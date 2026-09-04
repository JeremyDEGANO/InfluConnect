import { useEffect, useMemo, useState } from "react"
import { Fragment } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Sparkles, ArrowRight, Loader2, ShieldCheck, Rocket } from "lucide-react"
import { cn } from "@/lib/utils"

type PlanId = "starter" | "growth" | "pro"

interface Plan {
  id: PlanId
  name: string
  price_eur_monthly: number
  price_eur_monthly_billed_annually: number
  price_eur_annual_total: number
  annual_savings_eur: number
  annual_months_free: number
  features: Record<string, unknown>
}

type ApiPlan = {
  id?: PlanId
  code?: PlanId
  name: string
  price_eur_monthly?: number
  price_eur?: number
  price_eur_monthly_billed_annually?: number
  price_eur_annual_total?: number
  annual_savings_eur?: number
  annual_months_free?: number
  features?: Record<string, unknown>
}

type FeatureDef = {
  key: string
  label: string
  type: "bool" | "limit" | "choice"
  group: string
}

const GROUP_LABELS: Record<string, string> = {
  core: "pricing.groups.core",
  campaigns: "pricing.groups.campaigns",
  team: "pricing.groups.team",
  contracts: "pricing.groups.contracts",
  analytics: "pricing.groups.analytics",
  integrations: "pricing.groups.integrations",
}

const GROUP_ORDER = ["core", "campaigns", "team", "contracts", "analytics", "integrations"]

