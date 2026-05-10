"""Views for multi-user enterprise (BrandMembership) and agency delegations.

Imported into views_extra.py via star-import-style append. Kept in a separate
file for readability.
"""
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BrandProfile, BrandMembership, InfluencerProfile, AgencyDelegation, User
from .serializers import BrandMembershipSerializer, AgencyDelegationSerializer


def _user_brand(user):
    """Return BrandProfile owned by user (OneToOne) or via active membership."""
    if hasattr(user, 'brand_profile'):
        return user.brand_profile
    m = BrandMembership.objects.filter(user=user, status='active').select_related('brand').first()
    return m.brand if m else None


# --- BrandMembership ---------------------------------------------------------

class BrandMembershipListCreateView(generics.ListCreateAPIView):
    serializer_class = BrandMembershipSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        brand = _user_brand(self.request.user)
        if not brand:
            return BrandMembership.objects.none()
        return BrandMembership.objects.filter(brand=brand).select_related('user')

    def create(self, request, *args, **kwargs):
        brand = _user_brand(request.user)
        if not brand:
            return Response({"detail": "No brand workspace."}, status=status.HTTP_403_FORBIDDEN)
        # Only the brand owner can invite (the user holding the OneToOne).
        if not (hasattr(request.user, 'brand_profile') and request.user.brand_profile.id == brand.id):
            membership = BrandMembership.objects.filter(brand=brand, user=request.user, status='active').first()
            if not membership or membership.role not in ('owner', 'admin'):
                return Response({"detail": "Only owners/admins can invite."}, status=status.HTTP_403_FORBIDDEN)
        email = (request.data.get('invited_email') or '').strip().lower()
        role = request.data.get('role') or 'member'
        if not email:
            return Response({"invited_email": "required"}, status=status.HTTP_400_BAD_REQUEST)
        if role not in dict(BrandMembership.ROLE_CHOICES):
            return Response({"role": "invalid"}, status=status.HTTP_400_BAD_REQUEST)
        # Auto-link if user already exists
        existing_user = User.objects.filter(email__iexact=email).first()
        if BrandMembership.objects.filter(brand=brand, invited_email=email).exists() or (
            existing_user and BrandMembership.objects.filter(brand=brand, user=existing_user).exists()
        ):
            return Response({"detail": "Already invited."}, status=status.HTTP_409_CONFLICT)
        m = BrandMembership.objects.create(
            brand=brand, invited_email=email, user=existing_user,
            role=role, status='active' if existing_user else 'invited',
            joined_at=timezone.now() if existing_user else None,
            invited_by=request.user,
        )
        return Response(BrandMembershipSerializer(m).data, status=status.HTTP_201_CREATED)


class BrandMembershipDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BrandMembershipSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        brand = _user_brand(self.request.user)
        if not brand:
            return BrandMembership.objects.none()
        return BrandMembership.objects.filter(brand=brand)

    def perform_destroy(self, instance):
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
