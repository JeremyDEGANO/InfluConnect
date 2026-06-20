import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Link, useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { StatsCard } from "@/components/shared/StatsCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SimpleLineChart, DonutChart } from "@/components/shared/Charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, AlertTriangle, ArrowRight, CalendarClock, CheckSquare,
  FileSignature, Handshake, Lock, MessageSquare, Crown,
} from "lucide-react"
import { fetchBrandOnboarding, type BrandOnboardingStatus } from "@/lib/apiExtra"

interface DashboardData {
  total_campaigns: number
  active_campaigns: number
  total_proposals_received: number
  total_spent: number
  in_progress_collabs?: number
  timeseries?: { label: string; campaigns: number; spend: number; proposals: number }[]
  status_breakdown?: Record<string, number>
  action_required?: {
    counter_offers: number
    contents_to_validate: number
    contracts_to_sign: number
    escrows_to_fund: number
  }
  unread_messages?: number
  recent_proposals?: {
    id: number
    campaign_id: number
    campaign_title: string
    influencer_name: string
    status: string
    proposed_price: number
    updated_at: string
  }[]
  upcoming_deadlines?: {
    id: number
    title: string
    deadline: string
    days_left: number
    status: string
  }[]
  agency?: { active_delegations: number; pending_delegations: number }
}

