import { useEffect, useMemo, useState } from "react"
import { Fragment } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Sparkles, ArrowRight, Loader2 } from "lucide-react"

interface Plan {
  id: "starter" | "growth" | "pro"
  name: string
  price_eur_monthly: number
  features: Record<string, unknown>
}

type Row = {
  key: string
  label: string
  group: string
  format?: "bool" | "number" | "support"
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
  { key: "dedicated_account_manager", label: "pricing.features.account_manager", group: "pricing.groups.support", format: "bool" },
  { key: "priority_support", label: "pricing.features.priority_support", group: "pricing.groups.support", format: "support" },
]

export default function Pricing() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get("/reference/plans/")
      .then((res) => {
        const data = res.data as { plans?: Plan[] } | Plan[]
        const list = Array.isArray(data) ? data : data.plans ?? []
        const order = ["starter", "growth", "pro"] as const
        setPlans([...list].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)))
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const r of ROWS) {
      if (!map.has(r.group)) map.set(r.group, [])
      map.get(r.group)!.push(r)
    }
    return Array.from(map.entries())
  }, [])

  const renderCell = (plan: Plan, row: Row) => {
    const v = (plan.features ?? {})[row.key] as unknown
    if (row.format === "bool") {
      return v ? <Check className="h-5 w-5 text-emerald-500 mx-auto" /> : <X className="h-5 w-5 text-gray-300 mx-auto" />
    }
    if (row.format === "number") {
      if (v === -1) return <span className="font-medium text-indigo-600">{t("pricing.unlimited")}</span>
      if (v === 0) return <X className="h-5 w-5 text-gray-300 mx-auto" />
      return <span className="font-medium">{String(v)}</span>
    }
    if (row.format === "support") {
      if (v === "none") return <X className="h-5 w-5 text-gray-300 mx-auto" />
      if (v === "email_48h") return <span>{t("pricing.support.email_48h")}</span>
      if (v === "email_phone_24h") return <span className="font-medium text-indigo-600">{t("pricing.support.email_phone_24h")}</span>
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
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">{t("pricing.title")}</h1>
          <p className="text-gray-500 mt-4 max-w-2xl mx-auto">{t("pricing.subtitle")}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t("common.loading")}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center text-gray-400 py-24">{t("pricing.unavailable")}</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-14">
              {plans.map((p) => {
                const highlighted = p.id === "growth"
                return (
                  <div
                    key={p.id}
                    className={[
                      "relative rounded-2xl border bg-white p-7 shadow-sm transition",
                      highlighted ? "border-indigo-500 shadow-indigo-500/10 shadow-xl md:-translate-y-2" : "border-gray-100",
                    ].join(" ")}
                  >
                    {highlighted && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white border-0">
                        {t("pricing.most_popular")}
                      </Badge>
                    )}
                    <div className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">{p.name}</div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900">{p.price_eur_monthly}€</span>
                      <span className="text-gray-400">/{t("pricing.per_month")}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2 min-h-[40px]">
                      {t(`pricing.plans.${p.id}.tagline`)}
                    </p>
                    <Button
                      variant={highlighted ? "gradient" : "outline"}
                      className="w-full mt-6"
                      asChild
                    >
                      <Link to="/register">
                        {p.id === "pro" ? t("pricing.contact_sales") : t("pricing.start_trial")}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Comparison table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-100">
                      <th className="text-left font-semibold text-gray-700 px-6 py-4 w-1/3">
                        {t("pricing.compare_title")}
                      </th>
                      {plans.map((p) => (
                        <th key={p.id} className="font-semibold text-gray-700 px-6 py-4 text-center">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(([groupKey, rows]) => (
                      <Fragment key={groupKey}>
                        <tr className="bg-gray-50/40 border-t border-gray-100">
                          <td colSpan={plans.length + 1} className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                            {t(groupKey)}
                          </td>
                        </tr>
                        {rows.map((row) => (
                          <tr key={row.key} className="border-t border-gray-100">
                            <td className="px-6 py-3.5 text-gray-700">{t(row.label)}</td>
                            {plans.map((p) => (
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
              <p className="text-sm text-gray-500 mb-4">{t("pricing.footer_note")}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="gradient" size="lg" asChild>
                  <Link to="/register">{t("pricing.start_trial")}</Link>
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
