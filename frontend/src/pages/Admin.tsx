import { Fragment, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  fetchAdminOverview,
  updateAdminUserStatus,
  type AdminOverview,
  type AdminOverviewBrand,
  type AdminOverviewUser,
} from "@/lib/apiExtra"
import { StatsCard } from "@/components/shared/StatsCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Shield,
  Building2,
  Users,
  TrendingUp,
  Wallet,
  LifeBuoy,
  Briefcase,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
} from "lucide-react"
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

const USER_TYPE_COLORS: Record<string, string> = {
  influencer: "bg-violet-100 text-violet-700",
  brand: "bg-sky-100 text-sky-700",
  admin: "bg-red-100 text-red-700",
}

function money(value: number) {
  return `EUR ${Number(value ?? 0).toLocaleString()}`
}

export default function Admin() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedBrandId, setExpandedBrandId] = useState<number | null>(null)
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [busyUserId, setBusyUserId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchAdminOverview()
      setOverview(data)
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sortedBrands = useMemo(() => {
    const list = overview?.brands ?? []
    return [...list].sort((a, b) => {
      if (a.subscription_active !== b.subscription_active) return a.subscription_active ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [overview?.brands])

  const sortedUsers = useMemo(() => {
    const list = overview?.users ?? []
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [overview?.users])

  const toggleUser = async (user: AdminOverviewUser, nextValue: boolean) => {
    setBusyUserId(user.id)
    try {
      await updateAdminUserStatus(user.id, nextValue)
      toast({ title: nextValue ? t("admin_page.user_activated") : t("admin_page.user_deactivated") })
      await load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setBusyUserId(null)
    }
  }

  if (loading || !overview) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}
      </div>
    )
  }

  const { kpis, subscription_projection: projection } = overview

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
          <Shield className="h-5 w-5 text-slate-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t("admin_page.panel")}</h1>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title={t("admin_page.total_users")} value={kpis.users_total} icon={Users} />
        <StatsCard title={t("admin_page.new_users_30d")} value={kpis.users_new_last_30d} icon={TrendingUp} />
        <StatsCard title={t("admin_page.active_companies")} value={kpis.brands_active_subscription} icon={Building2} />
        <StatsCard title={t("admin_page.active_campaigns")} value={kpis.campaigns_live} icon={Briefcase} />
        <StatsCard title={t("admin_page.open_tickets")} value={kpis.support_tickets_open} icon={LifeBuoy} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="card-base lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("admin_page.subscription_projection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">{t("admin_page.revenue_this_month")}</p>
                <p className="text-xl font-semibold text-gray-900">{money(projection.projected_this_month)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">{t("admin_page.revenue_next_month")}</p>
                <p className="text-xl font-semibold text-gray-900">{money(projection.projected_next_month)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">{t("admin_page.delta_next_month")}</p>
                <p className={`text-xl font-semibold ${projection.delta_next_vs_this >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {projection.delta_next_vs_this >= 0 ? "+" : ""}{money(projection.delta_next_vs_this)}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {(["starter", "growth", "pro"] as const).map((plan) => {
                const active = projection.active_plan_counts[plan] ?? 0
                const pending = projection.pending_plan_counts[plan] ?? 0
                const total = active + pending
                return (
                  <div key={plan} className="rounded-xl border border-gray-100 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={PLAN_COLORS[plan]}>{plan}</Badge>
                      <span className="text-xs text-gray-500">{t("admin_page.active")}: {active}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${Math.min((total / Math.max((kpis.brands_total || 1), 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{t("admin_page.pending")}: {pending}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base">{t("admin_page.ops_health")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t("admin_page.brands_pending_validation")}</span>
              <span className="font-semibold text-gray-900">{kpis.brands_pending_validation}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t("admin_page.support_sla_risk")}</span>
              <span className={`font-semibold ${kpis.support_tickets_stale_48h > 0 ? "text-amber-600" : "text-emerald-600"}`}>{kpis.support_tickets_stale_48h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t("admin_page.total_campaigns")}</span>
              <span className="font-semibold text-gray-900">{kpis.campaigns_total}</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">{t("admin_page.proposal_funnel")}</p>
              <div className="space-y-1">
                {Object.entries(overview.proposal_status_counts).slice(0, 6).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{status}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-base">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("admin_page.company_list")}</CardTitle>
          <Link to="/admin/brands"><Button size="sm" variant="outline">{t("common.view_all", "Voir tout")}</Button></Link>
        </CardHeader>
        <CardContent>
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
                {sortedBrands.map((b: AdminOverviewBrand) => (
                  <Fragment key={b.id}>
                    <tr
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedBrandId(expandedBrandId === b.id ? null : b.id)}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {expandedBrandId === b.id ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
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
                    {expandedBrandId === b.id && (
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
                ))}
                {sortedBrands.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">{t("admin_page.empty_companies")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader>
          <CardTitle>{t("admin_page.user_management")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-2 px-3">{t("admin_page.col_user")}</th>
                  <th className="text-left py-2 px-3">{t("admin_page.col_type")}</th>
                  <th className="text-center py-2 px-3">{t("admin_page.col_status")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_joined")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u: AdminOverviewUser) => (
                  <Fragment key={u.id}>
                    <tr
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {expandedUserId === u.id ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3"><Badge className={USER_TYPE_COLORS[u.user_type]}>{u.user_type}</Badge></td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}>
                          {u.is_active ? t("admin_page.active") : t("admin_page.inactive")}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyUserId === u.id || u.is_active}
                            onClick={(e) => { e.stopPropagation(); toggleUser(u, true) }}
                            className="h-7 px-2 text-emerald-700"
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyUserId === u.id || !u.is_active}
                            onClick={(e) => { e.stopPropagation(); toggleUser(u, false) }}
                            className="h-7 px-2 text-rose-600"
                          >
                            {busyUserId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedUserId === u.id && (
                      <tr className="border-t border-gray-100 bg-gray-50/50">
                        <td colSpan={5} className="px-4 py-3 text-xs text-gray-600">
                          <div className="grid md:grid-cols-4 gap-3">
                            <p><span className="text-gray-400">{t("admin_page.language")}: </span>{u.language_preference}</p>
                            <p><span className="text-gray-400">{t("admin_page.phone")}: </span>{u.phone || "-"}</p>
                            <p><span className="text-gray-400">{t("admin_page.location")}: </span>{u.location || "-"}</p>
                            <p><span className="text-gray-400">2FA: </span>{u.totp_enabled ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                            {u.user_type === "brand" && (
                              <>
                                <p><span className="text-gray-400">{t("admin_page.company")}: </span>{u.company_name || "-"}</p>
                                <p><span className="text-gray-400">{t("admin_page.plan")}: </span>{u.subscription_plan || "-"}</p>
                                <p><span className="text-gray-400">{t("admin_page.subscription_active")}: </span>{u.subscription_active ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                              </>
                            )}
                            <p><span className="text-gray-400">{t("admin_page.last_login")}: </span>{u.last_login ? new Date(u.last_login).toLocaleString() : "-"}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {sortedUsers.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">{t("admin_page.empty_users")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-4 gap-4">
        <Link to="/admin/brands">
          <Card className="card-base hover:shadow-md transition cursor-pointer"><CardContent className="p-4 text-sm font-medium">{t("admin_page.nav_brands")}</CardContent></Card>
        </Link>
        <Link to="/admin/reviews">
          <Card className="card-base hover:shadow-md transition cursor-pointer"><CardContent className="p-4 text-sm font-medium">{t("admin_page.nav_reviews")}</CardContent></Card>
        </Link>
        <Link to="/admin/audit-log">
          <Card className="card-base hover:shadow-md transition cursor-pointer"><CardContent className="p-4 text-sm font-medium">{t("admin_page.nav_audit")}</CardContent></Card>
        </Link>
        <Link to="/admin/support">
          <Card className="card-base hover:shadow-md transition cursor-pointer"><CardContent className="p-4 text-sm font-medium">{t("admin_page.nav_support")}</CardContent></Card>
        </Link>
      </div>
    </div>
  )
}
