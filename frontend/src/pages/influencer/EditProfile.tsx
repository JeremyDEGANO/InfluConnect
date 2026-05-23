import { useState, useEffect, FormEvent, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import api from "@/lib/api"
import { fetchOnboarding, fetchReference, revokeSocialNetwork, type ReferenceData, type OnboardingStatus } from "@/lib/apiExtra"
import TikTokVideosGrid from "@/components/social/TikTokVideosGrid"
import GrowthChart from "@/components/social/GrowthChart"
import { FreshnessBadge, VerifiedBadge } from "@/components/social/SocialStatusBadges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Info } from "lucide-react"
import { fetchPseudoAvailability, type PseudoAvailability } from "@/lib/apiExtra"

// Fallback labels FR if backend reference is unavailable
const FALLBACK_THEMES = [
  { code: "hospitality", label: "Hôtellerie" }, { code: "restaurant", label: "Restaurant" },
  { code: "fashion", label: "Mode" }, { code: "beauty", label: "Beauté" },
  { code: "travel", label: "Voyage" }, { code: "food", label: "Cuisine" },
  { code: "tech", label: "Tech" }, { code: "sport", label: "Sport" },
  { code: "lifestyle", label: "Lifestyle" }, { code: "gaming", label: "Gaming" },
  { code: "parenting", label: "Parentalité" }, { code: "health_wellness", label: "Santé & Bien-être" },
  { code: "finance", label: "Finance" }, { code: "sustainability", label: "Développement durable" },
  { code: "other", label: "Autre" },
]
const FALLBACK_CONTENT_TYPES = [
  { code: "story", label: "Story" }, { code: "reel_short", label: "Reel / Short" },
  { code: "long_video", label: "Vidéo longue" }, { code: "post_photo", label: "Post photo" },
  { code: "thread", label: "Thread / Tweet" }, { code: "live", label: "Live" },
  { code: "podcast", label: "Podcast" },
]
const FALLBACK_PLATFORMS = [
  { code: "instagram", label: "Instagram" }, { code: "tiktok", label: "TikTok" },
  { code: "youtube", label: "YouTube" }, { code: "twitter", label: "X (Twitter)" },
  { code: "pinterest", label: "Pinterest" }, { code: "twitch", label: "Twitch" },
  { code: "linkedin", label: "LinkedIn" }, { code: "snapchat", label: "Snapchat" },
]
const FALLBACK_LANGUAGES = [
  { code: "fr", label: "Français" }, { code: "en", label: "Anglais" },
  { code: "es", label: "Espagnol" }, { code: "de", label: "Allemand" },
  { code: "it", label: "Italien" }, { code: "pt", label: "Portugais" },
  { code: "ar", label: "Arabe" }, { code: "zh", label: "Chinois" },
]
const FALLBACK_COUNTRIES = [
  { code: "FR", label: "France", dial_code: "+33" },
  { code: "BE", label: "Belgique", dial_code: "+32" },
  { code: "CH", label: "Suisse", dial_code: "+41" },
  { code: "LU", label: "Luxembourg", dial_code: "+352" },
  { code: "MC", label: "Monaco", dial_code: "+377" },
  { code: "AD", label: "Andorre", dial_code: "+376" },
  { code: "ES", label: "Espagne", dial_code: "+34" },
  { code: "IT", label: "Italie", dial_code: "+39" },
  { code: "DE", label: "Allemagne", dial_code: "+49" },
  { code: "NL", label: "Pays-Bas", dial_code: "+31" },
  { code: "PT", label: "Portugal", dial_code: "+351" },
  { code: "GB", label: "Royaume-Uni", dial_code: "+44" },
  { code: "IE", label: "Irlande", dial_code: "+353" },
  { code: "US", label: "Etats-Unis", dial_code: "+1" },
  { code: "CN", label: "Chine", dial_code: "+86" },
  { code: "MA", label: "Maroc", dial_code: "+212" },
  { code: "TN", label: "Tunisie", dial_code: "+216" },
  { code: "DZ", label: "Algérie", dial_code: "+213" },
  { code: "SN", label: "Sénégal", dial_code: "+221" },
  { code: "CI", label: "Côte d'Ivoire", dial_code: "+225" },
  { code: "CM", label: "Cameroun", dial_code: "+237" },
  { code: "CD", label: "RDC", dial_code: "+243" },
  { code: "CA", label: "Canada", dial_code: "+1" },
]
const FALLBACK_CITIES_BY_COUNTRY: Record<string, string[]> = {
  FR: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes"],
  BE: ["Bruxelles", "Anvers", "Liège", "Gand", "Charleroi"],
  CH: ["Genève", "Lausanne", "Zurich", "Bâle", "Berne"],
  LU: ["Luxembourg", "Esch-sur-Alzette", "Differdange"],
  MC: ["Monaco"],
  AD: ["Andorre-la-Vieille", "Escaldes-Engordany", "Encamp"],
  ES: ["Madrid", "Barcelone", "Valence", "Séville", "Bilbao", "Malaga"],
  IT: ["Rome", "Milan", "Turin", "Naples", "Bologne", "Florence"],
  DE: ["Berlin", "Hambourg", "Munich", "Cologne", "Francfort", "Düsseldorf"],
  NL: ["Amsterdam", "Rotterdam", "La Haye", "Utrecht", "Eindhoven"],
  PT: ["Lisbonne", "Porto", "Braga", "Coimbra", "Faro"],
  GB: ["Londres", "Manchester", "Birmingham", "Liverpool", "Leeds", "Glasgow"],
  IE: ["Dublin", "Cork", "Galway", "Limerick", "Waterford"],
  US: ["New York", "Los Angeles", "Miami", "Chicago", "Austin", "San Francisco"],
  CN: ["Pékin", "Shanghai", "Shenzhen", "Guangzhou", "Chengdu", "Hangzhou"],
  MA: ["Casablanca", "Rabat", "Marrakech", "Tanger"],
  TN: ["Tunis", "Sfax", "Sousse"],
  DZ: ["Alger", "Oran", "Constantine"],
  SN: ["Dakar", "Thiès", "Saint-Louis", "Mbour"],
  CI: ["Abidjan", "Yamoussoukro", "Bouaké", "San-Pédro"],
  CM: ["Douala", "Yaoundé", "Bafoussam", "Garoua"],
  CD: ["Kinshasa", "Lubumbashi", "Goma", "Bukavu"],
  CA: ["Montréal", "Québec", "Toronto", "Vancouver"],
}
const FALLBACK_COMPLETION_LABELS: Record<string, string> = {
  avatar: "Photo de profil",
  bio: "Biographie",
  display_name: "Pseudo / nom public",
  location: "Ville",
  languages: "Langues parlées",
  content_themes: "Thématiques",
  content_types_offered: "Types de contenu",
  pricing: "Grille tarifaire",
  social_networks: "Réseaux sociaux",
  media_kit_images: "Images du kit média",
  collaboration_pitch: "Pourquoi collaborer avec vous",
  payment_method: "Coordonnées de paiement",
}

interface SocialNet {
  id?: number
  platform: string
  profile_url: string
  followers_count: number
  avg_views?: number
  engagement_rate?: number
  verified_via_api?: boolean
  last_synced_at?: string | null
  is_verified_external?: boolean
}

const sanitizeLocalPhone = (raw: string): string => raw.replace(/[^\d\s()-]/g, "")

const toE164Phone = (localRaw: string, dialCode: string): string => {
  const prefixDigits = dialCode.replace(/\D/g, "")
  const localDigits = localRaw.replace(/\D/g, "").replace(/^0+/, "")
  if (!localDigits) return ""
  return `+${prefixDigits}${localDigits}`
}

const inferCountryCodeFromPhone = (
  rawPhone: string,
  countries: Array<{ code: string; label: string; dial_code: string }>,
): string | null => {
  const digits = rawPhone.replace(/\D/g, "")
  if (!digits) return null
  const sorted = [...countries].sort(
    (a, b) => b.dial_code.replace(/\D/g, "").length - a.dial_code.replace(/\D/g, "").length,
  )
  for (const c of sorted) {
    const dd = c.dial_code.replace(/\D/g, "")
    if (digits.startsWith(dd)) return c.code
  }
  return null
}

const stripDialCodeFromPhone = (rawPhone: string, dialCode: string): string => {
  const dd = dialCode.replace(/\D/g, "")
  const digits = rawPhone.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith(dd)) return digits.slice(dd.length)
  return digits
}

