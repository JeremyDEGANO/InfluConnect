import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, CalendarDays, MapPin, Users } from "lucide-react"
import { EventItem, fetchBrandEvents } from "@/lib/apiExtra"

export default function BrandEvents() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBrandEvents()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("events.title", "Événements")}</h1>
        <Button variant="gradient" onClick={() => navigate("/brand/events/new")}>
          <Plus className="h-4 w-4 mr-2" />{t("events.new_event", "Créer un événement")}
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="card-base">
          <CardContent className="py-12 text-center text-gray-500">
            <p className="mb-4">{t("events.empty", "Aucun événement pour le moment")}</p>
            <Button variant="outline" onClick={() => navigate("/brand/events/new")}>{t("events.new_event", "Créer un événement")}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((ev) => {
            const accepted = ev.invitations?.filter((i) => i.status === "accepted").length ?? 0
            return (
              <Card key={ev.id} className="card-base">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900 line-clamp-2">{ev.title}</p>
                    <Badge variant="outline">{ev.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(ev.starts_at).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.address}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Users className="h-3 w-3" />{accepted}/{ev.invitations?.length ?? 0} {t("events.accepted", "présences")}</p>
                  <Button variant="outline" className="w-full" onClick={() => navigate(`/brand/events/${ev.id}`)}>
                    {t("events.view", "Voir")}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
