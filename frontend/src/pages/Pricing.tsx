import { useEffect, useMemo, useState } from "react"
import { Fragment } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Sparkles, ArrowRight, Loader2, Briefcase, Building2 } from "lucide-react"

interface Plan {
  id: "starter" | "growth" | "pro"
  name: string
  price_eur_monthly: number
  features: Record<string, unknown>
}

type ApiPlan = {
  id?: "starter" | "growth" | "pro"
  code?: "starter" | "growth" | "pro"
  name: string
  price_eur_monthly?: number
  price_eur?: number
  features?: Record<string, unknown>
}

type Row = {
  key: string
  label: string
  group: string
  format?: "bool" | "number" | "support"
}

type FeatureValue = boolean | number | string
type FeatureMatrix = Record<string, FeatureValue>

const FALLBACK_FEATURES: Record<Plan["id"], FeatureMatrix> = {
  starter: {
    concurrent_campaigns: 2,
    monthly_influencer_contacts: 20,
    users: 1,
    contract_templates_max: 2,
    basic_analytics: true,
    advanced_analytics: false,
    sso_office365_google: false,
    slack_teams_integration: false,
    api_access: false,
    crm_integration: false,
    multi_brand_workspaces: false,
    agency_delegations: false,
    white_label_reports: false,
    dedicated_account_manager: false,
    priority_support: "email_48h",
  },
  growth: {
    concurrent_campaigns: 8,
    monthly_influencer_contacts: 120,
    users: 5,
    contract_templates_max: 12,
    basic_analytics: true,
    advanced_analytics: true,
    sso_office365_google: true,
    slack_teams_integration: true,
    api_access: false,
    crm_integration: true,
    multi_brand_workspaces: false,
    agency_delegations: true,
    white_label_reports: false,
    dedicated_account_manager: false,
    priority_support: "email_phone_24h",
  },
  pro: {
    concurrent_campaigns: -1,
    monthly_influencer_contacts: -1,
    users: -1,
    contract_templates_max: -1,
    basic_analytics: true,
    advanced_analytics: true,
    sso_office365_google: true,
    slack_teams_integration: true,
    api_access: true,
    crm_integration: true,
    multi_brand_workspaces: true,
    agency_delegations: true,
    white_label_reports: true,
    dedicated_account_manager: true,
    priority_support: "email_phone_24h",
  },
}

const ROWS: Row[] = [
  { key: "concurrent_campaigns", label: "pricing.features.concurrent_campaigns", group: "pricing.groups.campaigns", format: "number" },
  { key: "monthly_influencer_contacts", label: "pricing.features.monthly_influencer_contacts", group: "pricing.groups.campaigns", format: "number" },
  { key: "users", label: "pricing.features.users", group: "pricing.groups.team", format: "number" },
  { key: "contract_templates_max", label: "pricing.features.contract_templates_max", group: "pricing.groups.contracts", format: "number" },
  { key: "basic_analytics", label: "pricing.features.basic_analytics", group: "pricing.groups.analytics", format: "bool" },
  { key: "advanced_analytics", label: "pricing.features.advanced_analytics", group: "pricing.groups.analytics", format: "bool" },
  { key: "sso_office365_google", label: "pricing.features.sso", group: "pricing.groups.integrations", format: "bool" },
  { key: "slack_teams_integration", label: "pricing.features.slack_teams", group: "pricing.groups.integrations", format: "bool" },
  { key: "api_access", label: "pricing.features.api_access", group: "pricing.groups.integrations", format: "bool" },
  { key: "crm_integration", label: "pricing.features.crm_integration", group: "pricing.groups.integrations", format: "bool" },
  { key: "multi_brand_workspaces", label: "pricing.features.multi_brand_workspaces", group: "pricing.groups.agency", format: "bool" },
  { key: "agency_delegations", label: "pricing.features.agency_delegations", group: "pricing.groups.agency", format: "bool" },
  { key: "white_label_reports", label: "pricing.features.white_label_reports", group: "pricing.groups.agency", format: "bool" },
  { key: "dedicated_account_manager", label: "pricing.features.account_manager", group: "pricing.groups.support", format: "bool" },
  { key: "priority_support", label: "pricing.features.priority_support", group: "pricing.groups.support", format: "support" },
]

