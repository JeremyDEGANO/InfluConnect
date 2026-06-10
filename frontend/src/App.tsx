import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { Footer } from "@/components/layout/Footer"
import { Toaster } from "@/components/ui/toaster"
import Landing from "@/pages/Landing"
import Login from "@/pages/Login"
import LoginSSO from "@/pages/LoginSSO"
import DocsIntegrations from "@/pages/DocsIntegrations"
import Integrations from "@/pages/brand/Integrations"
import Register from "@/pages/Register"
import PasswordResetRequest from "@/pages/PasswordResetRequest"
import PasswordResetConfirm from "@/pages/PasswordResetConfirm"
import MfaResetConfirm from "@/pages/MfaResetConfirm"
import SecuritySettings from "@/pages/SecuritySettings"
import Pricing from "@/pages/Pricing"
import InfluencerDashboard from "@/pages/influencer/Dashboard"
import InfluencerReferral from "./pages/influencer/Referral"
import InfluencerProposals from "@/pages/influencer/Proposals"
import ProposalDetail from "@/pages/influencer/ProposalDetail"
import InfluencerEditProfile from "@/pages/influencer/EditProfile"
import Earnings from "@/pages/influencer/Earnings"
import BrandDashboard from "@/pages/brand/Dashboard"
import BrandCampaigns from "@/pages/brand/Campaigns"
import NewCampaign from "@/pages/brand/NewCampaign"
import CampaignDetail from "@/pages/brand/CampaignDetail"
import ValidateContent from "@/pages/brand/ValidateContent"
import BrandEditProfile from "@/pages/brand/EditProfile"
import BrandOnboarding from "@/pages/brand/Onboarding"
import BrandTeam from "@/pages/brand/Team"
import BrandEnvironments from "./pages/brand/Environments"
import BrandDelegations from "@/pages/brand/Delegations"
import Subscription from "@/pages/brand/Subscription"
import AmbassadorPrograms from "@/pages/brand/AmbassadorPrograms"
import ContractTemplates from "@/pages/brand/ContractTemplates"
import BrandCastings from "@/pages/brand/Castings"
import BrandEvents from "@/pages/brand/Events"
import BrandEventDetail from "@/pages/brand/EventDetail"
import NewEvent from "@/pages/brand/NewEvent"
import Castings from "@/pages/influencer/Castings"
import InfluencerEvents from "@/pages/influencer/Events"
import Notifications from "@/pages/Notifications"
import Messages from "@/pages/Messages"
import Marketplace from "@/pages/Marketplace"
import Contracts from "@/pages/Contracts"
import InfluencerPublicProfile from "@/pages/InfluencerPublicProfile"
import BrandProposalDetail from "@/pages/brand/BrandProposalDetail"
import BrandPublicProfile from "@/pages/influencer/BrandPublicProfile"
import Terms from "@/pages/legal/Terms"
import Privacy from "@/pages/legal/Privacy"
import LegalNotice from "@/pages/legal/LegalNotice"
import CGV from "@/pages/legal/CGV"
import CookiesPolicy from "@/pages/legal/Cookies"
import About from "@/pages/About"
import Contact from "@/pages/Contact"
import FAQ from "@/pages/FAQ"
import Help from "@/pages/Help"
import Compare from "@/pages/Compare"
import EventRsvp from "@/pages/EventRsvp"
import Admin from "@/pages/Admin"
import AdminBrands from "@/pages/admin/Brands"
import AdminCompanies from "@/pages/admin/Companies"
import AdminUsers from "@/pages/admin/Users"
import AdminCampaigns from "@/pages/admin/Campaigns"
import AdminReviews from "@/pages/admin/Reviews"
import AdminAuditLog from "@/pages/admin/AuditLog"
import AdminSupport from "@/pages/admin/Support"
import SupportPage from "@/pages/Support"
import InfluencerOnboarding from "@/pages/influencer/Onboarding"
import InfluencerMediaKit from "@/pages/influencer/MediaKit"
import SignMobile from "@/pages/SignMobile"
import AcceptInvitation from "@/pages/AcceptInvitation"
import { PortalGuidedTour } from "@/components/shared/PortalGuidedTour"

function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1"><Outlet /></main>
      <Footer />
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

  return (
    <div className="min-h-screen flex flex-col bg-aurora-surface">
      <Header />
      <div className="flex flex-1">
        {!hideSidebar && <Sidebar />}
        <main key={workspaceRefreshKey} className="flex-1 overflow-auto relative">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-aurora-blue/[0.04] via-transparent to-transparent" />
          <div className="relative"><Outlet /></div>
        </main>
      </div>
      <PortalGuidedTour />
    </div>
  )
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
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/sso" element={<LoginSSO />} />
          <Route path="/docs/integrations" element={<DocsIntegrations />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<PasswordResetRequest />} />
          <Route path="/reset-password/confirm" element={<PasswordResetConfirm />} />
          <Route path="/security/reset-mfa" element={<MfaResetConfirm />} />
          <Route path="/marketplace/:pseudo" element={<InfluencerPublicProfile />} />
          <Route path="/pricing" element={<Navigate to="/pricing/brands" replace />} />
          <Route path="/pricing/brands" element={<Pricing />} />
          <Route path="/pricing/agencies" element={<Pricing />} />
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
          <Route path="/compare" element={<Compare />} />
          <Route path="/events/rsvp/:token" element={<EventRsvp />} />
          <Route path="/invitation/:token" element={<AcceptInvitation />} />
          <Route path="/sign/mobile/:token" element={<SignMobile />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
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
                <Route path="/brand/ambassadors" element={<AmbassadorPrograms />} />
                <Route path="/brand/contract-templates" element={<ContractTemplates />} />
                <Route path="/brand/castings" element={<BrandCastings />} />
                <Route path="/brand/events" element={<BrandEvents />} />
                <Route path="/brand/events/new" element={<NewEvent />} />
                <Route path="/brand/events/:id" element={<BrandEventDetail />} />
                <Route path="/brand/team" element={<BrandTeam />} />
                <Route path="/brand/environments" element={<BrandEnvironments />} />
                <Route path="/brand/integrations" element={<Integrations />} />
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
              <Route path="/admin/support" element={<AdminSupport />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}
