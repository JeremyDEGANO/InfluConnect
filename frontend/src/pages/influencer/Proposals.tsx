import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Calendar, DollarSign, Eye } from "lucide-react"

type ProposalStatus = "pending" | "active" | "completed" | "cancelled" | "accepted" | "declined" | "draft" | "published"

interface Proposal {
  id: number
  campaign_title: string
  brand_name: string
  proposed_price: number
  status: ProposalStatus
  created_at: string
  description: string
}

const MOCK: Proposal[] = [
  { id: 1, campaign_title: "Summer Collection 2024", brand_name: "FashionBrand", proposed_price: 250, status: "pending", created_at: "2024-03-01", description: "Instagram post + story about summer collection." },
  { id: 2, campaign_title: "Tech Gadgets Launch", brand_name: "TechCo", proposed_price: 500, status: "accepted", created_at: "2024-02-28", description: "YouTube review video of new smart devices." },
  { id: 3, campaign_title: "Healthy Snacks Campaign", brand_name: "NutriBar", proposed_price: 180, status: "completed", created_at: "2024-02-20", description: "TikTok series featuring daily healthy snacks." },
  { id: 4, campaign_title: "Travel Vlog Series", brand_name: "TravelApp", proposed_price: 350, status: "declined", created_at: "2024-02-15", description: "Monthly travel vlog integrations." },
]

export default function InfluencerProposals() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState("all")

  const filtered = tab === "all" ? MOCK : MOCK.filter((p) => p.status === tab)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("proposals.title")}</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t("proposals.all")}</TabsTrigger>
          <TabsTrigger value="pending">{t("proposals.pending")}</TabsTrigger>
          <TabsTrigger value="accepted">{t("proposals.accepted")}</TabsTrigger>
          <TabsTrigger value="declined">{t("proposals.declined")}</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">No proposals found.</div>
            )}
            {filtered.map((p) => (
              <Card key={p.id} className="card-base hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{p.campaign_title}</h3>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{p.brand_name}</p>
                      <p className="text-sm text-gray-600 mt-2">{p.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />€{p.proposed_price}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/influencer/proposals/${p.id}`)}>
                      <Eye className="h-4 w-4 mr-1" />{t("common.view")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
