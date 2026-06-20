import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { useNavItems, useUnreadMessages, type NavItem } from "@/components/layout/nav"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  const items = useNavItems()
  const unreadMessages = useUnreadMessages()

  const workItems = items.filter((it) => (it.section ?? "work") === "work")
  const accountItems = items.filter((it) => it.section === "account")

  const sectionLabel =
    user?.user_type === "brand"
      ? t("common.workspace_brand", "Marque")
      : user?.user_type === "admin"
        ? t("common.workspace_admin", "Administration")
        : t("common.workspace_creator", "Créateur")

  const subscriptionPlan = user?.active_brand?.subscription_plan
  const planLabel =
    user?.user_type === "brand"
      ? subscriptionPlan
        ? `Plan ${subscriptionPlan.charAt(0).toUpperCase()}${subscriptionPlan.slice(1)}`
        : t("common.plan_none", "Sans abonnement")
      : user?.user_type === "admin"
        ? t("common.plan_admin", "Console admin")
        : t("common.plan_creator", "Compte créateur")

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "InfluConnect"
  const initials = (user?.first_name?.[0] ?? user?.email?.[0] ?? "I").toUpperCase()

  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    const active = location.pathname === item.href
    return (
      <Link
        key={item.href}
        to={item.href}
        className={cn(
          "relative flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13px] font-medium transition-colors ease-aurora",
          active
            ? "bg-aurora-blue/10 text-aurora-blue-deep"
            : "text-aurora-ink-2 hover:bg-aurora-surface hover:text-aurora-ink"
        )}
      >
        <Icon className={cn("shrink-0", active ? "text-aurora-blue-deep" : "text-aurora-ink-3")} style={{ width: "16px", height: "16px" }} />
        {!collapsed && <span className="truncate flex-1">{t(item.label)}</span>}
        {item.href.includes("/messages") && unreadMessages > 0 && (
          <span
            className={cn(
              "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-aurora-blue px-1.5 text-[10px] font-semibold text-white",
              collapsed && "absolute right-1.5 top-1.5"
            )}
          >
            {unreadMessages > 99 ? "99+" : unreadMessages}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside className={cn("relative bg-white border-r border-aurora-line flex flex-col transition-all duration-300 ease-aurora shrink-0 h-full", collapsed ? "w-16" : "w-60")}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full bg-white border border-aurora-line shadow-soft flex items-center justify-center hover:bg-aurora-surface transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3 text-aurora-ink-3" /> : <ChevronLeft className="h-3 w-3 text-aurora-ink-3" />}
      </button>

      {/* Brand block */}
      <div className={cn("px-4 pt-5 pb-4 flex items-center gap-2", collapsed && "justify-center px-0")}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-aurora-blue to-aurora-blue-deep shrink-0" />
        {!collapsed && <span className="font-semibold tracking-tight text-aurora-ink">InfluConnect</span>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-4">
        {!collapsed && (
          <div className="px-3 mb-2 mt-1 text-[11px] uppercase tracking-widest text-aurora-ink-3 font-medium">
            {sectionLabel}
          </div>
        )}
        <nav className="space-y-0.5">{workItems.map(renderItem)}</nav>

        {accountItems.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-3 mt-6 mb-2 text-[11px] uppercase tracking-widest text-aurora-ink-3 font-medium">
                {t("common.account", "Compte")}
              </div>
            )}
            <nav className="space-y-0.5">{accountItems.map(renderItem)}</nav>
          </>
        )}
      </div>

      {/* User card — pinned at the bottom of the viewport-height sidebar */}
      {!collapsed && user && (
        <div className="shrink-0 mx-3 mb-4 rounded-xl bg-aurora-surface/60 border border-aurora-line p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-aurora-blue to-aurora-blue-deep text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {initials}
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-medium text-aurora-ink truncate">{displayName}</div>
            <div className="text-xs text-aurora-ink-3 truncate">{planLabel}</div>
          </div>
        </div>
      )}
    </aside>
  )
}
