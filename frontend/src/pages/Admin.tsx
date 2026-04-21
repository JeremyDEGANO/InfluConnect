import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { StatsCard } from "@/components/shared/StatsCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Briefcase, DollarSign, Shield, CheckCircle, XCircle, Loader2 } from "lucide-react"

type UserType = "influencer" | "brand" | "admin"
interface UserItem { id: number; first_name: string; last_name: string; email: string; user_type: UserType; is_active: boolean; created_at: string }
interface CampaignItem { id: number; title: string; brand_name: string; price_per_influencer: number; status: string }
interface FinancialData { total_escrow_funded: number; total_payments_released: number; estimated_commission: number; total_paid_proposals: number; total_active_proposals: number }

const TYPE_COLORS: Record<UserType, string> = { influencer: "bg-indigo-100 text-indigo-700", brand: "bg-blue-100 text-blue-700", admin: "bg-red-100 text-red-700" }

export default function Admin() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserItem[]>([])
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([])
  const [financials, setFinancials] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [uRes, cRes, fRes] = await Promise.all([
          api.get("/admin/users/"),
          api.get("/admin/campaigns/"),
          api.get("/admin/financials/"),
        ])
        setUsers(uRes.data.results ?? uRes.data)
        setCampaigns((cRes.data.results ?? cRes.data).slice(0, 5))
        setFinancials(fRes.data)
      } catch {
        // handle
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center"><Shield className="h-5 w-5 text-white" /></div>
        <h1 className="text-2xl font-bold text-gray-900">{t("admin_page.panel")}</h1>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title={t("admin_page.total_users")} value={users.length} icon={Users} iconBg="from-indigo-500 to-violet-600" />
        <StatsCard title={t("admin_page.active_campaigns")} value={financials?.total_active_proposals ?? 0} icon={Briefcase} iconBg="from-blue-400 to-cyan-500" />
        <StatsCard title={t("admin_page.revenue")} value={`€${financials?.estimated_commission ?? 0}`} icon={DollarSign} iconBg="from-green-400 to-emerald-600" />
        <StatsCard title={t("admin_page.pending_reviews")} value={financials?.total_paid_proposals ?? 0} icon={Shield} iconBg="from-yellow-400 to-orange-500" />
      </div>
      <Card className="card-base">
        <CardHeader><CardTitle>{t("admin_page.user_management")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-3 px-2 font-semibold text-gray-500">{t("admin_page.col_user")}</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-500">{t("admin_page.col_type")}</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-500">{t("admin_page.col_status")}</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-500">{t("admin_page.col_joined")}</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-500">{t("admin_page.col_actions")}</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-2"><p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p><p className="text-xs text-gray-500">{u.email}</p></td>
                    <td className="py-3 px-2"><span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[u.user_type] ?? ""}`}>{u.user_type}</span></td>
                    <td className="py-3 px-2 text-center"><StatusBadge status={u.is_active ? "active" : "pending"} /></td>
                    <td className="py-3 px-2 text-right text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-right"><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" className="text-green-600 h-7 w-7 p-0"><CheckCircle className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0"><XCircle className="h-4 w-4" /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card className="card-base">
        <CardHeader><CardTitle>{t("admin_page.recent_campaigns")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                <div><p className="font-medium text-gray-900 text-sm">{c.title}</p><p className="text-xs text-gray-500">{c.brand_name} · €{Number(c.price_per_influencer ?? 0).toLocaleString()}</p></div>
                <div className="flex items-center gap-2"><StatusBadge status={c.status as any} /><Badge variant="outline" className="text-xs cursor-pointer hover:bg-red-50 hover:text-red-600">{t("admin_page.flag")}</Badge></div>
              </div>
            ))}
            {campaigns.length === 0 && <p className="text-sm text-gray-400 text-center py-4">{t("campaigns_page.no_campaigns")}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
