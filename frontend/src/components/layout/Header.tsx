import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LanguageSelector } from "@/components/shared/LanguageSelector"
import { NotificationBell } from "@/components/shared/NotificationBell"
import { User, Settings, LogOut, LayoutDashboard, Shield } from "lucide-react"

export function Header() {
  const { t } = useTranslation()
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate("/") }

  const dashboardLink = user?.user_type === "brand" ? "/brand/dashboard" : user?.user_type === "admin" ? "/admin" : "/influencer/dashboard"
  const profileLink = user?.user_type === "brand" ? "/brand/profile/edit" : "/influencer/profile/edit"
  const securityLink = user?.user_type === "brand" ? "/brand/security" : "/influencer/security"
  const canAccessSecurity = user?.user_type === "brand" || user?.user_type === "influencer"

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/80">
      <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-xl group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-black shadow-sm shadow-indigo-500/20">IC</div>
          <span className="text-gray-900 tracking-tight">InfluConnect</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          {!isAuthenticated && (
            <>
              <a href="#features" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.features")}</a>
              <a href="#how-it-works" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.how_it_works")}</a>
              <a href="#pricing" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.pricing")}</a>
              <Link to="/pricing" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.compare")}</Link>
            </>
          )}
          {isAuthenticated && user?.user_type === "influencer" && (
            <>
              <Link to="/influencer/dashboard" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.dashboard")}</Link>
              <Link to="/influencer/proposals" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.proposals")}</Link>
              <Link to="/influencer/earnings" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.earnings")}</Link>
            </>
          )}
          {isAuthenticated && user?.user_type === "brand" && (
            <>
              <Link to="/brand/dashboard" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.dashboard")}</Link>
              <Link to="/brand/campaigns" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.campaigns")}</Link>
              <Link to="/brand/subscription" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.subscription")}</Link>
            </>
          )}
          {isAuthenticated && user?.user_type === "admin" && (
            <Link to="/admin" className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all">{t("nav.admin")}</Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          {isAuthenticated ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-semibold">
                        {(user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-gray-100">
                  <DropdownMenuLabel>
                    <p className="font-semibold">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-gray-500 font-normal">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(dashboardLink)}>
                    <LayoutDashboard className="h-4 w-4 mr-2" />{t("nav.dashboard")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(profileLink)}>
                    <User className="h-4 w-4 mr-2" />{t("nav.profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(profileLink)}>
                    <Settings className="h-4 w-4 mr-2" />{t("nav.settings")}
                  </DropdownMenuItem>
                  {canAccessSecurity && (
                    <DropdownMenuItem onClick={() => navigate(securityLink)}>
                      <Shield className="h-4 w-4 mr-2" />{t("nav.security")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />{t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild><Link to="/login">{t("nav.login")}</Link></Button>
              <Button variant="gradient" size="sm" asChild><Link to="/register">{t("nav.register")}</Link></Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
