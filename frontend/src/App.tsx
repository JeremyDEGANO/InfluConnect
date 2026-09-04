import { lazy, Suspense, useEffect } from "react"
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { EmailVerificationBanner } from "@/components/shared/EmailVerificationBanner"
import { PlanGuard } from "@/components/shared/PlanGuard"
import { Sidebar } from "@/components/layout/Sidebar"
import { Footer } from "@/components/layout/Footer"
import { MobileTabBar } from "@/components/layout/MobileTabBar"
import { NativeBridge } from "@/components/NativeBridge"
import { isNative } from "@/lib/native"
import { Toaster } from "@/components/ui/toaster"
// Eager: entry pages shown on first paint
import Landing from "@/pages/Landing"
import Login from "@/pages/Login"
import { PortalGuidedTour } from "@/components/shared/PortalGuidedTour"

// Lazy: every other page is its own chunk, loaded on navigation
const LoginSSO = lazy(() => import("@/pages/LoginSSO"))
const DocsIntegrations = lazy(() => import("@/pages/DocsIntegrations"))
const Integrations = lazy(() => import("@/pages/brand/Integrations"))
const Register = lazy(() => import("@/pages/Register"))
const PasswordResetRequest = lazy(() => import("@/pages/PasswordResetRequest"))
const PasswordResetConfirm = lazy(() => import("@/pages/PasswordResetConfirm"))
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"))
const MfaResetConfirm = lazy(() => import("@/pages/MfaResetConfirm"))
const SecuritySettings = lazy(() => import("@/pages/SecuritySettings"))
const Pricing = lazy(() => import("@/pages/Pricing"))
const InfluencerDashboard = lazy(() => import("@/pages/influencer/Dashboard"))
const InfluencerReferral = lazy(() => import("./pages/influencer/Referral"))
const InfluencerProposals = lazy(() => import("@/pages/influencer/Proposals"))
const ProposalDetail = lazy(() => import("@/pages/influencer/ProposalDetail"))
const InfluencerEditProfile = lazy(() => import("@/pages/influencer/EditProfile"))
const Earnings = lazy(() => import("@/pages/influencer/Earnings"))
const BrandDashboard = lazy(() => import("@/pages/brand/Dashboard"))
const BrandCampaigns = lazy(() => import("@/pages/brand/Campaigns"))
const NewCampaign = lazy(() => import("@/pages/brand/NewCampaign"))
const CampaignDetail = lazy(() => import("@/pages/brand/CampaignDetail"))
const ValidateContent = lazy(() => import("@/pages/brand/ValidateContent"))
const BrandEditProfile = lazy(() => import("@/pages/brand/EditProfile"))
const BrandOnboarding = lazy(() => import("@/pages/brand/Onboarding"))
const BrandTeam = lazy(() => import("@/pages/brand/Team"))
const BrandEnvironments = lazy(() => import("./pages/brand/Environments"))
const BrandDelegations = lazy(() => import("@/pages/brand/Delegations"))
const Subscription = lazy(() => import("@/pages/brand/Subscription"))
const AmbassadorPrograms = lazy(() => import("@/pages/brand/AmbassadorPrograms"))
const ContractTemplates = lazy(() => import("@/pages/brand/ContractTemplates"))
const BrandCastings = lazy(() => import("@/pages/brand/Castings"))
const BrandEvents = lazy(() => import("@/pages/brand/Events"))
const BrandEventDetail = lazy(() => import("@/pages/brand/EventDetail"))
const NewEvent = lazy(() => import("@/pages/brand/NewEvent"))
const Castings = lazy(() => import("@/pages/influencer/Castings"))
const InfluencerEvents = lazy(() => import("@/pages/influencer/Events"))
const Notifications = lazy(() => import("@/pages/Notifications"))
const Messages = lazy(() => import("@/pages/Messages"))
const Marketplace = lazy(() => import("@/pages/Marketplace"))
const Contracts = lazy(() => import("@/pages/Contracts"))
const InfluencerPublicProfile = lazy(() => import("@/pages/InfluencerPublicProfile"))
const BrandProposalDetail = lazy(() => import("@/pages/brand/BrandProposalDetail"))
const BrandPublicProfile = lazy(() => import("@/pages/influencer/BrandPublicProfile"))
const Terms = lazy(() => import("@/pages/legal/Terms"))
const Privacy = lazy(() => import("@/pages/legal/Privacy"))
const LegalNotice = lazy(() => import("@/pages/legal/LegalNotice"))
const CGV = lazy(() => import("@/pages/legal/CGV"))
const CookiesPolicy = lazy(() => import("@/pages/legal/Cookies"))
const About = lazy(() => import("@/pages/About"))
const Contact = lazy(() => import("@/pages/Contact"))
const FAQ = lazy(() => import("@/pages/FAQ"))
const Help = lazy(() => import("@/pages/Help"))
const EventRsvp = lazy(() => import("@/pages/EventRsvp"))
const Admin = lazy(() => import("@/pages/Admin"))
const AdminBrands = lazy(() => import("@/pages/admin/Brands"))
const AdminCompanies = lazy(() => import("@/pages/admin/Companies"))
const AdminUsers = lazy(() => import("@/pages/admin/Users"))
const AdminCampaigns = lazy(() => import("@/pages/admin/Campaigns"))
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"))
const AdminAuditLog = lazy(() => import("@/pages/admin/AuditLog"))
const AdminPlans = lazy(() => import("@/pages/admin/Plans"))
const AdminFeatures = lazy(() => import("@/pages/admin/Features"))
const AdminSupport = lazy(() => import("@/pages/admin/Support"))
const SupportPage = lazy(() => import("@/pages/Support"))
const InfluencerOnboarding = lazy(() => import("@/pages/influencer/Onboarding"))
const InfluencerMediaKit = lazy(() => import("@/pages/influencer/MediaKit"))
const SignMobile = lazy(() => import("@/pages/SignMobile"))
const AcceptInvitation = lazy(() => import("@/pages/AcceptInvitation"))
const MobileMore = lazy(() => import("@/pages/MobileMore"))

