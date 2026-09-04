"""Professional team invitation flow (multi-company / multi-environment).

A brand organization groups several environments (legal entities). Invitations
are sent by email with a single-use token link. Access is only granted once the
invitee proves control of the mailbox (login with the invited email, or account
creation through the token link).

Scopes:
- 'global'        → access to every environment of the organization
                    (OrganizationMembership, role admin|member).
- 'environments'  → access to a selected subset (BrandMembership rows).
"""
from __future__ import annotations

import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    BrandMembership,
    BrandProfile,
    OrganizationMembership,
    TeamInvitation,
    User,
)
from .serializers import UserSerializer
from .services import email_service
from .services import plans as plans_service
from .throttling import IPRateThrottle
from .workspace import (
    ensure_brand_organization,
    get_user_brand_workspaces,
    get_user_org_role,
    get_user_role_for_brand,
    resolve_active_brand,
)


class TeamInvitePublicThrottle(IPRateThrottle):
    scope = "team_invite_public"


class TeamInviteRegisterThrottle(IPRateThrottle):
    scope = "team_invite_register"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_org(request):
    """Organization of the requester's active environment (created lazily)."""
    active = resolve_active_brand(request.user, request=request)
    if not active:
        return None, None
    return ensure_brand_organization(active), active


def _manageable_env_ids(user, org) -> set[int]:
    """Environments of the org where the user can manage members."""
    if get_user_org_role(user, org) == 'admin':
        return set(org.environments.values_list('id', flat=True))
    ids = set()
    for brand in get_user_brand_workspaces(user).filter(organization=org):
        if get_user_role_for_brand(user, brand) in ('owner', 'admin'):
            ids.add(brand.id)
    return ids


def _invitation_payload(inv: TeamInvitation) -> dict:
    inviter = inv.invited_by
    return {
        'id': inv.id,
        'invited_email': inv.invited_email,
        'role': inv.role,
        'scope': inv.scope,
        'environments': [
            {'id': b.id, 'company_name': b.company_name}
            for b in inv.environments.all()
        ],
        'status': 'expired' if inv.is_expired else inv.status,
        'message': inv.message,
        'invited_by_name': (
            (f'{inviter.first_name} {inviter.last_name}'.strip() or inviter.username)
            if inviter else ''
        ),
        'expires_at': inv.expires_at,
        'created_at': inv.created_at,
        'accepted_at': inv.accepted_at,
    }


def _scope_summary(inv: TeamInvitation, lang: str) -> str:
    if inv.scope == 'global':
        return (
            "tous les environnements de l'organisation"
            if lang == 'fr' else
            'all environments of the organization'
        )
    names = ', '.join(inv.environments.values_list('company_name', flat=True))
    return names or ('environnements sélectionnés' if lang == 'fr' else 'selected environments')


def _send_invitation_email(inv: TeamInvitation) -> None:
    inviter = inv.invited_by
    inviter_name = (
        (f'{inviter.first_name} {inviter.last_name}'.strip() or inviter.username)
        if inviter else 'InfluConnect'
    )
    email_service.send_team_invitation(
        invited_email=inv.invited_email,
        inviter_name=inviter_name,
        organization_name=inv.organization.name,
        role=inv.role,
        scope_summary_fr=_scope_summary(inv, 'fr'),
        scope_summary_en=_scope_summary(inv, 'en'),
        accept_url=email_service._frontend_url(f'/invitation/{inv.token}'),
        expires_days=TeamInvitation.EXPIRY_DAYS,
        personal_message=inv.message,
    )


def _apply_invitation(inv: TeamInvitation, user: User) -> None:
    now = timezone.now()
    with transaction.atomic():
        if inv.scope == 'global':
            membership = OrganizationMembership.objects.filter(
                organization=inv.organization, user=user,
            ).first()
            if membership:
                membership.role = inv.role
                membership.status = 'active'
                membership.save(update_fields=['role', 'status', 'updated_at'])
            else:
                OrganizationMembership.objects.create(
                    organization=inv.organization, user=user,
                    role=inv.role, status='active', created_by=inv.invited_by,
                )
        else:
            for brand in inv.environments.all():
                membership = BrandMembership.objects.filter(brand=brand).filter(
                    Q(user=user) | Q(invited_email__iexact=user.email)
                ).first()
                if membership:
                    membership.user = user
                    membership.role = inv.role
                    membership.status = 'active'
                    membership.joined_at = membership.joined_at or now
                    membership.save(update_fields=['user', 'role', 'status', 'joined_at'])
                else:
                    BrandMembership.objects.create(
                        brand=brand, user=user, invited_email=user.email,
                        role=inv.role, status='active', joined_at=now,
                        invited_by=inv.invited_by,
                    )
        inv.status = 'accepted'
        inv.accepted_at = now
        inv.accepted_by = user
        inv.save(update_fields=['status', 'accepted_at', 'accepted_by'])

        # Point the user at a workspace they just gained access to.
        first_env = (
            inv.organization.environments.order_by('id').first()
            if inv.scope == 'global' else inv.environments.order_by('id').first()
        )
        if first_env:
            user.active_brand_workspace = first_env
            user.save(update_fields=['active_brand_workspace'])


