import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import api from "@/lib/api"
import { StatsCard } from "@/components/shared/StatsCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SimpleBarChart } from "@/components/shared/Charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileCompletionBanner } from "@/components/shared/ProfileCompletionBanner"
import { DollarSign, Briefcase, FileText, Star, Loader2 } from "lucide-react"

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

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.welcome")}, {user?.first_name}! 👋</h1>
        <p className="text-gray-500 mt-1">{t("influencer_dashboard.subtitle")}</p>
      </div>

      <ProfileCompletionBanner />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t("dashboard.earnings")} value={`€${data?.total_earnings ?? 0}`} icon={DollarSign} iconBg="from-green-400 to-emerald-600" />
        <StatsCard title={t("dashboard.active_campaigns")} value={data?.active_proposals ?? 0} icon={Briefcase} iconBg="from-indigo-500 to-violet-600" />
        <StatsCard title={t("dashboard.pending_proposals")} value={data?.pending_proposals ?? 0} icon={FileText} iconBg="from-yellow-400 to-orange-500" />
        <StatsCard title={t("dashboard.avg_rating")} value="—" icon={Star} iconBg="from-pink-400 to-rose-600" />
      </div>

      {data?.timeseries && data.timeseries.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">Gains mensuels</CardTitle></CardHeader>
            <CardContent>
              <SimpleBarChart
                data={data.timeseries.map((m) => ({ label: m.label, value: m.earnings }))}
                height={160}
                formatValue={(n) => `€${Math.round(n)}`}
                color="from-emerald-400 to-green-600"
              />
            </CardContent>
          </Card>
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">Nouvelles propositions</CardTitle></CardHeader>
            <CardContent>
              <SimpleBarChart
                data={data.timeseries.map((m) => ({ label: m.label, value: m.proposals }))}
                height={160}
                color="from-indigo-400 to-violet-600"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-lg">{t("dashboard.recent_proposals")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.recent_proposals ?? []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">{t("proposals_page.no_proposals")}</p>
            )}
            {(data?.recent_proposals ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{p.campaign_title}</p>
                  <p className="text-xs text-gray-500">{p.brand_company_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-gray-900">€{p.proposed_price}</span>
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
