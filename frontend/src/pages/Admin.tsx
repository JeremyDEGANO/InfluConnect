import { useTranslation } from "react-i18next"
import { StatsCard } from "@/components/shared/StatsCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Briefcase, DollarSign, Shield, CheckCircle, XCircle } from "lucide-react"

type UserType = "influencer" | "brand" | "admin"
interface User { id: number; name: string; email: string; type: UserType; status: "active" | "pending" | "completed" | "cancelled" | "accepted" | "declined" | "draft" | "published"; joined: string }

const MOCK_USERS: User[] = [
  { id: 1, name: "Sophie Laurent", email: "sophie@example.com", type: "influencer", status: "active", joined: "2024-01-15" },
  { id: 2, name: "FashionBrand", email: "brand@fashion.com", type: "brand", status: "active", joined: "2024-01-20" },
  { id: 3, name: "Marc Dubois", email: "marc@example.com", type: "influencer", status: "pending", joined: "2024-03-01" },
  { id: 4, name: "TechCo", email: "info@techco.com", type: "brand", status: "active", joined: "2024-02-10" },
]

const TYPE_COLORS: Record<UserType, string> = { influencer: "bg-purple-100 text-purple-700", brand: "bg-blue-100 text-blue-700", admin: "bg-red-100 text-red-700" }

export default function Admin() {
  const { t } = useTranslation()
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center"><Shield className="h-5 w-5 text-white" /></div>
        <h1 className="text-2xl font-bold text-gray-900">{t("nav.admin")} Panel</h1>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Users" value="10,248" icon={Users} trend={8} trendLabel="this month" iconBg="from-purple-500 to-indigo-600" />
        <StatsCard title="Active Campaigns" value="342" icon={Briefcase} trend={15} trendLabel="this month" iconBg="from-blue-400 to-cyan-500" />
        <StatsCard title="Revenue (MRR)" value="€52,400" icon={DollarSign} trend={22} trendLabel="vs last month" iconBg="from-green-400 to-emerald-600" />
        <StatsCard title="Pending Reviews" value="18" icon={Shield} iconBg="from-yellow-400 to-orange-500" />
      </div>
      <Card className="card-base">
        <CardHeader><CardTitle>User Management</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-3 px-2 font-semibold text-gray-500">User</th><th className="text-left py-3 px-2 font-semibold text-gray-500">Type</th><th className="text-center py-3 px-2 font-semibold text-gray-500">Status</th><th className="text-right py-3 px-2 font-semibold text-gray-500">Joined</th><th className="text-right py-3 px-2 font-semibold text-gray-500">Actions</th></tr></thead>
              <tbody>
                {MOCK_USERS.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-2"><p className="font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></td>
                    <td className="py-3 px-2"><span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[u.type]}`}>{u.type}</span></td>
                    <td className="py-3 px-2 text-center"><StatusBadge status={u.status} /></td>
                    <td className="py-3 px-2 text-right text-gray-500">{new Date(u.joined).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-right"><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" className="text-green-600 h-7 w-7 p-0"><CheckCircle className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="text-red-500 h-7 w-7 p-0"><XCircle className="h-4 w-4" /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card className="card-base">
        <CardHeader><CardTitle>Recent Campaigns — Moderation</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[{ title: "Summer Collection 2024", brand: "FashionBrand", budget: 2000, status: "active" as const }, { title: "Tech Gadgets", brand: "TechCo", budget: 5000, status: "pending" as const }, { title: "Healthy Living", brand: "NutriBar", budget: 1500, status: "completed" as const }].map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                <div><p className="font-medium text-gray-900 text-sm">{c.title}</p><p className="text-xs text-gray-500">{c.brand} · €{c.budget.toLocaleString()}</p></div>
                <div className="flex items-center gap-2"><StatusBadge status={c.status} /><Badge variant="outline" className="text-xs cursor-pointer hover:bg-red-50 hover:text-red-600">Flag</Badge></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
