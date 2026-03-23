import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Eye, Calendar, DollarSign } from "lucide-react"

type ProposalStatus = "pending" | "active" | "completed" | "cancelled" | "accepted" | "declined" | "draft" | "published"

interface Proposal {
  id: number
  influencer_name: string
  followers: number
  proposed_price: number
  status: ProposalStatus
  engagement_rate: number
}

const MOCK_PROPOSALS: Proposal[] = [
  { id: 1, influencer_name: "Sophie Laurent", followers: 125000, proposed_price: 300, status: "pending", engagement_rate: 5.2 },
  { id: 2, influencer_name: "Marc Dubois", followers: 87000, proposed_price: 200, status: "accepted", engagement_rate: 4.8 },
  { id: 3, influencer_name: "Emma Chen", followers: 250000, proposed_price: 500, status: "pending", engagement_rate: 3.9 },
  { id: 4, influencer_name: "Alex Moreau", followers: 45000, proposed_price: 150, status: "declined", engagement_rate: 6.1 },
]

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-xl font-bold text-gray-900">Campaign #{id}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-base">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Summer Collection 2024</CardTitle>
                <StatusBadge status="active" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">We're launching our Summer Collection 2024. Looking for fashion influencers to authentically showcase our new sustainable clothing line.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[{ icon: DollarSign, label: "Budget", value: "€2,000" }, { icon: Calendar, label: "Deadline", value: "Mar 31, 2024" }, { icon: Eye, label: "Views", value: "12 proposals" }].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-3 bg-gray-50 rounded-xl text-sm">
                    <div className="flex items-center gap-1 text-gray-400 mb-1"><Icon className="h-3.5 w-3.5" /><span className="text-xs">{label}</span></div>
                    <p className="font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {["Fashion", "Lifestyle", "Sustainable"].map((t) => <Badge key={t} variant="purple">{t}</Badge>)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">Proposals ({MOCK_PROPOSALS.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MOCK_PROPOSALS.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-purple-400 to-indigo-600 text-white text-sm font-semibold">
                          {p.influencer_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{p.influencer_name}</p>
                        <p className="text-xs text-gray-500">{(p.followers / 1000).toFixed(0)}K followers · {p.engagement_rate}% engagement</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-gray-900">€{p.proposed_price}</span>
                      <StatusBadge status={p.status} />
                      {p.status === "pending" && (
                        <Button size="sm" variant="gradient" onClick={() => navigate(`/brand/campaigns/${id}/validate/${p.id}`)}>Review</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Total Proposals", value: MOCK_PROPOSALS.length },
                { label: "Accepted", value: MOCK_PROPOSALS.filter((p) => p.status === "accepted").length },
                { label: "Pending Review", value: MOCK_PROPOSALS.filter((p) => p.status === "pending").length },
                { label: "Budget Used", value: "€500 / €2,000" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