const inferCountryCodeFromCity = (city: string, citiesByCountry: Record<string, string[]>): string => {
  if (!city) return "FR"
  const target = city.toLowerCase()
  for (const [code, cities] of Object.entries(citiesByCountry)) {
    if ((cities ?? []).some((c) => c.toLowerCase() === target)) return code
  }
  return "FR"
}

export default function InfluencerEditProfile() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [selectedCountry, setSelectedCountry] = useState("FR")
  const [phoneCountry, setPhoneCountry] = useState("FR")
  const [pseudoAvailability, setPseudoAvailability] = useState<PseudoAvailability | null>(null)
  const [pseudoChecking, setPseudoChecking] = useState(false)

  const [user_form, setUserForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", location: "",
  })
  const [initialDisplayName, setInitialDisplayName] = useState("")
  const [profile_form, setProfileForm] = useState({
    bio: "", display_name: "", gender: "", collaboration_pitch: "", payment_method: "", payment_details: "",
  })
  const [themes, setThemes] = useState<string[]>([])
  const [contentTypes, setContentTypes] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  // Pricing keyed by content_type code
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const [socials, setSocials] = useState<SocialNet[]>([])
  const [contentLinks, setContentLinks] = useState<{ label: string; url: string }[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>("")

  // Portfolio gallery (max 3)
  type GalleryImg = { id: number; image: string; caption?: string; order?: number }
  const [gallery, setGallery] = useState<GalleryImg[]>([])
  const [galleryUploading, setGalleryUploading] = useState(false)

  // Build absolute media URL (api baseURL is /api so origin is the backend host)
  const apiOrigin = useMemo(() => {
    try { return new URL(api.defaults.baseURL ?? "").origin } catch { return "" }
  }, [])
  const resolveMedia = (u?: string | null) => {
    if (!u) return ""
    return /^https?:/i.test(u) ? u : apiOrigin + u
  }
  const currentAvatarUrl = user?.avatar
    ? `${resolveMedia(user.avatar)}${user.updated_at ? `?v=${encodeURIComponent(user.updated_at)}` : ""}`
    : ""

  // Update preview whenever a new file is picked
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  const refreshStatus = () => fetchOnboarding().then(setStatus).catch(() => {})

  // Handle the ?social_connected / ?social_error redirect from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("social_connected")
    const error = params.get("social_error")
    if (connected) {
      toast({
        title: t("oauth_social.connected_toast"),
        description: t("oauth_social.connected_desc", { platform: connected }),
      })
      window.history.replaceState({}, "", window.location.pathname)
    } else if (error) {
      const reason = params.get("reason") || "unknown"
      toast({
        title: t("oauth_social.error_toast"),
        description: t("oauth_social.error_desc", { platform: error, reason }),
        variant: "destructive",
      })
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [toast])

  useEffect(() => {
    fetchReference().then(setReference).catch(() => {})
    refreshStatus()
    api.get("/auth/me/").then((res) => {
      const u = res.data
      const ip = u.influencer_profile ?? {}
      const countries = FALLBACK_COUNTRIES
      const cityMap = FALLBACK_CITIES_BY_COUNTRY
      const inferredByPhone = inferCountryCodeFromPhone(u.phone ?? "", countries)
      const inferredCountry = inferredByPhone ?? inferCountryCodeFromCity(u.location ?? "", cityMap)
      const selected = countries.some((c) => c.code === inferredCountry) ? inferredCountry : "FR"
      setSelectedCountry(selected)
      setPhoneCountry(selected)
      const selectedDial = (countries.find((c) => c.code === selected)?.dial_code ?? "+33")
      setUserForm({
        first_name: u.first_name ?? "", last_name: u.last_name ?? "",
        email: u.email ?? "",
        phone: u.phone ? stripDialCodeFromPhone(u.phone, selectedDial) : "",
        location: u.location ?? "",
      })
      setProfileForm({
        bio: ip.bio ?? "", display_name: ip.display_name ?? "",
        gender: ip.gender ?? "",
        collaboration_pitch: ip.collaboration_pitch ?? "",
        payment_method: ip.payment_method ?? "", payment_details: "",
      })
      setInitialDisplayName(ip.display_name ?? "")
      setThemes(ip.content_themes ?? [])
      setContentTypes(ip.content_types_offered ?? [])
      setLanguages(ip.languages ?? [])
      const p = ip.pricing ?? {}
      const pricingMap: Record<string, number> = {}
      Object.entries(p).forEach(([k, v]) => { pricingMap[k] = Number(v) })
      setPricing(pricingMap)
      setSocials((ip.social_networks ?? []).map((s: any) => ({
        id: s.id, platform: s.platform, profile_url: s.profile_url,
        followers_count: s.followers_count, avg_views: s.avg_views, engagement_rate: s.engagement_rate,
        verified_via_api: s.verified_via_api, last_synced_at: s.last_synced_at,
      })))
      setGallery((ip.media_kit_images ?? []) as GalleryImg[])
      setContentLinks(Array.isArray(ip.content_links) ? ip.content_links : [])
    }).catch(() => {})
  }, [])

  const themeOptions = reference?.themes ?? FALLBACK_THEMES
  const contentTypeOptions = reference?.content_types ?? FALLBACK_CONTENT_TYPES
  const platformOptions = reference?.social_platforms ?? FALLBACK_PLATFORMS
  const languageOptions = reference?.languages ?? FALLBACK_LANGUAGES
  const countryOptions = reference?.countries ?? FALLBACK_COUNTRIES
  const citiesByCountry = reference?.cities_by_country ?? FALLBACK_CITIES_BY_COUNTRY
  const cityOptions = citiesByCountry[selectedCountry] ?? []
  const selectedDialCode = countryOptions.find((c) => c.code === phoneCountry)?.dial_code ?? "+33"
  const completionLabels = reference?.completion_labels ?? FALLBACK_COMPLETION_LABELS

  useEffect(() => {
    if (user_form.location && !cityOptions.includes(user_form.location)) {
      setUserForm((prev) => ({ ...prev, location: "" }))
    }
  }, [selectedCountry])

  const ctLabel = useMemo(() => {
    const m: Record<string, string> = {}
    contentTypeOptions.forEach((c) => { m[c.code] = c.label })
    return m
  }, [contentTypeOptions])
  const collaborationPitchLength = profile_form.collaboration_pitch.trim().length
  const trimmedDisplayName = profile_form.display_name.trim()
  const displayNameChanged = trimmedDisplayName !== initialDisplayName.trim()
  const displayNameIsValid = !trimmedDisplayName || /^[\p{L}\p{N}_.-]+$/u.test(trimmedDisplayName)
  const pseudoAvailabilityMessage = (() => {
    if (!pseudoAvailability) return ""
    switch (pseudoAvailability.reason_code) {
      case "taken":
      case "reserved":
        return t("influencer_profile.pseudo_taken_desc")
      case "invalid":
      case "empty":
        return t("influencer_profile.pseudo_invalid_desc")
      default:
        return t("influencer_profile.pseudo_hint")
    }
  })()

  useEffect(() => {
    if (!displayNameChanged) {
      setPseudoAvailability(null)
      setPseudoChecking(false)
      return
    }
    if (!trimmedDisplayName || !displayNameIsValid) {
      setPseudoAvailability(null)
      setPseudoChecking(false)
      return
    }

    const timer = window.setTimeout(async () => {
      setPseudoChecking(true)
      try {
        const result = await fetchPseudoAvailability(trimmedDisplayName)
        setPseudoAvailability(result)
      } catch {
        setPseudoAvailability(null)
      } finally {
        setPseudoChecking(false)
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [displayNameChanged, displayNameIsValid, trimmedDisplayName])

  const toggleArr = (setter: (v: any) => void, arr: string[], v: string) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const toggleContentType = (code: string) => {
    if (contentTypes.includes(code)) {
      setContentTypes(contentTypes.filter((x) => x !== code))
      const next = { ...pricing }
      delete next[code]
      setPricing(next)
    } else {
      setContentTypes([...contentTypes, code])
      if (pricing[code] === undefined) setPricing({ ...pricing, [code]: 0 })
    }
  }

  const addSocial = () => setSocials((s) => [...s, { platform: "instagram", profile_url: "", followers_count: 0 }])
  const removeSocial = async (idx: number) => {
    const s = socials[idx]
    if (s.id) { try { await api.delete(`/influencers/social-networks/${s.id}/`) } catch { /* */ } }
    setSocials((arr) => arr.filter((_, i) => i !== idx))
  }
  const updateSocial = (idx: number, k: keyof SocialNet, v: any) =>
    setSocials((arr) => arr.map((s, i) => i === idx ? { ...s, [k]: v } : s))

  const uploadGalleryImage = async (file: File) => {
    if (gallery.length >= 3) {
      toast({ title: "Limite atteinte", description: "Vous pouvez ajouter au maximum 3 images.", variant: "destructive" })
      return
    }
    setGalleryUploading(true)
    try {
      const fd = new FormData()
      fd.append("image", file)
      fd.append("order", String(gallery.length))
      const r = await api.post("/influencers/media-kit-images/", fd, { headers: { "Content-Type": "multipart/form-data" } })
      const d = r.data
      const url = /^https?:/i.test(d.image) ? d.image : apiOrigin + d.image
      setGallery((g) => [...g, { id: d.id, image: url, caption: d.caption, order: d.order }])
      toast({ title: t("common.success") })
    } catch (e: any) {
      toast({ title: t("common.error"), description: e?.response?.data?.detail ?? t("influencer_profile.gallery_upload_error"), variant: "destructive" })
    } finally {
      setGalleryUploading(false)
    }
  }
  const deleteGalleryImage = async (id: number) => {
    try {
      await api.delete(`/influencers/media-kit-images/${id}/`)
      setGallery((g) => g.filter((x) => x.id !== id))
    } catch {
      toast({ title: t("common.error"), description: t("influencer_profile.gallery_delete_error"), variant: "destructive" })
    }
  }
  const updateGalleryCaption = async (id: number, caption: string) => {
    setGallery((g) => g.map((x) => x.id === id ? { ...x, caption } : x))
    try {
      await api.patch(`/influencers/media-kit-images/${id}/`, { caption })
    } catch { /* silent */ }
  }

  const syncSocial = async (id: number) => {
    setSyncingId(id)
    try {
      const r = await api.post(`/influencers/social-networks/${id}/sync/`)
      if (r.data?.synced === false) {
        toast({
          title: t("influencer_profile.oauth_sync_title"),
          description: r.data?.message ?? t("influencer_profile.oauth_sync_desc"),
        })
      } else {
        toast({ title: t("influencer_profile.sync_updated") })
        const me = await api.get("/auth/me/")
        const ip = me.data?.influencer_profile ?? {}
        setSocials((ip.social_networks ?? []).map((s: any) => ({
          id: s.id, platform: s.platform, profile_url: s.profile_url,
          followers_count: s.followers_count, avg_views: s.avg_views, engagement_rate: s.engagement_rate,
          verified_via_api: s.verified_via_api, last_synced_at: s.last_synced_at,
        })))
      }
    } catch (e: any) {
      toast({ title: t("common.error"), description: e?.response?.data?.detail ?? t("influencer_profile.sync_error"), variant: "destructive" })
    } finally {
      setSyncingId(null)
    }
  }

  const connectOAuth = async (id: number) => {
    try {
      const r = await api.post(`/social-networks/${id}/oauth-start/`)
      if (r.data?.oauth_url) {
        if (r.data.configured === false) {
          toast({
            title: t("oauth_social.not_configured_title"),
            description: t("oauth_social.not_configured_desc"),
            variant: "destructive",
          })
          return
        }
        // Real OAuth – redirect the full page so the provider can bring the
        // user back to /influencer/profile?social_connected=<platform>.
        window.location.href = r.data.oauth_url
      }
    } catch {
      toast({ title: t("oauth_social.error_generic"), description: t("oauth_social.unavailable"), variant: "destructive" })
    }
  }

  const disconnectOAuth = async (id: number) => {
    if (!window.confirm(t("influencer_profile.oauth_disconnect_confirm"))) return
    try {
      const updated: any = await revokeSocialNetwork(id)
      setSocials((prev) => prev.map((s) => (s.id === id ? {
        ...s,
        verified_via_api: updated?.verified_via_api ?? false,
        last_synced_at: updated?.last_synced_at ?? s.last_synced_at,
      } : s)))
      toast({ title: t("influencer_profile.oauth_disconnect_success") })
    } catch (e: any) {
      toast({
        title: t("common.error"),
        description: e?.response?.data?.detail ?? t("influencer_profile.oauth_disconnect_error"),
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (displayNameChanged && !displayNameIsValid) {
      toast({
        variant: "destructive",
        title: t("influencer_profile.pseudo_invalid_title"),
        description: t("influencer_profile.pseudo_invalid_desc"),
      })
      return
    }
    if (displayNameChanged && pseudoAvailability && !pseudoAvailability.available) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("influencer_profile.pseudo_taken_desc"),
      })
      return
    }
    setLoading(true)
    try {
      if (avatarFile) {
        const fd = new FormData()
        fd.append("avatar", avatarFile)
        await api.patch("/auth/me/", fd)
        await refreshUser()
        setAvatarFile(null)
      }
      const cleanPhone = toE164Phone(user_form.phone, selectedDialCode)
      await api.patch("/auth/me/", { ...user_form, phone: cleanPhone })
      const pricingObj: Record<string, number> = {}
      contentTypes.forEach((ct) => {
        const v = Number(pricing[ct] ?? 0)
        if (v > 0) pricingObj[ct] = v
      })
      const profilePayload: any = {
        bio: profile_form.bio,
        display_name: profile_form.display_name,
        gender: profile_form.gender,
        collaboration_pitch: profile_form.collaboration_pitch,
        languages,
        content_themes: themes,
        content_types_offered: contentTypes,
        pricing: pricingObj,
        payment_method: profile_form.payment_method,
        content_links: contentLinks.filter((l) => l.url.trim()).slice(0, 10),
      }
      if (profile_form.payment_details) profilePayload.payment_details = profile_form.payment_details
      await api.patch("/influencers/profile/", profilePayload)
      setInitialDisplayName(trimmedDisplayName)
      setProfileForm((prev) => ({ ...prev, display_name: trimmedDisplayName }))
      const uniqueSocials = Array.from(
        new Map(
          socials
            .filter((s) => s.profile_url)
            .map((s) => [String(s.platform).trim().toLowerCase(), s]),
        ).values(),
      )
      for (const s of uniqueSocials) {
        const engagementRate = Math.max(0, Math.min(100, Number(s.engagement_rate) || 0))
        const payload = {
          platform: s.platform, profile_url: s.profile_url,
          followers_count: Number(s.followers_count) || 0,
          avg_views: Number(s.avg_views) || 0,
          engagement_rate: engagementRate,
        }
        if (s.id) {
          await api.patch(`/influencers/social-networks/${s.id}/`, payload)
        } else {
          await api.post(`/influencers/social-networks/`, payload)
        }
      }
      await refreshUser()
      await refreshStatus()
      toast({ title: t("common.success"), description: t("influencer_profile.updated", "Profil mis à jour") })
    } catch (err: any) {
      const emailErrors = err?.response?.data?.email
      const pseudoErrors = err?.response?.data?.display_name
      let description = JSON.stringify(err?.response?.data ?? "").slice(0, 200)
      if (Array.isArray(emailErrors) && emailErrors.length > 0) {
        const message = String(emailErrors[0]).toLowerCase()
        if (message.includes("already") || message.includes("exist")) {
          description = t("influencer_profile.email_taken_desc")
        } else {
          description = String(emailErrors[0])
        }
      }
      if (Array.isArray(pseudoErrors) && pseudoErrors.length > 0) {
        const message = String(pseudoErrors[0])
        if (message.toLowerCase().includes("already")) {
          description = t("influencer_profile.pseudo_taken_desc")
        } else if (message.toLowerCase().includes("letters") || message.toLowerCase().includes("dots")) {
          description = t("influencer_profile.pseudo_invalid_desc")
        } else {
          description = message
        }
      }
      toast({ title: t("common.error"), description, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const friendlyMissing = (status?.missing_fields ?? []).map((f) => completionLabels[f] ?? f)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-aurora-ink-3">{t("influencer_dashboard.eyebrow", "Espace créateur")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("influencer_profile.title")}</h1>
        {status && (
          <div className="flex items-center gap-2">
            {status.completion_percent >= 100
              ? <CheckCircle2 className="h-5 w-5 text-green-600" />
              : <AlertCircle className="h-5 w-5 text-amber-500" />}
            <span className="font-semibold">{status.completion_percent}%</span>
          </div>
        )}
      </div>
      {status && status.completion_percent < 100 && (
        <Card className="card-base bg-aurora-blue/5 border-aurora-blue/15">
          <CardContent className="p-4 space-y-2">
            <Progress value={status.completion_percent} />
            <div className="text-xs text-aurora-ink-2">
              <strong>{t("influencer_profile.missing", "À compléter")} :</strong>
              <div className="inline-flex flex-wrap gap-1.5 mt-1 ml-1">
                {friendlyMissing.map((m, i) => (
                  <Badge key={i} variant="outline" className="bg-white">{m}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identité */}
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("influencer_profile.personal_info", "Identité")}</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("auth.first_name")}</Label>
              <Input className="mt-1" value={user_form.first_name} onChange={(e) => setUserForm({ ...user_form, first_name: e.target.value })} />
            </div>
            <div>
              <Label>{t("auth.last_name")}</Label>
              <Input className="mt-1" value={user_form.last_name} onChange={(e) => setUserForm({ ...user_form, last_name: e.target.value })} />
            </div>
            <div>
              <Label>{t("auth.email")}</Label>
              <Input className="mt-1" type="email" value={user_form.email} onChange={(e) => setUserForm({ ...user_form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t("influencer_profile.display_name", "Pseudo / nom public")}</Label>
              <Input className="mt-1" placeholder="mon.pseudo" value={profile_form.display_name} onChange={(e) => setProfileForm({ ...profile_form, display_name: e.target.value })} />
              {pseudoChecking ? (
                <p className="mt-1 text-[11px] text-aurora-ink-3">{t("influencer_profile.pseudo_checking", "Vérification de disponibilité...")}</p>
              ) : null}
              {!pseudoChecking && displayNameChanged && pseudoAvailability && !pseudoAvailability.available ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] text-amber-600">{pseudoAvailabilityMessage}</p>
                  {pseudoAvailability.suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {pseudoAvailability.suggestions.map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion}
                          className="rounded-full border border-aurora-blue/20 bg-indigo-50 px-3 py-1 text-[11px] font-medium text-aurora-blue-deep hover:bg-indigo-100 transition-colors"
                          onClick={() => setProfileForm({ ...profile_form, display_name: suggestion })}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className={`mt-1 text-[11px] ${displayNameChanged && !displayNameIsValid ? "text-red-500" : "text-aurora-ink-3"}`}>
                {displayNameChanged && !displayNameIsValid
                  ? t("influencer_profile.pseudo_invalid_desc")
                  : t("influencer_profile.pseudo_hint")}
              </p>
            </div>
            <div>
              <Label>{t("influencer_profile.gender", "Pronom / genre")}</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profile_form.gender}
                onChange={(e) => setProfileForm({ ...profile_form, gender: e.target.value })}
              >
                <option value="">{t("influencer_profile.gender_unspecified", "Non renseigné")}</option>
                <option value="she">{t("influencer_profile.gender_she", "Elle")}</option>
                <option value="he">{t("influencer_profile.gender_he", "Il")}</option>
                <option value="they">{t("influencer_profile.gender_they", "Iel")}</option>
                <option value="other">{t("influencer_profile.gender_other", "Autre")}</option>
                <option value="prefer_not">{t("influencer_profile.gender_prefer_not", "Préfère ne pas dire")}</option>
              </select>
            </div>
            <div>
              <Label>{t("influencer_profile.phone", "Téléphone")}</Label>
              <div className="mt-1 flex gap-2">
                <select
                  className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={phoneCountry}
                  onChange={(e) => setPhoneCountry(e.target.value)}
                >
                  {countryOptions.map((c) => (
                    <option key={c.code} value={c.code}>{c.label} ({c.dial_code})</option>
                  ))}
                </select>
                <Input
                  className="flex-1"
                  placeholder={t("influencer_profile.local_phone_placeholder")}
                  value={user_form.phone}
                  onChange={(e) => setUserForm({ ...user_form, phone: sanitizeLocalPhone(e.target.value) })}
                  inputMode="tel"
                />
              </div>
              <p className="text-[11px] text-aurora-ink-3 mt-1">{t("influencer_profile.phone_prefix_hint", { dial: selectedDialCode })}</p>
            </div>
            <div>
              <Label>{t("influencer_profile.country", "Pays")}</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                {countryOptions.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("influencer_profile.location", "Ville")}</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={user_form.location}
                onChange={(e) => setUserForm({ ...user_form, location: e.target.value })}
              >
                <option value="">{t("influencer_profile.city_placeholder")}</option>
                {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("influencer_profile.avatar", "Photo de profil")}</Label>
              <div className="mt-1 flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-aurora-blue/10 border border-aurora-line overflow-hidden flex items-center justify-center shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={t("influencer_profile.avatar_preview_alt")} className="h-full w-full object-cover" />
                  ) : currentAvatarUrl ? (
                    <img src={currentAvatarUrl} alt={t("influencer_profile.avatar_current_alt")} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-semibold text-indigo-400">
                      {(user_form.first_name?.[0] ?? "").toUpperCase()}
                      {(user_form.last_name?.[0] ?? "").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file" accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                    className="text-sm block w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 file:text-aurora-blue-deep hover:file:bg-indigo-100 file:cursor-pointer"
                  />
                  <p className="text-[11px] text-aurora-ink-3 mt-1">
                    {avatarFile
                      ? t("influencer_profile.avatar_pending", "Sera enregistrée à la sauvegarde")
                      : user?.avatar
                        ? t("influencer_profile.avatar_current", "Photo actuelle – sélectionnez un fichier pour la remplacer")
                        : t("influencer_profile.avatar_hint", "JPG ou PNG, carré recommandé (â‰¥ 400 px)")}
                  </p>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("influencer_profile.bio", "Biographie")}</Label>
              <textarea
                className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("influencer_profile.bio_placeholder", "Présentez-vous en quelques mots (10 caractères minimum)")}
                value={profile_form.bio} onChange={(e) => setProfileForm({ ...profile_form, bio: e.target.value })}
              />
              <p className="text-[11px] text-aurora-ink-3 mt-1">
                {profile_form.bio.length === 1
                  ? t("influencer_profile.bio_char_count", { count: profile_form.bio.length })
                  : t("influencer_profile.bio_char_count_plural", { count: profile_form.bio.length })}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("influencer_profile.collaboration_pitch", "Pourquoi collaborer avec vous ? (page 5 du kit média)")}</Label>
              <textarea
                className="mt-1 w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("influencer_profile.collaboration_pitch_placeholder", "Rédigez à la première personne pourquoi une marque devrait collaborer avec vous : votre univers, votre audience, votre manière de créer, vos points forts...")}
                value={profile_form.collaboration_pitch}
                onChange={(e) => setProfileForm({ ...profile_form, collaboration_pitch: e.target.value })}
              />
              <p className="text-[11px] text-aurora-ink-3 mt-1">
                {t("influencer_profile.collaboration_pitch_hint", "Cette case alimente directement la dernière page “Pourquoi collaborer avec vous ?”. Elle est requise pour un profil à 100%.")}
              </p>
              <p className={`text-[11px] mt-1 ${collaborationPitchLength < 20 ? "text-amber-600" : "text-emerald-600"}`}>
                {collaborationPitchLength < 20
                  ? t("influencer_profile.collaboration_pitch_too_short", { count: collaborationPitchLength })
                  : t("influencer_profile.collaboration_pitch_counter", { count: collaborationPitchLength })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Langues */}
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("influencer_profile.languages", "Langues parlées")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {languageOptions.map((l) => (
                <Badge key={l.code} variant={languages.includes(l.code) ? "info" : "outline"} className="cursor-pointer text-sm py-1 px-3" onClick={() => toggleArr(setLanguages, languages, l.code)}>
                  {languages.includes(l.code) ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}{l.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Thématiques */}
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base">{t("influencer_profile.themes", "Thématiques")}</CardTitle>
            <p className="text-xs text-aurora-ink-3 mt-1">{t("influencer_profile.themes_hint")}</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {themeOptions.map((th) => (
                <Badge key={th.code} variant={themes.includes(th.code) ? "info" : "outline"} className="cursor-pointer text-sm py-1 px-3" onClick={() => toggleArr(setThemes, themes, th.code)}>
                  {themes.includes(th.code) ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}{th.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Types de contenu */}
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base">{t("influencer_profile.content_types", "Types de contenu proposés")}</CardTitle>
            <p className="text-xs text-aurora-ink-3 mt-1">{t("influencer_profile.content_types_hint")}</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {contentTypeOptions.map((ct) => (
                <Badge key={ct.code} variant={contentTypes.includes(ct.code) ? "info" : "outline"} className="cursor-pointer text-sm py-1 px-3" onClick={() => toggleContentType(ct.code)}>
                  {contentTypes.includes(ct.code) ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}{ct.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Grille tarifaire (auto-générée depuis types de contenu) */}
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base">{t("influencer_profile.pricing", "Grille tarifaire")}</CardTitle>
            <p className="text-xs text-aurora-ink-3 mt-1">{t("influencer_profile.pricing_hint")}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {contentTypes.length === 0 && (
              <p className="text-sm text-aurora-ink-3">{t("influencer_profile.pricing_empty")}</p>
            )}
            {contentTypes.map((ct) => (
              <div key={ct} className="flex items-center gap-3">
                <Label className="w-44 shrink-0 text-sm font-medium">{ctLabel[ct] ?? ct}</Label>
                <div className="relative flex-1 max-w-[200px]">
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={pricing[ct] ?? ""}
                    onChange={(e) => setPricing({ ...pricing, [ct]: Number(e.target.value) })}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-aurora-ink-3">€</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Réseaux sociaux */}
        <Card className="card-base">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("influencer_profile.social_networks", "Réseaux sociaux")}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addSocial}><Plus className="h-3.5 w-3.5 mr-1" />{t("common.add", "Ajouter")}</Button>
            </div>
            <div className="flex items-start gap-2 mt-2 text-xs text-aurora-ink-3">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-indigo-500" />
              <p>
                La synchronisation automatique nécessite une connexion OAuth officielle
                (Instagram Graph, TikTok Display API, YouTube Data API). En attendant,
                saisissez vos statistiques manuellement.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {socials.length === 0 && <p className="text-sm text-aurora-ink-3">{t("influencer_profile.no_socials", "Ajoutez au moins un réseau social")}</p>}
            {socials.map((s, i) => (
              <div key={i} className="border border-aurora-line rounded-xl p-3 space-y-2">
                <div className="grid sm:grid-cols-5 gap-2 items-end">
                  <div>
                    <Label className="text-xs">{t("influencer_profile.platform")}</Label>
                    <select className="mt-1 w-full rounded-md border border-input px-2 py-1.5 text-sm" value={s.platform} onChange={(e) => updateSocial(i, "platform", e.target.value)}>
                      {platformOptions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">{t("influencer_profile.profile_url")}</Label>
                    <Input className="mt-1" placeholder="https://..." value={s.profile_url} onChange={(e) => updateSocial(i, "profile_url", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Followers</Label>
                    <Input className="mt-1" type="number" value={s.followers_count} onChange={(e) => updateSocial(i, "followers_count", e.target.value)} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeSocial(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">{t("influencer_profile.avg_views")}</Label>
                    <Input className="mt-1" type="number" value={s.avg_views ?? 0} onChange={(e) => updateSocial(i, "avg_views", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Engagement (%)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={s.engagement_rate ?? 0}
                      onChange={(e) => updateSocial(i, "engagement_rate", e.target.value)}
                    />
                  </div>
                  {s.id && (
                    <div className="flex items-end gap-1">
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => connectOAuth(s.id!)}
                        title={t("influencer_profile.oauth_connect_title")}
                      >
                        ðŸ”— OAuth
                      </Button>
                      <Button
                        type="button" variant="outline" size="sm"
                        disabled={syncingId === s.id}
                        onClick={() => syncSocial(s.id!)}
                        title={t("influencer_profile.oauth_sync_title_attr")}
                      >
                        {syncingId === s.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                        {t("influencer_profile.sync_button")}
                      </Button>
                      {s.verified_via_api && (
                        <Button
                          type="button" variant="ghost" size="sm"
                          onClick={() => disconnectOAuth(s.id!)}
                          title={t("influencer_profile.oauth_disconnect_title")}
                          className="text-red-600 hover:text-red-700"
                        >
                          {t("influencer_profile.oauth_disconnect")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {s.id && s.platform === "tiktok" && s.verified_via_api && (
                  <div className="mt-3 space-y-3 border-t border-aurora-line pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <FreshnessBadge lastSyncedAt={s.last_synced_at} />
                      {s.is_verified_external && <VerifiedBadge />}
                    </div>
                    <GrowthChart socialNetworkId={s.id} metric="followers_count" range="30" />
                    <TikTokVideosGrid socialNetworkId={s.id} limit={12} title={t("tiktok.videos.title")} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Galerie portfolio (jusqu'à 3 photos affichées dans le kit média) */}
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base">{t("influencer_profile.gallery_title")}</CardTitle>
            <p className="text-xs text-aurora-ink-3 mt-1">
              {t("influencer_profile.gallery_hint")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-aurora-blue/15 bg-indigo-50/70 p-3 text-xs text-indigo-900">
              <div className="flex items-center gap-2 font-semibold">
                <Info className="h-3.5 w-3.5" />
                {t("influencer_profile.gallery_recommendations_title")}
              </div>
              <p className="mt-1 leading-relaxed text-indigo-800">
                {t("influencer_profile.gallery_recommendations")}
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {gallery.map((g) => (
                <div key={g.id} className="relative rounded-xl border border-aurora-line overflow-hidden bg-aurora-surface">
                  <div className="aspect-[5/4] w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveMedia(g.image)} alt={g.caption ?? ""} className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteGalleryImage(g.id)}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 rounded-full p-1 shadow"
                    aria-label={t("influencer_profile.gallery_delete_aria")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Input
                    className="rounded-none border-0 border-t border-aurora-line text-xs"
                    placeholder={t("influencer_profile.gallery_caption_placeholder")}
                    defaultValue={g.caption ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value
                      if (v !== (g.caption ?? "")) updateGalleryCaption(g.id, v)
                    }}
                  />
                </div>
              ))}
              {gallery.length < 3 && (
                <label className="flex flex-col items-center justify-center aspect-[5/4] rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 cursor-pointer text-aurora-ink-3 hover:text-aurora-blue transition-colors">
                  {galleryUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-6 w-6 mb-1" />
                      <span className="text-xs">{t("influencer_profile.gallery_add_photo")}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={galleryUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadGalleryImage(f)
                      e.target.value = ""
                    }}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-aurora-ink-3">
              {gallery.length === 1
                ? t("influencer_profile.gallery_count", { count: gallery.length })
                : t("influencer_profile.gallery_count_plural", { count: gallery.length })} {" – "}{t("influencer_profile.gallery_note")}
            </p>
          </CardContent>
        </Card>

        {/* Liens externes (portfolio / contenus) */}
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base">{t("influencer_profile.content_links_title", "Liens de contenus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-aurora-ink-3">{t("influencer_profile.content_links_desc", "Partagez jusqu'à 10 liens vers vos meilleurs contenus, votre portfolio externe ou votre site.")}</p>
            {contentLinks.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  className="col-span-4"
                  placeholder={t("influencer_profile.link_label_placeholder", "Libellé (ex. Portfolio)")}
                  value={l.label}
                  maxLength={120}
                  onChange={(e) => setContentLinks((arr) => arr.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                />
                <Input
                  className="col-span-7"
                  placeholder="https://..."
                  type="url"
                  value={l.url}
                  maxLength={500}
                  onChange={(e) => setContentLinks((arr) => arr.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
                />
                <Button type="button" variant="ghost" size="sm" className="col-span-1 text-red-500" onClick={() => setContentLinks((arr) => arr.filter((_, i) => i !== idx))}>Ã—</Button>
              </div>
            ))}
            {contentLinks.length < 10 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setContentLinks((arr) => [...arr, { label: "", url: "" }])}>
                + {t("influencer_profile.add_link", "Ajouter un lien")}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Paiement */}
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("influencer_profile.payment", "Coordonnées de paiement")}</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("influencer_profile.payment_method", "Méthode")}</Label>
              <select className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" value={profile_form.payment_method} onChange={(e) => setProfileForm({ ...profile_form, payment_method: e.target.value })}>
                <option value="">{t("influencer_profile.select_placeholder")}</option>
                {(reference?.payment_methods ?? [
                  { code: "iban", label: "Virement SEPA (IBAN)" },
                  { code: "paypal", label: "PayPal" },
                  { code: "stripe", label: "Stripe Connect" },
                ]).map((pm) => <option key={pm.code} value={pm.code}>{pm.label}</option>)}
              </select>
            </div>
            <div>
              <Label>{t("influencer_profile.payment_details", "Détails (chiffrés)")}</Label>
              <Input className="mt-1" type="password" placeholder={t("influencer_profile.payment_placeholder", "IBAN ou email PayPal")} value={profile_form.payment_details} onChange={(e) => setProfileForm({ ...profile_form, payment_details: e.target.value })} />
              <p className="text-xs text-aurora-ink-3 mt-1">{t("influencer_profile.payment_note", "Stocké chiffré (Fernet). Laisser vide pour ne pas modifier.")}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="gradient" disabled={loading} size="lg">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  )
}