const RouteFallback = () => (
  <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
)

function PublicLayout() {
  const location = useLocation()

  // Anchor links like /#features are followed from any page, so the target only
  // exists after the landing page has rendered.
  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    const raf = requestAnimationFrame(() => {
      if (!document.getElementById(id)) {
        setTimeout(scroll, 250)
      } else {
        scroll()
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [location.pathname, location.hash])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1"><Outlet /></main>
      {!isNative && <Footer />}
    </div>
  )
}

function DashboardLayout() {
  const { user } = useAuth()
  const brandValidationStatus =
    user?.active_brand?.validation_status
    ?? (user?.brand_profile as { validation_status?: string } | undefined)?.validation_status
  const hideSidebar = user?.user_type === "brand" && brandValidationStatus !== "approved"
  const workspaceRefreshKey = `${user?.id ?? "anon"}-${user?.active_brand_workspace_id ?? "none"}`

  // App native : navigation par onglets en bas, pas de sidebar ni de visite guidée.
  if (isNative) {
    return (
      <div className="h-dvh flex flex-col bg-aurora-surface overflow-hidden">
        <Header />
        <main key={workspaceRefreshKey} className="flex-1 min-h-0 overflow-y-auto relative">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-aurora-blue/[0.04] via-transparent to-transparent" />
          <div className="relative"><Outlet /></div>
        </main>
        {!hideSidebar && <MobileTabBar />}
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-aurora-surface overflow-hidden">
      <Header />
      <EmailVerificationBanner />
      <div className="flex flex-1 min-h-0">
        {!hideSidebar && <Sidebar />}
        <main key={workspaceRefreshKey} className="flex-1 overflow-y-auto relative">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-aurora-blue/[0.04] via-transparent to-transparent" />
          <div className="relative"><Outlet /></div>
        </main>
      </div>
      <PortalGuidedTour />
    </div>
  )
}

/** Entrée de l'app native : pas de landing marketing, direct login ou dashboard. */
function NativeEntry() {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return <RouteFallback />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.user_type === "brand") return <Navigate to="/brand/dashboard" replace />
  if (user?.user_type === "admin") return <Navigate to="/admin" replace />
  return <Navigate to="/influencer/dashboard" replace />
}

function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.user_type)) return <Navigate to="/" replace />
  return <Outlet />
}

function BrandValidationRoute() {
  const { user } = useAuth()
  const location = useLocation()
  const status =
    user?.active_brand?.validation_status
    ?? (user?.brand_profile as { validation_status?: string } | undefined)?.validation_status
  const allowedBeforeApproval = new Set([
    "/brand/onboarding",
    "/brand/profile",
    "/brand/profile/edit",
    "/brand/security",
    "/brand/support",
  ])

  if (status === "approved") return <Outlet />
  if (allowedBeforeApproval.has(location.pathname)) return <Outlet />
  return <Navigate to="/brand/onboarding" replace />
}

