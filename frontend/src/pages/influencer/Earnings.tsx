import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { StatsCard } from "@/components/shared/StatsCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, CreditCard, Clock, Loader2 } from "lucide-react"

interface Proposal {
  id: number
  campaign_title: string
  brand_company_name: string
  proposed_price: number
  status: string
  created_at: string
}

export default function Earnings() {
  const { t } = useTranslation()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get("/proposals/").then((res) => {
      setProposals(res.data.results ?? res.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  const paid = proposals.filter((e) => e.status === "paid" || e.status === "completed")
  const total = paid.reduce((s, e) => s + Number(e.proposed_price), 0)
  const pending = proposals.filter((e) => ["pending", "accepted", "in_progress", "content_submitted"].includes(e.status)).reduce((s, e) => s + Number(e.proposed_price), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("nav.earnings")}</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t("earnings_page.total_earned")} value={`€${total}`} icon={DollarSign} iconBg="from-green-400 to-emerald-600" />
        <StatsCard title={t("earnings_page.pending")} value={`€${pending}`} icon={Clock} iconBg="from-yellow-400 to-orange-500" />
        <StatsCard title={t("earnings_page.this_month")} value={`€${total}`} icon={TrendingUp} iconBg="from-indigo-500 to-violet-600" />
        <StatsCard title={t("earnings_page.avg_per_campaign")} value={paid.length ? `€${Math.round(total / paid.length)}` : "€0"} icon={CreditCard} iconBg="from-blue-400 to-cyan-500" />
      </div>
      <Card className="card-base">
        <CardHeader><CardTitle>{t("earnings_page.payment_history")}</CardTitle></CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <p className="text-center py-8 text-gray-400">{t("proposals_page.no_proposals")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-semibold text-gray-500">{t("earnings_page.col_campaign")}</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-500">{t("earnings_page.col_brand")}</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-500">{t("earnings_page.col_amount")}</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-500">{t("earnings_page.col_status")}</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-500">{t("earnings_page.col_date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium text-gray-900">{e.campaign_title}</td>
                      <td className="py-3 px-2 text-gray-500">{e.brand_company_name}</td>
                      <td className="py-3 px-2 text-right font-semibold text-gray-900">€{e.proposed_price}</td>
                      <td className="py-3 px-2 text-center"><StatusBadge status={e.status as any} /></td>
                      <td className="py-3 px-2 text-right text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