export default function Pricing() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<Plan[]>([])
  const [featureDefs, setFeatureDefs] = useState<FeatureDef[]>([])
  const [publicKeys, setPublicKeys] = useState<string[]>([])
  const [commissionRate, setCommissionRate] = useState<number>(0)
  const [billing, setBilling] = useState<"annual" | "monthly">("annual")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get("/reference/plans/")
      .then((res) => {
        const data = res.data as {
          plans?: ApiPlan[]
          feature_defs?: FeatureDef[]
          public_feature_keys?: string[]
          commission_rate?: number
          annual_discount_percent?: number
        }
        const rawList = data.plans ?? []
        const list: Plan[] = rawList
          .map((plan) => {
            const monthly = Number(plan.price_eur_monthly ?? plan.price_eur ?? 0)
            return {
              id: (plan.id ?? plan.code) as PlanId,
              name: plan.name,
              price_eur_monthly: monthly,
              price_eur_monthly_billed_annually: Number(plan.price_eur_monthly_billed_annually ?? monthly),
              price_eur_annual_total: Number(plan.price_eur_annual_total ?? monthly * 12),
              annual_savings_eur: Number(plan.annual_savings_eur ?? 0),
              annual_months_free: Number(plan.annual_months_free ?? 0),
              features: plan.features ?? {},
            }
          })
          .filter((plan) => plan.id === "starter" || plan.id === "growth" || plan.id === "pro")

        const order: PlanId[] = ["starter", "growth", "pro"]
        setPlans([...list].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)))
        setFeatureDefs(data.feature_defs ?? [])
        setPublicKeys(data.public_feature_keys ?? [])
        setCommissionRate(Number(data.commission_rate ?? 0))
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [])

  const groups = useMemo(() => {
    const visible = featureDefs.filter((def) => publicKeys.includes(def.key))
    const map = new Map<string, FeatureDef[]>()
    for (const def of visible) {
      if (!map.has(def.group)) map.set(def.group, [])
      map.get(def.group)!.push(def)
    }
    return GROUP_ORDER
      .filter((group) => map.has(group))
      .map((group) => [group, map.get(group)!] as const)
  }, [featureDefs, publicKeys])

  const featureLabel = (def: FeatureDef) => t(`pricing.features.${def.key}`, def.label)

  const renderCell = (plan: Plan, def: FeatureDef) => {
    const value = (plan.features ?? {})[def.key]
    if (def.type === "bool") {
      return value
        ? <Check className="h-5 w-5 text-emerald-500 mx-auto" />
        : <X className="h-5 w-5 text-gray-300 mx-auto" />
    }
    if (def.type === "limit") {
      if (value === -1) return <span className="font-medium text-aurora-blue">{t("pricing.unlimited")}</span>
      if (value === 0 || value === undefined) return <X className="h-5 w-5 text-gray-300 mx-auto" />
      return <span className="font-medium">{String(value)}</span>
    }
    return <span>{String(value ?? "")}</span>
  }

  const priceFor = (plan: Plan) =>
    billing === "annual" ? plan.price_eur_monthly_billed_annually : plan.price_eur_monthly

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n))

  // Plans are configured so annual billing frees up whole months; show the
  // headline the same way for every plan.
  const monthsFree = Math.round(plans[0]?.annual_months_free ?? 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="container max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-3"><Sparkles className="h-3 w-3 mr-1" /> {t("pricing.tag")}</Badge>
          <h1 className="text-4xl sm:text-5xl font-semibold text-aurora-ink">{t("pricing.brand_title")}</h1>
          <p className="text-aurora-ink-3 mt-4 max-w-2xl mx-auto">{t("pricing.brand_subtitle")}</p>

          {/* Billing period selector — annual first */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-aurora-line shadow-sm mt-7">
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                billing === "annual" ? "bg-aurora-blue text-white" : "text-aurora-ink-2 hover:bg-aurora-surface",
              )}
            >
              {t("pricing.billing_annual")}
              {monthsFree > 0 && (
                <span className={cn(
                  "ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  billing === "annual" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700",
                )}>
                  {t("pricing.months_free", { count: monthsFree })}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                billing === "monthly" ? "bg-aurora-blue text-white" : "text-aurora-ink-2 hover:bg-aurora-surface",
              )}
            >
              {t("pricing.billing_monthly")}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-aurora-ink-3">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t("common.loading")}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center text-aurora-ink-3 py-24">{t("pricing.unavailable")}</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {plans.map((p) => {
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
                      <span className="text-4xl font-semibold text-aurora-ink">{fmt(priceFor(p))}€</span>
                      <span className="text-aurora-ink-3">/{t("pricing.per_month")}</span>
                    </div>
                    {billing === "annual" ? (
                      <p className="text-xs text-emerald-700 mt-1.5">
                        {t("pricing.annual_billed", {
                          total: fmt(p.price_eur_annual_total),
                          saving: fmt(p.annual_savings_eur),
                        })}
                      </p>
                    ) : (
                      <p className="text-xs text-aurora-ink-3 mt-1.5">{t("pricing.monthly_billed")}</p>
                    )}
                    <p className="text-sm text-aurora-ink-3 mt-3 min-h-[40px]">
                      {t(`pricing.plans.${p.id}.tagline`)}
                    </p>
                    <Button variant={highlighted ? "gradient" : "outline"} className="w-full mt-6" asChild>
                      <Link to="/register?type=brand">
                        {t("pricing.start_free")}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                    <p className="text-[11px] text-aurora-ink-3 mt-2.5 text-center leading-snug">
                      {t("pricing.free_until_contract")}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Freemium model spelled out so the CTA is never ambiguous */}
            <div className="max-w-3xl mx-auto mb-12 rounded-2xl border border-aurora-line bg-white p-5">
              <div className="flex gap-3">
                <Rocket className="h-5 w-5 text-aurora-blue shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-aurora-ink">{t("pricing.how_it_works_title")}</p>
                  <p className="text-sm text-aurora-ink-2 mt-1">{t("pricing.how_it_works_body")}</p>
                </div>
              </div>
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
                      {plans.map((p) => (
                        <th key={p.id} className="font-semibold text-aurora-ink-2 px-6 py-4 text-center">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(([groupKey, defs]) => (
                      <Fragment key={groupKey}>
                        <tr className="bg-aurora-surface/40 border-t border-aurora-line">
                          <td colSpan={plans.length + 1} className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-aurora-ink-3">
                            {t(GROUP_LABELS[groupKey] ?? groupKey)}
                          </td>
                        </tr>
                        {defs.map((def) => (
                          <tr key={def.key} className="border-t border-aurora-line">
                            <td className="px-6 py-3.5 text-aurora-ink-2">{featureLabel(def)}</td>
                            {plans.map((p) => (
                              <td key={p.id} className="px-6 py-3.5 text-center">
                                {renderCell(p, def)}
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

            {/* Commission restated under the table, as a discreet footnote */}
            {commissionRate > 0 && (
              <div className="max-w-2xl mx-auto mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                <div className="flex gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-emerald-900">
                      {t("pricing.commission_title", { rate: fmt(commissionRate) })}
                    </p>
                    <p className="text-[12px] text-emerald-800 mt-1 leading-relaxed">
                      {t("pricing.commission_body", { rate: fmt(commissionRate) })}
                    </p>
                    <p className="text-[12px] text-emerald-800 mt-1.5 font-medium leading-relaxed">
                      {t("pricing.commission_payer")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="text-center mt-14">
              <p className="text-sm text-aurora-ink-3 mb-4">{t("pricing.footer_note")}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="gradient" size="lg" asChild>
                  <Link to="/register?type=brand">{t("pricing.start_free")}</Link>
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
