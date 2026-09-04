import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchAdminOverview, type AdminOverview, fetchAdminFraudFlags, resolveAdminFraudFlag, type AdminFraudFlag, fetchAdminHistory, type AdminHistory } from "@/lib/apiExtra"
import { StatsCard } from "@/components/shared/StatsCard"
import { TrendChart, type TrendPoint } from "@/components/shared/TrendChart"
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

// Validated with the dataviz palette checker (all-pairs, light surface):
// lightness band, chroma floor, CVD separation, normal-vision floor, contrast.
const CHART_COLORS = {
  revenue: "#4f46e5",
  influencers: "#0d9488",
  budget: "#d97706",
  proposals: "#e11d48",
} as const

const RANGE_OPTIONS = [3, 6, 12] as const
type RangeMonths = (typeof RANGE_OPTIONS)[number]

/** "2026-09" -> "sept." in the user's locale. */
function monthLabel(month: string, locale: string) {
  const [year, m] = month.split("-").map(Number)
  if (!year || !m) return month
  return new Date(year, m - 1, 1).toLocaleDateString(locale, { month: "short" })
}

export default function Admin() {
  const { t, i18n } = useTranslation()
  const { toast } = useToast()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [fraudFlags, setFraudFlags] = useState<AdminFraudFlag[]>([])
  const [fraudLoading, setFraudLoading] = useState(false)
  const [history, setHistory] = useState<AdminHistory | null>(null)
  const [historyMonths, setHistoryMonths] = useState<RangeMonths>(6)
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadFraudFlags = () => {
    setFraudLoading(true)
    fetchAdminFraudFlags()
      .then(setFraudFlags)
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setFraudLoading(false))
  }

  useEffect(() => { loadFraudFlags() }, [])

  useEffect(() => {
    setHistoryLoading(true)
    fetchAdminHistory(historyMonths)
      .then(setHistory)
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setHistoryLoading(false))
  }, [historyMonths])

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

  const series = useMemo(() => {
    const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR"
    const points = history?.points ?? []
    const build = (pick: (p: AdminHistory["points"][number]) => number): TrendPoint[] =>
      points.map((p) => ({ label: monthLabel(p.label, locale), value: pick(p), partial: p.is_current_month }))
    return {
      revenue: build((p) => p.commission_eur),
      influencers: build((p) => p.active_influencers),
      budget: build((p) => p.budget_committed_eur),
      proposals: build((p) => p.proposals_sent),
      campaigns: build((p) => p.campaigns_created),
    }
  }, [history, i18n.language])

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
        <StatsCard title={t("admin_page.total_users")} value={kpis.users_total} />
        <StatsCard
          title={t("admin_page.new_users_30d")}
          value={kpis.users_new_last_30d}
          hint={`${kpis.users_total > 0 ? Math.round((kpis.users_new_last_30d / kpis.users_total) * 100) : 0}% ${t("admin_page.of_total", "du total")}`}
        />
        <StatsCard
          title={t("admin_page.active_companies")}
          value={kpis.brands_active_subscription}
          hint={`${t("admin_page.on_total", "sur")} ${kpis.brands_total}`}
          progress={kpis.brands_total > 0 ? (kpis.brands_active_subscription / kpis.brands_total) * 100 : 0}
          progressColor="bg-aurora-blue-deep"
        />
        <StatsCard
          title={t("admin_page.active_campaigns")}
          value={kpis.campaigns_live}
          hint={`${t("admin_page.on_total", "sur")} ${kpis.campaigns_total}`}
          progress={kpis.campaigns_total > 0 ? (kpis.campaigns_live / kpis.campaigns_total) * 100 : 0}
          progressColor="bg-amber-500"
        />
        <StatsCard
          title={t("admin_page.open_tickets")}
          value={kpis.support_tickets_open}
          hint={kpis.support_tickets_stale_48h > 0 ? `${kpis.support_tickets_stale_48h} > 48h` : undefined}
        />
      </div>

      {/* Historique: series derived from real timestamps, never estimates. */}
      <Card className="card-base">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">{t("admin_page.history_title", "Historique")}</CardTitle>
            <p className="text-xs text-aurora-ink-3 mt-1">
              {t("admin_page.history_subtitle", "Mois clos, puis mois en cours (partiel).")}
            </p>
          </div>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-aurora-surface border border-aurora-line">
            {RANGE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setHistoryMonths(value)}
                aria-pressed={historyMonths === value}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  historyMonths === value ? "bg-white text-aurora-ink shadow-sm" : "text-aurora-ink-3 hover:text-aurora-ink-2"
                }`}
              >
                {value} {t("admin_page.months_short", "mois")}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-16 text-aurora-ink-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />{t("common.loading")}
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <p className="text-sm font-medium text-aurora-ink">
                  {t("admin_page.chart_revenue", "Revenu encaisse")}
                  <span className="text-xs font-normal text-aurora-ink-3 ml-1.5">
                    ({t("admin_page.chart_revenue_hint", "commission")} {history?.commission_rate ?? 0}%)
                  </span>
                </p>
                <TrendChart points={series.revenue} color={CHART_COLORS.revenue} format={(v) => money(v)} />
              </div>
              <div>
                <p className="text-sm font-medium text-aurora-ink">
                  {t("admin_page.chart_influencers", "Influenceurs actifs")}
                  <span className="text-xs font-normal text-aurora-ink-3 ml-1.5">
                    ({t("admin_page.chart_influencers_hint", "collaborations engagees")})
                  </span>
                </p>
                <TrendChart points={series.influencers} color={CHART_COLORS.influencers} />
              </div>
              <div>
                <p className="text-sm font-medium text-aurora-ink">
                  {t("admin_page.chart_budget", "Budget engage")}
                  <span className="text-xs font-normal text-aurora-ink-3 ml-1.5">
                    ({t("admin_page.chart_budget_hint", "sequestre finance")})
                  </span>
                </p>
                <TrendChart points={series.budget} color={CHART_COLORS.budget} format={(v) => money(v)} />
              </div>
              <div>
                <p className="text-sm font-medium text-aurora-ink">
                  {t("admin_page.chart_proposals", "Propositions envoyees")}
                </p>
                <TrendChart points={series.proposals} color={CHART_COLORS.proposals} />
              </div>
            </div>
          )}

          {/* Table view: the values never rest on color alone. */}
          {!historyLoading && (history?.points?.length ?? 0) > 0 && (
            <details className="mt-5">
              <summary className="text-xs text-aurora-ink-3 cursor-pointer hover:text-aurora-ink-2">
                {t("admin_page.history_table", "Voir les donnees")}
              </summary>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-aurora-ink-3 border-b border-aurora-line">
                      <th className="text-left font-medium py-2 pr-3">{t("admin_page.month", "Mois")}</th>
                      <th className="text-right font-medium py-2 px-3">{t("admin_page.chart_revenue", "Revenu encaisse")}</th>
                      <th className="text-right font-medium py-2 px-3">{t("admin_page.chart_influencers", "Influenceurs actifs")}</th>
                      <th className="text-right font-medium py-2 px-3">{t("admin_page.chart_budget", "Budget engage")}</th>
                      <th className="text-right font-medium py-2 px-3">{t("admin_page.chart_proposals", "Propositions envoyees")}</th>
                      <th className="text-right font-medium py-2 pl-3">{t("admin_page.total_campaigns")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(history?.points ?? []).map((p) => (
                      <tr key={p.month} className="border-b border-aurora-line/60 last:border-0">
                        <td className="py-2 pr-3 text-aurora-ink-2">
                          {monthLabel(p.label, i18n.language?.startsWith("en") ? "en-US" : "fr-FR")}
                          {p.is_current_month && <span className="text-aurora-ink-3"> ({t("admin_page.partial", "en cours")})</span>}
                        </td>
                        <td className="py-2 px-3 text-right num text-aurora-ink">{money(p.commission_eur)}</td>
                        <td className="py-2 px-3 text-right num text-aurora-ink">{p.active_influencers}</td>
                        <td className="py-2 px-3 text-right num text-aurora-ink">{money(p.budget_committed_eur)}</td>
                        <td className="py-2 px-3 text-right num text-aurora-ink">{p.proposals_sent}</td>
                        <td className="py-2 pl-3 text-right num text-aurora-ink">{p.campaigns_created}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="card-base lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("admin_page.subscription_projection")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <p className="text-xs text-emerald-800">{t("admin_page.mrr_active", "MRR facturé")}</p>
                <p className="text-xl font-semibold text-aurora-ink">{money(projection.mrr_active)}</p>
                <p className="text-[11px] text-aurora-ink-3 mt-0.5">
                  {projection.active_subscriptions} {t("admin_page.active_subscriptions", "abonnements actifs")}
                </p>
              </div>
              <div className="rounded-xl border border-aurora-line p-3">
                <p className="text-xs text-aurora-ink-3">{t("admin_page.potential_approved", "Potentiel — à convertir")}</p>
                <p className="text-xl font-semibold text-aurora-ink-2">{money(projection.potential_approved_eur)}</p>
                <p className="text-[11px] text-aurora-ink-3 mt-0.5">
                  {projection.potential_approved_count} {t("admin_page.free_tier_companies", "sociétés en essai gratuit")}
                </p>
              </div>
              <div className="rounded-xl border border-aurora-line p-3">
                <p className="text-xs text-aurora-ink-3">{t("admin_page.potential_pending", "Potentiel — en validation")}</p>
                <p className="text-xl font-semibold text-aurora-ink-2">{money(projection.potential_pending_eur)}</p>
                <p className="text-[11px] text-aurora-ink-3 mt-0.5">
                  {projection.potential_pending_count} {t("admin_page.awaiting_validation", "dossiers en attente")}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-aurora-ink-3">
              {t(
                "admin_page.revenue_note",
                "Le MRR ne compte que les abonnements actifs. Les montants « potentiel » ne sont pas facturés : une marque reste gratuite jusqu'à sa première contractualisation, sans échéance garantie.",
              )}
            </p>

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
        <StatsCard title={t("admin_page.active_campaigns")} value={liveCampaigns.length} />
        <StatsCard title={t("admin_page.budget", "Budget")} value={money(liveBudgetTotal)} />
        <StatsCard title={t("admin_page.influencers", "Influenceurs")} value={liveInfluencersTarget} />
        <StatsCard
          title={t("admin_page.proposals", "Propositions")}
          value={liveProposalsTotal}
          hint={`${t("admin_page.in_progress", "En cours")}: ${liveProposalsInProgress}`}
          progress={liveProposalsTotal > 0 ? (liveProposalsInProgress / liveProposalsTotal) * 100 : 0}
          progressColor="bg-aurora-blue-deep"
        />
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
