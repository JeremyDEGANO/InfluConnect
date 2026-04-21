import api from "./api"

// ====== Types ======
export interface PlanFeature {
  campaigns_per_month: number | "unlimited"
  contacts: number | "unlimited"
  analytics: string
  support: string
  custom_contracts?: boolean
  ambassador_program?: boolean
  white_label?: boolean
  dedicated_manager?: boolean
}
export interface Plan {
  code: "starter" | "growth" | "pro"
  name: string
  price_eur: number
  features: PlanFeature
}
export interface CodeLabel { code: string; label: string }
export interface ReferenceData {
  themes: CodeLabel[]
  content_types: CodeLabel[]
  social_platforms: CodeLabel[]
  payment_methods: CodeLabel[]
  languages: CodeLabel[]
  cities: string[]
  completion_labels: Record<string, string>
  // Optional / legacy
  image_right_supports?: CodeLabel[]
  review_criteria?: CodeLabel[]
}
export interface BrandPending {
  id: number
  user_email: string
  user_name: string
  company_name: string
  siret: string
  validation_status: "pending" | "approved" | "rejected"
  validation_notes: string
  created_at: string
}
export interface AuditEntry {
  id: number
  action: string
  actor_email: string
  ip_address: string
  metadata: Record<string, unknown>
  created_at: string
}
export interface OnboardingStatus {
  completion_percent: number
  onboarding_completed: boolean
  missing_fields: string[]
}
export interface ProposalFull {
  id: number
  campaign: number
  campaign_title: string
  influencer: number
  influencer_name: string
  brand_company_name: string
  status: string
  proposed_price: number
  brand_signed_at: string | null
  influencer_signed_at: string | null
  contract_pdf: string | null
  contract_version: number
  escrow_funded_at: string | null
  escrow_released_at: string | null
  stripe_payment_intent_id: string | null
  submission_deadline: string | null
  validation_deadline: string | null
}

// ====== Public reference ======
export const fetchPlans = () => api.get<{ plans: Plan[] }>("/reference/plans/").then((r) => r.data.plans)
export const fetchReference = () => api.get<ReferenceData>("/reference/data/").then((r) => r.data)

// ====== Brand subscription ======
export const changeSubscription = (plan_code: string) =>
  api.post("/brands/subscription/change/", { plan_code }).then((r) => r.data)
export const cancelSubscription = () =>
  api.post("/brands/subscription/cancel/").then((r) => r.data)

// ====== Admin brand validation ======
export const fetchPendingBrands = () =>
  api.get<{ results?: BrandPending[] } | BrandPending[]>("/admin/brands/").then((r) => {
    const d = r.data as any
    return (d.results ?? d) as BrandPending[]
  })
export const approveBrand = (id: number) =>
  api.post(`/admin/brands/${id}/approve/`).then((r) => r.data)
export const rejectBrand = (id: number, reason: string) =>
  api.post(`/admin/brands/${id}/reject/`, { reason }).then((r) => r.data)

// ====== Influencer onboarding & media kit ======
export const fetchOnboarding = () =>
  api.get<OnboardingStatus>("/influencers/onboarding/").then((r) => r.data)
export const generateMediaKit = () =>
  api.post<{ media_kit_pdf: string }>("/influencers/media-kit/generate/").then((r) => r.data)
export const startStripeOnboarding = () =>
  api.post<{ url: string }>("/influencers/stripe-onboard/").then((r) => r.data)

// ====== Proposal signature / escrow / contract ======
export const generateContractPdf = (id: number) =>
  api.post<{ contract_pdf: string }>(`/proposals/${id}/generate-contract/`).then((r) => r.data)
export const signContract = (id: number) =>
  api.post(`/proposals/${id}/sign-contract/`).then((r) => r.data)
export const fundEscrow = (id: number) =>
  api.post(`/proposals/${id}/fund-escrow/`).then((r) => r.data)
export const submitContent = (id: number, payload: { content_url: string; screenshot?: File | null; notes?: string }) => {
  const fd = new FormData()
  fd.append("content_url", payload.content_url)
  if (payload.notes) fd.append("notes", payload.notes)
  if (payload.screenshot) fd.append("screenshot", payload.screenshot)
  return api.post(`/proposals/${id}/submit-content/`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data)
}
export const validateContent = (id: number) =>
  api.post(`/proposals/${id}/validate-content/`).then((r) => r.data)
export const rejectContent = (id: number, notes: string) =>
  api.post(`/proposals/${id}/reject-content/`, { notes }).then((r) => r.data)

// ====== Castings ======
export const fetchCastings = () => api.get("/castings/").then((r) => r.data)
export const fetchCastingApplications = (campaignId: number) =>
  api.get(`/campaigns/${campaignId}/casting/applications/`).then((r) => r.data)
export const applyCastingForCampaign = (campaignId: number, motivation: string) =>
  api.post(`/campaigns/${campaignId}/casting/apply/`, { motivation }).then((r) => r.data)
export const decideCastingApplication = (appId: number, decision: "selected" | "rejected") =>
  api.post(`/casting-applications/${appId}/decide/`, { decision }).then((r) => r.data)

