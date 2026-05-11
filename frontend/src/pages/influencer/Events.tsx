import { FormEvent, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EventInvitation, fetchInfluencerEventInvitations, respondEventInvitation } from "@/lib/apiExtra"
import { useToast } from "@/hooks/use-toast"

export default function InfluencerEvents() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const tokenParam = searchParams.get("invitation") || undefined

  const [items, setItems] = useState<EventInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyToken, setBusyToken] = useState<string | null>(null)
  const [plusOnes, setPlusOnes] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    fetchInfluencerEventInvitations(tokenParam)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [tokenParam])

  const sorted = useMemo(() => [...items].sort((a, b) => {
    const aPending = a.status === "pending" ? 0 : 1
    const bPending = b.status === "pending" ? 0 : 1
    if (aPending !== bPending) return aPending - bPending
    return new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime()
  }), [items])

  const respond = async (inv: EventInvitation, status: "accepted" | "declined") => {
    const plus = Math.max(0, Math.min(inv.max_plus_ones, Number(plusOnes[inv.invite_token] || 0)))
    setBusyToken(inv.invite_token)
    try {
      await respondEventInvitation({
        invitation_token: inv.invite_token,
        status,
        plus_ones: status === "accepted" ? plus : 0,
        response_message: (notes[inv.invite_token] || "").trim(),
      })
      toast({ title: t("events.rsvp_saved", "Réponse enregistrée") })
      load()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast({ variant: "destructive", title: t("common.error"), description: typeof detail === "string" ? detail : undefined })
    } finally {
      setBusyToken(null)
    }
  }

  const submit = async (e: FormEvent, inv: EventInvitation) => {
    e.preventDefault()
    await respond(inv, "accepted")
  }

  if (loading) {
    return <div className="p-6"><div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div></div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("events.my_invitations", "Mes invitations événements")}</h1>
      {sorted.length === 0 ? (
        <Card className="card-base"><CardContent className="py-12 text-center text-gray-500">{t("events.no_invites", "Aucune invitation")}</CardContent></Card>
      ) : (
        sorted.map((inv) => (
          <Card key={inv.id} className="card-base">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>{inv.event_title}</span>
                <Badge variant={inv.status === "accepted" ? "info" : inv.status === "declined" ? "destructive" : "outline"}>{inv.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><span className="text-gray-500">{t("events.when", "Quand")}:</span> {new Date(inv.event_starts_at).toLocaleString()}</p>
              <p><span className="text-gray-500">{t("events.where", "Où")}:</span> {inv.event_address}</p>
              <p><span className="text-gray-500">{t("events.max_plus_ones", "Accompagnants autorisés")}:</span> +{inv.max_plus_ones}</p>

              <form className="space-y-2" onSubmit={(e) => submit(e, inv)}>
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={inv.max_plus_ones}
                    value={plusOnes[inv.invite_token] ?? String(inv.plus_ones_confirmed || 0)}
                    onChange={(e) => setPlusOnes((p) => ({ ...p, [inv.invite_token]: e.target.value }))}
                    disabled={inv.status === "declined"}
                  />
                  <Input
                    placeholder={t("events.note_optional", "Note (optionnel)")}
                    value={notes[inv.invite_token] ?? inv.response_message ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [inv.invite_token]: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="gradient" disabled={busyToken === inv.invite_token}>{t("events.accept", "Je participe")}</Button>
                  <Button type="button" variant="outline" disabled={busyToken === inv.invite_token} onClick={() => respond(inv, "declined")}>{t("events.decline", "Je ne participe pas")}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
