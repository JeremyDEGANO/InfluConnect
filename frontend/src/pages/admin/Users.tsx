import { Fragment, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchAdminOverview, updateAdminUser, updateAdminUserStatus, type AdminOverviewUser } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  const [typeFilter, setTypeFilter] = useState<"all" | "influencer" | "brand" | "admin">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [editingUser, setEditingUser] = useState<AdminOverviewUser | null>(null)
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editLocation, setEditLocation] = useState("")
  const [editLanguage, setEditLanguage] = useState<"fr" | "en">("fr")

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
    return items.filter((u) => {
      if (typeFilter !== "all" && u.user_type !== typeFilter) return false
      if (statusFilter !== "all" && (statusFilter === "active") !== Boolean(u.is_active)) return false
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
      return !q || haystack.includes(q)
    })
  }, [items, search, typeFilter, statusFilter])

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

  const openEditUser = (user: AdminOverviewUser) => {
    setEditingUser(user)
    setEditEmail(user.email || "")
    setEditPhone(user.phone || "")
    setEditLocation(user.location || "")
    setEditLanguage(user.language_preference === "en" ? "en" : "fr")
  }

  const submitEditUser = async () => {
    if (!editingUser) return
    if (!editEmail.trim()) {
      toast({ variant: "destructive", title: t("common.error"), description: t("admin_users.edit_email", "Email") })
      return
    }

    setBusyId(editingUser.id)
    try {
      await updateAdminUser(editingUser.id, {
        email: editEmail.trim(),
        phone: editPhone.trim(),
        location: editLocation.trim(),
        language_preference: editLanguage,
      })
      toast({ title: t("admin_users.updated", "Utilisateur mis à jour") })
      setEditingUser(null)
      load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-aurora-ink-2" />
        <p className="text-sm text-aurora-ink-3">{t("admin_page.eyebrow", "Administration")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("admin_users.title")}</h1>
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
          <div className="mb-4 flex flex-wrap gap-2">
            {["all", "influencer", "brand", "admin"].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={typeFilter === value ? "default" : "outline"}
                onClick={() => setTypeFilter(value as "all" | "influencer" | "brand" | "admin")}
              >
                {value === "all" ? t("admin_users.filter_all", "Tous") : value}
              </Button>
            ))}
            {["all", "active", "inactive"].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={statusFilter === value ? "default" : "outline"}
                onClick={() => setStatusFilter(value as "all" | "active" | "inactive")}
              >
                {value === "all" ? t("admin_users.filter_status_all", "Tous statuts") : t(`admin_page.${value}`, value)}
              </Button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aurora-surface text-xs text-aurora-ink-3 uppercase">
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
                        className="border-t border-aurora-line hover:bg-aurora-surface cursor-pointer"
                        onClick={() => setExpandedId((current) => (current === key ? null : key))}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-aurora-ink-3" /> : <ChevronDown className="h-3.5 w-3.5 text-aurora-ink-3" />}
                            <div>
                              <p className="font-medium text-aurora-ink">{u.name}</p>
                              <p className="text-xs text-aurora-ink-3">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3"><Badge className={USER_TYPE_COLORS[u.user_type]}>{u.user_type}</Badge></td>
                        <td className="py-2 px-3 text-center">
                          <Badge className={u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-aurora-surface text-aurora-ink-2"}>
                            {u.is_active ? t("admin_page.active") : t("admin_page.inactive")}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-aurora-ink-3">{new Date(u.created_at).toLocaleDateString()}</td>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === u.id}
                              onClick={(e) => { e.stopPropagation(); openEditUser(u) }}
                              className="h-7 px-2"
                            >
                              {t("common.edit", "Modifier")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-aurora-line bg-aurora-surface/50">
                          <td colSpan={5} className="px-4 py-3 text-xs text-aurora-ink-2">
                            <div className="grid md:grid-cols-4 gap-3">
                              <p><span className="text-aurora-ink-3">{t("admin_page.language")}: </span>{u.language_preference}</p>
                              <p><span className="text-aurora-ink-3">{t("admin_page.phone")}: </span>{u.phone || "-"}</p>
                              <p><span className="text-aurora-ink-3">{t("admin_page.location")}: </span>{u.location || "-"}</p>
                              <p><span className="text-aurora-ink-3">2FA: </span>{u.totp_enabled ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                              {u.user_type === "brand" && (
                                <>
                                  <p><span className="text-aurora-ink-3">{t("admin_page.company")}: </span>{u.company_name || "-"}</p>
                                  <p><span className="text-aurora-ink-3">{t("admin_page.plan")}: </span>{u.subscription_plan || "-"}</p>
                                  <p><span className="text-aurora-ink-3">{t("admin_page.subscription_active")}: </span>{u.subscription_active ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                                </>
                              )}
                              <p><span className="text-aurora-ink-3">{t("admin_page.last_login")}: </span>{u.last_login ? new Date(u.last_login).toLocaleString() : "-"}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-aurora-ink-3">{t("admin_page.empty_users")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("common.edit", "Modifier")} {editingUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("admin_users.edit_email", "Email")}</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin_users.edit_phone", "Téléphone")}</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin_users.edit_location", "Localisation")}</Label>
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin_users.edit_language", "Langue (fr/en)")}</Label>
              <select
                value={editLanguage}
                onChange={(e) => setEditLanguage(e.target.value === "en" ? "en" : "fr")}
                className="mt-1 w-full h-10 rounded-md border border-aurora-line bg-white px-3 text-sm"
              >
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>{t("common.cancel", "Annuler")}</Button>
            <Button variant="gradient" disabled={busyId === editingUser?.id} onClick={submitEditUser}>
              {busyId === editingUser?.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("common.save", "Enregistrer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
