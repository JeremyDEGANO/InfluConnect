"""
Additional views layered on top of the original `views.py` to implement the
features required by the InfluConnect CDC v2.0:

- Subscription plans listing / upgrades / cancellation
- Brand validation workflow (admin)
- Onboarding & Media Kit (influencer)
- Contract PDF generation + signature with IP audit
- Stripe-backed escrow (stub) + payment release
- Casting & Ambassador programs
- Social network OAuth stubs + stats sync
- Review moderation (admin)
- Audit log

All Stripe / Email / PDF heavy-lifting is delegated to ``api.services``.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.shortcuts import get_object_or_404
from django.http import FileResponse
from django.db.models import Q, Avg, Count
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .constants import (
    SUBSCRIPTION_PLANS, CONTENT_THEMES, CONTENT_TYPES, SOCIAL_PLATFORMS,
    PAYMENT_METHODS, LANGUAGES, CITIES_FR, COMPLETION_LABELS_FR,
        COUNTRIES, CITIES_BY_COUNTRY,
)
from .models import (
    AmbassadorProgram, AuditLog, BrandProfile, Campaign, CampaignProposal,
    CastingApplication, ContractTemplate, ContentSubmission, DirectMessage, InfluencerProfile,
    MediaKitImage, Notification, PlatformSettings, Review, SocialNetwork, User,
    BrandMembership, AgencyDelegation, SupportTicket, SupportTicketImage,
)
from .serializers import (
    AmbassadorProgramSerializer, AuditLogSerializer, BrandAdminSerializer,
    BrandProfileSerializer, CampaignProposalSerializer, CastingApplicationSerializer,
    ContractTemplateSerializer, InfluencerProfileSerializer, MediaKitImageSerializer,
    ReviewSerializer, SocialNetworkSerializer,
    BrandMembershipSerializer, AgencyDelegationSerializer,
    SupportTicketSerializer, SupportTicketAdminUpdateSerializer, SupportTicketImageSerializer,
    _validate_influencer_pseudo, suggest_influencer_pseudos,
)
from .services import email_service, stripe_service
from .services.completion import compute_influencer_completion
from .services.pdf_service import generate_contract_pdf, generate_media_kit_pdf


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _client_ip(request) -> str | None:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _audit(actor, action: str, target_type: str = "", target_id: int | None = None,
           metadata: dict | None = None, ip: str | None = None) -> None:
    AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata or {},
        ip_address=ip,
    )


def _notify(user, type_: str, title: str, message: str, proposal=None, send_email: bool = False,
            email_subject: str | None = None, email_body: str | None = None) -> None:
    notif = Notification.objects.create(
        user=user, notification_type=type_, title=title, message=message,
        related_proposal=proposal,
    )
    if send_email and user.email:
        ok = email_service.send(
            to=user.email,
            subject=email_subject or f"InfluConnect — {title}",
            body_text=email_body or message,
        )
        if ok:
            notif.email_sent = True
            notif.save(update_fields=["email_sent"])


# ---------------------------------------------------------------------------
# Reference data (subscription plans, content themes, …)
# ---------------------------------------------------------------------------
class SubscriptionPlansView(APIView):
    """Public list of subscription plans (CDC §9.1)."""
    permission_classes = []  # public

    def get(self, request):
        plans = []
        for plan in SUBSCRIPTION_PLANS.values():
            f = plan["features"]
            plans.append({
                "code": plan["id"],
                "name": plan["name"],
                "price_eur": plan["price_eur_monthly"],
                "features": {
                    "campaigns_per_month": "unlimited" if f["concurrent_campaigns"] == -1 else f["concurrent_campaigns"],
                    "contacts": "unlimited" if f["monthly_influencer_contacts"] == -1 else f["monthly_influencer_contacts"],
                    "analytics": "Avancées" if f["advanced_analytics"] else "Basiques",
                    "support": {
                        "none": "Standard",
                        "email_48h": "Email (48h)",
                        "email_phone_24h": "Email & Tél. (24h)",
                    }.get(f["priority_support"], "Standard"),
                    "custom_contracts": f["contract_templates_max"] != 0,
                    "dedicated_manager": f["dedicated_account_manager"],
                },
            })
        return Response({"plans": plans})


class StripeConfigView(APIView):
    """Public endpoint returning the Stripe publishable key + live mode flag."""
    permission_classes = []

    def get(self, request):
        from django.conf import settings
        from .services import stripe_service
        return Response({
            "publishable_key": getattr(settings, "STRIPE_PUBLISHABLE_KEY", "") or "",
            "live": stripe_service.is_live(),
        })


class ReferenceDataView(APIView):
    """Public list of static reference data used by the frontend forms."""
    permission_classes = []

    def get(self, request):
        return Response({
            # Front uses these keys (label = FR display, code = stored value)
            "themes": CONTENT_THEMES,
            "content_types": CONTENT_TYPES,
            "social_platforms": SOCIAL_PLATFORMS,
            "payment_methods": PAYMENT_METHODS,
            "languages": LANGUAGES,
            "cities": CITIES_FR,
                "countries": COUNTRIES,
                "cities_by_country": CITIES_BY_COUNTRY,
            "completion_labels": COMPLETION_LABELS_FR,
            # Legacy aliases (kept for backward-compat with older callers)
            "content_themes": CONTENT_THEMES,
        })


class InfluencerPseudoAvailabilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw_value = request.query_params.get("value") or request.query_params.get("pseudo") or ""
        profile = None
        if getattr(request.user, "user_type", None) == "influencer":
            try:
                profile = request.user.influencer_profile
            except InfluencerProfile.DoesNotExist:
                profile = None

        cleaned = (raw_value or "").strip()
        if not cleaned:
            return Response({
                "value": raw_value,
                "available": False,
                "valid": False,
                "normalized": "",
                "reason": "empty",
                "reason_code": "empty",
                "suggestions": [],
            })

        try:
            normalized = _validate_influencer_pseudo(cleaned, current_profile=profile)
            available = True
            reason = ""
            reason_code = "available"
            suggestions: list[str] = []
        except ValidationError as exc:
            normalized = cleaned
            available = False
            reason = str(exc.detail[0]) if getattr(exc, "detail", None) else "unavailable"
            lowered = reason.lower()
            if "reserved" in lowered:
                reason_code = "reserved"
            elif "taken" in lowered:
                reason_code = "taken"
            else:
                reason_code = "invalid"
            suggestions = suggest_influencer_pseudos(cleaned, current_profile=profile)

        return Response({
            "value": raw_value,
            "available": available,
            "valid": available,
            "normalized": normalized,
            "reason": reason,
            "reason_code": reason_code,
            "suggestions": suggestions,
        })


# ---------------------------------------------------------------------------
# Brand subscription management
# ---------------------------------------------------------------------------
class BrandSubscriptionChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.brand_profile
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)

        plan = request.data.get("plan")
        if plan not in SUBSCRIPTION_PLANS:
            return Response({"detail": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)

        # Stripe stub — create or update subscription
        if not profile.stripe_customer_id:
            profile.stripe_customer_id = stripe_service.create_customer(
                email=request.user.email,
                name=profile.company_name,
            )
        if profile.stripe_subscription_id:
            stripe_service.change_subscription_plan(
                profile.stripe_subscription_id, SUBSCRIPTION_PLANS[plan]["stripe_price_id"],
            )
            action = "subscription_changed"
        else:
            sub = stripe_service.create_subscription(
                profile.stripe_customer_id, SUBSCRIPTION_PLANS[plan]["stripe_price_id"],
            )
            profile.stripe_subscription_id = sub["id"]
            action = "subscription_created"

        profile.subscription_plan = plan
        profile.subscription_active = True
        profile.subscription_expires_at = timezone.now() + timedelta(days=30)
        profile.save()

        _audit(request.user, action, "BrandProfile", profile.id,
               metadata={"plan": plan}, ip=_client_ip(request))
        _notify(request.user, "subscription_changed", "Abonnement mis à jour",
                f"Votre abonnement a été modifié vers {SUBSCRIPTION_PLANS[plan]['name']}.",
                send_email=True)
        return Response(BrandProfileSerializer(profile).data)


class BrandSubscriptionCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.brand_profile
        if profile.stripe_subscription_id:
            stripe_service.cancel_subscription(profile.stripe_subscription_id)
        profile.subscription_active = False
        profile.save()
        _audit(request.user, "subscription_cancelled", "BrandProfile", profile.id,
               ip=_client_ip(request))
        return Response(BrandProfileSerializer(profile).data)


# ---------------------------------------------------------------------------
# Admin — brand validation workflow (CDC §5.1)
# ---------------------------------------------------------------------------
class SupportTicketListCreateView(generics.ListCreateAPIView):
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAuthenticated]

    def _target_lang(self):
        """Return the target language code based on the client's Accept-Language header."""
        accept = self.request.headers.get('Accept-Language', '').lower()
        if accept.startswith('en'):
            return 'EN'
        if accept.startswith('fr'):
            return 'FR'
        return ''

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['translate_to'] = self._target_lang()
        return ctx

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.user_type == "admin":
            return SupportTicket.objects.select_related("requester").all()
        return SupportTicket.objects.select_related("requester").filter(requester=self.request.user)

    def perform_create(self, serializer):
        accept = self.request.headers.get('Accept-Language', '').lower()
        source_language = 'EN' if accept.startswith('en') else 'FR' if accept.startswith('fr') else ''
        serializer.save(requester=self.request.user, source_language=source_language)


