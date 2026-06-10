"""Views for multi-user enterprise (BrandMembership) and agency delegations.

Imported into views_extra.py via star-import-style append. Kept in a separate
file for readability.
"""
from django.utils import timezone
from django.db import transaction
import secrets
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BrandProfile, BrandMembership, InfluencerProfile, AgencyDelegation, User
from .serializers import BrandMembershipSerializer, AgencyDelegationSerializer
from .workspace import (
    ensure_brand_organization,
    get_user_brand_workspaces,
    get_user_org_role,
    get_user_role_for_brand,
    resolve_active_brand,
)


def _user_brand(user):
    """Return the user's currently active brand workspace."""
    return resolve_active_brand(user)


class BrandEnvironmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspaces = get_user_brand_workspaces(request.user)
        active = resolve_active_brand(request.user, request=request)
        payload = []
        for brand in workspaces:
            payload.append({
                'id': brand.id,
                'company_name': brand.company_name,
                'is_agency': bool(brand.is_agency),
                'role': get_user_role_for_brand(request.user, brand),
                'is_active': bool(active and active.id == brand.id),
            })
        return Response({'results': payload, 'active_brand_id': active.id if active else None})

    def post(self, request):
        workspaces = get_user_brand_workspaces(request.user)
        if not workspaces.exists():
            return Response({'detail': 'No brand workspace.'}, status=status.HTTP_403_FORBIDDEN)

        active = resolve_active_brand(request.user, request=request) or workspaces.first()
        organization = ensure_brand_organization(active)
        role = get_user_role_for_brand(request.user, active)
        if role not in ('owner', 'admin') and get_user_org_role(request.user, organization) != 'admin':
            return Response({'detail': 'Only owners/admins can create environments.'}, status=status.HTTP_403_FORBIDDEN)

        company_name = (request.data.get('company_name') or '').strip()
        if not company_name:
            return Response({'company_name': 'required'}, status=status.HTTP_400_BAD_REQUEST)

        generated_username = f"ws_{secrets.token_hex(8)}"
        generated_email = f"{generated_username}@workspace.local"

        with transaction.atomic():
            owner_stub = User.objects.create(
                username=generated_username,
                email=generated_email,
                user_type='brand',
                is_active=False,
            )
            owner_stub.set_unusable_password()
            owner_stub.save(update_fields=['password'])

            new_workspace = BrandProfile.objects.create(
                user=owner_stub,
                organization=organization,
                company_name=company_name,
                siret='',
                website='',
                sector=getattr(active, 'sector', ''),
                subscription_plan=getattr(active, 'subscription_plan', None),
                subscription_active=bool(getattr(active, 'subscription_active', False)),
                validation_status=getattr(active, 'validation_status', 'pending'),
                is_agency=bool(getattr(active, 'is_agency', False)),
                agency_default_commission_percent=getattr(active, 'agency_default_commission_percent', 20),
            )

            BrandMembership.objects.create(
                brand=new_workspace,
                user=request.user,
                invited_email=request.user.email,
                role='owner',
                status='active',
                joined_at=timezone.now(),
                invited_by=request.user,
            )

            request.user.active_brand_workspace = new_workspace
            request.user.save(update_fields=['active_brand_workspace'])

        return Response({
            'id': new_workspace.id,
            'company_name': new_workspace.company_name,
            'is_agency': bool(new_workspace.is_agency),
            'role': 'owner',
            'is_active': True,
        }, status=status.HTTP_201_CREATED)


class BrandEnvironmentSwitchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        brand_id = request.data.get('brand_id')
        try:
            brand_id = int(brand_id)
        except (TypeError, ValueError):
            return Response({'brand_id': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)

        brand = get_user_brand_workspaces(request.user).filter(pk=brand_id).first()
        if not brand:
            return Response({'detail': 'Forbidden workspace.'}, status=status.HTTP_403_FORBIDDEN)

        request.user.active_brand_workspace = brand
        request.user.save(update_fields=['active_brand_workspace'])
        return Response({
            'active_brand_id': brand.id,
            'active_brand_name': brand.company_name,
            'role': get_user_role_for_brand(request.user, brand),
        })


# --- BrandMembership ---------------------------------------------------------

class BrandMembershipListCreateView(generics.ListCreateAPIView):
    serializer_class = BrandMembershipSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        brand = resolve_active_brand(self.request.user, request=self.request)
        if not brand:
            return BrandMembership.objects.none()
        return BrandMembership.objects.filter(brand=brand).select_related('user')

    def create(self, request, *args, **kwargs):
        # Replaced by the token-based invitation flow (POST /brands/team/invitations/).
        # The old behaviour silently attached existing accounts without consent.
        return Response(
            {"detail": "Deprecated. Use /api/brands/team/invitations/ instead."},
            status=status.HTTP_410_GONE,
        )


class BrandMembershipDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BrandMembershipSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        from .workspace import get_user_org_role
        user = self.request.user
        manageable_ids = []
        for brand in get_user_brand_workspaces(user).select_related('organization'):
            role = get_user_role_for_brand(user, brand)
            org_role = get_user_org_role(user, brand.organization) if brand.organization_id else None
            if role in ('owner', 'admin') or org_role == 'admin':
                manageable_ids.append(brand.id)
        if not manageable_ids:
            return BrandMembership.objects.none()
        return BrandMembership.objects.filter(brand_id__in=manageable_ids)

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.user_id == self.request.user.id:
            raise PermissionDenied('You cannot change your own role.')
        role = self.request.data.get('role')
        if role is not None and role not in ('admin', 'member'):
            raise PermissionDenied('Role must be admin or member.')
        if instance.role == 'owner':
            raise PermissionDenied('Owner role cannot be changed.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.user_id == self.request.user.id:
            raise PermissionDenied('You cannot revoke your own access.')
        if instance.role == 'owner':
            raise PermissionDenied('Owner access cannot be revoked.')
        instance.status = 'revoked'
        instance.save(update_fields=['status'])


# --- AgencyDelegation --------------------------------------------------------

class AgencyDelegationListCreateView(generics.ListCreateAPIView):
    """Agencies invite influencers. Influencers see incoming invitations."""
    serializer_class = AgencyDelegationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        if hasattr(u, 'brand_profile') and u.brand_profile.is_agency:
            return AgencyDelegation.objects.filter(agency=u.brand_profile).select_related('influencer__user')
        if hasattr(u, 'influencer_profile'):
            return AgencyDelegation.objects.filter(influencer=u.influencer_profile).select_related('agency')
        return AgencyDelegation.objects.none()

    def create(self, request, *args, **kwargs):
        if not (hasattr(request.user, 'brand_profile') and request.user.brand_profile.is_agency):
            return Response({"detail": "Only agencies can create delegations."}, status=status.HTTP_403_FORBIDDEN)
        agency = request.user.brand_profile
        influencer_ref = (request.data.get('influencer') or '').strip()
        influencer = None
        if influencer_ref.isdigit():
            influencer = InfluencerProfile.objects.filter(pk=int(influencer_ref)).first()
        if influencer is None and influencer_ref:
            influencer = InfluencerProfile.objects.filter(user__username__iexact=influencer_ref).select_related('user').first()
        if influencer is None:
            return Response({"influencer": "not found"}, status=status.HTTP_400_BAD_REQUEST)
        commission = request.data.get('commission_percent', agency.agency_default_commission_percent)
        try:
            commission_val = float(commission)
        except (TypeError, ValueError):
            return Response({"commission_percent": "invalid"}, status=status.HTTP_400_BAD_REQUEST)
        if commission_val < 0 or commission_val > 100:
            return Response({"commission_percent": "0-100"}, status=status.HTTP_400_BAD_REQUEST)
        if AgencyDelegation.objects.filter(agency=agency, influencer=influencer).exists():
            return Response({"detail": "Already invited."}, status=status.HTTP_409_CONFLICT)
        d = AgencyDelegation.objects.create(
            agency=agency, influencer=influencer,
            commission_percent=commission_val,
            invitation_message=request.data.get('invitation_message', ''),
        )
        return Response(AgencyDelegationSerializer(d).data, status=status.HTTP_201_CREATED)


class AgencyDelegationActionView(APIView):
    """Influencer accepts/declines a pending delegation; agency revokes."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            d = AgencyDelegation.objects.select_related('agency', 'influencer').get(pk=pk)
        except AgencyDelegation.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        action = (request.data.get('action') or '').lower()
        u = request.user
        if action in ('accept', 'decline'):
            if not (hasattr(u, 'influencer_profile') and u.influencer_profile.id == d.influencer_id):
                return Response({"detail": "Not your invitation."}, status=status.HTTP_403_FORBIDDEN)
            if d.status != 'pending':
                return Response({"detail": "Already processed."}, status=status.HTTP_400_BAD_REQUEST)
            if action == 'accept':
                d.status = 'accepted'
                d.accepted_at = timezone.now()
            else:
                d.status = 'declined'
            d.save(update_fields=['status', 'accepted_at'])
        elif action == 'revoke':
            if not (hasattr(u, 'brand_profile') and u.brand_profile.id == d.agency_id):
                return Response({"detail": "Not your delegation."}, status=status.HTTP_403_FORBIDDEN)
            d.status = 'revoked'
            d.revoked_at = timezone.now()
            d.save(update_fields=['status', 'revoked_at'])
        else:
            return Response({"action": "must be accept|decline|revoke"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AgencyDelegationSerializer(d).data)