// ====== Campaign targeting & direct proposals ======
export const fetchCampaignTargets = (campaignId: number) =>
  api.get(`/campaigns/${campaignId}/target/`).then((r) => {
    const d = r.data as any
    return (d.results ?? d) as any[]
  })
export const sendCampaignProposals = (
  campaignId: number,
  influencer_ids: number[],
  proposed_price?: number,
) =>
  api.post(`/campaigns/${campaignId}/send-proposals/`, {
    influencer_ids,
    ...(proposed_price != null ? { proposed_price } : {}),
  }).then((r) => r.data)

// ====== Contracts (list) ======
export interface ContractItem {
  id: number
  campaign: number
  campaign_title: string
  influencer_name?: string
  brand_company_name?: string
  contract_pdf: string | null
  contract_version: number
  brand_signed_at: string | null
  influencer_signed_at: string | null
  status: string
}
export const fetchContracts = () =>
  api.get("/proposals/").then((r) => {
    const d = r.data as any
    const list = (d.results ?? d) as any[]
    return list.filter((p) => p.contract_pdf) as ContractItem[]
  })

// ====== Reviews moderation (admin) ======
export const fetchPendingReviews = () =>
  api.get("/admin/reviews/pending/").then((r) => {
    const d = r.data as any
    return (d.results ?? d) as any[]
  })
export const publishReview = (id: number) =>
  api.post(`/admin/reviews/${id}/publish/`).then((r) => r.data)
export const rejectReview = (id: number, reason: string) =>
  api.post(`/admin/reviews/${id}/reject/`, { reason }).then((r) => r.data)

// ====== Audit log ======
export const fetchAuditLog = (page = 1) =>
  api.get<{ results: AuditEntry[]; count?: number }>(`/admin/audit-log/?page=${page}`).then((r) => r.data)

// ====== Notifications ======
export const fetchNotifications = () =>
  api.get("/notifications/").then((r) => {
    const d = r.data as any
    return (d.results ?? d) as any[]
  })
export const markNotificationRead = (id: number) =>
  api.post(`/notifications/${id}/read/`).then((r) => r.data)

// ====== Public marketplace ======
export const fetchMarketplace = () => api.get("/public/marketplace/").then((r) => r.data)

// ====== Ambassador programs ======
export const fetchAmbassadorPrograms = () => api.get("/ambassador-programs/").then((r) => r.data)
export const createAmbassadorProgram = (payload: Record<string, unknown>) =>
  api.post("/ambassador-programs/", payload).then((r) => r.data)

// ====== Contract templates ======
export const fetchContractTemplates = () => api.get("/contract-templates/").then((r) => r.data)
export const createContractTemplate = (payload: Record<string, unknown>) =>
  api.post("/contract-templates/", payload).then((r) => r.data)

// ====== Counter offers ======
export const sendCounterOffer = (
  proposalId: number,
  counter_price: number,
  counter_message: string,
) =>
  api
    .post(`/proposals/${proposalId}/counter-offer/`, { counter_price, counter_message })
    .then((r) => r.data)

export const acceptCounterOffer = (proposalId: number) =>
  api.post(`/proposals/${proposalId}/accept-counter/`).then((r) => r.data)

// ====== Reviews ======
export interface ReviewPayload {
  rating: number
  comment: string
  criteria_ratings?: Record<string, number>
}
export const createReview = (proposalId: number, payload: ReviewPayload) =>
  api.post(`/proposals/${proposalId}/review/`, payload).then((r) => r.data)
export const fetchUserReviews = (userId: number) =>
  api.get(`/users/${userId}/reviews/`).then((r) => {
    const d = r.data as any
    return (d.results ?? d) as any[]
  })

// ====== Messages ======
export const fetchProposalMessages = (proposalId: number) =>
  api.get(`/proposals/${proposalId}/messages/`).then((r) => {
    const d = r.data as any
    return (d.results ?? d) as any[]
  })
export const sendProposalMessage = (proposalId: number, content: string) =>
  api.post(`/proposals/${proposalId}/messages/send/`, { content }).then((r) => r.data)

// ====== Social OAuth ======
export const startSocialOAuth = (socialNetworkId: number) =>
  api.post<{ oauth_url: string; platform: string }>(`/social-networks/${socialNetworkId}/oauth-start/`).then((r) => r.data)
export const syncSocialNetwork = (socialNetworkId: number) =>
  api.post(`/social-networks/${socialNetworkId}/sync/`).then((r) => r.data)

// ====== Stripe configuration (publishable key) ======
export const fetchStripeConfig = () =>
  api.get<{ publishable_key: string; live: boolean }>("/stripe/config/").then((r) => r.data)

// ====== Proposal brand actions ======
export const cancelProposal = (proposalId: number, reason?: string) =>
  api.post(`/proposals/${proposalId}/cancel/`, { reason: reason ?? "" }).then((r) => r.data)
export const deleteCampaign = (campaignId: number) =>
  api.delete(`/campaigns/${campaignId}/`).then((r) => r.data)

// ====== Public brand profile ======
export interface BrandPublic {
  id: number
  company_name: string
  logo: string | null
  sector: string
  description: string
  website: string
  average_rating: number | null
}
export const fetchBrandPublic = (brandId: number) =>
  api.get<BrandPublic>(`/brands/${brandId}/`).then((r) => r.data)
