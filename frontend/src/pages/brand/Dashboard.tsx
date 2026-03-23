import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { useNavigate } from "react-router-dom"
import { StatsCard } from "@/components/shared/StatsCard"
import { CampaignCard } from "@/components/shared/CampaignCard"
import { Button } from "@/components/ui/button"
import { Briefcase, DollarSign, Users, TrendingUp, Plus } from "lucide-react"

type CampaignStatus = "pending" | "active" | "completed" | "cancelled" | "accepted" | "declined" | "draft" | "published"

interface Campaign {
  id: number
  title: string
  budget: number
  deadline: string
  status: CampaignStatus
  themes: string[]
  proposals_count: number
}

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: 1, title: "Summer Collection 2024", budget: 2000, deadline: "2024-03-31", status: "active", themes: ["Fashion", "Lifestyle"], proposals_count: 8 },
  { id: 2, title: "Product Launch - TechPad", budget: 5000, deadline: "2024-04-15", status: "draft", themes: ["Tech", "Gaming"], proposals_count: 0 },
  { id: 3, title: "Healthy Living Campaign", budget: 1500, deadline: "2024-02-28", status: "completed", themes: ["Fitness", "Food"], proposals_count: 12 },
]

export default function BrandDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("dashboard.welcome")}, {user?.first_name}! 👋</h1>
          <p className="text-gray-500 mt-1">Manage your influencer campaigns</p>
        </div>
        <Button variant="gradient" onClick={() => navigate("/brand/campaigns/new")}>
          <Plus className="h-4 w-4 mr-2" />{t("campaigns.new_campaign")}
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t("dashboard.active_campaigns")} value={2} icon={Briefcase} trend={5} trendLabel="vs last month" iconBg="from-purple-500 to-indigo-600" />
        <StatsCard title={t("dashboard.total_spent")} value="€8,500" icon={DollarSign} trend={20} trendLabel="vs last month" iconBg="from-green-400 to-emerald-600" />
        <StatsCard title={t("dashboard.influencers_contacted")} value={24} icon={Users} trend={12} trendLabel="vs last month" iconBg="from-blue-400 to-cyan-500" />
        <StatsCard title="Avg Campaign ROI" value="4.2x" icon={TrendingUp} trend={8} trendLabel="vs last month" iconBg="from-pink-400 to-rose-600" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("campaigns.title")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_CAMPAIGNS.map((c) => (
            <CampaignCard key={c.id} {...c} onView={(id) => navigate(`/brand/campaigns/${id}`)} />
          ))}
        </div>
      </div>
    </div>
  )
}
