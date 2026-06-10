import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LanguageSelector } from "@/components/shared/LanguageSelector"
import { NotificationBell } from "@/components/shared/NotificationBell"
import { WorkspaceSwitcher } from "@/components/shared/WorkspaceSwitcher"
import { resolveMediaUrl } from "@/lib/utils"
import { User, Settings, LogOut, LayoutDashboard, Shield } from "lucide-react"
import { PORTAL_TOUR_REPLAY_EVENT } from "@/components/shared/PortalGuidedTour"

export function Header() {
  const { t } = useTranslation()
  const { user, isAuthenticated, logout, switchBrandWorkspace, createBrandWorkspace } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate("/") }
  const replayTour = () => {
    window.dispatchEvent(new Event(PORTAL_TOUR_REPLAY_EVENT))
  }

  const dashboardLink = user?.user_type === "brand" ? "/brand/dashboard" : user?.user_type === "admin" ? "/admin" : "/influencer/dashboard"
  const profileLink = user?.user_type === "brand" ? "/brand/profile/edit" : "/influencer/profile/edit"
  const securityLink = user?.user_type === "brand" ? "/brand/security" : "/influencer/security"
  const canAccessSecurity = user?.user_type === "brand" || user?.user_type === "influencer"
  const brandApproved = user?.user_type !== "brand" || (
    (user?.active_brand?.validation_status
      ?? (user?.brand_profile as { validation_status?: string } | undefined)?.validation_status) === "approved"
  )
  const brandEnvironments = user?.brand_environments ?? []
  const canSwitchWorkspace = user?.user_type === "brand" && brandEnvironments.length > 1
  const canCreateWorkspace = user?.user_type === "brand" && ["owner", "admin"].includes(user?.active_brand_role || "")

  const handleCreateWorkspace = async () => {
    const value = window.prompt(t("common.workspace_create_prompt", "Name of the new workspace"), "")
    const companyName = (value || "").trim()
    if (!companyName) return
    await createBrandWorkspace(companyName)
  }

  return (
    <header className="sticky top-0 z-50 glass border-b border-aurora-line">
      <div className="container max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img
            src="/brand-logo-square.svg"
            alt="InfluConnect"
            className="h-7 w-7 rounded-[8px] shadow-soft object-cover"
          />
          <span className="text-aurora-ink font-semibold text-[15px] tracking-tight">InfluConnect</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-[13px] font-medium">
          {!isAuthenticated && (
            <>
              <Link to="/#features" className="px-3 py-1.5 rounded-full text-aurora-ink-2 hover:text-aurora-ink hover:bg-aurora-surface transition-all ease-aurora">{t("nav.features")}</Link>
              <Link to="/#how-it-works" className="px-3 py-1.5 rounded-full text-aurora-ink-2 hover:text-aurora-ink hover:bg-aurora-surface transition-all ease-aurora">{t("nav.how_it_works")}</Link>
              <Link to="/pricing/brands" className="px-3 py-1.5 rounded-full text-aurora-ink-2 hover:text-aurora-ink hover:bg-aurora-surface transition-all ease-aurora">{t("nav.pricing")}</Link>
              <Link to="/compare" className="px-3 py-1.5 rounded-full text-aurora-ink-2 hover:text-aurora-ink hover:bg-aurora-surface transition-all ease-aurora">{t("nav.compare")}</Link>
              <Link to="/about" className="px-3 py-1.5 rounded-full text-aurora-ink-2 hover:text-aurora-ink hover:bg-aurora-surface transition-all ease-aurora">{t("nav.about", "À propos")}</Link>
              <Link to="/contact" className="px-3 py-1.5 rounded-full text-aurora-ink-2 hover:text-aurora-ink hover:bg-aurora-surface transition-all ease-aurora">{t("nav.contact", "Contact")}</Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          {isAuthenticated ? (
            <>
              {brandApproved && user?.user_type === "brand" && <WorkspaceSwitcher />}
              {brandApproved && <NotificationBell />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2">
                    <Avatar className="h-8 w-8 ring-2 ring-aurora-line hover:ring-aurora-blue/30 transition-all">
                      <AvatarImage src={resolveMediaUrl(user?.avatar)} alt={user?.first_name || "Avatar"} />
                      <AvatarFallback className="bg-aurora-ink text-white text-xs font-semibold">
                        {(user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "")}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl shadow-soft-lg border-aurora-line p-1.5">
                  <DropdownMenuLabel className="px-3 py-2.5">
                    <p className="font-semibold text-aurora-ink text-sm">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-aurora-ink-3 font-normal mt-0.5 truncate">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {brandApproved ? (
                    <>
                      {user?.user_type === "brand" && (
                        <>
                          <DropdownMenuLabel className="px-3 py-2 text-xs text-aurora-ink-3">
                            {t("common.current_workspace", "Current workspace")}
                          </DropdownMenuLabel>
                          {brandEnvironments.map((workspace) => (
                            <DropdownMenuItem
                              key={workspace.id}
                              onClick={() => switchBrandWorkspace(workspace.id)}
                              className={workspace.id === user?.active_brand_workspace_id ? "font-semibold" : ""}
                            >
                              {workspace.company_name}
                            </DropdownMenuItem>
                          ))}
                          {canCreateWorkspace && (
                            <DropdownMenuItem onClick={handleCreateWorkspace}>
                              + {t("common.workspace_create", "Create workspace")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                        </>
                      )}
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
                      {canAccessSecurity && (
                        <DropdownMenuItem onClick={replayTour}>
                          <LayoutDashboard className="h-4 w-4 mr-2" />{t("tour.replay", "Refaire la visite")}
                        </DropdownMenuItem>
                      )}
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => navigate("/brand/onboarding")}>
                      <LayoutDashboard className="h-4 w-4 mr-2" />{t("brand_profile.go_to_onboarding", "Voir l'onboarding")}
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
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" asChild><Link to="/login">{t("nav.login")}</Link></Button>
              <Button variant="gradient" size="sm" asChild><Link to="/register">{t("nav.register")}</Link></Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
