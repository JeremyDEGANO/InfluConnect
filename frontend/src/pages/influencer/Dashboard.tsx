import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { StatsCard } from "@/components/shared/StatsCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Briefcase, FileText, Star } from "lucide-react"

interface Proposal {
  id: number
  campaign_title: string
  brand_name: string
  proposed_price: number
  status: "pending" | "active" | "completed" | "cancelled" | "accepted" | "declined" | "draft" | "published"
  created_at: string
}

const MOCK_PROPOSALS: Proposal[] = [
  { id: 1, campaign_title: "Summer Collection 2024", brand_name: "FashionBrand", proposed_price: 250, status: "pending", created_at: "2024-03-01" },
  { id: 2, campaign_title: "Tech Gadgets Launch", brand_name: "TechCo", proposed_price: 500, status: "accepted", created_at: "2024-02-28" },
  { id: 3, campaign_title: "Healthy Snacks Campaign", brand_name: "NutriBar", proposed_price: 180, status: "completed", created_at: "2024-02-20" },
  { id: 4, campaign_title: "Travel Vlog Series", brand_name: "TravelApp", proposed_price: 350, status: "declined", created_at: "2024-02-15" },
]

export default function InfluencerDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [proposals] = useState<Proposal[]>(MOCK_PROPOSALS)
  const [loading] = useState(false)

  useEffect(() => {
    // Would fetch from API in production
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">{t("common.loading")}</div>

  const totalEarnings = proposals.filter((p) => p.status === "completed").reduce((s, p) => s + p.proposed_price, 0)
  const active = proposals.filter((p) => p.status === "active" || p.status === "accepted").length
  const pending = proposals.filter((p) => p.status === "pending").length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.welcome")}, {user?.first_name}! 👋</h1>
        <p className="text-gray-500 mt-1">Here's your performance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t("dashboard.earnings")} value={`€${totalEarnings}`} icon={DollarSign} trend={12} trendLabel="vs last month" iconBg="from-green-400 to-emerald-600" />
        <StatsCard title={t("dashboard.active_campaigns")} value={active} icon={Briefcase} trend={8} trendLabel="vs last month" iconBg="from-purple-500 to-indigo-600" />
        <StatsCard title={t("dashboard.pending_proposals")} value={pending} icon={FileText} iconBg="from-yellow-400 to-orange-500" />
        <StatsCard title={t("dashboard.avg_rating")} value="4.8" icon={Star} trend={3} trendLabel="vs last month" iconBg="from-pink-400 to-rose-600" />
      </div>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-lg">{t("dashboard.recent_proposals")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{p.campaign_title}</p>
                  <p className="text-xs text-gray-500">{p.brand_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-gray-900">€{p.proposed_price}</span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
