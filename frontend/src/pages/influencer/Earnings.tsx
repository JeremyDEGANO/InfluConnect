import { useTranslation } from "react-i18next"
import { StatsCard } from "@/components/shared/StatsCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, CreditCard, Clock } from "lucide-react"

type EarningStatus = "pending" | "active" | "completed" | "cancelled" | "accepted" | "declined" | "draft" | "published"

interface Earning {
  id: number
  campaign: string
  brand: string
  amount: number
  status: EarningStatus
  date: string
  payment_date?: string
}

const MOCK: Earning[] = [
  { id: 1, campaign: "Tech Gadgets Launch", brand: "TechCo", amount: 500, status: "completed", date: "2024-02-28", payment_date: "2024-03-05" },
  { id: 2, campaign: "Healthy Snacks", brand: "NutriBar", amount: 180, status: "completed", date: "2024-02-20", payment_date: "2024-02-25" },
  { id: 3, campaign: "Summer Collection", brand: "FashionBrand", amount: 250, status: "accepted", date: "2024-03-01" },
  { id: 4, campaign: "Travel Vlog Series", brand: "TravelApp", amount: 350, status: "pending", date: "2024-03-10" },
]

export default function Earnings() {
  const { t } = useTranslation()
  const total = MOCK.filter((e) => e.status === "completed").reduce((s, e) => s + e.amount, 0)
  const pending = MOCK.filter((e) => e.status === "pending" || e.status === "accepted").reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("nav.earnings")}</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Earned" value={`€${total}`} icon={DollarSign} trend={15} trendLabel="vs last month" iconBg="from-green-400 to-emerald-600" />
        <StatsCard title="Pending" value={`€${pending}`} icon={Clock} iconBg="from-yellow-400 to-orange-500" />
        <StatsCard title="This Month" value="€500" icon={TrendingUp} trend={8} trendLabel="vs last month" iconBg="from-purple-500 to-indigo-600" />
        <StatsCard title="Avg per Campaign" value="€320" icon={CreditCard} iconBg="from-blue-400 to-cyan-500" />
      </div>
      <Card className="card-base">
        <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-semibold text-gray-500">Campaign</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-500">Brand</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-500">Amount</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-500">Status</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium text-gray-900">{e.campaign}</td>
                    <td className="py-3 px-2 text-gray-500">{e.brand}</td>
                    <td className="py-3 px-2 text-right font-semibold text-gray-900">€{e.amount}</td>
                    <td className="py-3 px-2 text-center"><StatusBadge status={e.status} /></td>
                    <td className="py-3 px-2 text-right text-gray-500">{e.payment_date ? new Date(e.payment_date).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
