import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import api from "@/lib/api"
import { fetchNotifications, markNotificationRead } from "@/lib/apiExtra"
import { useAuth } from "@/lib/auth"

interface Notification {
  id: number
  notification_type: string
  title: string
  message: string
  related_proposal: number | null
  read: boolean
  created_at: string
}

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return `${Math.floor(diff / 86400)} j`
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])

  const load = () => {
    if (!isAuthenticated) return
    fetchNotifications()
      .then((d) => setNotifications(d as Notification[]))
      .catch(() => {})
  }

  useEffect(() => {
    load()
    if (!isAuthenticated) return
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const unread = notifications.filter((n) => !n.read).length

  const markAllRead = async () => {
    await api.post("/notifications/read-all/").catch(() => {})
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {})
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    }
    if (n.related_proposal && user?.user_type === "influencer") {
      navigate(`/influencer/proposals/${n.related_proposal}`)
    } else {
      viewAll()
    }
  }

  const viewAll = () => {
    const path = user?.user_type === "brand" ? "/brand/notifications" : "/influencer/notifications"
    navigate(path)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs flex items-center justify-center font-semibold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">Tout lire</button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">Aucune notification</p>
        ) : (
          notifications.slice(0, 6).map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleClick(n)}
              className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${!n.read ? "bg-indigo-50/70" : ""}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-medium text-sm truncate">{n.title}</span>
                <span className="text-xs text-gray-400 shrink-0 ml-2">{timeAgo(n.created_at)}</span>
              </div>
              <span className="text-xs text-gray-600 line-clamp-2">{n.message}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={viewAll} className="justify-center text-xs text-indigo-600 font-medium">
          Voir toutes les notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