class SupportTicketImageUploadView(generics.CreateAPIView):
    """POST /support/tickets/<ticket_pk>/images/ — upload une image (max 5)."""
    serializer_class = SupportTicketImageSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_ticket(self):
        ticket = get_object_or_404(
            SupportTicket,
            pk=self.kwargs['ticket_pk'],
            requester=self.request.user,
        )
        return ticket

    def create(self, request, *args, **kwargs):
        ticket = self.get_ticket()
        if ticket.images.count() >= 5:
            return Response(
                {'detail': 'Maximum 5 images per ticket.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'detail': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)
        obj = SupportTicketImage.objects.create(ticket=ticket, image=image_file)
        serializer = SupportTicketImageSerializer(obj, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SupportTicketImageDownloadView(APIView):
    """Serve support images only to requester or admins."""
    permission_classes = [IsAuthenticated]

    def get(self, request, image_id):
        image = get_object_or_404(SupportTicketImage.objects.select_related('ticket__requester'), pk=image_id)
        ticket = image.ticket
        if not (request.user.is_staff or request.user.user_type == 'admin' or ticket.requester_id == request.user.id):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if not image.image:
            return Response({'detail': 'Image not found.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            image.image.open('rb'),
            as_attachment=False,
            filename=image.image.name.rsplit('/', 1)[-1],
        )


class SupportTicketFollowUpView(APIView):
    """Append a user follow-up note to an existing support ticket."""

    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_pk):
        ticket = get_object_or_404(
            SupportTicket,
            pk=ticket_pk,
            requester=self.request.user,
        )
        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'detail': 'No message provided.'}, status=status.HTTP_400_BAD_REQUEST)
        timestamp = timezone.now().strftime('%Y-%m-%d %H:%M')
        ticket.message = f"{ticket.message}\n\n[Suivi {timestamp}]\n{message}"
        if ticket.status == 'closed':
            ticket.status = 'open'
        ticket.save(update_fields=['message', 'status', 'updated_at'])
        return Response(SupportTicketSerializer(ticket, context={'request': request}).data, status=status.HTTP_200_OK)


class SupportTicketRatingView(APIView):
    """Store a final 1-5 rating for a closed support ticket."""

    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_pk):
        ticket = get_object_or_404(
            SupportTicket,
            pk=ticket_pk,
            requester=self.request.user,
        )
        if ticket.status != 'closed':
            return Response({'detail': 'Ticket must be closed before rating.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rating = int(request.data.get('rating'))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid rating.'}, status=status.HTTP_400_BAD_REQUEST)
        if rating < 1 or rating > 5:
            return Response({'detail': 'Rating must be between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)
        ticket.rating = rating
        ticket.rated_at = timezone.now()
        ticket.save(update_fields=['rating', 'rated_at', 'updated_at'])
        return Response(SupportTicketSerializer(ticket, context={'request': request}).data, status=status.HTTP_200_OK)


class AdminSupportTicketUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = SupportTicketAdminUpdateSerializer
    permission_classes = [IsAdminUser]
    queryset = SupportTicket.objects.select_related("requester").all()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        accept = self.request.headers.get('Accept-Language', '').lower()
        if accept.startswith('en'):
            ctx['translate_to'] = 'EN'
        elif accept.startswith('fr'):
            ctx['translate_to'] = 'FR'
        else:
            ctx['translate_to'] = ''
        return ctx


class AdminOverviewView(APIView):
    """Consolidated admin cockpit metrics + lists for operations."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if month_start.month == 12:
            next_month_start = month_start.replace(year=month_start.year + 1, month=1)
        else:
            next_month_start = month_start.replace(month=month_start.month + 1)

        plan_prices = {
            plan_id: Decimal(str(plan.get('price_eur_monthly', 0)))
            for plan_id, plan in SUBSCRIPTION_PLANS.items()
        }

        active_plan_counts = {
            plan_id: BrandProfile.objects.filter(
                subscription_active=True,
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }
        approved_not_active_plan_counts = {
            plan_id: BrandProfile.objects.filter(
                validation_status='approved',
                subscription_active=False,
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }
        pending_validation_plan_counts = {
            plan_id: BrandProfile.objects.filter(
                validation_status='pending',
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }
        pending_plan_counts = {
            plan_id: approved_not_active_plan_counts[plan_id] + pending_validation_plan_counts[plan_id]
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }

        agency_active_plan_counts = {
            plan_id: BrandProfile.objects.filter(
                is_agency=True,
                subscription_active=True,
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }
        agency_non_active_plan_counts = {
            plan_id: BrandProfile.objects.filter(
                is_agency=True,
                subscription_active=False,
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }

        projected_this_month = sum(
            int(active_plan_counts[plan_id] + approved_not_active_plan_counts[plan_id]) * plan_prices[plan_id]
            for plan_id in SUBSCRIPTION_PLANS.keys()
        )
        projected_next_month = sum(
            int(
                active_plan_counts[plan_id]
                + approved_not_active_plan_counts[plan_id]
                + pending_validation_plan_counts[plan_id]
            ) * plan_prices[plan_id]
            for plan_id in SUBSCRIPTION_PLANS.keys()
        )

        brands_qs = BrandProfile.objects.select_related('user', 'validated_by').annotate(
            active_members_count=Count('memberships', filter=Q(memberships__status='active'), distinct=True),
            campaigns_count=Count('campaigns', distinct=True),
        ).order_by('-user__created_at')

        users_qs = User.objects.select_related('brand_profile', 'influencer_profile').order_by('-created_at')

        support_open = SupportTicket.objects.exclude(status='closed').count()
        support_stale_48h = SupportTicket.objects.filter(
            status__in=['open', 'in_progress'],
            created_at__lt=now - timedelta(hours=48),
        ).count()

        proposal_status_counts = {
            row['status']: row['count']
            for row in CampaignProposal.objects.values('status').annotate(count=Count('id')).order_by()
        }

        brands_data = []
        for b in brands_qs:
            created_at = b.user.created_at
            days_since_signup = max((now - created_at).days, 0) if created_at else 0
            brands_data.append({
                'id': b.id,
                'company_name': b.company_name,
                'email': b.user.email,
                'owner_name': (f"{b.user.first_name} {b.user.last_name}".strip() or b.user.username),
                'website': b.website,
                'sector': b.sector,
                'siret': b.siret,
                'validation_status': b.validation_status,
                'subscription_plan': b.subscription_plan,
                'subscription_active': b.subscription_active,
                'subscription_expires_at': b.subscription_expires_at,
                'plan_price_monthly': float(plan_prices.get(b.subscription_plan or '', Decimal('0'))),
                'team_size': int(b.active_members_count or 0) + 1,
                'campaigns_count': int(b.campaigns_count or 0),
                'created_at': created_at,
                'days_since_signup': days_since_signup,
                'validated_by_username': b.validated_by.username if b.validated_by else '',
                'validation_notes': b.validation_notes,
            })

        users_data = []
        for u in users_qs:
            brand_profile = getattr(u, 'brand_profile', None)
            users_data.append({
                'id': u.id,
                'name': (f"{u.first_name} {u.last_name}".strip() or u.username),
                'email': u.email,
                'user_type': u.user_type,
                'is_active': u.is_active,
                'language_preference': u.language_preference,
                'phone': u.phone,
                'location': u.location,
                'totp_enabled': u.totp_enabled,
                'last_login': u.last_login,
                'created_at': u.created_at,
                'company_name': brand_profile.company_name if brand_profile else '',
                'subscription_plan': brand_profile.subscription_plan if brand_profile else '',
                'subscription_active': bool(brand_profile.subscription_active) if brand_profile else False,
            })

        return Response({
            'kpis': {
                'users_total': User.objects.count(),
                'users_new_last_30d': User.objects.filter(created_at__gte=now - timedelta(days=30)).count(),
                'brands_total': BrandProfile.objects.count(),
                'agencies_total': BrandProfile.objects.filter(is_agency=True).count(),
                'agencies_with_plan': BrandProfile.objects.filter(is_agency=True).exclude(subscription_plan__isnull=True).exclude(subscription_plan='').count(),
                'brands_pending_validation': BrandProfile.objects.filter(validation_status='pending').count(),
                'brands_active_subscription': BrandProfile.objects.filter(subscription_active=True).count(),
                'influencers_total': User.objects.filter(user_type='influencer').count(),
                'campaigns_total': Campaign.objects.count(),
                'campaigns_live': Campaign.objects.filter(status='active').count(),
                'support_tickets_open': support_open,
                'support_tickets_stale_48h': support_stale_48h,
            },
            'subscription_projection': {
                'currency': 'EUR',
                'month_start': month_start,
                'next_month_start': next_month_start,
                'projected_this_month': float(projected_this_month),
                'projected_next_month': float(projected_next_month),
                'delta_next_vs_this': float(projected_next_month - projected_this_month),
                'active_plan_counts': active_plan_counts,
                'pending_plan_counts': pending_plan_counts,
                'approved_not_active_plan_counts': approved_not_active_plan_counts,
                'pending_validation_plan_counts': pending_validation_plan_counts,
                'agency_active_plan_counts': agency_active_plan_counts,
                'agency_non_active_plan_counts': agency_non_active_plan_counts,
            },
            'proposal_status_counts': proposal_status_counts,
            'brands': brands_data,
            'users': users_data,
        })


class AdminUserStatusUpdateView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user.id == request.user.id:
            return Response({'detail': 'Cannot deactivate yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        is_active = request.data.get('is_active', None)
        if is_active is None:
            return Response({'detail': 'is_active is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = bool(is_active)
        user.save(update_fields=['is_active'])

        _audit(
            request.user,
            'admin_user_status_update',
            'User',
            user.id,
            metadata={'is_active': user.is_active},
            ip=_client_ip(request),
        )
        return Response({'id': user.id, 'is_active': user.is_active})


class AdminPendingBrandsView(generics.ListAPIView):
    serializer_class = BrandAdminSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        status_filter = self.request.query_params.get("status", "pending")
        qs = BrandProfile.objects.select_related("user", "validated_by").order_by("-id")
        if status_filter and status_filter != "all":
            qs = qs.filter(validation_status=status_filter)
        if status_filter == "pending":
            # Only expose brands that actually completed onboarding and submitted for review.
            ready_ids = []
            for profile in qs:
                if not _brand_missing_fields(profile):
                    ready_ids.append(profile.id)
            return BrandProfile.objects.select_related("user", "validated_by").filter(id__in=ready_ids).order_by("-id")
        return qs


class AdminBrandApproveView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            profile = BrandProfile.objects.select_related("user").get(pk=pk)
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        missing = _brand_missing_fields(profile)
        if missing:
            return Response(
                {"detail": "Brand onboarding is incomplete.", "missing_fields": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.validation_status = "approved"
        profile.validated_at = timezone.now()
        profile.validated_by = request.user
        # Auto-activate subscription on approval (Stripe stub charge would happen here)
        if profile.subscription_plan and not profile.subscription_active:
            if not profile.stripe_customer_id:
                profile.stripe_customer_id = stripe_service.create_customer(
                    email=profile.user.email, name=profile.company_name,
                )
            sub = stripe_service.create_subscription(
                profile.stripe_customer_id,
                SUBSCRIPTION_PLANS[profile.subscription_plan]["stripe_price_id"],
            )
            profile.stripe_subscription_id = sub["id"]
            profile.subscription_active = True
            profile.subscription_expires_at = timezone.now() + timedelta(days=30)
        profile.save()

        _audit(request.user, "brand_validated", "BrandProfile", profile.id,
               ip=_client_ip(request))
        _notify(profile.user, "brand_validated", "Compte validé",
                "Votre compte InfluConnect a été validé. Vous pouvez maintenant créer vos campagnes.",
                send_email=True,
                email_body=email_service.send_brand_validated.__doc__ or
                          "Votre compte InfluConnect a été validé.")
        # Use dedicated template
        email_service.send_brand_validated(profile.user.email, profile.company_name)
        return Response(BrandAdminSerializer(profile).data)


class AdminBrandRejectView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            profile = BrandProfile.objects.select_related("user").get(pk=pk)
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response({"detail": "reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        profile.validation_status = "rejected"
        profile.validation_notes = reason
        profile.validated_at = timezone.now()
        profile.validated_by = request.user
        profile.save()

        _audit(request.user, "brand_rejected", "BrandProfile", profile.id,
               metadata={"reason": reason}, ip=_client_ip(request))
        _notify(profile.user, "brand_rejected", "Inscription refusée",
                f"Motif : {reason}", send_email=True)
        email_service.send_brand_rejected(profile.user.email, profile.company_name, reason)
        return Response(BrandAdminSerializer(profile).data)


# ---------------------------------------------------------------------------
# Brand onboarding (CDC §5.1) — required fields & submit-for-validation
# ---------------------------------------------------------------------------
BRAND_REQUIRED_FIELDS = ["company_name", "siret", "website", "sector", "description", "logo"]


def _brand_missing_fields(profile):
    missing = []
    for f in BRAND_REQUIRED_FIELDS:
        val = getattr(profile, f, None)
        if f == "logo":
            if not val:
                missing.append(f)
        else:
            if not (val or "").strip() if isinstance(val, str) else not val:
                missing.append(f)
    return missing


class BrandOnboardingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.brand_profile
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)
        missing = _brand_missing_fields(profile)
        effective_status = profile.validation_status
        # A newly created brand can start with DB status=pending; expose it as draft
        # until onboarding is complete and explicitly submitted.
        if profile.validation_status == "pending" and missing:
            effective_status = "draft"
        return Response({
            "validation_status": effective_status,
            "validation_notes": profile.validation_notes,
            "missing_fields": missing,
            "ready_to_submit": len(missing) == 0,
            "can_create_campaigns": profile.validation_status == "approved",
        })


class BrandSubmitForValidationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.brand_profile
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)
        if profile.validation_status == "approved":
            return Response({"detail": "Already approved."}, status=status.HTTP_400_BAD_REQUEST)
        missing = _brand_missing_fields(profile)
        if missing:
            return Response(
                {"detail": "Missing required fields.", "missing_fields": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Reset to pending (covers re-submission after rejection)
        profile.validation_status = "pending"
        profile.validation_notes = ""
        profile.validated_at = None
        profile.validated_by = None
        profile.save(update_fields=[
            "validation_status", "validation_notes", "validated_at", "validated_by",
        ])
        _audit(request.user, "brand_submitted_for_validation", "BrandProfile", profile.id,
               ip=_client_ip(request))
        return Response({
            "validation_status": profile.validation_status,
            "missing_fields": [],
            "ready_to_submit": True,
            "can_create_campaigns": False,
        })


# ---------------------------------------------------------------------------
# Influencer onboarding & Media Kit (CDC §4.1 & §4.2)
# ---------------------------------------------------------------------------
class InfluencerOnboardingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.influencer_profile
        completion = compute_influencer_completion(profile)
        if profile.profile_completion_percent != completion:
            profile.profile_completion_percent = completion
            if completion >= 80 and not profile.onboarding_completed:
                profile.onboarding_completed = True
            profile.save(update_fields=["profile_completion_percent", "onboarding_completed"])
        return Response({
            "completion_percent": completion,
            "onboarding_completed": profile.onboarding_completed,
            "missing_fields": _missing_fields(profile),
        })


def _missing_fields(profile) -> list[str]:
    user = profile.user
    missing: list[str] = []
    if not user.avatar:
        missing.append("avatar")
    if not profile.bio or len(profile.bio.strip()) < 10:
        missing.append("bio")
    if not profile.display_name:
        missing.append("display_name")
    if not user.location:
        missing.append("location")
    if not profile.languages:
        missing.append("languages")
    if not profile.content_themes:
        missing.append("content_themes")
    if not profile.content_types_offered:
        missing.append("content_types_offered")
    if not profile.pricing:
        missing.append("pricing")
    if not profile.social_networks.exists():
        missing.append("social_networks")
    if not profile.media_kit_images.exists():
        missing.append("media_kit_images")
    if not profile.collaboration_pitch or len(profile.collaboration_pitch.strip()) < 20:
        missing.append("collaboration_pitch")
    if not (profile.payment_method and profile.payment_details):
        missing.append("payment_method")
    return missing


class MediaKitGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.influencer_profile
        completion = compute_influencer_completion(profile)
        if completion < 80:
            return Response(
                {"detail": "Profile must be at least 80% complete.", "completion": completion},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not profile.collaboration_pitch or len(profile.collaboration_pitch.strip()) < 20:
            return Response(
                {"detail": "Remplissez la case 'Pourquoi collaborer avec vous ?' dans votre profil avant de générer le kit média."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            pdf_bytes = generate_media_kit_pdf(profile=profile)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"PDF generation failed: {exc}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        filename = f"media_kit_{profile.id}_{timezone.now():%Y%m%d_%H%M%S}.pdf"
        profile.media_kit_pdf.save(filename, ContentFile(pdf_bytes), save=False)
        profile.media_kit_generated_at = timezone.now()
        profile.media_kit_is_custom = False
        profile.profile_completion_percent = completion
        profile.onboarding_completed = True
        profile.save()
        return Response(InfluencerProfileSerializer(profile).data)


class MediaKitUploadView(APIView):
    """Allow influencer to upload their own media kit PDF (overrides generator)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "file is required."}, status=status.HTTP_400_BAD_REQUEST)
        # Validation: type + size (max 10 MB)
        name_lower = (f.name or "").lower()
        ctype = (f.content_type or "").lower()
        if not name_lower.endswith(".pdf") or "pdf" not in ctype:
            return Response({"detail": "Only PDF files are accepted."}, status=status.HTTP_400_BAD_REQUEST)
        if f.size and f.size > 10 * 1024 * 1024:
            return Response({"detail": "File too large (10 MB max)."}, status=status.HTTP_400_BAD_REQUEST)
        profile = request.user.influencer_profile
        filename = f"media_kit_custom_{profile.id}_{timezone.now():%Y%m%d_%H%M%S}.pdf"
        profile.media_kit_pdf.save(filename, f, save=False)
        profile.media_kit_generated_at = timezone.now()
        profile.media_kit_is_custom = True
        profile.save(update_fields=["media_kit_pdf", "media_kit_generated_at", "media_kit_is_custom"])
        return Response(InfluencerProfileSerializer(profile, context={"request": request}).data)

    def delete(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.influencer_profile
        if profile.media_kit_pdf:
            profile.media_kit_pdf.delete(save=False)
        profile.media_kit_pdf = None
        profile.media_kit_generated_at = None
        profile.media_kit_is_custom = False
        profile.save(update_fields=["media_kit_pdf", "media_kit_generated_at", "media_kit_is_custom"])
        return Response({"detail": "Media kit removed."})


# ---------------------------------------------------------------------------
# Contract generation & signature (CDC §6)
# ---------------------------------------------------------------------------
class ProposalGenerateContractView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.select_related(
                "campaign__brand", "campaign__contract_template", "influencer__user", "contract_template"
            ).get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        # only the brand for this proposal can request generation
        if (request.user.user_type != "brand"
                or proposal.campaign.brand.user_id != request.user.id):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status not in ("accepted", "counter_offer"):
            return Response({"detail": "Proposal must be accepted first."},
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Optional: brand can specify which template to use
        template_id = request.data.get("template_id")
        if template_id:
            try:
                template = ContractTemplate.objects.get(pk=template_id, brand=proposal.campaign.brand)
                proposal.contract_template = template
            except ContractTemplate.DoesNotExist:
                return Response({"detail": "Template not found or unauthorized."},
                                status=status.HTTP_400_BAD_REQUEST)
        # If no template specified, use the campaign template first, then the brand default.
        elif not proposal.contract_template:
            campaign_template = getattr(proposal.campaign, "contract_template", None)
            if campaign_template and campaign_template.brand_id == proposal.campaign.brand_id:
                proposal.contract_template = campaign_template
            else:
                default_template = ContractTemplate.objects.filter(
                    brand=proposal.campaign.brand, is_default=True
                ).first()
                if default_template:
                    proposal.contract_template = default_template
        
        try:
            pdf = generate_contract_pdf(proposal=proposal)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"PDF generation failed: {exc}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        filename = f"contract_prop_{proposal.id}_v{proposal.contract_version}.pdf"
        proposal.contract_pdf.save(filename, ContentFile(pdf), save=False)
        proposal.save()
        # Only notify influencer that contract is ready for signing
        _notify(proposal.influencer.user, "contract_ready", "Contrat prêt à signer",
                f"La marque a généré le contrat pour « {proposal.campaign.title} ». "
                f"Veuillez le relire et le signer.",
                proposal=proposal, send_email=True)
        return Response(CampaignProposalSerializer(proposal).data)


# ---------------------------------------------------------------------------
# Casting (CDC §10.5)
# ---------------------------------------------------------------------------
class CastingListView(generics.ListAPIView):
    """Public castings — open opportunities for influencers to apply to."""
    serializer_class = None  # uses CampaignSerializer indirectly
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        from .serializers import CampaignSerializer
        qs = Campaign.objects.filter(is_casting=True, status="active").order_by("-created_at")
        return Response(CampaignSerializer(qs, many=True, context={"request": request}).data)


class CastingApplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            campaign = Campaign.objects.get(pk=pk, is_casting=True)
        except Campaign.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        profile = request.user.influencer_profile
        if CastingApplication.objects.filter(campaign=campaign, influencer=profile).exists():
            return Response({"detail": "Already applied."}, status=status.HTTP_400_BAD_REQUEST)
        motivation = request.data.get("motivation", "")
        if not motivation:
            return Response({"detail": "motivation is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        app = CastingApplication.objects.create(
            campaign=campaign, influencer=profile,
            motivation=motivation,
            examples=request.data.get("examples", []),
        )
        _notify(campaign.brand.user, "casting_application", "Nouvelle candidature",
                f"{profile.display_name or request.user.username} a postulé à « {campaign.title} ».",
                send_email=True)
        return Response(CastingApplicationSerializer(app).data, status=status.HTTP_201_CREATED)


class CastingApplicationsListView(generics.ListAPIView):
    """Brand-side: list applications received for a casting campaign."""
    serializer_class = CastingApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pk = self.kwargs["pk"]
        user = self.request.user
        if user.user_type != "brand":
            return CastingApplication.objects.none()
        try:
            campaign = Campaign.objects.get(pk=pk, brand__user=user)
        except Campaign.DoesNotExist:
            return CastingApplication.objects.none()
        return CastingApplication.objects.filter(campaign=campaign).select_related(
            "influencer__user"
        ).order_by("-created_at")


class CastingApplicationDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            app = CastingApplication.objects.select_related(
                "campaign__brand", "influencer__user"
            ).get(pk=pk)
        except CastingApplication.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if (request.user.user_type != "brand"
                or app.campaign.brand.user_id != request.user.id):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        decision = request.data.get("decision")
        if decision not in ("selected", "rejected"):
            return Response({"detail": "Invalid decision."}, status=status.HTTP_400_BAD_REQUEST)
        app.status = decision
        app.decided_at = timezone.now()
        app.save()
        if decision == "selected":
            CampaignProposal.objects.get_or_create(
                campaign=app.campaign, influencer=app.influencer,
                defaults={
                    "proposed_price": app.campaign.price_per_influencer or 0,
                    "contract_template": app.campaign.contract_template,
                },
            )
        return Response(CastingApplicationSerializer(app).data)


# ---------------------------------------------------------------------------
# Media kit gallery images (portfolio uploads included in PDF)
# ---------------------------------------------------------------------------
class MediaKitImageViewSet(viewsets.ModelViewSet):
    serializer_class = MediaKitImageSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = []  # set in __init__ to avoid import cycle

    def get_parsers(self):
        from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
        return [MultiPartParser(), FormParser(), JSONParser()]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "user_type", None) != "influencer":
            return MediaKitImage.objects.none()
        return MediaKitImage.objects.filter(influencer__user=user)

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        user = self.request.user
        if getattr(user, "user_type", None) != "influencer":
            raise PermissionDenied("Only influencers can upload media kit images.")
        profile = user.influencer_profile
        if profile.media_kit_images.count() >= 3:
            raise ValidationError({"detail": "Maximum of 3 portfolio images reached."})
        serializer.save(influencer=profile)

    def perform_destroy(self, instance):
        if instance.influencer.user_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Forbidden.")
        if instance.image:
            instance.image.delete(save=False)
        instance.delete()


# ---------------------------------------------------------------------------
# Ambassador programs (CDC §10.1)
# ---------------------------------------------------------------------------
class AmbassadorProgramViewSet(viewsets.ModelViewSet):
    serializer_class = AmbassadorProgramSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "brand":
            return AmbassadorProgram.objects.filter(brand__user=user).order_by("-created_at")
        if user.user_type == "influencer":
            return AmbassadorProgram.objects.filter(influencer__user=user).order_by("-created_at")
        return AmbassadorProgram.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only brands can create ambassador programs.")
        serializer.save(brand=self.request.user.brand_profile)


# ---------------------------------------------------------------------------
# Contract templates (CDC §6.3 — Growth/Pro only)
# ---------------------------------------------------------------------------
class ContractTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = ContractTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.user_type != "brand":
            return ContractTemplate.objects.none()
        return ContractTemplate.objects.filter(brand__user=self.request.user).order_by("-id")

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only brands can manage contract templates.")
        profile = self.request.user.brand_profile
        if profile.subscription_plan not in ("growth", "pro"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Templates are only available on Growth and Pro plans.")
        serializer.save(brand=profile)

    @staticmethod
    def _docx_to_html(file_obj) -> str:
        try:
            import mammoth
        except ImportError:
            return ""
        try:
            result = mammoth.convert_to_html(file_obj)
        except Exception:
            return ""
        return result.value or ""

    @staticmethod
    def _pdf_to_html(file_obj) -> str:
        try:
            from pypdf import PdfReader
        except ImportError:
            return ""
        try:
            reader = PdfReader(file_obj)
        except Exception:
            return ""
        parts: list[str] = []
        for page in reader.pages:
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            for para in text.split("\n\n"):
                para = para.strip()
                if para:
                    # escape basic HTML, convert single \n to <br/>
                    import html as _html
                    safe = _html.escape(para).replace("\n", "<br/>")
                    parts.append(f"<p>{safe}</p>")
        return "\n".join(parts)

    def _import(self, request):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        if request.user.user_type != "brand":
            raise PermissionDenied("Only brands can import templates.")
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "No file provided."})
        name = (upload.name or "").lower()
        if name.endswith(".docx"):
            html = self._docx_to_html(upload)
            kind = "docx"
        elif name.endswith(".pdf"):
            upload.seek(0)
            html = self._pdf_to_html(upload)
            kind = "pdf"
        else:
            raise ValidationError({"file": "Only .docx or .pdf files are supported."})

        if not html.strip():
            raise ValidationError({
                "file": "Could not extract content from this file. Please verify the file is a valid .docx/.pdf document.",
            })

        upload.seek(0)
        return Response({"body_html": html, "format": kind, "filename": upload.name})

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def import_document(self, request):
        return self._import(request)

    @action(detail=True, methods=["get"], url_path="source-file")
    def source_file(self, request, pk=None):
        template = self.get_object()
        if not template.source_file:
            return Response({'detail': 'File not found.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            template.source_file.open('rb'),
            as_attachment=False,
            filename=template.source_file.name.rsplit('/', 1)[-1],
        )


# ---------------------------------------------------------------------------
# Social network OAuth + stats sync (CDC §8)
#
# Real OAuth flow:
#   1. POST /api/social-networks/<pk>/oauth-start/ → returns authorize_url
#   2. User is redirected to the platform, approves access
#   3. Platform redirects to /api/social/oauth/callback/<platform>/?code=...&state=...
#   4. Backend exchanges code → encrypts tokens → fetches stats → redirects to
#      frontend at /influencer/profile?social_connected=<platform>
#   5. POST /api/social-networks/<pk>/sync/ refreshes stats on demand
#
# When credentials are not configured for a platform, the view falls back to
# the legacy stub mode (manual stats only, verified_via_api=True for demo).
# ---------------------------------------------------------------------------
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.shortcuts import redirect

from .services.social import get_provider, ProviderError
from .services.social.tokens import decrypt_token, encrypt_token

OAUTH_STATE_MAX_AGE = 600  # seconds (10 min to complete the flow)


def _state_signer() -> TimestampSigner:
    return TimestampSigner(salt="social-oauth")


def _redirect_uri(platform: str) -> str:
    base = getattr(settings, "SOCIAL_OAUTH_REDIRECT_BASE", "http://localhost:8000").rstrip("/")
    return f"{base}/api/social/oauth/callback/{platform}/"


def _save_tokens(sn: SocialNetwork, tokens):
    sn.oauth_access_token = encrypt_token(tokens.access_token)
    sn.oauth_refresh_token = encrypt_token(tokens.refresh_token) if tokens.refresh_token else ""
    if tokens.expires_in:
        sn.oauth_expires_at = timezone.now() + timedelta(seconds=int(tokens.expires_in))
    else:
        sn.oauth_expires_at = None


def _apply_stats(sn: SocialNetwork, stats):
    sn.followers_count = stats.followers_count
    sn.avg_views = stats.avg_views
    sn.engagement_rate = Decimal(str(stats.engagement_rate))
    if stats.profile_url:
        sn.profile_url = stats.profile_url
    sn.last_synced_at = timezone.now()
    sn.verified_via_api = True


class SocialPlatformsView(APIView):
    """Public listing of platforms with OAuth credentials configured."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        from .services.social import available_platforms
        configured = available_platforms()
        return Response({
            "configured": configured,
            "platforms": {
                p: {"oauth_enabled": p in configured}
                for p in ("youtube", "tiktok", "instagram", "facebook", "twitch")
            },
        })


class SocialOAuthStartView(APIView):
    """Return the OAuth authorize URL for the requested social network."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            sn = SocialNetwork.objects.get(pk=pk, influencer__user=request.user)
        except SocialNetwork.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        provider = get_provider(sn.platform)
        if provider is None:
            # Stub fallback — legacy behaviour for unconfigured platforms.
            return Response({
                "platform": sn.platform,
                "configured": False,
                "oauth_url": f"https://oauth.influconnect.fr/{sn.platform}/start?sn={sn.id}",
                "note": (
                    f"OAuth credentials not configured for {sn.platform}. "
                    "Set the corresponding env vars (e.g. YOUTUBE_CLIENT_ID/SECRET) "
                    "and restart the backend to enable the real flow."
                ),
            })

        state = _state_signer().sign(f"{request.user.id}:{sn.id}:{sn.platform}")
        redirect_uri = _redirect_uri(sn.platform)
        try:
            url = provider.get_authorize_url(state, redirect_uri)
        except ProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({
            "platform": sn.platform,
            "configured": True,
            "oauth_url": url,
            "redirect_uri": redirect_uri,
        })


class SocialOAuthCallbackView(APIView):
    """Public callback endpoint hit by the OAuth provider after user consent."""
    permission_classes = []  # public — security is provided by the signed state.
    authentication_classes = []

    def get(self, request, platform):
        frontend = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        target = f"{frontend}/influencer/profile"

        error = request.query_params.get("error")
        if error:
            return redirect(f"{target}?social_error={platform}&reason={error}")

        code = request.query_params.get("code")
        state = request.query_params.get("state")
        if not code or not state:
            return redirect(f"{target}?social_error={platform}&reason=missing_code")

        try:
            unsigned = _state_signer().unsign(state, max_age=OAUTH_STATE_MAX_AGE)
        except SignatureExpired:
            return redirect(f"{target}?social_error={platform}&reason=expired")
        except BadSignature:
            return redirect(f"{target}?social_error={platform}&reason=bad_state")

        try:
            user_id_str, sn_id_str, expected_platform = unsigned.split(":")
        except ValueError:
            return redirect(f"{target}?social_error={platform}&reason=bad_state")
        if expected_platform != platform:
            return redirect(f"{target}?social_error={platform}&reason=platform_mismatch")

        try:
            sn = SocialNetwork.objects.get(pk=int(sn_id_str), influencer__user_id=int(user_id_str))
        except SocialNetwork.DoesNotExist:
            return redirect(f"{target}?social_error={platform}&reason=not_found")

        provider = get_provider(platform)
        if provider is None:
            return redirect(f"{target}?social_error={platform}&reason=not_configured")

        try:
            tokens = provider.exchange_code(code, _redirect_uri(platform))
            stats = provider.fetch_stats(tokens)
        except ProviderError as exc:
            return redirect(f"{target}?social_error={platform}&reason=api_error&detail={exc}")

        _save_tokens(sn, tokens)
        _apply_stats(sn, stats)
        sn.save()
        return redirect(f"{target}?social_connected={platform}")


class SocialSyncView(APIView):
    """Refresh stats on demand using the stored OAuth token."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            sn = SocialNetwork.objects.get(pk=pk, influencer__user=request.user)
        except SocialNetwork.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        provider = get_provider(sn.platform)
        access_token = decrypt_token(sn.oauth_access_token) if sn.oauth_access_token else None

        if provider is None or not access_token:
            # Stub fallback — keep old behaviour so demo still works.
            sn.last_synced_at = timezone.now()
            sn.verified_via_api = True
            sn.save(update_fields=["last_synced_at", "verified_via_api"])
            return Response({
                **SocialNetworkSerializer(sn).data,
                "stub": True,
                "detail": (
                    "Sync simulée — connecte d'abord ton compte via OAuth pour "
                    "importer les vraies statistiques."
                ),
            })

        # Refresh the access token if it has expired.
        from .services.social.base import TokenBundle
        tokens = TokenBundle(
            access_token=access_token,
            refresh_token=decrypt_token(sn.oauth_refresh_token) or "",
            expires_in=None,
        )
        if sn.oauth_expires_at and sn.oauth_expires_at <= timezone.now() and tokens.refresh_token:
            try:
                tokens = provider.refresh_access_token(tokens.refresh_token)
                _save_tokens(sn, tokens)
            except (NotImplementedError, ProviderError):
                pass

        try:
            stats = provider.fetch_stats(tokens)
        except ProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        _apply_stats(sn, stats)
        sn.save()
        return Response(SocialNetworkSerializer(sn).data)


# ---------------------------------------------------------------------------
# Review moderation (CDC §4.6 & §5.8)
# ---------------------------------------------------------------------------
class AdminReviewModerationListView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return Review.objects.filter(is_published=False).order_by("-created_at")


class AdminReviewPublishView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            review = Review.objects.get(pk=pk)
        except Review.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        review.is_published = True
        review.moderated_by = request.user
        review.moderated_at = timezone.now()
        review.save()
        _audit(request.user, "review_moderated", "Review", review.id,
               metadata={"action": "publish"}, ip=_client_ip(request))
        return Response(ReviewSerializer(review).data)


class AdminReviewRejectView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            review = Review.objects.get(pk=pk)
        except Review.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        review.delete()
        _audit(request.user, "review_moderated", "Review", pk,
               metadata={"action": "reject"}, ip=_client_ip(request))
        return Response({"detail": "deleted"})


# ---------------------------------------------------------------------------
# Audit log (admin)
# ---------------------------------------------------------------------------
class AdminAuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor")
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        return qs


# ---------------------------------------------------------------------------
# Stripe Webhook stub
# ---------------------------------------------------------------------------
class StripeWebhookView(APIView):
    """Stub Stripe webhook receiver. In live mode, verify the signature using
    settings.STRIPE_WEBHOOK_SECRET before processing."""
    permission_classes = []

    def post(self, request):
        # In live mode:
        # event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        # then handle event.type accordingly.
        return Response({"received": True})


# ---------------------------------------------------------------------------
# Influencer Stripe Connect onboarding (stub)
# ---------------------------------------------------------------------------
class InfluencerStripeOnboardView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.influencer_profile
        if not profile.stripe_account_id:
            acct = stripe_service.create_connected_account(email=request.user.email)
            profile.stripe_account_id = acct["id"]
            profile.stripe_onboarding_url = acct["onboarding_url"]
            profile.save()
        return Response({
            "stripe_account_id": profile.stripe_account_id,
            "onboarding_url": profile.stripe_onboarding_url,
        })


# ---------------------------------------------------------------------------
# Public marketplace (CDC §10.8) — list verified influencers without auth
# ---------------------------------------------------------------------------
class PublicMarketplaceView(generics.ListAPIView):
    serializer_class = InfluencerProfileSerializer
    permission_classes = []

    def get_queryset(self):
        return InfluencerProfile.objects.filter(
            user__user_type="influencer",
        ).select_related("user").prefetch_related("social_networks").order_by("-user__created_at", "-id")


class MarketplaceContactInfluencerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != "brand":
            return Response({"detail": "Only brands can contact influencers."}, status=status.HTTP_403_FORBIDDEN)

        try:
            brand = user.brand_profile
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)

        if brand.validation_status != "approved":
            return Response(
                {"detail": "Brand profile must be approved before contacting influencers."},
                status=status.HTTP_403_FORBIDDEN,
            )

        influencer_id = request.data.get("influencer_id")
        message = (request.data.get("message") or "").strip()
        if not influencer_id:
            return Response({"detail": "influencer_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(message) < 10:
            return Response({"detail": "Message must contain at least 10 characters."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            influencer = InfluencerProfile.objects.select_related("user").get(pk=influencer_id)
        except InfluencerProfile.DoesNotExist:
            return Response({"detail": "Influencer not found."}, status=status.HTTP_404_NOT_FOUND)

        sender_name = (brand.company_name or user.username).strip()
        
        # Create DirectMessage
        DirectMessage.objects.create(
            sender=user,
            recipient=influencer.user,
            content=message
        )
        
        _notify(
            influencer.user,
            "new_message",
            "Nouveau message marketplace",
            f"{sender_name} vous a contacté via la marketplace :\n\n{message}",
            send_email=bool(influencer.user.email),
            email_subject="InfluConnect — Nouveau contact marque",
            email_body=(
                f"Bonjour,\n\n"
                f"{sender_name} vous a contacté via la marketplace InfluConnect :\n\n"
                f"{message}\n\n"
                "Connectez-vous à InfluConnect pour répondre et proposer une collaboration."
            ),
        )
        _audit(
            user,
            "marketplace_contact_influencer",
            "InfluencerProfile",
            influencer.id,
            metadata={"brand_id": brand.id},
            ip=_client_ip(request),
        )

        return Response({"sent": True}, status=status.HTTP_201_CREATED)

from ._views_team_agency import (
    BrandMembershipListCreateView, BrandMembershipDetailView,
    AgencyDelegationListCreateView, AgencyDelegationActionView,
)

