import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { useNavItems } from "@/components/layout/nav"
import { resolveMediaUrl } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronRight, LogOut, Shield } from "lucide-react"

/**
 * Page "Plus" du shell mobile : reprend toute la navigation de la sidebar
 * desktop (filtrée par rôle/plan), le profil et la déconnexion.
 */
export default function MobileMore() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = useNavItems()

  const workItems = items.filter((it) => (it.section ?? "work") === "work")
  const accountItems = items.filter((it) => it.section === "account")
  const securityLink = user?.user_type === "brand" ? "/brand/security" : "/influencer/security"
  const canAccessSecurity = user?.user_type === "brand" || user?.user_type === "influencer"

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "InfluConnect"

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const renderItem = (item: { label: string; href: string; icon: React.ElementType }) => {
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        to={item.href}
        className="flex items-center gap-3 px-4 h-12 bg-white active:bg-aurora-surface border-b border-aurora-line last:border-b-0 first:rounded-t-xl last:rounded-b-xl"
      >
        <Icon className="h-[18px] w-[18px] text-aurora-ink-3 shrink-0" />
        <span className="flex-1 text-sm font-medium text-aurora-ink truncate">{t(item.label)}</span>
        <ChevronRight className="h-4 w-4 text-aurora-ink-3" />
      </Link>
    )
  }

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      {/* Carte profil */}
      <div className="flex items-center gap-3 rounded-xl bg-white border border-aurora-line p-4">
        <Avatar className="h-12 w-12 ring-2 ring-aurora-line">
          <AvatarImage src={resolveMediaUrl(user?.avatar)} alt={displayName} />
          <AvatarFallback className="bg-aurora-ink text-white text-sm font-semibold">
            {(user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-aurora-ink truncate">{displayName}</p>
          <p className="text-xs text-aurora-ink-3 truncate">{user?.email}</p>
        </div>
      </div>

      <div className="rounded-xl border border-aurora-line overflow-hidden">
        {workItems.map(renderItem)}
      </div>

      {(accountItems.length > 0 || canAccessSecurity) && (
        <div>
          <p className="px-1 mb-2 text-[11px] uppercase tracking-widest text-aurora-ink-3 font-medium">
            {t("common.account", "Compte")}
          </p>
          <div className="rounded-xl border border-aurora-line overflow-hidden">
            {accountItems.map(renderItem)}
            {canAccessSecurity && renderItem({ label: "nav.security", href: securityLink, icon: Shield })}
          </div>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-medium active:bg-red-50"
      >
        <LogOut className="h-4 w-4" />
        {t("nav.logout")}
      </button>
    </div>
  )
}
