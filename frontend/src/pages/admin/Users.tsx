import { Fragment, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchAdminOverview, updateAdminUserStatus, type AdminOverviewUser } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ChevronDown, ChevronUp, Users, UserCheck, UserX } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const USER_TYPE_COLORS: Record<string, string> = {
  influencer: "bg-violet-100 text-violet-700",
  brand: "bg-sky-100 text-sky-700",
  admin: "bg-red-100 text-red-700",
}

export default function AdminUsers() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<AdminOverviewUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = () => {
    setLoading(true)
    fetchAdminOverview()
      .then((d) => setItems(d.users ?? []))
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setLoading(false))
  }

  useEffect(load, [t, toast])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((u) => {
      const haystack = [
        u.name,
        u.email,
        u.user_type,
        u.language_preference,
        u.phone,
        u.location,
        u.company_name,
        u.subscription_plan,
        u.is_active ? "active" : "inactive",
      ].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  const toggleUser = async (user: AdminOverviewUser, nextValue: boolean) => {
    setBusyId(user.id)
    try {
      await updateAdminUserStatus(user.id, nextValue)
      toast({ title: nextValue ? t("admin_page.user_activated") : t("admin_page.user_deactivated") })
      load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-slate-600" />
        <h1 className="text-2xl font-bold text-gray-900">{t("admin_users.title")}</h1>
      </div>

      <Card className="card-base">
        <CardHeader>
          <CardTitle>{t("admin_page.user_management")} ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin_page.search_users")}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-2 px-3">{t("admin_page.col_user")}</th>
                  <th className="text-left py-2 px-3">{t("admin_page.col_type")}</th>
                  <th className="text-center py-2 px-3">{t("admin_page.col_status")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_joined")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((u) => {
                  const key = String(u.id)
                  const isExpanded = expandedId === key
                  return (
                    <Fragment key={u.id}>
                      <tr
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId((current) => (current === key ? null : key))}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                            <div>
                              <p className="font-medium text-gray-900">{u.name}</p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3"><Badge className={USER_TYPE_COLORS[u.user_type]}>{u.user_type}</Badge></td>
                        <td className="py-2 px-3 text-center">
                          <Badge className={u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}>
                            {u.is_active ? t("admin_page.active") : t("admin_page.inactive")}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === u.id || u.is_active}
                              onClick={(e) => { e.stopPropagation(); toggleUser(u, true) }}
                              className="h-7 px-2 text-emerald-700"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === u.id || !u.is_active}
                              onClick={(e) => { e.stopPropagation(); toggleUser(u, false) }}
                              className="h-7 px-2 text-rose-600"
                            >
                              {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-gray-50/50">
                          <td colSpan={5} className="px-4 py-3 text-xs text-gray-600">
                            <div className="grid md:grid-cols-4 gap-3">
                              <p><span className="text-gray-400">{t("admin_page.language")}: </span>{u.language_preference}</p>
                              <p><span className="text-gray-400">{t("admin_page.phone")}: </span>{u.phone || "-"}</p>
                              <p><span className="text-gray-400">{t("admin_page.location")}: </span>{u.location || "-"}</p>
                              <p><span className="text-gray-400">2FA: </span>{u.totp_enabled ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                              {u.user_type === "brand" && (
                                <>
                                  <p><span className="text-gray-400">{t("admin_page.company")}: </span>{u.company_name || "-"}</p>
                                  <p><span className="text-gray-400">{t("admin_page.plan")}: </span>{u.subscription_plan || "-"}</p>
                                  <p><span className="text-gray-400">{t("admin_page.subscription_active")}: </span>{u.subscription_active ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                                </>
                              )}
                              <p><span className="text-gray-400">{t("admin_page.last_login")}: </span>{u.last_login ? new Date(u.last_login).toLocaleString() : "-"}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">{t("admin_page.empty_users")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
