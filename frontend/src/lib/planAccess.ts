import type { User } from "@/lib/auth"

/**
 * Single source of truth for "does this plan include that page?".
 *
 * The sidebar, the route guards and the guided tour all read this, so a page
 * can never be hidden from the menu yet reachable by typing its URL, and the
 * tour can never walk someone through a feature they have not paid for.
 *
 * Plan features are admin-configurable and arrive with the session
 * (`active_brand.plan_features`), so nothing here hardcodes a plan name.
 */
export type PlanFeatures = Record<string, unknown> | undefined

export interface AccessContext {
  planFeatures: PlanFeatures
  platformFeatures?: Record<string, unknown>
  environmentsCount: number
  isAgency: boolean
}

export function accessContext(user: User | null | undefined): AccessContext {
  return {
    planFeatures: user?.active_brand?.plan_features as PlanFeatures,
    platformFeatures: user?.platform_features as Record<string, unknown> | undefined,
    environmentsCount: user?.brand_environments?.length ?? 0,
    isAgency: Boolean(user?.active_brand?.is_agency),
  }
}

/**
 * Absent payload (an older cached session) stays permissive: the backend
 * enforces entitlements anyway, and locking someone out of their own account
 * over a stale cache would be worse than showing a page that 403s.
 */
const featureOn = (planFeatures: PlanFeatures, key: string) =>
  !planFeatures || Boolean(planFeatures[key])

/** Paths gated by the subscription, with the rule that unlocks each one. */
const RULES: Record<string, (ctx: AccessContext) => boolean> = {
  "/brand/ambassadors": (c) => featureOn(c.planFeatures, "ambassador_programs"),
  "/brand/events": (c) => featureOn(c.planFeatures, "events"),
  "/brand/castings": (c) => featureOn(c.planFeatures, "open_castings"),
  "/brand/contract-templates": (c) =>
    !c.planFeatures || Number(c.planFeatures.contract_templates_max ?? 0) !== 0,
  // The integrations hub is worth showing as soon as one integration is included.
  "/brand/integrations": (c) =>
    featureOn(c.planFeatures, "api_access")
    || featureOn(c.planFeatures, "sso_office365_google")
    || featureOn(c.planFeatures, "slack_teams_integration")
    || featureOn(c.planFeatures, "crm_integration"),
  // Someone already in several environments keeps access to switch between them.
  "/brand/environments": (c) =>
    featureOn(c.planFeatures, "multi_environments") || c.environmentsCount > 1,
}

/** Longest matching rule, so /brand/events/new inherits /brand/events. */
function ruleFor(path: string): ((ctx: AccessContext) => boolean) | undefined {
  const match = Object.keys(RULES)
    .filter((base) => path === base || path.startsWith(`${base}/`))
    .sort((a, b) => b.length - a.length)[0]
  return match ? RULES[match] : undefined
}

export function canAccessPath(path: string, ctx: AccessContext): boolean {
  const rule = ruleFor(path)
  return rule ? rule(ctx) : true
}

/** Which plan feature a path needs — used to explain the block to the user. */
export const PATH_FEATURE_LABEL: Record<string, string> = {
  "/brand/ambassadors": "ambassador_programs",
  "/brand/events": "events",
  "/brand/castings": "open_castings",
  "/brand/contract-templates": "contract_templates_max",
  "/brand/integrations": "api_access",
  "/brand/environments": "multi_environments",
}

export function featureKeyForPath(path: string): string | undefined {
  const match = Object.keys(PATH_FEATURE_LABEL)
    .filter((base) => path === base || path.startsWith(`${base}/`))
    .sort((a, b) => b.length - a.length)[0]
  return match ? PATH_FEATURE_LABEL[match] : undefined
}