export default function BrandDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [brandStatus, setBrandStatus] = useState<BrandOnboardingStatus | null>(null)
  const isAgency = Boolean(user?.active_brand?.is_agency)

  useEffect(() => {
    fetchBrandOnboarding().then(setBrandStatus).catch(() => {})
  }, [])

  useEffect(() => {
    api.get("/brands/dashboard/")
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  const actions = stats?.action_required
  const actionItems = [
    {
      key: "contents_to_validate",
      count: actions?.contents_to_validate ?? 0,
      icon: CheckSquare,
      label: t("brand_dashboard.action_contents", "Contenus à valider"),
      href: "/brand/campaigns",
      color: "text-amber-600 bg-amber-50",
    },
    {
      key: "counter_offers",
      count: actions?.counter_offers ?? 0,
      icon: Handshake,
      label: t("brand_dashboard.action_counters", "Contre-offres à traiter"),
      href: "/brand/campaigns",
      color: "text-indigo-600 bg-indigo-50",
    },
    {
      key: "contracts_to_sign",
      count: actions?.contracts_to_sign ?? 0,
      icon: FileSignature,
      label: t("brand_dashboard.action_contracts", "Contrats à signer"),
      href: "/brand/contracts",
      color: "text-violet-600 bg-violet-50",
    },
    {
      key: "escrows_to_fund",
      count: actions?.escrows_to_fund ?? 0,
      icon: Lock,
      label: t("brand_dashboard.action_escrows", "Paiements à séquestrer"),
      href: "/brand/campaigns",
      color: "text-rose-600 bg-rose-50",
    },
    {
      key: "unread_messages",
      count: stats?.unread_messages ?? 0,
      icon: MessageSquare,
      label: t("brand_dashboard.action_messages", "Messages non lus"),
      href: "/brand/messages",
      color: "text-sky-600 bg-sky-50",
    },
  ].filter((a) => a.count > 0)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short" })

  return (
    <div className="px-6 sm:px-8 py-8 max-w-7xl mx-auto space-y-8">
      {brandStatus && brandStatus.validation_status !== "approved" && (
        <Card className="card-base border-l-4 border-l-aurora-blue">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-aurora-blue mt-0.5" />
              <div>
                <p className="font-semibold text-aurora-ink">
                  {brandStatus.validation_status === "rejected"
                    ? t("brand_dashboard.banner_rejected_title", "Inscription refusée")
                    : t("brand_dashboard.banner_pending_title", "Validation en attente")}
                </p>
                <p className="text-sm text-aurora-ink-3 mt-0.5">
                  {brandStatus.validation_status === "rejected" && brandStatus.validation_notes
                    ? brandStatus.validation_notes
                    : t("brand_dashboard.banner_pending_desc", "Vous ne pouvez pas créer de campagnes tant que votre profil n'est pas approuvé.")}
                </p>
              </div>
            </div>
            <Link to="/brand/onboarding">
              <Button variant="gradient" size="sm">{t("brand_dashboard.banner_cta", "Compléter l'onboarding")}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <PageHeader
        eyebrow={<>Bonjour {user?.first_name},</>}
        title={
          isAgency
            ? t("brand_dashboard.headline_agency", "Tableau de bord agence")
            : t("brand_dashboard.headline", "Voici votre activité.")
        }
      />

      {/* KPIs — real figures only, no decorative bars */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t("dashboard.active_campaigns")}
          value={stats?.active_campaigns ?? 0}
          hint={t("brand_dashboard.kpi_total_campaigns", "{{count}} au total", { count: stats?.total_campaigns ?? 0 })}
        />
        <StatsCard
          title={t("brand_dashboard.kpi_collabs", "Collaborations en cours")}
          value={stats?.in_progress_collabs ?? 0}
          hint={t("brand_dashboard.kpi_proposals", "{{count}} propositions envoyées", { count: stats?.total_proposals_received ?? 0 })}
        />
        <StatsCard
          title={t("dashboard.total_spent")}
          value={`€${Number(stats?.total_spent ?? 0).toLocaleString("fr-FR")}`}
          hint={t("brand_dashboard.kpi_spent_hint", "Collaborations payées")}
        />
        {isAgency ? (
          <StatsCard
            title={t("brand_dashboard.kpi_delegations", "Influenceurs sous mandat")}
            value={stats?.agency?.active_delegations ?? 0}
            hint={t("brand_dashboard.kpi_delegations_pending", "{{count}} invitations en attente", { count: stats?.agency?.pending_delegations ?? 0 })}
          />
        ) : (
          <StatsCard
            title={t("brand_dashboard.kpi_paid", "Collaborations payées")}
            value={stats?.status_breakdown?.paid ?? 0}
            hint={t("brand_dashboard.kpi_validated", "{{count}} validées", { count: stats?.status_breakdown?.validated ?? 0 })}
          />
        )}
      </div>

      {/* Actions to deal with right now */}
      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-tight">
            {t("brand_dashboard.actions_title", "Actions à traiter")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionItems.length === 0 ? (
            <p className="text-sm text-aurora-ink-3 py-2">
              {t("brand_dashboard.actions_empty", "Rien à traiter — tout est à jour. ✨")}
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {actionItems.map((a) => {
                const Icon = a.icon
                return (
                  <button
                    key={a.key}
                    onClick={() => navigate(a.href)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-aurora-line hover:bg-aurora-surface text-left transition-colors"
                  >
                    <span className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${a.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-aurora-ink">{a.label}</span>
                      <span className="block text-xs text-aurora-ink-3">{a.count}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-aurora-ink-3 shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics */}
      {stats?.timeseries && stats.timeseries.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="card-base lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight">
                {t("brand_dashboard.chart_spend", "Dépenses & campagnes (6 derniers mois)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleLineChart
                data={stats.timeseries.map((m) => ({ label: m.label, value: m.spend }))}
                height={180}
                formatValue={(n) => `€${Math.round(n)}`}
                stroke="hsl(var(--aurora-blue))"
              />
              <div className="flex items-center gap-4 mt-4 text-xs text-aurora-ink-3">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-aurora-blue" />{t("brand_dashboard.chart_spend_legend", "Dépenses")}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base font-semibold tracking-tight">{t("brand_dashboard.chart_proposals", "Propositions par statut")}</CardTitle></CardHeader>
            <CardContent>
              <DonutChart
                slices={[
                  { label: t("status.pending", "En attente"), value: stats.status_breakdown?.pending ?? 0, color: "#6366f1" },
                  { label: t("status.accepted", "Acceptées"), value: stats.status_breakdown?.accepted ?? 0, color: "#8b5cf6" },
                  { label: t("status.contract_signed", "Signées"), value: stats.status_breakdown?.contract_signed ?? 0, color: "#a855f7" },
                  { label: t("status.in_progress", "En cours"), value: (stats.status_breakdown?.in_progress ?? 0) + (stats.status_breakdown?.content_submitted ?? 0), color: "#f59e0b" },
                  { label: t("status.paid", "Payées"), value: stats.status_breakdown?.paid ?? 0, color: "#10b981" },
                  { label: t("status.declined", "Refusées"), value: stats.status_breakdown?.declined ?? 0, color: "#94a3b8" },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <Card className="card-base lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold tracking-tight">
              {t("brand_dashboard.recent_title", "Dernières propositions")}
            </CardTitle>
            <Link to="/brand/campaigns" className="text-sm font-medium text-aurora-blue hover:text-aurora-blue-deep">
              {t("common.view_all", "Tout voir")} →
            </Link>
          </CardHeader>
          <CardContent>
            {(stats?.recent_proposals?.length ?? 0) === 0 ? (
              <p className="text-sm text-aurora-ink-3 py-4 text-center">
                {t("brand_dashboard.recent_empty", "Aucune proposition pour le moment.")}
              </p>
            ) : (
              <div className="divide-y divide-aurora-line/60">
                {stats!.recent_proposals!.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/brand/proposals/${p.id}`)}
                    className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-aurora-surface rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-aurora-ink truncate">{p.influencer_name}</p>
                      <p className="text-xs text-aurora-ink-3 truncate">{p.campaign_title}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-aurora-ink-3">{formatDate(p.updated_at)}</span>
                      <StatusBadge status={p.status as any} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming deadlines */}
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-aurora-ink-2" />
              {t("brand_dashboard.deadlines_title", "Échéances à venir")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(stats?.upcoming_deadlines?.length ?? 0) === 0 ? (
              <p className="text-sm text-aurora-ink-3 py-4 text-center">
                {t("brand_dashboard.deadlines_empty", "Aucune échéance dans les 30 prochains jours.")}
              </p>
            ) : (
              <div className="space-y-2">
                {stats!.upcoming_deadlines!.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/brand/campaigns/${d.id}`)}
                    className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border border-aurora-line hover:bg-aurora-surface text-left transition-colors"
                  >
                    <span className="text-sm font-medium text-aurora-ink truncate">{d.title}</span>
                    <Badge variant={d.days_left <= 7 ? "warning" : "secondary"} className="shrink-0">
                      {d.days_left <= 0
                        ? t("brand_dashboard.deadline_today", "Aujourd'hui")
                        : t("brand_dashboard.deadline_days", "J-{{count}}", { count: d.days_left })}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agency shortcut */}
      {isAgency && (
        <Card className="card-base">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <Crown className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-aurora-ink">{t("brand_dashboard.agency_title", "Vos mandats")}</p>
                <p className="text-xs text-aurora-ink-3">
                  {t("brand_dashboard.agency_desc", "{{active}} influenceurs sous mandat · {{pending}} invitations en attente", {
                    active: stats?.agency?.active_delegations ?? 0,
                    pending: stats?.agency?.pending_delegations ?? 0,
                  })}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/brand/ambassadors")}>
              {t("brand_dashboard.agency_cta", "Gérer")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
