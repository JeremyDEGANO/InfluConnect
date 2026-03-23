import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LanguageSelector } from "@/components/shared/LanguageSelector"
import { NotificationBell } from "@/components/shared/NotificationBell"
import { User, Settings, LogOut, LayoutDashboard } from "lucide-react"

export function Header() {
  const { t } = useTranslation()
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate("/") }

  const dashboardLink = user?.user_type === "brand" ? "/brand/dashboard" : user?.user_type === "admin" ? "/admin" : "/influencer/dashboard"
  const profileLink = user?.user_type === "brand" ? "/brand/profile/edit" : "/influencer/profile/edit"

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="gradient-text">InfluConnect</span>
          <span className="text-lg">✨</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          {!isAuthenticated && (
            <>
              <a href="#features" className="hover:text-purple-600 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-purple-600 transition-colors">Pricing</a>
            </>
          )}
          {isAuthenticated && user?.user_type === "influencer" && (
            <>
              <Link to="/influencer/dashboard" className="hover:text-purple-600 transition-colors">{t("nav.dashboard")}</Link>
              <Link to="/influencer/proposals" className="hover:text-purple-600 transition-colors">{t("nav.proposals")}</Link>
              <Link to="/influencer/earnings" className="hover:text-purple-600 transition-colors">{t("nav.earnings")}</Link>
            </>
          )}
          {isAuthenticated && user?.user_type === "brand" && (
            <>
              <Link to="/brand/dashboard" className="hover:text-purple-600 transition-colors">{t("nav.dashboard")}</Link>
              <Link to="/brand/campaigns" className="hover:text-purple-600 transition-colors">{t("nav.campaigns")}</Link>
              <Link to="/brand/subscription" className="hover:text-purple-600 transition-colors">{t("nav.subscription")}</Link>
            </>
          )}
          {isAuthenticated && user?.user_type === "admin" && (
            <Link to="/admin" className="hover:text-purple-600 transition-colors">{t("nav.admin")}</Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          {isAuthenticated ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-sm font-semibold">
                        {(user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
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
                    <Settings className="h-4 w-4 mr-2" />Settings
                  </DropdownMenuItem>
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
