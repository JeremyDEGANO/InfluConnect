"""Subscription plan configuration & feature entitlements.

Single source of truth for "what does each plan include":
  * defaults come from constants.SUBSCRIPTION_PLANS;
  * platform admins can override price / any feature per plan
    (SubscriptionPlanConfig rows, edited from Admin → Plans & tarifs);
  * a brand can have a negotiated price (BrandProfile.subscription_price_override).

Every feature-gated view should go through `has_feature` / `get_limit` /
`require_feature` so admin changes apply immediately, without redeploy.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import PermissionDenied

from ..constants import SUBSCRIPTION_PLANS

# Feature matrix definition — drives the admin editor, the public pricing /
# compare pages and validation of admin overrides.
#   type "bool"  → included or not
#   type "limit" → integer, 0 = not included, -1 = unlimited
#   type "choice"→ one of `choices`
PLAN_FEATURE_DEFS = [
    {"key": "concurrent_campaigns", "label": "Campagnes actives", "type": "limit", "group": "campaigns"},
    {"key": "monthly_influencer_contacts", "label": "Contacts influenceurs / mois", "type": "limit", "group": "campaigns"},
    {"key": "ambassador_programs", "label": "Programmes ambassadeurs", "type": "bool", "group": "campaigns"},
    {"key": "events", "label": "Événements", "type": "bool", "group": "campaigns"},
    {"key": "open_castings", "label": "Castings ouverts", "type": "bool", "group": "campaigns"},
    {"key": "users", "label": "Utilisateurs / environnement", "type": "limit", "group": "team"},
    {"key": "multi_environments", "label": "Multi-environnements (multi-société)", "type": "bool", "group": "team"},
    {"key": "contract_templates_max", "label": "Modèles de documents (contrats)", "type": "limit", "group": "contracts"},
    {"key": "basic_analytics", "label": "Analytics basiques", "type": "bool", "group": "analytics"},
    {"key": "advanced_analytics", "label": "Analytics avancées & exports", "type": "bool", "group": "analytics"},
    {"key": "sso_office365_google", "label": "SSO (Office 365)", "type": "bool", "group": "integrations"},
    {"key": "slack_teams_integration", "label": "Intégration Slack / Teams", "type": "bool", "group": "integrations"},
    {"key": "api_access", "label": "API & webhooks", "type": "bool", "group": "integrations"},
    {"key": "crm_integration", "label": "Intégration CRM", "type": "bool", "group": "integrations"},
    {"key": "dedicated_account_manager", "label": "Account manager dédié", "type": "bool", "group": "support"},
    {
        "key": "priority_support", "label": "Support prioritaire", "type": "choice", "group": "support",
        "choices": ["none", "email_48h", "email_phone_24h"],
    },
]
_FEATURE_DEFS_BY_KEY = {d["key"]: d for d in PLAN_FEATURE_DEFS}
DEFAULT_PLAN_CODE = "starter"


def _overrides_by_code() -> dict:
    from ..models import SubscriptionPlanConfig
    return {row.code: row for row in SubscriptionPlanConfig.objects.all()}


def _merge_plan(code: str, row=None) -> dict:
    base = SUBSCRIPTION_PLANS[code]
    features = dict(base["features"])
    if row is not None:
        features.update({k: v for k, v in (row.features or {}).items() if k in _FEATURE_DEFS_BY_KEY})
    price = base["price_eur_monthly"]
    if row is not None and row.price_eur_monthly is not None:
        price = float(row.price_eur_monthly)
    return {
        "code": code,
        "name": (row.name if row and row.name else base["name"]),
        "price_eur_monthly": price,
        "stripe_price_id": base["stripe_price_id"],
        "features": features,
    }


def get_plan_configs() -> list[dict]:
    """Every plan, defaults merged with admin overrides, in pricing order."""
    rows = _overrides_by_code()
    return [_merge_plan(code, rows.get(code)) for code in SUBSCRIPTION_PLANS]


def get_plan_config(code: str) -> dict:
    if code not in SUBSCRIPTION_PLANS:
        code = DEFAULT_PLAN_CODE
    return _merge_plan(code, _overrides_by_code().get(code))


def validate_feature_value(key: str, value):
    """Coerce + validate an admin-provided feature value. Raises ValueError."""
    d = _FEATURE_DEFS_BY_KEY.get(key)
    if d is None:
        raise ValueError(f"Unknown feature: {key}")
    if d["type"] == "bool":
        return bool(value)
    if d["type"] == "limit":
        try:
            value = int(value)
        except (TypeError, ValueError):
            raise ValueError(f"{key} must be an integer (-1 = unlimited)")
        if value < -1:
            raise ValueError(f"{key} must be >= -1")
        return value
    if value not in d["choices"]:
        raise ValueError(f"{key} must be one of {d['choices']}")
    return value


def validate_price(value) -> Decimal:
    try:
        price = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("price_eur_monthly must be a number")
    if price < 0:
        raise ValueError("price_eur_monthly must be >= 0")
    return price


# --- Brand-level entitlements ----------------------------------------------
def get_brand_features(brand) -> dict:
    """Feature matrix applicable to a brand (defaults to the starter plan)."""
    code = getattr(brand, "subscription_plan", None) or DEFAULT_PLAN_CODE
    return get_plan_config(code)["features"]


def get_brand_price(brand) -> float:
    override = getattr(brand, "subscription_price_override", None)
    if override is not None:
        return float(override)
    code = getattr(brand, "subscription_plan", None) or DEFAULT_PLAN_CODE
    return float(get_plan_config(code)["price_eur_monthly"])


def has_feature(brand, key: str) -> bool:
    return bool(get_brand_features(brand).get(key))


def get_limit(brand, key: str) -> int:
    """Integer limit for a brand. -1 = unlimited, 0 = not included."""
    try:
        return int(get_brand_features(brand).get(key, 0))
    except (TypeError, ValueError):
        return 0


def require_feature(brand, key: str, message: str | None = None) -> None:
    if not has_feature(brand, key):
        label = _FEATURE_DEFS_BY_KEY.get(key, {}).get("label", key)
        raise PermissionDenied(
            message or f"« {label} » n'est pas inclus dans votre abonnement. Passez à un plan supérieur."
        )


def monthly_contacts_used(brand) -> int:
    """Influencer contacts initiated by the brand this calendar month.

    Counts campaign proposals sent plus marketplace contact messages
    (logged as AuditLog action="marketplace_contact" on the brand).
    Backs the "monthly_influencer_contacts" plan limit.
    """
    from django.utils import timezone

    from ..models import AuditLog, CampaignProposal

    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    proposals = CampaignProposal.objects.filter(
        campaign__brand=brand, created_at__gte=month_start,
    ).count()
    marketplace = AuditLog.objects.filter(
        action="marketplace_contact", target_type="BrandProfile",
        target_id=brand.id, created_at__gte=month_start,
    ).count()
    return proposals + marketplace


def enforce_monthly_contacts(brand, requested: int = 1) -> None:
    """Raise PermissionDenied when sending `requested` more influencer
    contacts would exceed the brand's monthly plan limit."""
    limit = get_limit(brand, "monthly_influencer_contacts")
    if limit == -1:
        return
    used = monthly_contacts_used(brand)
    if used + requested > limit:
        remaining = max(0, limit - used)
        raise PermissionDenied(
            f"Limite mensuelle atteinte : votre abonnement autorise {limit} contacts influenceurs par mois "
            f"({used} déjà utilisés, {remaining} restants). Passez à un plan supérieur pour aller plus loin."
        )


def enforce_limit(brand, key: str, current_count: int, message: str | None = None) -> None:
    """Raise PermissionDenied when current_count has reached the plan limit."""
    limit = get_limit(brand, key)
    if limit == -1:
        return
    if current_count >= limit:
        label = _FEATURE_DEFS_BY_KEY.get(key, {}).get("label", key)
        raise PermissionDenied(
            message or (
                f"Limite atteinte : votre abonnement autorise {limit} « {label} ». "
                "Passez à un plan supérieur pour aller plus loin."
            )
        )
