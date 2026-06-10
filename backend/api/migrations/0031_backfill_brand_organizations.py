"""Backfill BrandOrganization for existing brands.

Grouping rule: every environment is anchored to the real (active) user behind
it — the profile owner, or for stub-owned environments the first active owner
membership. All brands sharing the same anchor user end up in one organization,
and the anchor user becomes global admin of that organization.
"""
from django.db import migrations


def backfill_organizations(apps, schema_editor):
    BrandProfile = apps.get_model('api', 'BrandProfile')
    BrandMembership = apps.get_model('api', 'BrandMembership')
    BrandOrganization = apps.get_model('api', 'BrandOrganization')
    OrganizationMembership = apps.get_model('api', 'OrganizationMembership')

    org_by_anchor = {}

    for brand in BrandProfile.objects.select_related('user').order_by('id'):
        if brand.organization_id:
            continue

        anchor = brand.user
        if anchor is not None and not anchor.is_active:
            owner_membership = (
                BrandMembership.objects
                .filter(brand=brand, role='owner', status='active', user__isnull=False)
                .select_related('user')
                .order_by('id')
                .first()
            )
            if owner_membership and owner_membership.user.is_active:
                anchor = owner_membership.user

        anchor_key = anchor.id if anchor is not None else f'brand-{brand.id}'
        org = org_by_anchor.get(anchor_key)
        if org is None:
            org = BrandOrganization.objects.create(
                name=brand.company_name or (anchor.username if anchor else f'Organization {brand.id}'),
            )
            org_by_anchor[anchor_key] = org
            if anchor is not None and anchor.is_active:
                OrganizationMembership.objects.get_or_create(
                    organization=org, user=anchor,
                    defaults={'role': 'admin', 'status': 'active'},
                )

        brand.organization = org
        brand.save(update_fields=['organization'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0030_brandorganization_brandprofile_organization_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_organizations, noop),
    ]
