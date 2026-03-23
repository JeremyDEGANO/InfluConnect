import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, FileText, DollarSign, User, Briefcase, PlusCircle,
  CreditCard, ChevronLeft, ChevronRight, Shield
} from "lucide-react"

interface NavItem { label: string; href: string; icon: React.ElementType }

const INFLUENCER_NAV: NavItem[] = [
  { label: "nav.dashboard", href: "/influencer/dashboard", icon: LayoutDashboard },
  { label: "nav.proposals", href: "/influencer/proposals", icon: FileText },
  { label: "nav.earnings", href: "/influencer/earnings", icon: DollarSign },
  { label: "nav.profile", href: "/influencer/profile/edit", icon: User },
]

const BRAND_NAV: NavItem[] = [
  { label: "nav.dashboard", href: "/brand/dashboard", icon: LayoutDashboard },
  { label: "nav.campaigns", href: "/brand/campaigns", icon: Briefcase },
  { label: "campaigns.new_campaign", href: "/brand/campaigns/new", icon: PlusCircle },
  { label: "nav.profile", href: "/brand/profile/edit", icon: User },
  { label: "nav.subscription", href: "/brand/subscription", icon: CreditCard },
]

const ADMIN_NAV: NavItem[] = [
  { label: "nav.admin", href: "/admin", icon: Shield },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()

  const items = user?.user_type === "brand" ? BRAND_NAV : user?.user_type === "admin" ? ADMIN_NAV : INFLUENCER_NAV

  return (
    <aside className={cn("relative bg-white border-r border-gray-100 flex flex-col transition-all duration-300 shrink-0", collapsed ? "w-16" : "w-56")}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <nav className="flex-1 py-6 px-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 border border-purple-100"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-purple-600" : "text-gray-400")} style={{ width: "18px", height: "18px" }} />
              {!collapsed && <span className="truncate">{t(item.label)}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
