from decimal import Decimal
from django.conf import settings as django_settings
from django.core.files.base import ContentFile
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q, Sum, Avg
from rest_framework import generics, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    User, InfluencerProfile, SocialNetwork, BrandProfile,
    Campaign, CampaignProposal, ContentSubmission,
    Message, Review, Notification, PlatformSettings, AuditLog,
)
from .serializers import (
    UserSerializer, InfluencerProfileSerializer, InfluencerProfileWithPaymentSerializer,
    SocialNetworkSerializer, BrandProfileSerializer,
    CampaignSerializer, CampaignProposalSerializer, ContentSubmissionSerializer,
    MessageSerializer, ReviewSerializer, NotificationSerializer, PlatformSettingsSerializer,
    RegisterSerializer, LoginSerializer,
)
from .services import email_service, stripe_service
from .services.pdf_service import generate_contract_pdf


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _audit(actor, action, target_type="", target_id=None, metadata=None, ip=None):
    AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        action=action, target_type=target_type, target_id=target_id,
        metadata=metadata or {}, ip_address=ip,
    )


def create_notification(user, notification_type, title, message, proposal=None):
    Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        related_proposal=proposal,
    )


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def _update_average_rating(user):
    avg = Review.objects.filter(reviewee=user).aggregate(avg=Avg("rating"))["avg"] or 0
    avg = round(float(avg), 2)
    if user.user_type == "influencer" and hasattr(user, "influencer_profile"):
        user.influencer_profile.average_rating = avg
        user.influencer_profile.save(update_fields=["average_rating"])
    elif user.user_type == "brand" and hasattr(user, "brand_profile"):
        user.brand_profile.average_rating = avg
        user.brand_profile.save(update_fields=["average_rating"])


