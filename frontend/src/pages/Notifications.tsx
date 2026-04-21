import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { fetchNotifications, markNotificationRead } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, CheckCheck, Loader2, Mail, FileText, DollarSign, Star, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notif {
  id: number
  notification_type: string
  title: string
  message: string
  related_proposal: number | null
  read: boolean
  email_sent: boolean
  created_at: string
}

const ICONS: Record<string, any> = {
  proposal_received: Mail,
  proposal_accepted: FileText,
  proposal_declined: AlertCircle,
  contract_signed: FileText,
  payment_released: DollarSign,
  review_received: Star,
}

export default function Notifications() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetchNotifications()
      .then((d) => setItems(d as Notif[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const markRead = async (id: number) => {
    await markNotificationRead(id).catch(() => {})
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAllRead = async () => {
    await api.post("/notifications/read-all/").catch(() => {})
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleClick = (n: Notif) => {
    if (!n.read) markRead(n.id)
    if (n.related_proposal) {
      navigate(`/influencer/proposals/${n.related_proposal}`)
    }
  }

  const unread = items.filter((n) => !n.read).length

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell className="h-6 w-6 text-indigo-500" />
          {t("notifications.title")}
          {unread > 0 && <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">{unread}</span>}
        </h1>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" />{t("notifications.mark_all_read")}
          </Button>
        )}
      </div>

      <Card className="card-base">
        <CardHeader><CardTitle className="text-base">{t("notifications.recent_activity")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" />{t("notifications.loading")}</div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">{t("notifications.empty")}</p>
          ) : (
            <div className="space-y-2">
              {items.map((n) => {
                const Icon = ICONS[n.notification_type] ?? Bell
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors border",
                      n.read ? "bg-white border-gray-100 hover:bg-gray-50" : "bg-indigo-50/50 border-indigo-100 hover:bg-indigo-50"
                    )}
                  >
                    <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", n.read ? "bg-gray-100 text-gray-500" : "bg-indigo-100 text-indigo-600")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm font-semibold truncate", n.read ? "text-gray-700" : "text-gray-900")}>{n.title}</p>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString(i18n.language)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