export default function App() {
  return (
    <>
      <NativeBridge />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={isNative ? <NativeEntry /> : <Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/sso" element={<LoginSSO />} />
          <Route path="/docs/integrations" element={<DocsIntegrations />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<PasswordResetRequest />} />
          <Route path="/reset-password/confirm" element={<PasswordResetConfirm />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/security/reset-mfa" element={<MfaResetConfirm />} />
          <Route path="/marketplace/:pseudo" element={<InfluencerPublicProfile />} />
          <Route path="/pricing" element={<Navigate to="/pricing/brands" replace />} />
          <Route path="/pricing/brands" element={<Pricing />} />
          <Route path="/pricing/agencies" element={<Navigate to="/pricing/brands" replace />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/notice" element={<LegalNotice />} />
          <Route path="/legal/cgv" element={<CGV />} />
          <Route path="/legal/cookies" element={<CookiesPolicy />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/help" element={<Help />} />
          <Route path="/compare" element={<Navigate to="/pricing/brands" replace />} />
          <Route path="/events/rsvp/:token" element={<EventRsvp />} />
          <Route path="/invitation/:token" element={<AcceptInvitation />} />
          <Route path="/sign/mobile/:token" element={<SignMobile />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/m/more" element={<MobileMore />} />
            <Route element={<ProtectedRoute roles={["influencer"]} />}>
              <Route path="/influencer/dashboard" element={<InfluencerDashboard />} />
              <Route path="/influencer/referral" element={<InfluencerReferral />} />
              <Route path="/influencer/onboarding" element={<InfluencerOnboarding />} />
              <Route path="/influencer/media-kit" element={<InfluencerMediaKit />} />
              <Route path="/influencer/proposals" element={<InfluencerProposals />} />
              <Route path="/influencer/proposals/:id" element={<ProposalDetail />} />
              <Route path="/influencer/brands/:id" element={<BrandPublicProfile />} />
              <Route path="/influencer/profile/edit" element={<InfluencerEditProfile />} />
              <Route path="/influencer/earnings" element={<Earnings />} />
              <Route path="/influencer/castings" element={<Castings />} />
              <Route path="/influencer/contracts" element={<Contracts />} />
              <Route path="/influencer/notifications" element={<Notifications />} />
              <Route path="/influencer/messages" element={<Messages />} />
              <Route path="/influencer/messages/:conversation_id" element={<Messages />} />
              <Route path="/influencer/security" element={<SecuritySettings />} />
              <Route path="/influencer/delegations" element={<BrandDelegations />} />
              <Route path="/influencer/events" element={<InfluencerEvents />} />
              <Route path="/influencer/support" element={<SupportPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={["brand"]} />}>
              <Route element={<BrandValidationRoute />}>
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/brand/dashboard" element={<BrandDashboard />} />
                <Route path="/brand/campaigns" element={<BrandCampaigns />} />
                <Route path="/brand/campaigns/new" element={<NewCampaign />} />
                <Route path="/brand/campaigns/:id" element={<CampaignDetail />} />
                <Route path="/brand/campaigns/:id/validate/:proposalId" element={<ValidateContent />} />
                <Route path="/brand/proposals/:id" element={<BrandProposalDetail />} />
                <Route path="/brand/influencers/:pseudo" element={<InfluencerPublicProfile />} />
                <Route path="/brand/profile/edit" element={<BrandEditProfile />} />
                <Route path="/brand/onboarding" element={<BrandOnboarding />} />
                <Route path="/brand/profile" element={<BrandEditProfile />} />
                <Route path="/brand/subscription" element={<Subscription />} />
                <Route path="/brand/ambassadors" element={<PlanGuard><AmbassadorPrograms /></PlanGuard>} />
                <Route path="/brand/contract-templates" element={<PlanGuard><ContractTemplates /></PlanGuard>} />
                <Route path="/brand/castings" element={<PlanGuard><BrandCastings /></PlanGuard>} />
                <Route path="/brand/events" element={<PlanGuard><BrandEvents /></PlanGuard>} />
                <Route path="/brand/events/new" element={<PlanGuard><NewEvent /></PlanGuard>} />
                <Route path="/brand/events/:id" element={<PlanGuard><BrandEventDetail /></PlanGuard>} />
                <Route path="/brand/team" element={<BrandTeam />} />
                <Route path="/brand/environments" element={<PlanGuard><BrandEnvironments /></PlanGuard>} />
                <Route path="/brand/integrations" element={<PlanGuard><Integrations /></PlanGuard>} />
                <Route path="/brand/contracts" element={<Contracts />} />
                <Route path="/brand/notifications" element={<Notifications />} />
                <Route path="/brand/messages" element={<Messages />} />
                <Route path="/brand/messages/:conversation_id" element={<Messages />} />
                <Route path="/brand/security" element={<SecuritySettings />} />
                <Route path="/brand/support" element={<SupportPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/brands" element={<AdminBrands />} />
              <Route path="/admin/companies" element={<AdminCompanies />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/campaigns" element={<AdminCampaigns />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/audit-log" element={<AdminAuditLog />} />
              <Route path="/admin/plans" element={<AdminPlans />} />
              <Route path="/admin/features" element={<AdminFeatures />} />
              <Route path="/admin/support" element={<AdminSupport />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}
