import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import {
  fetchAgencyDelegations, createAgencyDelegation, actionAgencyDelegation,
  type AgencyDelegation,
} from "@/lib/apiExtra"
import { useAuth } from "@/lib/auth"

export default function AgencyDelegations() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user } = useAuth()
  const isAgency = !!user?.brand_profile?.is_agency
  const isInfluencer = user?.user_type === "influencer"
  const [list, setList] = useState<AgencyDelegation[]>([])
  const [loading, setLoading] = useState(true)
  const [influencerPseudo, setInfluencerPseudo] = useState("")
  const [commission, setCommission] = useState<string>(String(user?.brand_profile?.agency_default_commission_percent ?? 20))
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reload = () => fetchAgencyDelegations().then(setList).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { reload() }, [])

  const handleInvite = async () => {
    const comm = Number(commission)
    if (!influencerPseudo.trim() || isNaN(comm)) return
    setSubmitting(true)
    try {
      await createAgencyDelegation(influencerPseudo.trim(), comm, message)
      toast({ title: t("agency.invitation_sent", "Invitation envoyée") })
      setInfluencerPseudo(""); setMessage("")
      reload()
    } catch (e: any) {
      toast({ variant: "destructive", title: t("common.error"), description: e?.response?.data?.detail ?? "" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAction = async (id: number, action: "accept" | "decline" | "revoke") => {
    try {
      await actionAgencyDelegation(id, action)
      reload()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("brand_dashboard.eyebrow", "Espace marque")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("agency.title", "Délégations agence")}</h1>

      {isAgency && (
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("agency.invite_title", "Inviter un influenceur")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>{t("agency.influencer_pseudo", "Pseudo influenceur")}</Label>
                <Input value={influencerPseudo} onChange={(e) => setInfluencerPseudo(e.target.value)} placeholder="ex: lena_makeup" />
              </div>
              <div>
                <Label>{t("agency.commission", "Commission %")}</Label>
                <Input type="number" min={0} max={100} step={0.1} value={commission} onChange={(e) => setCommission(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("agency.message", "Message")}</Label>
              <Input value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <Button variant="gradient" onClick={handleInvite} disabled={submitting || !influencerPseudo.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("agency.send_invitation", "Envoyer l'invitation")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="card-base">
        <CardHeader><CardTitle className="text-base">{t("agency.list_title", isAgency ? "Mes influenceurs sous gestion" : "Invitations reçues")}</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-aurora-ink-3 text-center py-4">{t("agency.empty", "Aucune délégation pour le moment.")}</p>
          ) : (
            <div className="space-y-2">
              {list.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-aurora-surface">
                  <div>
                    <p className="font-medium text-aurora-ink text-sm">
                      {isAgency ? d.influencer_name : d.agency_name}
                    </p>
                    <p className="text-xs text-aurora-ink-3">
                      {t("agency.commission", "Commission")} : {d.commission_percent}% Â· {t(`agency.status_${d.status}`, d.status)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isInfluencer && d.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleAction(d.id, "accept")}>{t("agency.accept", "Accepter")}</Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleAction(d.id, "decline")}>{t("agency.decline", "Refuser")}</Button>
                      </>
                    )}
                    {isAgency && d.status !== "revoked" && d.status !== "declined" && (
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleAction(d.id, "revoke")}>{t("agency.revoke", "Révoquer")}</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