def _get_pending_invitation(token: str) -> TeamInvitation | None:
    if not token or len(token) > 64:
        return None
    inv = (
        TeamInvitation.objects
        .select_related('organization', 'invited_by')
        .prefetch_related('environments')
        .filter(token=token)
        .first()
    )
    if inv and inv.status == 'pending' and inv.is_expired:
        inv.status = 'expired'
        inv.save(update_fields=['status'])
    return inv


def _user_already_covered(inv: TeamInvitation, user: User) -> bool:
    """True when the user already has at least the invited access."""
    rank = {'member': 1, 'admin': 2, 'owner': 3}
    wanted = rank[inv.role]
    if inv.scope == 'global':
        current = get_user_org_role(user, inv.organization)
        return bool(current) and rank.get(current, 0) >= wanted
    for brand in inv.environments.all():
        current = get_user_role_for_brand(user, brand)
        if not current or rank.get(current, 0) < wanted:
            return False
    return inv.environments.exists()


# ---------------------------------------------------------------------------
# Organization-side management (authenticated brand users)
# ---------------------------------------------------------------------------

class TeamOverviewView(APIView):
    """Everything the Team page needs: org, environments, members, invitations."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org, _active = _resolve_org(request)
        if not org:
            return Response({'detail': 'No brand workspace.'}, status=status.HTTP_403_FORBIDDEN)

        manageable = _manageable_env_ids(request.user, org)
        org_role = get_user_org_role(request.user, org)
        visible_env_ids = None
        if not manageable and not org_role:
            # Plain members can still see the team roster of their environments.
            accessible = set(
                get_user_brand_workspaces(request.user)
                .filter(organization=org)
                .values_list('id', flat=True)
            )
            if not accessible:
                return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
            visible_env_ids = accessible

        environment_qs = org.environments.order_by('id')
        if visible_env_ids is not None:
            environment_qs = environment_qs.filter(id__in=visible_env_ids)
        environments = list(environment_qs.values('id', 'company_name', 'is_agency'))
        env_ids = [e['id'] for e in environments]

        members: dict[int, dict] = {}

        def _member_entry(user: User) -> dict:
            return members.setdefault(user.id, {
                'user_id': user.id,
                'name': (f'{user.first_name} {user.last_name}'.strip() or user.username),
                'email': user.email,
                'global_role': None,
                'global_membership_id': None,
                'environment_roles': [],
            })

        for om in OrganizationMembership.objects.filter(
            organization=org, status='active',
        ).select_related('user'):
            entry = _member_entry(om.user)
            entry['global_role'] = om.role
            entry['global_membership_id'] = om.id

        for bm in BrandMembership.objects.filter(
            brand_id__in=env_ids, status='active', user__isnull=False,
        ).select_related('user'):
            entry = _member_entry(bm.user)
            entry['environment_roles'].append({
                'membership_id': bm.id,
                'brand_id': bm.brand_id,
                'role': bm.role,
            })

        # Environment owners (the profile's own user) — exclude stub accounts.
        for brand in BrandProfile.objects.filter(id__in=env_ids).select_related('user'):
            if brand.user and brand.user.is_active:
                entry = _member_entry(brand.user)
                entry['environment_roles'].append({
                    'membership_id': None,
                    'brand_id': brand.id,
                    'role': 'owner',
                })

        invitations = []
        if manageable or org_role == 'admin':
            for inv in (
                TeamInvitation.objects.filter(organization=org)
                .exclude(status='accepted')
                .prefetch_related('environments')
                .select_related('invited_by')[:50]
            ):
                if inv.status == 'pending' and inv.is_expired:
                    inv.status = 'expired'
                    inv.save(update_fields=['status'])
                invitations.append(_invitation_payload(inv))

        return Response({
            'organization': {'id': org.id, 'name': org.name},
            'org_role': org_role,
            'manageable_environment_ids': sorted(manageable),
            'can_invite_global': org_role == 'admin',
            'environments': environments,
            'members': sorted(members.values(), key=lambda m: m['name'].lower()),
            'invitations': invitations,
        })


class TeamInvitationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        org, _active = _resolve_org(request)
        if not org:
            return Response({'detail': 'No brand workspace.'}, status=status.HTTP_403_FORBIDDEN)

        manageable = _manageable_env_ids(request.user, org)
        org_role = get_user_org_role(request.user, org)
        if not manageable and org_role != 'admin':
            return Response({'detail': 'Only owners/admins can invite.'}, status=status.HTTP_403_FORBIDDEN)

        email = (request.data.get('invited_email') or '').strip().lower()
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({'invited_email': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)

        role = request.data.get('role') or 'member'
        if role not in dict(TeamInvitation.ROLE_CHOICES):
            return Response({'role': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)

        scope = request.data.get('scope') or 'environments'
        if scope not in dict(TeamInvitation.SCOPE_CHOICES):
            return Response({'scope': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)

        env_objects: list[BrandProfile] = []
        if scope == 'global':
            if org_role != 'admin':
                return Response(
                    {'detail': 'Only a global admin can grant access to all environments.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            raw_ids = request.data.get('environment_ids') or []
            if not isinstance(raw_ids, list) or not raw_ids:
                return Response({'environment_ids': 'required'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                env_ids = {int(i) for i in raw_ids}
            except (TypeError, ValueError):
                return Response({'environment_ids': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)
            if not env_ids.issubset(manageable):
                return Response(
                    {'environment_ids': 'You can only invite to environments you administer.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            env_objects = list(BrandProfile.objects.filter(id__in=env_ids, organization=org).select_related('user'))
            if len(env_objects) != len(env_ids):
                return Response({'environment_ids': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)
            # Plan entitlement: max users per environment (owner + active members)
            for env in env_objects:
                current_users = (
                    BrandMembership.objects.filter(brand=env, status='active').count()
                    + (1 if env.user and env.user.is_active else 0)
                )
                plans_service.enforce_limit(env, 'users', current_users)

        if TeamInvitation.objects.filter(
            organization=org, invited_email__iexact=email, status='pending',
        ).exclude(expires_at__lt=timezone.now()).exists():
            return Response({'detail': 'An invitation is already pending for this email.'},
                            status=status.HTTP_409_CONFLICT)

        existing_user = User.objects.filter(email__iexact=email, is_active=True).first()
        message = (request.data.get('message') or '').strip()[:1000]

        # Expire any stale pending invitation for the same email first
        TeamInvitation.objects.filter(
            organization=org, invited_email__iexact=email, status='pending',
        ).update(status='expired')

        inv = TeamInvitation.objects.create(
            organization=org,
            invited_email=email,
            role=role,
            scope=scope,
            message=message,
            invited_by=request.user,
            expires_at=timezone.now() + timezone.timedelta(days=TeamInvitation.EXPIRY_DAYS),
        )
        if env_objects:
            inv.environments.set(env_objects)

        if existing_user and _user_already_covered(inv, existing_user):
            inv.delete()
            return Response({'detail': 'This user already has this access.'},
                            status=status.HTTP_409_CONFLICT)

        _send_invitation_email(inv)
        return Response(_invitation_payload(inv), status=status.HTTP_201_CREATED)


class TeamInvitationActionView(APIView):
    """POST {action: 'resend' | 'cancel'} on a pending invitation."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        org, _active = _resolve_org(request)
        if not org:
            return Response({'detail': 'No brand workspace.'}, status=status.HTTP_403_FORBIDDEN)

        inv = (
            TeamInvitation.objects
            .select_related('organization', 'invited_by')
            .prefetch_related('environments')
            .filter(pk=pk, organization=org)
            .first()
        )
        if not inv:
            return Response(status=status.HTTP_404_NOT_FOUND)

        manageable = _manageable_env_ids(request.user, org)
        org_role = get_user_org_role(request.user, org)
        if inv.scope == 'global':
            allowed = org_role == 'admin'
        else:
            env_ids = set(inv.environments.values_list('id', flat=True))
            allowed = org_role == 'admin' or (bool(env_ids) and env_ids.issubset(manageable))
        if not allowed:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        action = (request.data.get('action') or '').lower()
        if action == 'cancel':
            if inv.status not in ('pending', 'expired'):
                return Response({'detail': 'Already processed.'}, status=status.HTTP_400_BAD_REQUEST)
            inv.status = 'cancelled'
            inv.save(update_fields=['status'])
        elif action == 'resend':
            if inv.status not in ('pending', 'expired'):
                return Response({'detail': 'Already processed.'}, status=status.HTTP_400_BAD_REQUEST)
            inv.status = 'pending'
            inv.expires_at = timezone.now() + timezone.timedelta(days=TeamInvitation.EXPIRY_DAYS)
            inv.save(update_fields=['status', 'expires_at'])
            _send_invitation_email(inv)
        else:
            return Response({'action': 'must be resend|cancel'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_invitation_payload(inv))


class OrganizationMemberDetailView(APIView):
    """PATCH role / DELETE (revoke) a GLOBAL membership. Global admins only."""
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        org, _active = _resolve_org(request)
        if not org:
            return None, Response({'detail': 'No brand workspace.'}, status=status.HTTP_403_FORBIDDEN)
        if get_user_org_role(request.user, org) != 'admin':
            return None, Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        membership = OrganizationMembership.objects.filter(pk=pk, organization=org).select_related('user').first()
        if not membership:
            return None, Response(status=status.HTTP_404_NOT_FOUND)
        if membership.user_id == request.user.id:
            return None, Response({'detail': 'You cannot modify your own global access.'},
                                  status=status.HTTP_400_BAD_REQUEST)
        return membership, None

    def patch(self, request, pk):
        membership, err = self._get(request, pk)
        if err:
            return err
        role = request.data.get('role')
        if role not in dict(OrganizationMembership.ROLE_CHOICES):
            return Response({'role': 'invalid'}, status=status.HTTP_400_BAD_REQUEST)
        membership.role = role
        membership.save(update_fields=['role', 'updated_at'])
        return Response({'id': membership.id, 'role': membership.role, 'status': membership.status})

    def delete(self, request, pk):
        membership, err = self._get(request, pk)
        if err:
            return err
        membership.status = 'revoked'
        membership.save(update_fields=['status', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Invitee-side (public token endpoints)
# ---------------------------------------------------------------------------

class PublicInvitationDetailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [TeamInvitePublicThrottle]

    def get(self, request, token):
        inv = _get_pending_invitation(token)
        if not inv:
            return Response({'detail': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)
        payload = _invitation_payload(inv)
        payload['organization_name'] = inv.organization.name
        payload['email_registered'] = User.objects.filter(
            email__iexact=inv.invited_email, is_active=True,
        ).exists()
        payload.pop('id', None)
        return Response(payload)


class PublicInvitationAcceptView(APIView):
    """Authenticated user accepts: their account email must match the invite."""
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        inv = _get_pending_invitation(token)
        if not inv:
            return Response({'detail': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)
        if inv.status != 'pending':
            return Response({'detail': 'Invitation is no longer valid.', 'status': inv.status},
                            status=status.HTTP_410_GONE)
        if (request.user.email or '').strip().lower() != inv.invited_email.lower():
            return Response(
                {'detail': 'This invitation was sent to a different email address.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.user.user_type not in ('brand', 'admin'):
            return Response(
                {'detail': 'Only brand accounts can join a brand workspace.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        _apply_invitation(inv, request.user)
        return Response({
            'detail': 'accepted',
            'user': UserSerializer(request.user, context={'request': request}).data,
        })


class PublicInvitationRegisterView(APIView):
    """Create an account from the invitation link, then grant access."""
    permission_classes = [AllowAny]
    throttle_classes = [TeamInviteRegisterThrottle]

    def post(self, request, token):
        inv = _get_pending_invitation(token)
        if not inv:
            return Response({'detail': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)
        if inv.status != 'pending':
            return Response({'detail': 'Invitation is no longer valid.', 'status': inv.status},
                            status=status.HTTP_410_GONE)
        if User.objects.filter(email__iexact=inv.invited_email).exists():
            return Response(
                {'detail': 'An account already exists for this email. Please log in to accept.'},
                status=status.HTTP_409_CONFLICT,
            )

        first_name = (request.data.get('first_name') or '').strip()[:150]
        last_name = (request.data.get('last_name') or '').strip()[:150]
        password = request.data.get('password') or ''
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            return Response({'password': exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        base_username = re.sub(r'[^a-z0-9._-]', '', inv.invited_email.split('@')[0].lower()) or 'user'
        username = base_username
        suffix = 1
        while User.objects.filter(username__iexact=username).exists():
            suffix += 1
            username = f'{base_username}{suffix}'

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=inv.invited_email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                user_type='brand',
            )
            _apply_invitation(inv, user)

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)
