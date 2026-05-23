import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Calendar, DollarSign, Eye, Loader2 } from "lucide-react"

interface Proposal {
  id: number
  campaign_title: string
  brand_company_name: string
  proposed_price: number
  status: string
  created_at: string
}

export default function InfluencerProposals() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState("all")
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get("/proposals/").then((res) => {
      setProposals(res.data.results ?? res.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = tab === "all" ? proposals : proposals.filter((p) => p.status === tab)

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("influencer_dashboard.eyebrow", "Espace créateur")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("proposals.title")}</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t("proposals.all")}</TabsTrigger>
          <TabsTrigger value="pending">{t("proposals.pending")}</TabsTrigger>
          <TabsTrigger value="accepted">{t("proposals.accepted")}</TabsTrigger>
          <TabsTrigger value="declined">{t("proposals.declined")}</TabsTrigger>
          <TabsTrigger value="completed">{t("proposals_page.completed")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-aurora-ink-3">{t("proposals_page.no_proposals")}</div>
            )}
            {filtered.map((p) => (
              <Card key={p.id} className="card-base hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-aurora-ink">{p.campaign_title}</h3>
                        <StatusBadge status={p.status as any} />
                      </div>
                      <p className="text-sm text-aurora-ink-3 mt-1">{p.brand_company_name}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-aurora-ink-3">
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
