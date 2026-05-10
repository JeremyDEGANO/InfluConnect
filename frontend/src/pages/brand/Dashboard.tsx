import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { StatsCard } from "@/components/shared/StatsCard"
import { CampaignCard } from "@/components/shared/CampaignCard"
import { SimpleLineChart, DonutChart } from "@/components/shared/Charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Briefcase, DollarSign, Users, TrendingUp, Plus, Loader2, AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"
import { fetchBrandOnboarding, type BrandOnboardingStatus } from "@/lib/apiExtra"

interface DashboardData {
  total_campaigns: number
  active_campaigns: number
  total_proposals_received: number
  total_spent: number
  timeseries?: { label: string; campaigns: number; spend: number; proposals: number }[]
  status_breakdown?: Record<string, number>
}

interface Campaign {
  id: number
  title: string
  price_per_influencer: number
  deadline: string
  status: string
  target_networks: string[]
}

export default function BrandDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardData | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [brandStatus, setBrandStatus] = useState<BrandOnboardingStatus | null>(null)
  const [isFirstWelcome, setIsFirstWelcome] = useState(false)

  useEffect(() => {
    fetchBrandOnboarding().then(setBrandStatus).catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, campRes] = await Promise.all([
          api.get("/brands/dashboard/"),
          api.get("/campaigns/"),
        ])
        setStats(dashRes.data)
        setCampaigns(campRes.data.results ?? campRes.data)
      } catch {
        // silently handle
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const storageKey = `ic_welcome_seen_${user.id}`
    const alreadySeen = localStorage.getItem(storageKey) === "1"
    if (alreadySeen) {
      setIsFirstWelcome(false)
      return
    }
    setIsFirstWelcome(true)
    localStorage.setItem(storageKey, "1")
  }, [user?.id])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {brandStatus && brandStatus.validation_status !== "approved" && (
        <Card className="card-base border-l-4 border-l-purple-500">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">
                  {brandStatus.validation_status === "rejected"
                    ? t("brand_dashboard.banner_rejected_title", "Inscription refusée")
                    : t("brand_dashboard.banner_pending_title", "Validation en attente")}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(isFirstWelcome ? "dashboard.welcome_first" : "dashboard.welcome_back")}, {user?.first_name}! 👋</h1>
          <p className="text-gray-500 mt-1">{t("brand_dashboard.subtitle")}</p>
        </div>
        <Button variant="gradient" onClick={() => navigate("/brand/campaigns/new")}>
          <Plus className="h-4 w-4 mr-2" />{t("campaigns.new_campaign")}
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t("dashboard.active_campaigns")} value={stats?.active_campaigns ?? 0} icon={Briefcase} />
        <StatsCard title={t("dashboard.total_spent")} value={`€${stats?.total_spent ?? 0}`} icon={DollarSign} />
        <StatsCard title={t("dashboard.influencers_contacted")} value={stats?.total_proposals_received ?? 0} icon={Users} />
        <StatsCard title={t("brand_dashboard.avg_roi")} value={stats?.total_campaigns ?? 0} icon={TrendingUp} />
      </div>

      {/* Analytics */}
      {stats?.timeseries && stats.timeseries.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="card-base lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Dépenses & campagnes (6 derniers mois)</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleLineChart
                data={stats.timeseries.map((m) => ({ label: m.label, value: m.spend }))}
                height={180}
                formatValue={(n) => `€${Math.round(n)}`}
                stroke="#059669"
              />
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Dépenses</span>
              </div>
            </CardContent>
          </Card>
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">Propositions par statut</CardTitle></CardHeader>
            <CardContent>
              <DonutChart
                slices={[
                  { label: "En attente", value: stats.status_breakdown?.pending ?? 0, color: "#6366f1" },
                  { label: "Acceptées", value: stats.status_breakdown?.accepted ?? 0, color: "#8b5cf6" },
                  { label: "Signées", value: stats.status_breakdown?.contract_signed ?? 0, color: "#a855f7" },
                  { label: "En cours", value: (stats.status_breakdown?.in_progress ?? 0) + (stats.status_breakdown?.content_submitted ?? 0), color: "#f59e0b" },
                  { label: "Payées", value: stats.status_breakdown?.paid ?? 0, color: "#10b981" },
                  { label: "Refusées", value: stats.status_breakdown?.declined ?? 0, color: "#94a3b8" },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("campaigns.title")}</h2>
        {campaigns.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-4">{t("campaigns_page.no_campaigns")}</p>
            <Button variant="gradient" onClick={() => navigate("/brand/campaigns/new")}><Plus className="h-4 w-4 mr-2" />{t("campaigns_page.create")}</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.slice(0, 6).map((c) => (
              <CampaignCard
                key={c.id}
                id={c.id}
                title={c.title}
                budget={Number(c.price_per_influencer) || 0}
                deadline={c.deadline ?? ""}
                status={c.status as any}
                themes={c.target_networks ?? []}
                proposals_count={0}
                onView={(id) => navigate(`/brand/campaigns/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
