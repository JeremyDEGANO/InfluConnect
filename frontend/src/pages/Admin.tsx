import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchAdminOverview, type AdminOverview, fetchAdminFraudFlags, resolveAdminFraudFlag, type AdminFraudFlag } from "@/lib/apiExtra"
import { StatsCard } from "@/components/shared/StatsCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-aurora-surface text-aurora-ink-2",
  growth: "bg-blue-100 text-blue-700",
  pro: "bg-emerald-100 text-emerald-700",
}

function money(value: number) {
  return `EUR ${Number(value ?? 0).toLocaleString()}`
}

export default function Admin() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [fraudFlags, setFraudFlags] = useState<AdminFraudFlag[]>([])
  const [fraudLoading, setFraudLoading] = useState(false)

  const loadFraudFlags = () => {
    setFraudLoading(true)
    fetchAdminFraudFlags()
      .then(setFraudFlags)
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setFraudLoading(false))
  }

  useEffect(() => { loadFraudFlags() }, [])

  const resolveFlag = async (id: number) => {
    try {
      await resolveAdminFraudFlag(id)
      setFraudFlags((prev) => prev.filter((f) => f.id !== id))
      toast({ title: t("admin_page.fraud_flags.resolved", "Signalement résolu") })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchAdminOverview()
      .then((data) => setOverview(data))
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setLoading(false))
  }, [t, toast])

  const proposalEntries = useMemo(() => {
    const entries = Object.entries(overview?.proposal_status_counts ?? {})
    return entries.sort((a, b) => b[1] - a[1])
  }, [overview?.proposal_status_counts])

  if (loading || !overview) {
    return (
      <div className="flex items-center justify-center h-64 text-aurora-ink-3">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}
      </div>
    )
  }

  const { kpis, subscription_projection: projection } = overview
  const liveCampaigns = overview.live_campaigns ?? []
  const liveBudgetTotal = liveCampaigns.reduce((sum, c) => sum + Number(c.price_per_influencer ?? 0), 0)
  const liveInfluencersTarget = liveCampaigns.reduce((sum, c) => sum + Number(c.max_influencers ?? 0), 0)
  const liveProposalsTotal = liveCampaigns.reduce((sum, c) => sum + Number(c.proposals_total ?? 0), 0)
  const liveProposalsInProgress = liveCampaigns.reduce((sum, c) => sum + Number(c.proposals_in_progress ?? 0), 0)

  return (
    <div className="px-6 sm:px-8 py-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        eyebrow={t("admin_page.eyebrow", "Mis à jour il y a quelques instants")}
        title={t("admin_page.panel", "Vue d'ensemble")}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title={t("admin_page.total_users")} value={kpis.users_total} progress={75} progressColor="bg-aurora-blue" />
        <StatsCard title={t("admin_page.new_users_30d")} value={kpis.users_new_last_30d} progress={Math.min(100, (kpis.users_new_last_30d / Math.max(1, kpis.users_total)) * 100 * 5)} progressColor="bg-emerald-500" />
        <StatsCard title={t("admin_page.active_companies")} value={kpis.brands_active_subscription} progress={60} progressColor="bg-aurora-blue-deep" />
        <StatsCard title={t("admin_page.active_campaigns")} value={kpis.campaigns_live} progress={Math.min(100, kpis.campaigns_live * 5)} progressColor="bg-amber-500" />
        <StatsCard title={t("admin_page.open_tickets")} value={kpis.support_tickets_open} progress={Math.min(100, kpis.support_tickets_open * 10)} progressColor="bg-rose-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="card-base lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("admin_page.subscription_projection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-aurora-line p-3">
                <p className="text-xs text-aurora-ink-3">{t("admin_page.revenue_this_month")}</p>
                <p className="text-xl font-semibold text-aurora-ink">{money(projection.projected_this_month)}</p>
              </div>
              <div className="rounded-xl border border-aurora-line p-3">
                <p className="text-xs text-aurora-ink-3">{t("admin_page.revenue_next_month")}</p>
                <p className="text-xl font-semibold text-aurora-ink">{money(projection.projected_next_month)}</p>
              </div>
              <div className="rounded-xl border border-aurora-line p-3">
                <p className="text-xs text-aurora-ink-3">{t("admin_page.delta_next_month")}</p>
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
                  <div key={plan} className="rounded-xl border border-aurora-line p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={PLAN_COLORS[plan]}>{plan}</Badge>
                      <span className="text-xs text-aurora-ink-3">{t("admin_page.active")}: {active}</span>
                    </div>
                    <div className="h-2 rounded-full bg-aurora-surface overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${Math.min((total / Math.max((kpis.brands_total || 1), 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-aurora-ink-3">{t("admin_page.pending")}: {pending}</p>
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
              <span className="text-aurora-ink-2">{t("admin_page.brands_pending_validation")}</span>
              <span className="font-semibold text-aurora-ink">{kpis.brands_pending_validation}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-aurora-ink-2">{t("admin_page.support_sla_risk")}</span>
              <span className={`font-semibold ${kpis.support_tickets_stale_48h > 0 ? "text-amber-600" : "text-emerald-600"}`}>{kpis.support_tickets_stale_48h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-aurora-ink-2">{t("admin_page.total_campaigns")}</span>
              <span className="font-semibold text-aurora-ink">{kpis.campaigns_total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-aurora-ink-2">{t("admin_page.influencers")}</span>
              <span className="font-semibold text-aurora-ink">{kpis.influencers_total}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t("admin_page.active_campaigns")} value={liveCampaigns.length} progress={Math.min(100, liveCampaigns.length * 5)} progressColor="bg-aurora-blue" />
        <StatsCard title={t("admin_page.budget", "Budget")} value={money(liveBudgetTotal)} progress={Math.min(100, liveBudgetTotal > 0 ? 60 : 0)} progressColor="bg-amber-500" />
        <StatsCard title={t("admin_page.influencers", "Influenceurs")} value={liveInfluencersTarget} progress={Math.min(100, liveInfluencersTarget * 4)} progressColor="bg-emerald-500" />
        <StatsCard title={t("admin_page.proposals", "Propositions")} value={liveProposalsTotal} hint={`${t("admin_page.in_progress", "En cours")}: ${liveProposalsInProgress}`} progress={Math.min(100, liveProposalsTotal * 3)} progressColor="bg-aurora-blue-deep" />
      </div>

      <Card className="card-base">
        <CardHeader>
          <CardTitle>{t("admin_page.proposal_funnel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {proposalEntries.map(([status, count]) => (
              <div key={status} className="rounded-xl border border-aurora-line p-3">
                <p className="text-xs text-aurora-ink-3">{t(`status.${status}`, status)}</p>
                <p className="text-xl font-semibold text-aurora-ink mt-1">{count}</p>
              </div>
            ))}
            {proposalEntries.length === 0 && (
              <p className="text-sm text-aurora-ink-3">{t("admin_page.empty_live_campaigns", "Aucune donnée disponible.")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("admin_page.fraud_flags.title", "Signalements anti-fraude")}</CardTitle>
          <button onClick={loadFraudFlags} className="text-xs text-aurora-blue hover:underline">
            {t("common.refresh", "Rafra\u00eechir")}
          </button>
        </CardHeader>
        <CardContent>
          {fraudLoading ? (
            <div className="flex items-center text-aurora-ink-3 text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("common.loading")}</div>
          ) : fraudFlags.length === 0 ? (
            <p className="text-sm text-aurora-ink-3">{t("admin_page.fraud_flags.empty", "Aucun signalement actif.")}</p>
          ) : (
            <div className="divide-y divide-aurora-line">
              {fraudFlags.map((flag) => {
                const sevColor = flag.severity === "high" ? "bg-rose-100 text-rose-700" : flag.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-aurora-surface text-aurora-ink-2"
                return (
                  <div key={flag.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={sevColor}>{t(`admin_page.fraud_flags.severity.${flag.severity}`, flag.severity)}</Badge>
                        <Badge variant="outline">{t(`admin_page.fraud_flags.type.${flag.flag_type}`, flag.flag_type)}</Badge>
                        {flag.platform && <span className="text-xs text-aurora-ink-3">{flag.platform}</span>}
                      </div>
                      <p className="text-sm text-aurora-ink">
                        {flag.influencer_pseudo ? `@${flag.influencer_pseudo}` : `#${flag.influencer_id ?? "?"}`}
                        {flag.external_username ? ` — ${flag.external_username}` : ""}
                      </p>
                      <p className="text-[11px] text-aurora-ink-3 mt-1 font-mono break-all">{JSON.stringify(flag.details)}</p>
                      <p className="text-[11px] text-aurora-ink-3 mt-1">{new Date(flag.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => resolveFlag(flag.id)} className="text-xs px-3 py-1.5 rounded-md bg-aurora-blue text-white hover:opacity-90 flex-shrink-0">
                      {t("admin_page.fraud_flags.resolve", "R\u00e9soudre")}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
