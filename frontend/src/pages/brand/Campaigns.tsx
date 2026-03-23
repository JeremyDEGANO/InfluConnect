import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CampaignCard } from "@/components/shared/CampaignCard"
import { Plus } from "lucide-react"

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

const MOCK: Campaign[] = [
  { id: 1, title: "Summer Collection 2024", budget: 2000, deadline: "2024-03-31", status: "active", themes: ["Fashion", "Lifestyle"], proposals_count: 8 },
  { id: 2, title: "Product Launch - TechPad", budget: 5000, deadline: "2024-04-15", status: "draft", themes: ["Tech", "Gaming"], proposals_count: 0 },
  { id: 3, title: "Healthy Living Campaign", budget: 1500, deadline: "2024-02-28", status: "completed", themes: ["Fitness", "Food"], proposals_count: 12 },
  { id: 4, title: "Holiday Special", budget: 3000, deadline: "2024-12-25", status: "draft", themes: ["Lifestyle", "Fashion"], proposals_count: 0 },
]

export default function BrandCampaigns() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState("all")

  const filtered = tab === "all" ? MOCK : MOCK.filter((c) => c.status === tab)

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
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">{t("campaigns.active")}</TabsTrigger>
          <TabsTrigger value="draft">{t("campaigns.draft")}</TabsTrigger>
          <TabsTrigger value="completed">{t("campaigns.completed")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-4">No campaigns yet.</p>
              <Button variant="gradient" onClick={() => navigate("/brand/campaigns/new")}><Plus className="h-4 w-4 mr-2" />Create Campaign</Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((c) => <CampaignCard key={c.id} {...c} onView={(id) => navigate(`/brand/campaigns/${id}`)} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
