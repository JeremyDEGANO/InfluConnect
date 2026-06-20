import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { useUnreadMessages } from "@/components/layout/nav"
import {
  LayoutDashboard, FileText, Briefcase, MessageSquare, Bell, Menu, Shield, Users,
} from "lucide-react"

interface Tab { label: string; href: string; icon: React.ElementType }

/**
 * Navigation principale de l'app native : 4 destinations clés + "Plus".
 * Le reste de la navigation (équivalent sidebar) vit dans /m/more.
 */
export function MobileTabBar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const unreadMessages = useUnreadMessages()

  const isAgency = Boolean(
    user?.active_brand?.is_agency
    ?? (user as { brand_profile?: { is_agency?: boolean } } | null)?.brand_profile?.is_agency
  )

  const tabs: Tab[] =
    user?.user_type === "brand"
      ? [
          { label: "nav.dashboard", href: "/brand/dashboard", icon: LayoutDashboard },
          isAgency
            ? { label: "nav.marketplace", href: "/marketplace", icon: Users }
            : { label: "nav.campaigns", href: "/brand/campaigns", icon: Briefcase },
          { label: "nav.message", href: "/brand/messages", icon: MessageSquare },
          { label: "nav.notifications", href: "/brand/notifications", icon: Bell },
        ]
      : user?.user_type === "admin"
        ? [
            { label: "nav.admin", href: "/admin", icon: Shield },
            { label: "nav.admin_users", href: "/admin/users", icon: Users },
            { label: "nav.admin_campaigns", href: "/admin/campaigns", icon: Briefcase },
          ]
        : [
            { label: "nav.dashboard", href: "/influencer/dashboard", icon: LayoutDashboard },
            { label: "nav.proposals", href: "/influencer/proposals", icon: FileText },
            { label: "nav.message", href: "/influencer/messages", icon: MessageSquare },
            { label: "nav.notifications", href: "/influencer/notifications", icon: Bell },
          ]

  const allTabs: Tab[] = [...tabs, { label: "nav.more", href: "/m/more", icon: Menu }]

  return (
    <nav className="shrink-0 z-50 bg-white/95 backdrop-blur border-t border-aurora-line pb-safe">
      <div className="flex items-stretch justify-around h-16">
        {allTabs.map((tab) => {
          const Icon = tab.icon
          const active = tab.href === "/m/more"
            ? location.pathname === tab.href
            : location.pathname === tab.href || location.pathname.startsWith(tab.href + "/")
          const isMessages = tab.href.includes("/messages")
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 select-none",
                "transition-colors ease-aurora active:bg-aurora-surface",
                active ? "text-aurora-blue-deep" : "text-aurora-ink-3"
              )}
            >
              <span className="relative">
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {isMessages && unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-aurora-blue px-1 text-[9px] font-semibold text-white">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </span>
              <span className={cn("text-[10px] leading-none truncate max-w-full px-1", active ? "font-semibold" : "font-medium")}>
                {t(tab.label)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