export default function Pricing() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const mode: "brand" | "agency" = location.pathname.includes("/pricing/agencies") ? "agency" : "brand"

  useEffect(() => {
    api.get("/reference/plans/")
      .then((res) => {
        const data = res.data as { plans?: ApiPlan[] } | ApiPlan[]
        const rawList = Array.isArray(data) ? data : data.plans ?? []
        const list: Plan[] = rawList
          .map((plan) => ({
            id: (plan.id ?? plan.code) as Plan["id"],
            name: plan.name,
            price_eur_monthly: Number(plan.price_eur_monthly ?? plan.price_eur ?? 0),
            features: plan.features ?? {},
          }))
          .filter((plan) => plan.id === "starter" || plan.id === "growth" || plan.id === "pro")
        const order = ["starter", "growth", "pro"] as const
        setPlans(
          [...list].sort((a, b) => {
            const left = order.indexOf(a.id)
            const right = order.indexOf(b.id)
            const safeLeft = left === -1 ? 999 : left
            const safeRight = right === -1 ? 999 : right
            return safeLeft - safeRight
          })
        )
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [])

  const displayPlans = useMemo(() => {
    if (mode === "agency") {
      return plans.filter((plan) => plan.id === "growth" || plan.id === "pro")
    }
    return plans
  }, [mode, plans])

  const groups = useMemo(() => {
    const activeRows = mode === "brand" ? ROWS.filter((row) => row.group !== "pricing.groups.agency") : ROWS
    const map = new Map<string, Row[]>()
    for (const r of activeRows) {
      if (!map.has(r.group)) map.set(r.group, [])
      map.get(r.group)!.push(r)
    }
    return Array.from(map.entries())
  }, [mode])

  const renderCell = (plan: Plan, row: Row) => {
    const planFallback = FALLBACK_FEATURES[plan.id] ?? FALLBACK_FEATURES.starter
    const v = ((plan.features ?? {})[row.key] ?? planFallback[row.key] ?? false) as unknown
    if (row.format === "bool") {
      return v ? <Check className="h-5 w-5 text-emerald-500 mx-auto" /> : <X className="h-5 w-5 text-gray-300 mx-auto" />
    }
    if (row.format === "number") {
      if (v === -1) return <span className="font-medium text-aurora-blue">{t("pricing.unlimited")}</span>
      if (v === 0) return <X className="h-5 w-5 text-gray-300 mx-auto" />
      return <span className="font-medium">{String(v)}</span>
    }
    if (row.format === "support") {
      if (v === "none") return <X className="h-5 w-5 text-gray-300 mx-auto" />
      if (v === "email_48h") return <span>{t("pricing.support.email_48h")}</span>
      if (v === "email_phone_24h") return <span className="font-medium text-aurora-blue">{t("pricing.support.email_phone_24h")}</span>
      return <span>{String(v)}</span>
    }
    return <span>{String(v)}</span>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="container max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-3"><Sparkles className="h-3 w-3 mr-1" /> {t("pricing.tag")}</Badge>
          <h1 className="text-4xl sm:text-5xl font-semibold text-aurora-ink">{mode === "agency" ? t("pricing.agency_title") : t("pricing.brand_title")}</h1>
          <p className="text-aurora-ink-3 mt-4 max-w-2xl mx-auto">{mode === "agency" ? t("pricing.agency_subtitle") : t("pricing.brand_subtitle")}</p>
          <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-white border border-aurora-line shadow-sm mt-7">
            <Button
              variant={mode === "brand" ? "gradient" : "ghost"}
              className="rounded-lg"
              onClick={() => navigate("/pricing/brands")}
            >
              <Building2 className="h-4 w-4" />
              {t("pricing.switch_brand")}
            </Button>
            <Button
              variant={mode === "agency" ? "gradient" : "ghost"}
              className="rounded-lg"
              onClick={() => navigate("/pricing/agencies")}
            >
              <Briefcase className="h-4 w-4" />
              {t("pricing.switch_agency")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-aurora-ink-3">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t("common.loading")}
          </div>
        ) : displayPlans.length === 0 ? (
          <div className="text-center text-aurora-ink-3 py-24">{t("pricing.unavailable")}</div>
        ) : (
          <>
            {mode === "agency" && (
              <div className="max-w-4xl mx-auto mb-8 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 text-sm text-cyan-800 text-center">
                {t("pricing.agency_paid_note")}
              </div>
            )}
            {/* Summary cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-14">
              {displayPlans.map((p) => {
                const highlighted = p.id === "growth"
                return (
                  <div
                    key={p.id}
                    className={[
                      "relative rounded-2xl border bg-white p-7 shadow-sm transition",
                      highlighted ? "border-indigo-500 shadow-indigo-500/10 shadow-xl md:-translate-y-2" : "border-aurora-line",
                    ].join(" ")}
                  >
                    {highlighted && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white border-0">
                        {t("pricing.most_popular")}
                      </Badge>
                    )}
                    <div className="text-sm font-semibold text-aurora-blue uppercase tracking-wider">{p.name}</div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-semibold text-aurora-ink">{p.price_eur_monthly}€</span>
                      <span className="text-aurora-ink-3">/{t("pricing.per_month")}</span>
                    </div>
                    <p className="text-sm text-aurora-ink-3 mt-2 min-h-[40px]">
                      {t(`pricing.plans.${p.id}.tagline`)}
                    </p>
                    <Button
                      variant={highlighted ? "gradient" : "outline"}
                      className="w-full mt-6"
                      asChild
                    >
                      <Link to={mode === "agency" ? "/register?type=agency" : "/register?type=brand"}>
                        {mode === "agency" ? t("pricing.start_agency") : (p.id === "pro" ? t("pricing.contact_sales") : t("pricing.start_trial"))}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Comparison table */}
            <div className="bg-white rounded-2xl border border-aurora-line shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-aurora-surface/70 border-b border-aurora-line">
                      <th className="text-left font-semibold text-aurora-ink-2 px-6 py-4 w-1/3">
                        {t("pricing.compare_title")}
                      </th>
                      {displayPlans.map((p) => (
                        <th key={p.id} className="font-semibold text-aurora-ink-2 px-6 py-4 text-center">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(([groupKey, rows]) => (
                      <Fragment key={groupKey}>
                        <tr className="bg-aurora-surface/40 border-t border-aurora-line">
                          <td colSpan={displayPlans.length + 1} className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-aurora-ink-3">
                            {t(groupKey)}
                          </td>
                        </tr>
                        {rows.map((row) => (
                          <tr key={row.key} className="border-t border-aurora-line">
                            <td className="px-6 py-3.5 text-aurora-ink-2">{t(row.label)}</td>
                            {displayPlans.map((p) => (
                              <td key={p.id} className="px-6 py-3.5 text-center">
                                {renderCell(p, row)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center mt-14">
              <p className="text-sm text-aurora-ink-3 mb-4">{t("pricing.footer_note")}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="gradient" size="lg" asChild>
                  <Link to={mode === "agency" ? "/register?type=agency" : "/register?type=brand"}>
                    {mode === "agency" ? t("pricing.start_agency") : t("pricing.start_trial")}
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/login">{t("pricing.login")}</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
