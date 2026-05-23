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
  countries?: Array<{ code: string; label: string; dial_code: string }>
  cities_by_country?: Record<string, string[]>
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
  logo?: string
  website?: string
  sector?: string
  description?: string
  validation_status: "pending" | "approved" | "rejected"
  validation_notes: string
  created_at: string
}
export interface AuditEntry {
  id: number
  action: string
  actor: number | null
  actor_username?: string
  actor_email: string
  target_type?: string
  target_id?: number | null
  ip_address: string | null
  metadata: Record<string, unknown>
  created_at: string
}
export interface AdminOverviewBrand {
  id: number
  company_name: string
  email: string
  owner_name: string
  website: string
  sector: string
  siret: string
  validation_status: "pending" | "approved" | "rejected"
  subscription_plan: "starter" | "growth" | "pro" | ""
  subscription_active: boolean
  subscription_expires_at: string | null
  plan_price_monthly: number
  team_size: number
  campaigns_count: number
  created_at: string
  days_since_signup: number
  validated_by_username: string
  validation_notes: string
}
export interface AdminOverviewUser {
  id: number
  name: string
  email: string
  user_type: "influencer" | "brand" | "admin"
  is_active: boolean
  language_preference: "fr" | "en"
  phone: string
  location: string
  totp_enabled: boolean
  last_login: string | null
  created_at: string
  company_name: string
  subscription_plan: "starter" | "growth" | "pro" | ""
  subscription_active: boolean
}
export interface AdminOverviewLiveCampaign {
  id: number
  title: string
  brand_company_name: string
  status: "draft" | "active" | "paused" | "completed" | "cancelled" | string
  deadline: string | null
  price_per_influencer: number | null
  max_influencers: number
  proposals_total: number
  proposals_in_progress: number
  created_at: string
}
export interface AdminOverview {
  kpis: {
    users_total: number
    users_new_last_30d: number
    brands_total: number
    brands_pending_validation: number
    brands_active_subscription: number
    influencers_total: number
    campaigns_total: number
    campaigns_live: number
    support_tickets_open: number
    support_tickets_stale_48h: number
  }
  subscription_projection: {
    currency: string
    month_start: string
    next_month_start: string
    projected_this_month: number
    projected_next_month: number
    delta_next_vs_this: number
    active_plan_counts: Record<string, number>
    pending_plan_counts: Record<string, number>
  }
  proposal_status_counts: Record<string, number>
  brands: AdminOverviewBrand[]
  users: AdminOverviewUser[]
  live_campaigns: AdminOverviewLiveCampaign[]
}
export interface SupportTicketImage {
  id: number
  image_url: string
  uploaded_at: string
}
export interface SupportTicket {
  id: number
  requester: number
  requester_email: string
  requester_kind?: "influencer" | "brand" | "agency"
  requester_display_name?: string
  source_language?: string
  subject: string
  message: string
  status: "open" | "in_progress" | "closed"
  priority: "normal" | "high" | "urgent"
  admin_reply: string
  admin_note?: string  // only visible to admins
  images: SupportTicketImage[]
  rating?: number | null
  rated_at?: string | null
  created_at: string
  updated_at: string
}
export interface OnboardingStatus {
  completion_percent: number
  onboarding_completed: boolean
  missing_fields: string[]
}
export interface PseudoAvailability {
  value: string
  available: boolean
  valid: boolean
  normalized: string
  reason: string
  reason_code: "available" | "empty" | "invalid" | "taken" | "reserved"
  suggestions: string[]
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

export interface CampaignLookalikeResult {
  influencer_id: number
  display_name: string
  pseudo: string
  avatar: string | null
  location: string
  themes: string[]
  platforms: string[]
  followers_avg: number
  engagement_rate_avg: number
  rating: number
  score: number
  reasons: string[]
}

export interface CampaignLookalikeResponse {
  campaign_id: number
  reference_influencer_id: number
  count: number
  results: CampaignLookalikeResult[]
}

export interface CampaignEmvBreakdown {
  influencer_id: number
  influencer_name: string
  submissions: number
  impressions: number
  engagement: number
  emv_eur: number
}

export interface CampaignEmv {
  campaign_id: number
  campaign_title: string
  currency: string
  submissions_count: number
  emv_total_eur: number
  budget_spent_eur: number
  emv_vs_spend_ratio: number | null
  confidence_score: number
  by_influencer: CampaignEmvBreakdown[]
}

export interface EventInvitation {
  id: number
  event: number
  event_title: string
  event_address: string
  event_city: string
  event_starts_at: string
  event_ends_at: string | null
  influencer: number
  influencer_user_id: number | null
  influencer_display_name: string | null
  influencer_avatar?: string | null
  invited_email?: string
  invitee_label?: string
  invite_token: string
  status: "pending" | "accepted" | "declined"
  max_plus_ones: number
  plus_ones_confirmed: number
  response_message: string
  responded_at: string | null
  checked_in_at?: string | null
  checked_in_by?: number | null
  qr_payload: string
  created_at: string
  updated_at: string
}

export interface EventItem {
  id: number
  brand: number
  brand_name: string
  title: string
  description: string
  address: string
  city: string
  starts_at: string
  ends_at: string | null
  status: "draft" | "published" | "cancelled" | "completed"
  max_invitees: number
  invitations: EventInvitation[]
  created_at: string
  updated_at: string
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
export const fetchPendingBrands = (status = "all") =>
  api.get<{ results?: BrandPending[] } | BrandPending[]>(`/admin/brands/?status=${encodeURIComponent(status)}`).then((r) => {
    const d = r.data as any
    return (d.results ?? d) as BrandPending[]
  })
export const approveBrand = (id: number) =>
  api.post(`/admin/brands/${id}/approve/`).then((r) => r.data)
export const rejectBrand = (id: number, reason: string) =>
  api.post(`/admin/brands/${id}/reject/`, { reason }).then((r) => r.data)

// ====== Brand onboarding (CDC §5.1) ======
export interface BrandOnboardingStatus {
  validation_status: "draft" | "pending" | "approved" | "rejected"
  validation_notes: string
  missing_fields: string[]
  ready_to_submit: boolean
  can_create_campaigns: boolean
}
export const fetchBrandOnboarding = () =>
  api.get<BrandOnboardingStatus>("/brands/onboarding/").then((r) => r.data)
export const submitBrandForValidation = () =>
  api.post<BrandOnboardingStatus>("/brands/submit-validation/").then((r) => r.data)

// ====== Influencer onboarding & media kit ======
export const fetchOnboarding = () =>
  api.get<OnboardingStatus>("/influencers/onboarding/").then((r) => r.data)
export const fetchPseudoAvailability = (value: string) =>
  api.get<PseudoAvailability>("/influencers/pseudo-availability/", { params: { value } }).then((r) => r.data)
export const generateMediaKit = () =>
  api.post<{ media_kit_pdf: string }>("/influencers/media-kit/generate/").then((r) => r.data)
export const startStripeOnboarding = () =>
  api.post<{ url: string }>("/influencers/stripe-onboard/").then((r) => r.data)

// ====== Proposal signature / escrow / contract ======
export const generateContractPdf = (id: number, templateId?: number) =>
  api.post<{ contract_pdf: string }>(`/proposals/${id}/generate-contract/`, templateId ? { template_id: templateId } : {}).then((r) => r.data)
export const signContract = (
  id: number,
  payload?: { signature_mode?: string; signature_value?: string; signature_data?: string | null; consent?: boolean },
) => api.post(`/proposals/${id}/sign-contract/`, payload ?? {}).then((r) => r.data)
export const createSignSession = (proposalId: number) =>
  api.post<{ token: string; sign_url: string; expires_at: string }>(`/proposals/${proposalId}/sign-session/`).then((r) => r.data)
export const getSignSession = (token: string) =>
  api.get<{
    token: string
    proposal_id: number
    expires_at: string
    used: boolean
    completed_at?: string | null
    signer_role?: string
    signer_label?: string
  }>(`/sign-sessions/${token}/`).then((r) => r.data)
export const completeSignSession = (
  token: string,
  payload: { signature_mode?: string; signature_value?: string; signature_data?: string | null; consent?: boolean },
) => api.post(`/sign-sessions/${token}/complete/`, payload).then((r) => r.data)
export const fundEscrow = (id: number) =>
  api.post(`/proposals/${id}/fund-escrow/`).then((r) => r.data)
export const submitContent = (
  id: number,
  payload: {
    submission_type: "link" | "upload"
    publication_url?: string
    uploaded_file?: File | null
    screenshot?: File | null
  },
) => {
  const fd = new FormData()
  fd.append("submission_type", payload.submission_type)
  fd.append("publication_url", payload.publication_url ?? "")
  fd.append("publication_date", new Date().toISOString())
  if (payload.uploaded_file) fd.append("uploaded_file", payload.uploaded_file)
  if (payload.screenshot) fd.append("screenshot", payload.screenshot)
  return api.post(`/proposals/${id}/submit-content/`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data)
}
export const fetchLatestSubmission = (id: number) =>
  api.get(`/proposals/${id}/latest-submission/`).then((r) => r.data)
export const validateContent = (id: number) =>
  api.post(`/proposals/${id}/validate-content/`).then((r) => r.data)
export const rejectContent = (
  id: number,
  payload: { rejection_reason: string; rejection_comment?: string },
) => api.post(`/proposals/${id}/reject-content/`, payload).then((r) => r.data)

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

// ====== Events ======
export const fetchBrandEvents = () =>
  api.get<EventItem[] | { results?: EventItem[] }>("/events/").then((r) => {
    const d = r.data as any
    return (d.results ?? d) as EventItem[]
  })

export const fetchBrandEvent = (eventId: number) =>
  api.get<EventItem>(`/events/${eventId}/`).then((r) => r.data)

export const createBrandEvent = (payload: {
  title: string
  description: string
  address: string
  city: string
  starts_at: string
  ends_at?: string | null
  status?: "draft" | "published"
  max_invitees?: number
}) => api.post<EventItem>("/events/", payload).then((r) => r.data)

export const inviteInfluencersToEvent = (
  eventId: number,
  payload: { influencer_ids: number[]; invited_emails?: string[]; max_plus_ones?: number },
) => api.post<{ created: number[]; skipped: number[]; external_created: string[]; external_skipped: string[] }>(`/events/${eventId}/invite/`, payload).then((r) => r.data)

export const fetchInfluencerEventInvitations = (token?: string) =>
  api.get<EventInvitation[] | { results?: EventInvitation[] }>("/event-invitations/", {
    params: token ? { invitation: token } : undefined,
  }).then((r) => {
    const d = r.data as any
    return (d.results ?? d) as EventInvitation[]
  })

export const respondEventInvitation = (payload: {
  invitation_token: string
  status: "accepted" | "declined"
  plus_ones?: number
  response_message?: string
}) => api.post<EventInvitation>("/event-invitations/respond/", payload).then((r) => r.data)

export const fetchEventInvitationByToken = (token: string) =>
  api.get<EventInvitation>(`/event-invitations/${token}/`).then((r) => r.data)

export const checkInEventInvitation = (payload: { invitation_token?: string; qr_payload?: string }) =>
  api.post<{ checked_in: boolean; already_checked_in: boolean; invitation: EventInvitation }>("/events/check-in/", payload).then((r) => r.data)

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
export const fetchAuditLog = (page = 1, action?: string) => {
  const qs = new URLSearchParams({ page: String(page) })
  if (action && action !== "all") qs.set("action", action)
  return api.get<{ results: AuditEntry[]; count?: number }>(`/admin/audit-log/?${qs.toString()}`).then((r) => r.data)
}

// ====== Admin overview ======
export const fetchAdminOverview = () =>
  api.get<AdminOverview>("/admin/overview/").then((r) => r.data)

export const fetchCampaignEmv = (campaignId: number) =>
  api.get<CampaignEmv>(`/campaigns/${campaignId}/emv/`).then((r) => r.data)

export const fetchCampaignLookalikes = (
  campaignId: number,
  payload: { reference_influencer_id: number; limit?: number; min_score?: number },
) => api.post<CampaignLookalikeResponse>(`/campaigns/${campaignId}/lookalikes/`, payload).then((r) => r.data)

export const exportCampaignReport = async (
  campaignId: number,
  format: "pdf" | "pptx" | "google_slides" = "pptx",
) => {
  const res = await api.post(`/campaigns/${campaignId}/export-report/`, { format }, { responseType: "blob" })
  const disposition = String(res.headers?.["content-disposition"] || "")
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i)
  const filename = filenameMatch?.[1] || `campaign_${campaignId}_report.${format === "pdf" ? "pdf" : "pptx"}`
  const blobUrl = window.URL.createObjectURL(res.data)
  const link = document.createElement("a")
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
}

export const updateAdminUserStatus = (id: number, is_active: boolean) =>
  api.patch<{ id: number; is_active: boolean }>(`/admin/users/${id}/status/`, { is_active }).then((r) => r.data)
export const updateAdminUser = (
  id: number,
  payload: Partial<Pick<AdminOverviewUser, "email" | "phone" | "location" | "language_preference" | "is_active">>,
) => api.patch(`/admin/users/${id}/`, payload).then((r) => r.data)
export const updateAdminBrand = (
  id: number,
  payload: Partial<Pick<BrandPending, "company_name" | "website" | "sector" | "description" | "validation_notes" | "validation_status">>,
) => api.patch(`/admin/brands/${id}/`, payload).then((r) => r.data)

// ====== Support tickets ======
export const fetchSupportTickets = () =>
  api.get<SupportTicket[] | { results?: SupportTicket[] }>("/support/tickets/").then((r) => {
    const d = r.data as any
    return (d.results ?? d) as SupportTicket[]
  })
export const createSupportTicket = (payload: { subject: string; message: string; priority?: "normal" | "high" | "urgent" }) =>
  api.post<SupportTicket>("/support/tickets/", payload).then((r) => r.data)
export const uploadSupportTicketImage = (ticketId: number, file: File) => {
  const fd = new FormData()
  fd.append("image", file)
  return api.post<SupportTicketImage>(`/support/tickets/${ticketId}/images/`, fd).then((r) => r.data)
}
export const addSupportTicketFollowUp = (ticketId: number, message: string) =>
  api.post<SupportTicket>(`/support/tickets/${ticketId}/followup/`, { message }).then((r) => r.data)
export const rateSupportTicket = (ticketId: number, rating: number) =>
  api.post<SupportTicket>(`/support/tickets/${ticketId}/rate/`, { rating }).then((r) => r.data)
export const updateAdminSupportTicket = (
  id: number,
  payload: { status?: "open" | "in_progress" | "closed"; priority?: "normal" | "high" | "urgent"; admin_note?: string; admin_reply?: string },
) => api.patch<SupportTicket>(`/admin/support/tickets/${id}/`, payload).then((r) => r.data)

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
export const contactInfluencerFromMarketplace = (payload: { influencer_id: number; message: string }) =>
  api.post<{ sent: boolean }>("/marketplace/contact/", payload).then((r) => r.data)

// ====== Ambassador programs ======
export const fetchAmbassadorPrograms = () => api.get("/ambassador-programs/").then((r) => r.data)
export const createAmbassadorProgram = (payload: Record<string, unknown>) =>
  api.post("/ambassador-programs/", payload).then((r) => r.data)

// ====== Contract templates ======
export const fetchContractTemplates = () =>
  api.get("/contract-templates/").then((r) => {
    const d = r.data as any
    return (d.results ?? d) as any[]
  })
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

export async function openProtectedFile(url: string) {
  const res = await api.get(url, { responseType: "blob" })
  const blobUrl = window.URL.createObjectURL(res.data)
  window.open(blobUrl, "_blank", "noopener,noreferrer")
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
}

export async function downloadProtectedFile(url: string, filename = "document.pdf") {
  const res = await api.get(url, { responseType: "blob" })
  const blobUrl = window.URL.createObjectURL(res.data)
  const link = document.createElement("a")
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
}

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


// ---- Brand multi-user (memberships) ----
export interface BrandMembership {
  id: number
  user: number | null
  user_email: string
  user_name: string
  invited_email: string
  role: 'owner' | 'admin' | 'member'
  status: 'invited' | 'active' | 'revoked'
  invited_at: string
  joined_at: string | null
}
export const fetchBrandMemberships = () =>
  api.get<BrandMembership[]>("/brands/memberships/").then((r) => (r.data as any).results ?? r.data)
export const inviteBrandMember = (invited_email: string, role: 'admin' | 'member' = 'member') =>
  api.post<BrandMembership>("/brands/memberships/", { invited_email, role }).then((r) => r.data)
export const revokeBrandMember = (id: number) =>
  api.delete(`/brands/memberships/${id}/`).then((r) => r.data)

// ---- Agency delegations ----
export interface AgencyDelegation {
  id: number
  agency: number
  agency_name: string
  influencer: number
  influencer_name: string
  commission_percent: number | string
  status: 'pending' | 'accepted' | 'declined' | 'revoked'
  invitation_message: string
  created_at: string
  accepted_at: string | null
  revoked_at: string | null
}
export const fetchAgencyDelegations = () =>
  api.get<AgencyDelegation[]>("/agency/delegations/").then((r) => (r.data as any).results ?? r.data)
export const createAgencyDelegation = (influencer: number | string, commission_percent: number, invitation_message = "") =>
  api.post<AgencyDelegation>("/agency/delegations/", { influencer, commission_percent, invitation_message }).then((r) => r.data)
export const actionAgencyDelegation = (id: number, action: 'accept' | 'decline' | 'revoke') =>
  api.post<AgencyDelegation>(`/agency/delegations/${id}/action/`, { action }).then((r) => r.data)
