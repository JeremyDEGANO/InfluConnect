import { Fragment, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchAdminOverview, type AdminOverviewBrand } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, ChevronDown, ChevronUp, Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-slate-100 text-slate-700",
  growth: "bg-blue-100 text-blue-700",
  pro: "bg-emerald-100 text-emerald-700",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
}

function money(value: number) {
  return `EUR ${Number(value ?? 0).toLocaleString()}`
}

export default function AdminCompanies() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<AdminOverviewBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setLoading(true)
    fetchAdminOverview()
      .then((d) => setItems(d.brands ?? []))
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setLoading(false))
  }, [t, toast])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((b) => {
      const haystack = [
        b.company_name,
        b.owner_name,
        b.email,
        b.website,
        b.sector,
        b.siret,
        b.validation_status,
        b.subscription_plan,
      ].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-slate-600" />
        <h1 className="text-2xl font-bold text-gray-900">{t("admin_companies.title")}</h1>
      </div>

      <Card className="card-base">
        <CardHeader>
          <CardTitle>{t("admin_page.company_list")} ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin_page.search_companies")}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-2 px-3">{t("admin_page.col_company")}</th>
                  <th className="text-left py-2 px-3">{t("admin_page.col_plan")}</th>
                  <th className="text-center py-2 px-3">{t("admin_page.col_status")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_mrr")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_team")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((b) => {
                  const key = String(b.id)
                  const isExpanded = expandedId === key
                  return (
                    <Fragment key={b.id}>
                      <tr
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId((current) => (current === key ? null : key))}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                            <div>
                              <p className="font-medium text-gray-900">{b.company_name}</p>
                              <p className="text-xs text-gray-500">{b.owner_name} · {b.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3"><Badge className={PLAN_COLORS[b.subscription_plan || "starter"]}>{b.subscription_plan || "-"}</Badge></td>
                        <td className="py-2 px-3 text-center"><Badge className={STATUS_COLORS[b.validation_status]}>{b.validation_status}</Badge></td>
                        <td className="py-2 px-3 text-right font-medium">{money(b.plan_price_monthly)}</td>
                        <td className="py-2 px-3 text-right">{b.team_size}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-gray-50/50">
                          <td colSpan={5} className="px-4 py-3 text-xs text-gray-600">
                            <div className="grid md:grid-cols-3 gap-3">
                              <div>
                                <p><span className="text-gray-400">{t("admin_page.website")}: </span>{b.website || "-"}</p>
                                <p><span className="text-gray-400">{t("admin_page.sector")}: </span>{b.sector || "-"}</p>
                                <p><span className="text-gray-400">SIRET: </span>{b.siret || "-"}</p>
                              </div>
                              <div>
                                <p><span className="text-gray-400">{t("admin_page.campaigns")}: </span>{b.campaigns_count}</p>
                                <p><span className="text-gray-400">{t("admin_page.subscription_active")}: </span>{b.subscription_active ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                                <p><span className="text-gray-400">{t("admin_page.subscription_expires")}: </span>{b.subscription_expires_at ? new Date(b.subscription_expires_at).toLocaleDateString() : "-"}</p>
                              </div>
                              <div>
                                <p><span className="text-gray-400">{t("admin_page.validated_by")}: </span>{b.validated_by_username || "-"}</p>
                                <p><span className="text-gray-400">{t("admin_page.days_since_signup")}: </span>{b.days_since_signup}</p>
                                <p><span className="text-gray-400">{t("admin_page.validation_note")}: </span>{b.validation_notes || "-"}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">{t("admin_page.empty_companies")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
