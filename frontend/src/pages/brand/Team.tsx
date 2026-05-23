import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Trash2, UserPlus } from "lucide-react"
import {
  fetchBrandMemberships, inviteBrandMember, revokeBrandMember,
  type BrandMembership,
} from "@/lib/apiExtra"

export default function BrandTeam() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [list, setList] = useState<BrandMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [submitting, setSubmitting] = useState(false)

  const reload = () => fetchBrandMemberships().then(setList).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { reload() }, [])

  const handleInvite = async () => {
    if (!email.trim()) return
    setSubmitting(true)
    try {
      await inviteBrandMember(email.trim().toLowerCase(), role)
      toast({ title: t("brand_team.invited", "Invitation envoyée") })
      setEmail("")
      reload()
    } catch (e: any) {
      toast({ variant: "destructive", title: t("common.error"), description: e?.response?.data?.detail ?? "" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (id: number) => {
    if (!confirm(t("brand_team.confirm_revoke", "Révoquer cet accès ?"))) return
    try {
      await revokeBrandMember(id)
      reload()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("brand_dashboard.eyebrow", "Espace marque")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("brand_team.title", "Équipe")}</h1>
      <Card className="card-base">
        <CardHeader><CardTitle className="text-base">{t("brand_team.invite_title", "Inviter un collaborateur")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label>{t("brand_team.role", "Rôle")}</Label>
              <select className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="member">{t("brand_team.role_member", "Membre")}</option>
                <option value="admin">{t("brand_team.role_admin", "Admin")}</option>
              </select>
            </div>
          </div>
          <Button variant="gradient" onClick={handleInvite} disabled={submitting || !email.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
            {t("brand_team.invite_button", "Inviter")}
          </Button>
        </CardContent>
      </Card>
      <Card className="card-base">
        <CardHeader><CardTitle className="text-base">{t("brand_team.members", "Membres")}</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-aurora-ink-3 text-center py-4">{t("brand_team.empty", "Aucun collaborateur invité.")}</p>
          ) : (
            <div className="space-y-2">
              {list.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-aurora-surface">
                  <div>
                    <p className="font-medium text-aurora-ink text-sm">{m.user_name || m.invited_email}</p>
                    <p className="text-xs text-aurora-ink-3">{m.user_email || m.invited_email} Â· {t(`brand_team.role_${m.role}`, m.role)} Â· {t(`brand_team.status_${m.status}`, m.status)}</p>
                  </div>
                  {m.role !== "owner" && m.status !== "revoked" && (
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRevoke(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
