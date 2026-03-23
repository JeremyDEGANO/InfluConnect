import { useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface Notification {
  id: number
  title: string
  message: string
  read: boolean
  time: string
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 1, title: "New Proposal", message: "FashionBrand sent you a proposal", read: false, time: "5m ago" },
  { id: 2, title: "Payment Received", message: "€250 has been released to your account", read: false, time: "1h ago" },
  { id: 3, title: "Campaign Update", message: "Summer Collection campaign ends tomorrow", read: true, time: "2h ago" },
]

export function NotificationBell() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const unread = notifications.filter((n) => !n.read).length

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs flex items-center justify-center">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-purple-600 hover:underline">Mark all read</button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.map((n) => (
          <DropdownMenuItem key={n.id} className={`flex flex-col items-start gap-1 p-3 ${!n.read ? "bg-purple-50" : ""}`}>
            <div className="flex items-center justify-between w-full">
              <span className="font-medium text-sm">{n.title}</span>
              <span className="text-xs text-gray-400">{n.time}</span>
            </div>
            <span className="text-xs text-gray-600">{n.message}</span>
            {!n.read && <Badge variant="purple" className="text-xs">New</Badge>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
