import { FormEvent, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fetchEventInvitationByToken, respondEventInvitation, type EventInvitation } from "@/lib/apiExtra"

export default function EventRsvp() {
  const { t } = useTranslation()
  const { token } = useParams()
  const [invitation, setInvitation] = useState<EventInvitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [plusOnes, setPlusOnes] = useState(0)
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!token) return
    fetchEventInvitationByToken(token)
      .then((data) => {
        setInvitation(data)
        setPlusOnes(data.plus_ones_confirmed || 0)
        setNote(data.response_message || "")
      })
      .catch(() => setInvitation(null))
      .finally(() => setLoading(false))
  }, [token])

  const respond = async (status: "accepted" | "declined") => {
    if (!token) return
    setBusy(true)
    try {
      const res = await respondEventInvitation({
        invitation_token: token,
        status,
        plus_ones: status === "accepted" ? Math.max(0, Math.min(invitation?.max_plus_ones ?? 0, plusOnes)) : 0,
        response_message: note,
      })
      setInvitation(res)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  if (!invitation) return <div className="min-h-screen flex items-center justify-center text-gray-500">{t("events.invitation_not_found", "Invitation introuvable")}</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        <Card className="card-base">
          <CardHeader>
            <CardTitle>{invitation.event_title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">{new Date(invitation.event_starts_at).toLocaleString()}</p>
            <p className="text-sm text-gray-600">{invitation.event_address}</p>
            <p className="text-sm text-gray-700">{t("events.current_status", "Statut actuel")} : {invitation.status}</p>

            <div className="grid sm:grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                max={invitation.max_plus_ones}
                value={plusOnes}
                onChange={(e) => setPlusOnes(Number(e.target.value) || 0)}
              />
              <Input
                placeholder={t("events.note_optional", "Note (optionnel)")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="gradient" disabled={busy} onClick={() => respond("accepted")}>{t("events.accept", "Je participe")}</Button>
              <Button variant="outline" disabled={busy} onClick={() => respond("declined")}>{t("events.decline", "Je ne participe pas")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
