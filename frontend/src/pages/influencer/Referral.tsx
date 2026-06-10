import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Copy, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ReferralOverview {
  referral_code: string
  discount_percent: number
  accepted_referrals: number
  pending_invites: number
}

interface ReferralInvite {
  id: number
  invited_email: string
  status: "sent" | "accepted" | "revoked"
  created_at: string
  accepted_at: string | null
}

const statusVariant = (status: ReferralInvite["status"]) => {
  if (status === "accepted") return "success" as const
  if (status === "sent") return "warning" as const
  return "secondary" as const
}

export default function InfluencerReferral() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<ReferralOverview | null>(null)
  const [invites, setInvites] = useState<ReferralInvite[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [sending, setSending] = useState(false)

  const load = async () => {
    try {
      const [overviewRes, invitesRes] = await Promise.all([
        api.get("/influencers/referral/"),
        api.get("/influencers/referral/invitations/"),
      ])
      setOverview(overviewRes.data)
      setInvites(invitesRes.data?.results ?? [])
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const copyCode = async () => {
    if (!overview?.referral_code) return
    try {
      await navigator.clipboard.writeText(overview.referral_code)
      toast({ title: t("influencer_referral.code_copied", "Code copied") })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setSending(true)
    try {
      await api.post("/influencers/referral/invitations/", { invited_email: email })
      setInviteEmail("")
      toast({ title: t("influencer_referral.invite_sent", "Invitation sent") })
      await load()
    } catch {
      toast({ variant: "destructive", title: t("influencer_referral.invite_failed", "Unable to send invite") })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("influencer_referral.eyebrow", "Creator workspace")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("influencer_referral.title", "Referral")}</h1>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-base">{t("influencer_referral.code_title", "Your referral code")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-aurora-ink-2">
            {t("influencer_referral.code_desc", "Your code is generated automatically by InfluConnect and cannot be changed.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={overview?.referral_code ?? ""} readOnly />
            <Button type="button" variant="outline" onClick={copyCode}>
              <Copy className="h-4 w-4 mr-2" />{t("influencer_referral.copy", "Copy")}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="info">{t("influencer_referral.discount", "Discount")}: {Number(overview?.discount_percent ?? 0)}%</Badge>
            <Badge variant="success">{t("influencer_referral.accepted", "Accepted")}: {overview?.accepted_referrals ?? 0}</Badge>
            <Badge variant="warning">{t("influencer_referral.pending", "Pending")}: {overview?.pending_invites ?? 0}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-base">{t("influencer_referral.invite_title", "Invite a creator")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("influencer_referral.email_placeholder", "email@example.com")}
            />
            <Button type="button" onClick={sendInvite} disabled={sending || !inviteEmail.trim()}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              {t("influencer_referral.send_invite", "Send invite")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-base">{t("influencer_referral.invites_title", "Invitations")}</CardTitle>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="text-sm text-aurora-ink-3 text-center py-4">{t("influencer_referral.empty", "No invitations yet.")}</p>
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-aurora-surface">
                  <div>
                    <p className="font-medium text-aurora-ink text-sm">{invite.invited_email}</p>
                    <p className="text-xs text-aurora-ink-3">
                      {t("influencer_referral.sent_on", "Sent on")} {new Date(invite.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={statusVariant(invite.status)}>{t(`influencer_referral.status_${invite.status}`, invite.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}