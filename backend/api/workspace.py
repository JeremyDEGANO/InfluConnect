from __future__ import annotations

from django.db.models import Q

from .models import BrandMembership, BrandOrganization, BrandProfile, OrganizationMembership

_ROLE_RANK = {'member': 1, 'admin': 2, 'owner': 3}


def get_user_global_org_ids(user):
    """Organizations where the user has GLOBAL access (all environments)."""
    if not user or not getattr(user, 'is_authenticated', False):
        return OrganizationMembership.objects.none().values_list('organization_id', flat=True)
    return OrganizationMembership.objects.filter(
        user=user, status='active',
    ).values_list('organization_id', flat=True)


def get_user_brand_workspaces(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return BrandProfile.objects.none()

    owned_id = getattr(getattr(user, 'brand_profile', None), 'id', None)

    membership_ids = BrandMembership.objects.filter(
        user=user,
        status='active',
    ).values_list('brand_id', flat=True)

    query = Q(id__in=membership_ids) | Q(organization_id__in=get_user_global_org_ids(user))
    if owned_id:
        query |= Q(id=owned_id)
    return BrandProfile.objects.filter(query).distinct()


def get_user_role_for_brand(user, brand: BrandProfile | None) -> str | None:
    """Effective role on one environment: the highest of the per-environment
    membership and the organization-wide (global) membership."""
    if not user or not getattr(user, 'is_authenticated', False) or not brand:
        return None
    if user.is_staff:
        return 'admin'
    if brand.user_id == user.id:
        return 'owner'

    roles = []
    membership = BrandMembership.objects.filter(user=user, brand=brand, status='active').only('role').first()
    if membership:
        roles.append(membership.role)
    if brand.organization_id:
        org_membership = OrganizationMembership.objects.filter(
            user=user, organization_id=brand.organization_id, status='active',
        ).only('role').first()
        if org_membership:
            roles.append(org_membership.role)
    if not roles:
        return None
    return max(roles, key=lambda r: _ROLE_RANK.get(r, 0))


def user_can_access_brand(user, brand: BrandProfile | None) -> bool:
    return get_user_role_for_brand(user, brand) is not None


def get_user_org_role(user, organization: BrandOrganization | None) -> str | None:
    """'admin' → global admin of the client, 'member' → global member, None otherwise."""
    if not user or not getattr(user, 'is_authenticated', False) or not organization:
        return None
    if user.is_staff:
        return 'admin'
    membership = OrganizationMembership.objects.filter(
        user=user, organization=organization, status='active',
    ).only('role').first()
    return membership.role if membership else None


def ensure_brand_organization(brand: BrandProfile) -> BrandOrganization:
    """Lazily attach an organization to a legacy environment. The owner of the
    environment becomes global admin of the new organization."""
    if brand.organization_id:
        return brand.organization
    org = BrandOrganization.objects.create(name=brand.company_name or 'Organization')
    brand.organization = org
    brand.save(update_fields=['organization'])
    owner = brand.user
    if owner and owner.is_active:
        OrganizationMembership.objects.get_or_create(
            organization=org, user=owner,
            defaults={'role': 'admin', 'status': 'active'},
        )
    return org


def resolve_active_brand(user, request=None):
    if not user or not getattr(user, 'is_authenticated', False):
        return None

    qs = get_user_brand_workspaces(user)
    allowed_ids = list(qs.values_list('id', flat=True))
    if not allowed_ids:
        return None

    requested_id = None
    if request is not None:
        raw = (
            request.headers.get('X-Workspace-Id')
            or request.headers.get('X-Brand-Id')
            or request.query_params.get('workspace_id')
            or request.query_params.get('brand_id')
        )
        if raw:
            try:
                requested_id = int(raw)
            except (TypeError, ValueError):
                requested_id = None

    selected_id = None
    if requested_id in allowed_ids:
        selected_id = requested_id
    elif user.active_brand_workspace_id in allowed_ids:
        selected_id = user.active_brand_workspace_id
    elif getattr(getattr(user, 'brand_profile', None), 'id', None) in allowed_ids:
        selected_id = user.brand_profile.id
    else:
        selected_id = allowed_ids[0]

    if selected_id and user.active_brand_workspace_id != selected_id:
        user.active_brand_workspace_id = selected_id
        user.save(update_fields=['active_brand_workspace'])

    return qs.filter(id=selected_id).first()
