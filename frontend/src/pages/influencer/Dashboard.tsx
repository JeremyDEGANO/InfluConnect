import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import api from "@/lib/api"
import { StatsCard } from "@/components/shared/StatsCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SimpleLineChart } from "@/components/shared/Charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileCompletionBanner } from "@/components/shared/ProfileCompletionBanner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Loader2 } from "lucide-react"

interface DashboardData {
  total_proposals: number
  pending_proposals: number
  active_proposals: number
  total_earnings: number
  recent_proposals: Proposal[]
  timeseries?: { label: string; proposals: number; earnings: number }[]
}

interface Proposal {
  id: number
  campaign_title: string
  brand_company_name: string
  proposed_price: number
  status: string
  created_at: string
}

export default function InfluencerDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get("/influencers/dashboard/").then((res) => {
      setData(res.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="px-6 sm:px-8 py-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        eyebrow={<>Bienvenue {user?.first_name},</>}
        title={
          (data?.pending_proposals ?? 0) > 0
            ? t("influencer_dashboard.headline_pending", { count: data?.pending_proposals ?? 0, defaultValue: `Vous avez ${data?.pending_proposals} nouvelles propositions.` })
            : t("influencer_dashboard.headline_idle", "Prêt à collaborer ?")
        }
      />

      <ProfileCompletionBanner />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t("dashboard.earnings")} value={`€${Number(data?.total_earnings ?? 0).toLocaleString("fr-FR")}`} progress={70} progressColor="bg-emerald-500" />
        <StatsCard title={t("dashboard.active_campaigns")} value={data?.active_proposals ?? 0} progress={Math.min(100, ((data?.active_proposals ?? 0) / 5) * 100)} progressColor="bg-aurora-blue" hint={(data?.active_proposals ?? 0) > 0 ? t("influencer_dashboard.active_hint", { count: data?.active_proposals, defaultValue: `${data?.active_proposals} en cours` }) : undefined} />
        <StatsCard title={t("dashboard.pending_proposals")} value={data?.pending_proposals ?? 0} progress={Math.min(100, ((data?.pending_proposals ?? 0) / 5) * 100)} progressColor="bg-amber-500" hint={(data?.pending_proposals ?? 0) > 0 ? t("influencer_dashboard.pending_hint", "à traiter") : undefined} />
        <StatsCard title={t("dashboard.avg_rating")} value="—" progress={0} progressColor="bg-aurora-blue-deep" />
      </div>

      {data?.timeseries && data.timeseries.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base font-semibold tracking-tight">{t("influencer_dashboard.monthly_earnings")}</CardTitle></CardHeader>
            <CardContent>
              <SimpleLineChart
                data={data.timeseries.map((m) => ({ label: m.label, value: m.earnings }))}
                height={160}
                formatValue={(n) => `€${Math.round(n)}`}
                stroke="#059669"
              />
            </CardContent>
          </Card>
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base font-semibold tracking-tight">{t("influencer_dashboard.new_proposals")}</CardTitle></CardHeader>
            <CardContent>
              <SimpleLineChart
                data={data.timeseries.map((m) => ({ label: m.label, value: m.proposals }))}
                height={160}
                stroke="hsl(var(--aurora-blue))"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">{t("dashboard.recent_proposals")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data?.recent_proposals ?? []).length === 0 && (
              <p className="text-sm text-aurora-ink-3 text-center py-6">{t("proposals_page.no_proposals")}</p>
            )}
            {(data?.recent_proposals ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 rounded-xl border border-transparent hover:border-aurora-line hover:bg-aurora-surface ease-aurora">
                <div>
                  <p className="font-medium text-aurora-ink text-sm">{p.campaign_title}</p>
                  <p className="text-xs text-aurora-ink-3 mt-0.5">{p.brand_company_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num font-semibold text-sm text-aurora-ink">€{p.proposed_price}</span>
                  <StatusBadge status={p.status as any} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
