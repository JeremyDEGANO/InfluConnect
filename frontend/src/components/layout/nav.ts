// Définition de la navigation partagée entre la Sidebar (desktop) et le
// shell mobile (tab bar + page "Plus"). Le filtrage (plan, agence, onboarding)
// vit dans useNavItems pour que les deux rendus restent cohérents.
import { useEffect, useState } from "react"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { fetchOnboarding } from "@/lib/apiExtra"
import {
  LayoutDashboard, FileText, DollarSign, User, Briefcase, PlusCircle,
  CreditCard, Shield, Sparkles, Star, ScrollText, Building2,
  Bell, Megaphone, Crown, Users, LifeBuoy, MessageSquare, CalendarCheck, Plug, Gift,
} from "lucide-react"

export type NavSection = "work" | "account"
export interface NavItem { label: string; href: string; icon: React.ElementType; section?: NavSection }

interface ConversationItem {
  unread_count?: number
}

export const INFLUENCER_NAV: NavItem[] = [
  { label: "nav.dashboard", href: "/influencer/dashboard", icon: LayoutDashboard, section: "work" },
  { label: "nav.referral", href: "/influencer/referral", icon: Gift, section: "work" },
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

export const BRAND_NAV: NavItem[] = [
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
  { label: "nav.environments", href: "/brand/environments", icon: Building2, section: "account" },
  { label: "nav.integrations", href: "/brand/integrations", icon: Plug, section: "account" },
  { label: "nav.profile", href: "/brand/profile/edit", icon: User, section: "account" },
  { label: "nav.subscription", href: "/brand/subscription", icon: CreditCard, section: "account" },
  { label: "nav.support", href: "/brand/support", icon: LifeBuoy, section: "account" },
  { label: "nav.brand_onboarding", href: "/brand/onboarding", icon: Sparkles, section: "account" },
]

export const ADMIN_NAV: NavItem[] = [
  { label: "nav.admin", href: "/admin", icon: Shield, section: "work" },
  { label: "nav.admin_companies", href: "/admin/companies", icon: Building2, section: "work" },
  { label: "nav.admin_users", href: "/admin/users", icon: Users, section: "work" },
  { label: "nav.admin_campaigns", href: "/admin/campaigns", icon: Briefcase, section: "work" },
  { label: "nav.admin_brands", href: "/admin/brands", icon: Building2, section: "work" },
  { label: "nav.admin_reviews", href: "/admin/reviews", icon: Star, section: "work" },
  { label: "nav.admin_plans", href: "/admin/plans", icon: CreditCard, section: "work" },
  { label: "nav.admin_audit", href: "/admin/audit-log", icon: ScrollText, section: "work" },
  { label: "nav.admin_support", href: "/admin/support", icon: LifeBuoy, section: "account" },
]

/** Total des messages non lus, rafraîchi périodiquement (badge sidebar / tab bar). */
export function useUnreadMessages(): number {
  const { user } = useAuth()
  const [unreadMessages, setUnreadMessages] = useState(0)

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

  return unreadMessages
}

/** Items de navigation du rôle courant, filtrés (plan, agence, onboarding). */
export function useNavItems(): NavItem[] {
  const { user } = useAuth()
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null)

  const isAgency = Boolean(
    user?.active_brand?.is_agency
    ?? (user as { brand_profile?: { is_agency?: boolean } } | null)?.brand_profile?.is_agency
  )
  const brandApproved = (
    user?.active_brand?.validation_status
    ?? (user as { brand_profile?: { validation_status?: string } } | null)?.brand_profile?.validation_status
  ) === "approved"

  useEffect(() => {
    if (user?.user_type !== "influencer") {
      setOnboardingCompleted(null)
      return
    }
    fetchOnboarding()
      .then((s) => setOnboardingCompleted(Boolean(s.onboarding_completed)))
      .catch(() => setOnboardingCompleted(null))
  }, [user?.user_type])

  // Feature gating by subscription plan (admin-configurable). Absent payload
  // (older session cache) → permissive, the backend still enforces.
  const planFeatures = user?.active_brand?.plan_features
  const featureOn = (key: string) => !planFeatures || Boolean(planFeatures[key])
  const environmentsCount = user?.brand_environments?.length ?? 0

  return user?.user_type === "brand"
    ? BRAND_NAV.filter((item) => {
        if (item.href === "/brand/onboarding" && brandApproved) return false
        if (isAgency && (item.href === "/brand/campaigns" || item.href === "/brand/campaigns/new" || item.href === "/brand/castings")) {
          return false
        }
        if (item.href === "/brand/ambassadors" && !featureOn("ambassador_programs")) return false
        if (item.href === "/brand/events" && !featureOn("events")) return false
        if (item.href === "/brand/castings" && !featureOn("open_castings")) return false
        if (item.href === "/brand/contract-templates" && planFeatures && Number(planFeatures.contract_templates_max ?? 0) === 0) return false
        // Integrations menu only makes sense when at least one integration is included
        if (
          item.href === "/brand/integrations"
          && !featureOn("api_access")
          && !featureOn("sso_office365_google")
          && !featureOn("slack_teams_integration")
          && !featureOn("crm_integration")
        ) return false
        // Keep environments visible when the user already belongs to several
        if (item.href === "/brand/environments" && !featureOn("multi_environments") && environmentsCount <= 1) return false
        return true
      })
    : user?.user_type === "admin"
      ? ADMIN_NAV
      : INFLUENCER_NAV.filter((item) => item.href !== "/influencer/onboarding" || onboardingCompleted !== true)
}