# ---------------------------------------------------------------------------
# Auth views
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            # CDC §5.1 — brand registration kicks off the validation workflow
            if user.user_type == "brand":
                profile = user.brand_profile
                email_service.send_brand_registration_received(user.email, profile.company_name)
                admin_emails = list(getattr(django_settings, "ADMIN_NOTIFICATION_EMAILS", []) or [])
                if not admin_emails:
                    admin_emails = list(
                        User.objects.filter(user_type="admin").values_list("email", flat=True)
                    )
                if admin_emails:
                    email_service.send_admin_new_brand_to_validate(
                        admin_emails, profile.company_name, profile.id,
                    )
            return Response(
                {"user": UserSerializer(user).data, **tokens},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            # 2FA gate: if enabled, require a valid TOTP code in the same request
            if user.totp_enabled:
                from .views_auth import verify_user_totp
                code = (request.data.get("totp_code") or "").strip()
                if not code:
                    return Response(
                        {"totp_required": True},
                        status=status.HTTP_200_OK,
                    )
                if not verify_user_totp(user, code):
                    return Response(
                        {"totp_required": True, "detail": "Invalid verification code."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            tokens = get_tokens_for_user(user)
            return Response({"user": UserSerializer(user).data, **tokens})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        user = request.user
        user_data = {k: v for k, v in request.data.items()
                     if k not in ("influencer_profile", "brand_profile")}
        user_serializer = UserSerializer(user, data=user_data, partial=True)
        if not user_serializer.is_valid():
            return Response(user_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user_serializer.save()

        if user.user_type == "influencer" and hasattr(user, "influencer_profile"):
            profile_data = request.data.get("influencer_profile", {})
            if profile_data:
                ps = InfluencerProfileWithPaymentSerializer(
                    user.influencer_profile, data=profile_data, partial=True
                )
                if not ps.is_valid():
                    return Response(ps.errors, status=status.HTTP_400_BAD_REQUEST)
                ps.save()
        elif user.user_type == "brand" and hasattr(user, "brand_profile"):
            profile_data = request.data.get("brand_profile", {})
            if profile_data:
                ps = BrandProfileSerializer(user.brand_profile, data=profile_data, partial=True)
                if not ps.is_valid():
                    return Response(ps.errors, status=status.HTTP_400_BAD_REQUEST)
                ps.save()

        return Response(UserSerializer(user).data)


# ---------------------------------------------------------------------------
# Influencer views
# ---------------------------------------------------------------------------

class InfluencerListView(generics.ListAPIView):
    serializer_class = InfluencerProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = InfluencerProfile.objects.select_related("user").prefetch_related("social_networks")
        if self.request.user.user_type == "brand":
            qs = qs.filter(is_verified=True)

        platform = self.request.query_params.get("platform")
        if platform:
            qs = qs.filter(social_networks__platform=platform)

        min_followers = self.request.query_params.get("min_followers")
        if min_followers:
            try:
                qs = qs.filter(social_networks__followers_count__gte=int(min_followers))
            except ValueError:
                pass

        content_themes = self.request.query_params.get("content_themes")
        if content_themes:
            for theme in content_themes.split(","):
                qs = qs.filter(content_themes__contains=theme.strip())

        min_rating = self.request.query_params.get("min_rating")
        if min_rating:
            try:
                qs = qs.filter(average_rating__gte=float(min_rating))
            except ValueError:
                pass

        location = self.request.query_params.get("location")
        if location:
            qs = qs.filter(user__location__icontains=location)

        return qs.distinct()


class InfluencerDetailView(generics.RetrieveAPIView):
    queryset = InfluencerProfile.objects.select_related("user").prefetch_related("social_networks")
    serializer_class = InfluencerProfileSerializer
    permission_classes = [IsAuthenticated]


class InfluencerProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_profile(self, request):
        if request.user.user_type != "influencer":
            return None
        try:
            return request.user.influencer_profile
        except InfluencerProfile.DoesNotExist:
            return None

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        profile = self._get_profile(request)
        if profile is None:
            return Response({"detail": "Influencer profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = InfluencerProfileWithPaymentSerializer(profile, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InfluencerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.influencer_profile
        except InfluencerProfile.DoesNotExist:
            return Response({"detail": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

        proposals = CampaignProposal.objects.filter(influencer=profile)
        total_earnings = proposals.filter(status="paid").aggregate(
            total=Sum("escrow_amount")
        )["total"] or 0

        # Monthly timeseries (last 6 months) — new proposals, earnings
        now = timezone.now()
        months = []
        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            label = month_start.strftime("%b %Y")
            prop_count = proposals.filter(
                created_at__gte=month_start, created_at__lt=next_month
            ).count()
            earnings = proposals.filter(
                status="paid",
                escrow_released_at__gte=month_start, escrow_released_at__lt=next_month,
            ).aggregate(total=Sum("escrow_amount"))["total"] or 0
            months.append({
                "label": label,
                "proposals": prop_count,
                "earnings": float(earnings),
            })

        return Response({
            "total_proposals": proposals.count(),
            "pending_proposals": proposals.filter(status="pending").count(),
            "active_proposals": proposals.filter(
                status__in=["accepted", "contract_signed", "in_progress", "content_submitted"]
            ).count(),
            "total_earnings": float(total_earnings),
            "timeseries": months,
            "recent_proposals": CampaignProposalSerializer(
                proposals.order_by("-created_at")[:5], many=True
            ).data,
        })


class SocialNetworkViewSet(viewsets.ModelViewSet):
    serializer_class = SocialNetworkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.user_type != "influencer":
            return SocialNetwork.objects.none()
        try:
            return self.request.user.influencer_profile.social_networks.all()
        except InfluencerProfile.DoesNotExist:
            return SocialNetwork.objects.none()

    def perform_create(self, serializer):
        if self.request.user.user_type != "influencer":
            raise PermissionDenied("Only influencers can manage social networks.")
        serializer.save(influencer=self.request.user.influencer_profile)


# ---------------------------------------------------------------------------
# Brand views
# ---------------------------------------------------------------------------

class BrandDetailView(generics.RetrieveAPIView):
    queryset = BrandProfile.objects.select_related("user")
    serializer_class = BrandProfileSerializer
    permission_classes = [IsAuthenticated]


class BrandProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_profile(self, request):
        if request.user.user_type != "brand":
            return None
        try:
            return request.user.brand_profile
        except BrandProfile.DoesNotExist:
            return None

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        profile = self._get_profile(request)
        if profile is None:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = BrandProfileSerializer(profile, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BrandSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.brand_profile
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)

        plan = request.data.get("subscription_plan")
        if plan not in ["starter", "growth", "pro"]:
            return Response({"detail": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)

        profile.subscription_plan = plan
        profile.subscription_active = True
        profile.subscription_expires_at = timezone.now() + timedelta(days=30)
        profile.save()
        return Response(BrandProfileSerializer(profile).data)


class BrandDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.brand_profile
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

        campaigns = Campaign.objects.filter(brand=profile)
        proposals = CampaignProposal.objects.filter(campaign__brand=profile)
        total_spent = proposals.filter(status="paid").aggregate(
            total=Sum("escrow_amount")
        )["total"] or 0

        # Monthly timeseries (last 6 months) — campaigns created, spend
        now = timezone.now()
        months = []
        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            label = month_start.strftime("%b %Y")
            camp_count = campaigns.filter(
                created_at__gte=month_start, created_at__lt=next_month
            ).count()
            spend = proposals.filter(
                status="paid",
                escrow_funded_at__gte=month_start, escrow_funded_at__lt=next_month,
            ).aggregate(total=Sum("escrow_amount"))["total"] or 0
            prop_count = proposals.filter(
                created_at__gte=month_start, created_at__lt=next_month,
            ).count()
            months.append({
                "label": label,
                "campaigns": camp_count,
                "spend": float(spend),
                "proposals": prop_count,
            })

        status_breakdown = {}
        for s in ["pending", "accepted", "declined", "counter_offer", "contract_signed",
                  "in_progress", "content_submitted", "validated", "paid", "disputed"]:
            status_breakdown[s] = proposals.filter(status=s).count()

        return Response({
            "total_campaigns": campaigns.count(),
            "active_campaigns": campaigns.filter(status="active").count(),
            "total_proposals_received": proposals.count(),
            "total_spent": float(total_spent),
            "timeseries": months,
            "status_breakdown": status_breakdown,
        })


# ---------------------------------------------------------------------------
# Campaign views
# ---------------------------------------------------------------------------

class CampaignViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "brand":
            try:
                return Campaign.objects.filter(brand=user.brand_profile).order_by("-created_at")
            except BrandProfile.DoesNotExist:
                return Campaign.objects.none()
        elif user.user_type == "influencer":
            return Campaign.objects.filter(status="active").order_by("-created_at")
        return Campaign.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            raise PermissionDenied("Only brands can create campaigns.")
        try:
            serializer.save(brand=self.request.user.brand_profile)
        except BrandProfile.DoesNotExist:
            raise PermissionDenied("Brand profile not found.")

    def perform_destroy(self, instance):
        if instance.brand.user != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You do not own this campaign.")
        # Allow deletion unless there are proposals with signed contracts / in progress / paid
        blocking = instance.proposals.filter(
            status__in=["contract_signed", "in_progress", "content_submitted", "validated", "paid"]
        ).exists()
        if blocking:
            raise ValidationError("Cannot delete a campaign with active or completed contracts.")
        instance.delete()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.brand.user != request.user and not request.user.is_staff:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class CampaignTargetView(APIView):
    permission_classes = [IsAuthenticated]

    def _filter(self, campaign, extra_filters=None):
        """Return matching influencer profiles based on campaign criteria."""
        filters = {**(campaign.target_filters or {}), **(extra_filters or {})}
        qs = InfluencerProfile.objects.prefetch_related("social_networks")

        platform = filters.get("platform")
        if platform:
            qs = qs.filter(social_networks__platform=platform)

        min_followers = filters.get("min_followers")
        if min_followers:
            qs = qs.filter(social_networks__followers_count__gte=int(min_followers))

        # Use campaign's target_networks as theme filter if no explicit themes
        content_themes = filters.get("content_themes") or campaign.target_networks
        if content_themes:
            from django.db.models import Q
            theme_q = Q()
            for theme in content_themes:
                theme_q |= Q(content_themes__icontains=theme)
            qs = qs.filter(theme_q)

        min_rating = filters.get("min_rating")
        if min_rating:
            qs = qs.filter(average_rating__gte=float(min_rating))

        location = filters.get("location")
        if location:
            qs = qs.filter(user__location__icontains=location)

        return qs.distinct()

    def get(self, request, pk):
        """GET — auto-match influencers based on campaign's own criteria."""
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            campaign = Campaign.objects.get(pk=pk, brand__user=request.user)
        except Campaign.DoesNotExist:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)
        qs = self._filter(campaign)
        return Response(InfluencerProfileSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request, pk):
        """POST — filter with custom overrides."""
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            campaign = Campaign.objects.get(pk=pk, brand__user=request.user)
        except Campaign.DoesNotExist:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)
        qs = self._filter(campaign, request.data.get("filters"))
        return Response(InfluencerProfileSerializer(qs, many=True, context={"request": request}).data)


class CampaignSendProposalsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            campaign = Campaign.objects.get(pk=pk, brand__user=request.user)
        except Campaign.DoesNotExist:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)

        influencer_ids = request.data.get("influencer_ids", [])
        proposed_price = request.data.get("proposed_price", campaign.price_per_influencer or 0)
        created = []
        skipped = []

        for inf_id in influencer_ids:
            try:
                influencer = InfluencerProfile.objects.get(pk=inf_id)
            except InfluencerProfile.DoesNotExist:
                skipped.append(inf_id)
                continue

            if CampaignProposal.objects.filter(campaign=campaign, influencer=influencer).exists():
                skipped.append(inf_id)
                continue

            proposal = CampaignProposal.objects.create(
                campaign=campaign,
                influencer=influencer,
                proposed_price=proposed_price,
            )
            create_notification(
                user=influencer.user,
                notification_type="new_proposal",
                title=f"New proposal: {campaign.title}",
                message=f'{campaign.brand.company_name} sent you a proposal for "{campaign.title}".',
                proposal=proposal,
            )
            created.append(proposal.id)

        return Response({"created": created, "skipped": skipped}, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Proposal helpers
# ---------------------------------------------------------------------------

def _get_proposal_for_influencer(request, pk):
    try:
        proposal = CampaignProposal.objects.get(pk=pk)
    except CampaignProposal.DoesNotExist:
        return None, Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    if request.user.user_type != "influencer":
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    try:
        profile = request.user.influencer_profile
    except InfluencerProfile.DoesNotExist:
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    if proposal.influencer != profile:
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return proposal, None


def _get_proposal_for_brand(request, pk):
    try:
        proposal = CampaignProposal.objects.get(pk=pk)
    except CampaignProposal.DoesNotExist:
        return None, Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    if request.user.user_type != "brand":
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    try:
        profile = request.user.brand_profile
    except BrandProfile.DoesNotExist:
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    if proposal.campaign.brand != profile:
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return proposal, None


# ---------------------------------------------------------------------------
# Proposal views
# ---------------------------------------------------------------------------

class ProposalListView(generics.ListAPIView):
    serializer_class = CampaignProposalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "influencer":
            try:
                return CampaignProposal.objects.filter(influencer=user.influencer_profile).order_by("-created_at")
            except InfluencerProfile.DoesNotExist:
                return CampaignProposal.objects.none()
        elif user.user_type == "brand":
            try:
                return CampaignProposal.objects.filter(campaign__brand=user.brand_profile).order_by("-created_at")
            except BrandProfile.DoesNotExist:
                return CampaignProposal.objects.none()
        return CampaignProposal.objects.all().order_by("-created_at")


class ProposalDetailView(generics.RetrieveAPIView):
    serializer_class = CampaignProposalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "influencer":
            try:
                return CampaignProposal.objects.filter(influencer=user.influencer_profile)
            except InfluencerProfile.DoesNotExist:
                return CampaignProposal.objects.none()
        elif user.user_type == "brand":
            try:
                return CampaignProposal.objects.filter(campaign__brand=user.brand_profile)
            except BrandProfile.DoesNotExist:
                return CampaignProposal.objects.none()
        return CampaignProposal.objects.all()


class ProposalAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_influencer(request, pk)
        if err:
            return err
        if proposal.status not in ("pending", "counter_offer"):
            return Response(
                {"detail": "Proposal cannot be accepted in its current state."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        proposal.status = "accepted"
        proposal.save()
        create_notification(
            user=proposal.campaign.brand.user,
            notification_type="proposal_accepted",
            title="Proposal accepted",
            message=(
                f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                f'accepted your proposal for "{proposal.campaign.title}".'
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalDeclineView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_influencer(request, pk)
        if err:
            return err
        decline_reason = request.data.get("decline_reason", "")
        if not decline_reason:
            return Response({"detail": "decline_reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        proposal.status = "declined"
        proposal.decline_reason = decline_reason
        proposal.save()
        create_notification(
            user=proposal.campaign.brand.user,
            notification_type="proposal_declined",
            title="Proposal declined",
            message=(
                f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                f'declined your proposal for "{proposal.campaign.title}".'
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalCounterOfferView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_influencer(request, pk)
        if err:
            return err
        counter_price = request.data.get("counter_price")
        if counter_price is None:
            return Response({"detail": "counter_price is required."}, status=status.HTTP_400_BAD_REQUEST)
        proposal.status = "counter_offer"
        proposal.counter_price = counter_price
        proposal.counter_message = request.data.get("counter_message", "")
        proposal.save()
        create_notification(
            user=proposal.campaign.brand.user,
            notification_type="counter_offer",
            title="Counter offer received",
            message=(
                f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                f'sent a counter offer for "{proposal.campaign.title}".'
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalAcceptCounterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status != "counter_offer":
            return Response({"detail": "No counter offer to accept."}, status=status.HTTP_400_BAD_REQUEST)
        proposal.proposed_price = proposal.counter_price
        proposal.status = "accepted"
        proposal.save()
        create_notification(
            user=proposal.influencer.user,
            notification_type="proposal_accepted",
            title="Counter offer accepted",
            message=f'Your counter offer for "{proposal.campaign.title}" was accepted.',
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalCancelView(APIView):
    """Brand cancels a proposal they sent (only in pending / counter_offer states)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status not in ("pending", "counter_offer"):
            return Response(
                {"detail": "Proposal cannot be cancelled in its current state."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        proposal.status = "declined"
        proposal.decline_reason = request.data.get("reason", "Cancelled by brand")
        proposal.save()
        create_notification(
            user=proposal.influencer.user,
            notification_type="proposal_declined",
            title="Proposal cancelled",
            message=f'The brand cancelled the proposal for "{proposal.campaign.title}".',
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class BrandPublicDetailView(generics.RetrieveAPIView):
    """Public brand profile view (auth required) — used by influencers to inspect a brand."""
    permission_classes = [IsAuthenticated]
    serializer_class = BrandProfileSerializer
    queryset = BrandProfile.objects.all()


class ProposalSignContractView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_brand = (
            user.user_type == "brand"
            and hasattr(user, "brand_profile")
            and proposal.campaign.brand == user.brand_profile
        )
        is_influencer = (
            user.user_type == "influencer"
            and hasattr(user, "influencer_profile")
            and proposal.influencer == user.influencer_profile
        )

        if not is_brand and not is_influencer:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        if is_brand:
            proposal.contract_signed_brand = True
        if is_influencer:
            proposal.contract_signed_influencer = True

        # Track who signed when (CDC §6.4 — IP + timestamp audit trail)
        ip = _client_ip(request)
        now = timezone.now()
        if is_brand and not proposal.brand_signed_at:
            proposal.brand_signed_at = now
            proposal.brand_signature_ip = ip
        if is_influencer and not proposal.influencer_signed_at:
            proposal.influencer_signed_at = now
            proposal.influencer_signature_ip = ip

        if proposal.contract_signed_brand and proposal.contract_signed_influencer:
            proposal.status = "contract_signed"
            proposal.contract_signed_at = now
            # Auto-generate (or refresh) the contract PDF on full signature
            if not proposal.contract_pdf:
                try:
                    pdf_bytes = generate_contract_pdf(proposal=proposal)
                    proposal.contract_pdf.save(
                        f"contract_prop_{proposal.id}_v{proposal.contract_version}.pdf",
                        ContentFile(pdf_bytes), save=False,
                    )
                except Exception:
                    pass
            _audit(user, "contract_signed", "CampaignProposal", proposal.id, ip=ip)
            for recipient in (proposal.influencer.user, proposal.campaign.brand.user):
                create_notification(
                    user=recipient,
                    notification_type="contract_signed",
                    title="Contract fully signed",
                    message=f'The contract for "{proposal.campaign.title}" has been signed by both parties.',
                    proposal=proposal,
                )
        proposal.save()
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalFundEscrowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status != "contract_signed":
            return Response(
                {"detail": "Contract must be signed before funding escrow."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        amount = Decimal(str(request.data.get("amount", proposal.proposed_price)))
        # Stripe stub — create escrow PaymentIntent
        brand_profile = proposal.campaign.brand
        if not brand_profile.stripe_customer_id:
            brand_profile.stripe_customer_id = stripe_service.create_customer(
                email=brand_profile.user.email, name=brand_profile.company_name,
            )
            brand_profile.save(update_fields=["stripe_customer_id"])
        pi = stripe_service.create_escrow_payment_intent(
            customer_id=brand_profile.stripe_customer_id,
            amount_eur=amount, proposal_id=proposal.id,
        )
        stripe_service.confirm_escrow_payment(pi["id"])
        proposal.stripe_payment_intent_id = pi["id"]
        proposal.escrow_amount = amount
        proposal.escrow_funded = True
        proposal.escrow_funded_at = timezone.now()
        proposal.status = "in_progress"
        # Compute submission deadline (campaign deadline or +14 days)
        if proposal.campaign.deadline:
            proposal.submission_deadline = timezone.datetime.combine(
                proposal.campaign.deadline, timezone.datetime.min.time(),
                tzinfo=timezone.get_current_timezone(),
            )
        else:
            proposal.submission_deadline = timezone.now() + timedelta(days=14)
        proposal.save()
        _audit(request.user, "escrow_funded", "CampaignProposal", proposal.id,
               metadata={"amount": str(amount)}, ip=_client_ip(request))
        email_service.send_escrow_funded(
            proposal.influencer.user.email, str(amount), proposal.campaign.title,
        )
        create_notification(
            user=proposal.influencer.user,
            notification_type="escrow_funded",
            title="Escrow funded",
            message=f'The brand has funded the escrow for "{proposal.campaign.title}". You can start working!',
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalSubmitContentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_influencer(request, pk)
        if err:
            return err
        if proposal.status != "in_progress":
            return Response(
                {"detail": "Proposal must be in progress to submit content."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data.copy()
        data["proposal"] = proposal.pk
        serializer = ContentSubmissionSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()

        proposal.status = "content_submitted"
        # Brand has 5 days to validate (CDC §2.2)
        deadline_days = PlatformSettings.get_instance().validation_deadline_days
        proposal.validation_deadline = timezone.now() + timedelta(days=int(deadline_days))
        proposal.save()
        create_notification(
            user=proposal.campaign.brand.user,
            notification_type="content_submitted",
            title="Content submitted",
            message=(
                f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                f'submitted content for "{proposal.campaign.title}".'
            ),
            proposal=proposal,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProposalValidateContentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status != "content_submitted":
            return Response({"detail": "No content to validate."}, status=status.HTTP_400_BAD_REQUEST)

        submission = proposal.submissions.order_by("-created_at").first()
        if not submission:
            return Response({"detail": "No submission found."}, status=status.HTTP_404_NOT_FOUND)

        submission.brand_validated = True
        submission.brand_validation_date = timezone.now()
        submission.save()
        proposal.status = "validated"
        proposal.save()
        _audit(request.user, "content_validated", "CampaignProposal", proposal.id,
               ip=_client_ip(request))
        # Auto-release escrow after validation (CDC §2.1)
        if proposal.escrow_funded and not proposal.escrow_released:
            settings_obj = PlatformSettings.get_instance()
            commission_rate = Decimal(str(settings_obj.commission_rate))
            try:
                release = stripe_service.release_escrow_to_influencer(
                    payment_intent_id=proposal.stripe_payment_intent_id or "stub",
                    influencer_account_id=proposal.influencer.stripe_account_id or None,
                    amount_eur=Decimal(str(proposal.escrow_amount)),
                    commission_rate=commission_rate,
                )
                proposal.stripe_transfer_id = release["transfer_id"]
                proposal.escrow_released = True
                proposal.escrow_released_at = timezone.now()
                proposal.status = "paid"
                proposal.save()
                _audit(request.user, "escrow_released", "CampaignProposal", proposal.id,
                       metadata=release, ip=_client_ip(request))
                email_service.send_payment_released(
                    proposal.influencer.user.email,
                    release["net_amount_eur"], proposal.campaign.title,
                )
                create_notification(
                    user=proposal.influencer.user,
                    notification_type="payment_released",
                    title="Payment released",
                    message=f'Payment for "{proposal.campaign.title}" has been released.',
                    proposal=proposal,
                )
            except Exception:
                pass
        create_notification(
            user=proposal.influencer.user,
            notification_type="content_validated",
            title="Content validated",
            message=f'Your content for "{proposal.campaign.title}" was validated by the brand.',
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalRejectContentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status != "content_submitted":
            return Response({"detail": "No content to reject."}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = request.data.get("rejection_reason")
        if not rejection_reason:
            return Response({"detail": "rejection_reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        submission = proposal.submissions.order_by("-created_at").first()
        if not submission:
            return Response({"detail": "No submission found."}, status=status.HTTP_404_NOT_FOUND)

        submission.brand_validated = False
        submission.brand_validation_date = timezone.now()
        submission.rejection_reason = rejection_reason
        submission.rejection_comment = request.data.get("rejection_comment", "")
        submission.save()
        proposal.status = "in_progress"
        proposal.save()
        create_notification(
            user=proposal.influencer.user,
            notification_type="content_rejected",
            title="Content rejected",
            message=f'Your content for "{proposal.campaign.title}" was rejected. Reason: {rejection_reason}.',
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalReleasePaymentView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if proposal.status not in ("validated", "disputed"):
            return Response(
                {"detail": "Payment can only be released for validated or resolved proposals."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        proposal.escrow_released = True
        proposal.status = "paid"
        proposal.save()
        create_notification(
            user=proposal.influencer.user,
            notification_type="payment_released",
            title="Payment released",
            message=f'Payment for "{proposal.campaign.title}" has been released to you.',
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


# ---------------------------------------------------------------------------
# Message views
# ---------------------------------------------------------------------------

class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pk = self.kwargs["pk"]
        user = self.request.user
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Message.objects.none()

        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and hasattr(user, "brand_profile")
                and proposal.campaign.brand == user.brand_profile)
            or user.is_staff
        )
        if not is_participant:
            return Message.objects.none()

        return Message.objects.filter(proposal=proposal).order_by("created_at")


class MessageCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and hasattr(user, "brand_profile")
                and proposal.campaign.brand == user.brand_profile)
            or user.is_staff
        )
        if not is_participant:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        data["proposal"] = pk
        serializer = MessageSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        msg = serializer.save(sender=request.user)

        if user.user_type == "influencer":
            recipient = proposal.campaign.brand.user
        else:
            recipient = proposal.influencer.user

        create_notification(
            user=recipient,
            notification_type="new_message",
            title="New message",
            message=f'You have a new message from {user.username} about "{proposal.campaign.title}".',
            proposal=proposal,
        )
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Review views
# ---------------------------------------------------------------------------

class ReviewCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if proposal.status != "paid":
            return Response(
                {"detail": "Reviews can only be created for paid proposals."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and hasattr(user, "brand_profile")
                and proposal.campaign.brand == user.brand_profile)
        )
        if not is_participant:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        if user.user_type == "influencer":
            reviewee = proposal.campaign.brand.user
        else:
            reviewee = proposal.influencer.user

        if Review.objects.filter(proposal=proposal, reviewer=user).exists():
            return Response(
                {"detail": "You have already reviewed this proposal."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data.copy()
        data["proposal"] = pk
        data["reviewee"] = reviewee.pk
        serializer = ReviewSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        review = serializer.save(reviewer=user)
        _update_average_rating(reviewee)
        create_notification(
            user=reviewee,
            notification_type="new_review",
            title="New review",
            message=f"{user.username} left you a {review.rating}/5 review.",
            proposal=proposal,
        )
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class UserReviewListView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(reviewee_id=self.kwargs["pk"]).order_by("-created_at")


# ---------------------------------------------------------------------------
# Notification views
# ---------------------------------------------------------------------------

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        notif.read = True
        notif.save()
        return Response(NotificationSerializer(notif).data)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({"detail": "All notifications marked as read."})


# ---------------------------------------------------------------------------
# Admin views
# ---------------------------------------------------------------------------

class AdminUserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]


class AdminCampaignListView(generics.ListAPIView):
    queryset = Campaign.objects.all().order_by("-created_at")
    serializer_class = CampaignSerializer
    permission_classes = [IsAdminUser]


class AdminProposalListView(generics.ListAPIView):
    queryset = CampaignProposal.objects.all().order_by("-created_at")
    serializer_class = CampaignProposalSerializer
    permission_classes = [IsAdminUser]


class AdminArbitrateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        decision = request.data.get("decision")
        if decision not in ("validated", "disputed"):
            return Response(
                {"detail": 'decision must be "validated" or "disputed".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        admin_notes = request.data.get("admin_notes", "")
        submission = proposal.submissions.order_by("-created_at").first()
        if submission:
            submission.admin_validated = (decision == "validated")
            submission.admin_notes = admin_notes
            submission.save()

        proposal.status = decision
        proposal.save()
        return Response(CampaignProposalSerializer(proposal).data)


class AdminFinancialsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        settings_obj = PlatformSettings.get_instance()
        commission_rate = float(settings_obj.commission_rate) / 100

        total_escrow = CampaignProposal.objects.filter(
            escrow_funded=True
        ).aggregate(total=Sum("escrow_amount"))["total"] or 0

        total_released = CampaignProposal.objects.filter(
            escrow_released=True
        ).aggregate(total=Sum("escrow_amount"))["total"] or 0

        total_commission = float(total_released) * commission_rate

        return Response({
            "total_escrow_funded": total_escrow,
            "total_payments_released": total_released,
            "estimated_commission": round(total_commission, 2),
            "commission_rate_percent": settings_obj.commission_rate,
            "total_paid_proposals": CampaignProposal.objects.filter(status="paid").count(),
            "total_active_proposals": CampaignProposal.objects.filter(
                status__in=["accepted", "contract_signed", "in_progress", "content_submitted"]
            ).count(),
        })


class AdminSettingsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        settings_obj = PlatformSettings.get_instance()
        return Response(PlatformSettingsSerializer(settings_obj).data)

    def put(self, request):
        settings_obj = PlatformSettings.get_instance()
        serializer = PlatformSettingsSerializer(settings_obj, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        settings_obj = PlatformSettings.get_instance()
        serializer = PlatformSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
