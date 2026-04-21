import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CampaignCard } from "@/components/shared/CampaignCard"
import { Plus, Loader2 } from "lucide-react"

interface Campaign {
  id: number
  title: string
  price_per_influencer: number
  deadline: string
  status: string
  target_networks: string[]
}

export default function BrandCampaigns() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState("all")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get("/campaigns/").then((res) => {
      setCampaigns(res.data.results ?? res.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("campaigns.title")}</h1>
        <Button variant="gradient" onClick={() => navigate("/brand/campaigns/new")}>
          <Plus className="h-4 w-4 mr-2" />{t("campaigns.new_campaign")}
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t("campaigns_page.all")}</TabsTrigger>
          <TabsTrigger value="active">{t("campaigns.active")}</TabsTrigger>
          <TabsTrigger value="draft">{t("campaigns.draft")}</TabsTrigger>
          <TabsTrigger value="completed">{t("campaigns.completed")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-4">{t("campaigns_page.no_campaigns")}</p>
              <Button variant="gradient" onClick={() => navigate("/brand/campaigns/new")}><Plus className="h-4 w-4 mr-2" />{t("campaigns_page.create")}</Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => (
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
