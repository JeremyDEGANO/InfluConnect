import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { fetchOnboarding } from "@/lib/apiExtra"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, FileText, DollarSign, User, Briefcase, PlusCircle,
  CreditCard, ChevronLeft, ChevronRight, Shield, Sparkles, Star, ScrollText, Building2,
  Bell, Megaphone, Crown, Users, LifeBuoy, MessageSquare, CalendarCheck,
} from "lucide-react"

type NavSection = "work" | "account"
interface NavItem { label: string; href: string; icon: React.ElementType; section?: NavSection }

interface ConversationItem {
  unread_count?: number
}

const INFLUENCER_NAV: NavItem[] = [
  { label: "nav.dashboard", href: "/influencer/dashboard", icon: LayoutDashboard, section: "work" },
  { label: "nav.onboarding", href: "/influencer/onboarding", icon: Sparkles, section: "work" },
  { label: "nav.message", href: "/influencer/messages", icon: MessageSquare, section: "work" },
  { label: "nav.events", href: "/influencer/events", icon: CalendarCheck, section: "work" },
  { label: "nav.proposals", href: "/influencer/proposals", icon: FileText, section: "work" },
  { label: "nav.castings", href: "/influencer/castings", icon: Megaphone, section: "work" },
  { label: "nav.contracts", href: "/influencer/contracts", icon: FileText, section: "work" },
  { label: "nav.earnings", href: "/influencer/earnings", icon: DollarSign, section: "work" },
  { label: "nav.media_kit", href: "/influencer/media-kit", icon: FileText, section: "work" },
  { label: "nav.notifications", href: "/influencer/notifications", icon: Bell, section: "work" },
  { label: "nav.delegations", href: "/influencer/delegations", icon: Crown, section: "work" },
  { label: "nav.profile", href: "/influencer/profile/edit", icon: User, section: "account" },
  { label: "nav.support", href: "/influencer/support", icon: LifeBuoy, section: "account" },
]

const BRAND_NAV: NavItem[] = [
  { label: "nav.dashboard", href: "/brand/dashboard", icon: LayoutDashboard, section: "work" },
  { label: "nav.campaigns", href: "/brand/campaigns", icon: Briefcase, section: "work" },
  { label: "campaigns.new_campaign", href: "/brand/campaigns/new", icon: PlusCircle, section: "work" },
  { label: "nav.marketplace", href: "/marketplace", icon: Users, section: "work" },
  { label: "nav.castings", href: "/brand/castings", icon: Megaphone, section: "work" },
  { label: "nav.contracts", href: "/brand/contracts", icon: FileText, section: "work" },
  { label: "nav.events", href: "/brand/events", icon: CalendarCheck, section: "work" },
  { label: "nav.message", href: "/brand/messages", icon: MessageSquare, section: "work" },
  { label: "nav.ambassadors", href: "/brand/ambassadors", icon: Crown, section: "work" },
  { label: "nav.notifications", href: "/brand/notifications", icon: Bell, section: "work" },
  { label: "nav.contract_templates", href: "/brand/contract-templates", icon: ScrollText, section: "work" },
  { label: "nav.team", href: "/brand/team", icon: Users, section: "account" },
  { label: "nav.profile", href: "/brand/profile/edit", icon: User, section: "account" },
  { label: "nav.subscription", href: "/brand/subscription", icon: CreditCard, section: "account" },
  { label: "nav.support", href: "/brand/support", icon: LifeBuoy, section: "account" },
  { label: "nav.brand_onboarding", href: "/brand/onboarding", icon: Sparkles, section: "account" },
]

const ADMIN_NAV: NavItem[] = [
  { label: "nav.admin", href: "/admin", icon: Shield, section: "work" },
  { label: "nav.admin_companies", href: "/admin/companies", icon: Building2, section: "work" },
  { label: "nav.admin_users", href: "/admin/users", icon: Users, section: "work" },
  { label: "nav.admin_campaigns", href: "/admin/campaigns", icon: Briefcase, section: "work" },
  { label: "nav.admin_brands", href: "/admin/brands", icon: Building2, section: "work" },
  { label: "nav.admin_reviews", href: "/admin/reviews", icon: Star, section: "work" },
  { label: "nav.admin_audit", href: "/admin/audit-log", icon: ScrollText, section: "work" },
  { label: "nav.admin_support", href: "/admin/support", icon: LifeBuoy, section: "account" },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const { user } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  const isAgency = Boolean((user as { brand_profile?: { is_agency?: boolean } } | null)?.brand_profile?.is_agency)
  const brandApproved = ((user as { brand_profile?: { validation_status?: string } } | null)?.brand_profile?.validation_status) === "approved"

  useEffect(() => {
    if (user?.user_type !== "influencer") {
      setOnboardingCompleted(null)
      return
    }
    fetchOnboarding()
      .then((s) => setOnboardingCompleted(Boolean(s.onboarding_completed)))
      .catch(() => setOnboardingCompleted(null))
  }, [user?.user_type])

  useEffect(() => {
    if (!user || (user.user_type !== "brand" && user.user_type !== "influencer")) {
      setUnreadMessages(0)
      return
    }

    let cancelled = false
    const loadUnread = async () => {
      try {
        const res = await api.get("/conversations/")
        const list = Array.isArray(res.data)
          ? (res.data as ConversationItem[])
          : Array.isArray(res.data?.results)
            ? (res.data.results as ConversationItem[])
            : []
        const total = list.reduce((sum, c) => sum + (c.unread_count || 0), 0)
        if (!cancelled) setUnreadMessages(total)
      } catch {
        if (!cancelled) setUnreadMessages(0)
      }
    }

    loadUnread()
    const onUnreadRefresh = () => {
      loadUnread()
    }
    window.addEventListener("messages:unread-refresh", onUnreadRefresh)
    const timer = setInterval(loadUnread, 30000)
    return () => {
      cancelled = true
      window.removeEventListener("messages:unread-refresh", onUnreadRefresh)
      clearInterval(timer)
    }
  }, [user])

  const items = user?.user_type === "brand"
    ? BRAND_NAV.filter((item) => {
        if (item.href === "/brand/onboarding" && brandApproved) return false
        if (isAgency && (item.href === "/brand/campaigns" || item.href === "/brand/campaigns/new" || item.href === "/brand/castings")) {
          return false
        }
        return true
      })
    : user?.user_type === "admin"
      ? ADMIN_NAV
      : INFLUENCER_NAV.filter((item) => item.href !== "/influencer/onboarding" || onboardingCompleted !== true)

  const workItems = items.filter((it) => (it.section ?? "work") === "work")
  const accountItems = items.filter((it) => it.section === "account")

  const sectionLabel =
    user?.user_type === "brand"
      ? t("common.workspace_brand", "Marque")
      : user?.user_type === "admin"
        ? t("common.workspace_admin", "Administration")
        : t("common.workspace_creator", "Créateur")

  const planLabel =
    user?.user_type === "brand"
      ? t("common.plan_growth", "Plan Growth")
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
    <aside className={cn("relative bg-white border-r border-aurora-line flex flex-col transition-all duration-300 ease-aurora shrink-0 min-h-screen", collapsed ? "w-16" : "w-60")}>
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

      <div className="flex-1 overflow-y-auto px-2.5 pb-32">
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

      {/* User card */}
      {!collapsed && user && (
        <div className="absolute bottom-4 left-3 right-3 rounded-xl bg-aurora-surface/60 border border-aurora-line p-3 flex items-center gap-3">
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
