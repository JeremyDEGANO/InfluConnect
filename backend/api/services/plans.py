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
    # Headline trust features — shown first on the public pricing page.
    {"key": "electronic_signature", "label": "Signature électronique", "type": "bool", "group": "core"},
    {"key": "secure_escrow_payment", "label": "Paiement sécurisé sous séquestre", "type": "bool", "group": "core"},
    {"key": "dispute_mediation", "label": "Médiation en cas de litige", "type": "bool", "group": "core"},
    {"key": "certified_statistics", "label": "Statistiques certifiées", "type": "bool", "group": "core"},
    {"key": "concurrent_campaigns", "label": "Campagnes actives", "type": "limit", "group": "campaigns"},
    {"key": "selective_castings", "label": "Castings sur sélection d'influenceurs", "type": "bool", "group": "campaigns"},
    {"key": "open_castings", "label": "Castings ouverts à tous les influenceurs", "type": "bool", "group": "campaigns"},
    {"key": "ambassador_programs", "label": "Programmes ambassadeurs", "type": "bool", "group": "campaigns"},
    {"key": "events", "label": "Événements", "type": "bool", "group": "campaigns"},
    {"key": "users", "label": "Utilisateurs / environnement", "type": "limit", "group": "team"},
    {"key": "multi_environments", "label": "Multi-environnements (multi-société)", "type": "bool", "group": "team"},
    {"key": "contract_templates_max", "label": "Modèles de documents (contrats)", "type": "limit", "group": "contracts"},
    {"key": "basic_analytics", "label": "Analytics basiques", "type": "bool", "group": "analytics"},
    {"key": "advanced_analytics", "label": "Analytics avancées & exports", "type": "bool", "group": "analytics"},
    {"key": "sso_office365_google", "label": "SSO (Office 365)", "type": "bool", "group": "integrations"},
    {"key": "slack_teams_integration", "label": "Intégration Slack / Teams", "type": "bool", "group": "integrations"},
    {"key": "api_access", "label": "API & webhooks", "type": "bool", "group": "integrations"},
    {"key": "crm_integration", "label": "Intégration CRM", "type": "bool", "group": "integrations"},
]

# Shown on the public pricing/compare pages. Everything else stays available to
# the admin editor but is hidden from prospects.
PUBLIC_FEATURE_KEYS = [
    "electronic_signature",
    "secure_escrow_payment",
    "dispute_mediation",
    "certified_statistics",
    "concurrent_campaigns",
    "selective_castings",
    "open_castings",
    "users",
    "multi_environments",
    "contract_templates_max",
    "basic_analytics",
    "sso_office365_google",
    "api_access",
    "crm_integration",
]
_FEATURE_DEFS_BY_KEY = {d["key"]: d for d in PLAN_FEATURE_DEFS}
DEFAULT_PLAN_CODE = "starter"
PLATFORM_FEATURE_FIELDS = {
    "ambassador_programs": "ambassador_programs_enabled",
    "events": "events_enabled",
    "referral_program": "referral_program_enabled",
}


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
# Available before the brand ever subscribes. The public pricing page promises
# that discovery — signing up, browsing creators, building a campaign and
# reaching out — costs nothing; contracting a collaboration is the paywall
# (enforced when a contract is generated), so these keys must survive the
# "no active subscription" reset below.
FREE_TIER_FEATURES = {
    "concurrent_campaigns": -1,
    "selective_castings": True,
    "basic_analytics": True,
}


def get_brand_features(brand) -> dict:
    """Feature matrix applicable to a brand (defaults to the starter plan)."""
    code = getattr(brand, "subscription_plan", None) or DEFAULT_PLAN_CODE
    features = dict(get_plan_config(code)["features"])
    if not bool(getattr(brand, "subscription_active", False)):
        for definition in PLAN_FEATURE_DEFS:
            key = definition["key"]
            if key in FREE_TIER_FEATURES:
                features[key] = FREE_TIER_FEATURES[key]
            elif definition["type"] == "bool":
                features[key] = False
            elif definition["type"] == "limit":
                features[key] = 0
            elif definition["type"] == "choice":
                features[key] = definition["choices"][0]
        return features
    for key, field in PLATFORM_FEATURE_FIELDS.items():
        if key in features and not is_platform_feature_enabled(key):
            features[key] = False
    return features


def is_platform_feature_enabled(key: str) -> bool:
    from ..models import PlatformSettings

    field = PLATFORM_FEATURE_FIELDS.get(key)
    if not field:
        return True
    return bool(getattr(PlatformSettings.get_instance(), field))


def require_platform_feature(key: str, message: str | None = None) -> None:
    if not is_platform_feature_enabled(key):
        raise PermissionDenied(message or "This feature is currently disabled by the platform administrator.")


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
