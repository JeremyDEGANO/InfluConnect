import { Routes, Route, Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { Footer } from "@/components/layout/Footer"
import { Toaster } from "@/components/ui/toaster"
import Landing from "@/pages/Landing"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import PasswordResetRequest from "@/pages/PasswordResetRequest"
import PasswordResetConfirm from "@/pages/PasswordResetConfirm"
import SecuritySettings from "@/pages/SecuritySettings"
import Pricing from "@/pages/Pricing"import InfluencerDashboard from "@/pages/influencer/Dashboard"
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
import Subscription from "@/pages/brand/Subscription"
import AmbassadorPrograms from "@/pages/brand/AmbassadorPrograms"
import ContractTemplates from "@/pages/brand/ContractTemplates"
import BrandCastings from "@/pages/brand/Castings"
import Castings from "@/pages/influencer/Castings"
import Notifications from "@/pages/Notifications"
import Marketplace from "@/pages/Marketplace"
import Contracts from "@/pages/Contracts"
import InfluencerPublicProfile from "@/pages/InfluencerPublicProfile"
import BrandProposalDetail from "@/pages/brand/BrandProposalDetail"
import BrandPublicProfile from "@/pages/influencer/BrandPublicProfile"
import Terms from "@/pages/legal/Terms"
import Privacy from "@/pages/legal/Privacy"
import LegalNotice from "@/pages/legal/LegalNotice"
import Admin from "@/pages/Admin"
import AdminBrands from "@/pages/admin/Brands"
import AdminReviews from "@/pages/admin/Reviews"
import AdminAuditLog from "@/pages/admin/AuditLog"
import InfluencerOnboarding from "@/pages/influencer/Onboarding"

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
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-gray-50 overflow-auto"><Outlet /></main>
      </div>
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

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<PasswordResetRequest />} />
          <Route path="/reset-password/confirm" element={<PasswordResetConfirm />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace/:id" element={<InfluencerPublicProfile />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/notice" element={<LegalNotice />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route element={<ProtectedRoute roles={["influencer"]} />}>
              <Route path="/influencer/dashboard" element={<InfluencerDashboard />} />
              <Route path="/influencer/onboarding" element={<InfluencerOnboarding />} />
              <Route path="/influencer/proposals" element={<InfluencerProposals />} />
              <Route path="/influencer/proposals/:id" element={<ProposalDetail />} />
              <Route path="/influencer/brands/:id" element={<BrandPublicProfile />} />
              <Route path="/influencer/profile/edit" element={<InfluencerEditProfile />} />
              <Route path="/influencer/earnings" element={<Earnings />} />
              <Route path="/influencer/castings" element={<Castings />} />
              <Route path="/influencer/contracts" element={<Contracts />} />
              <Route path="/influencer/notifications" element={<Notifications />} />
              <Route path="/influencer/security" element={<SecuritySettings />} />
            </Route>
            <Route element={<ProtectedRoute roles={["brand"]} />}>
              <Route path="/brand/dashboard" element={<BrandDashboard />} />
              <Route path="/brand/campaigns" element={<BrandCampaigns />} />
              <Route path="/brand/campaigns/new" element={<NewCampaign />} />
              <Route path="/brand/campaigns/:id" element={<CampaignDetail />} />
              <Route path="/brand/campaigns/:id/validate/:proposalId" element={<ValidateContent />} />
              <Route path="/brand/proposals/:id" element={<BrandProposalDetail />} />
              <Route path="/brand/profile/edit" element={<BrandEditProfile />} />
              <Route path="/brand/subscription" element={<Subscription />} />
              <Route path="/brand/ambassadors" element={<AmbassadorPrograms />} />
              <Route path="/brand/contract-templates" element={<ContractTemplates />} />
              <Route path="/brand/castings" element={<BrandCastings />} />
              <Route path="/brand/contracts" element={<Contracts />} />
              <Route path="/brand/notifications" element={<Notifications />} />
              <Route path="/brand/security" element={<SecuritySettings />} />
            </Route>
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/brands" element={<AdminBrands />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/audit-log" element={<AdminAuditLog />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}
