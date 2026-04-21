import { useState, useEffect, FormEvent, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import api from "@/lib/api"
import { fetchOnboarding, fetchReference, type ReferenceData, type OnboardingStatus } from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Info } from "lucide-react"

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
const FALLBACK_CITIES = [
  "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier",
  "Strasbourg", "Bordeaux", "Lille", "Rennes",
]
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
}

// Format French phone progressively as user types
const formatPhoneFR = (raw: string): string => {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("33")) {
    const rest = digits.slice(2, 11)
    const groups = rest.match(/.{1,2}/g) ?? []
    return "+33 " + groups.join(" ")
  }
  const limited = digits.slice(0, 10)
  const groups = limited.match(/.{1,2}/g) ?? []
  return groups.join(" ")
}

export default function InfluencerEditProfile() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [syncingId, setSyncingId] = useState<number | null>(null)

  const [user_form, setUserForm] = useState({
    first_name: "", last_name: "", phone: "", location: "",
  })
  const [profile_form, setProfileForm] = useState({
    bio: "", display_name: "", payment_method: "", payment_details: "",
  })
  const [themes, setThemes] = useState<string[]>([])
  const [contentTypes, setContentTypes] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  // Pricing keyed by content_type code
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const [socials, setSocials] = useState<SocialNet[]>([])
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
      setUserForm({
        first_name: u.first_name ?? "", last_name: u.last_name ?? "",
        phone: u.phone ? formatPhoneFR(u.phone) : "", location: u.location ?? "",
      })
      setProfileForm({
        bio: ip.bio ?? "", display_name: ip.display_name ?? "",
        payment_method: ip.payment_method ?? "", payment_details: "",
      })
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
    }).catch(() => {})
  }, [])

  const themeOptions = reference?.themes ?? FALLBACK_THEMES
  const contentTypeOptions = reference?.content_types ?? FALLBACK_CONTENT_TYPES
  const platformOptions = reference?.social_platforms ?? FALLBACK_PLATFORMS
  const languageOptions = reference?.languages ?? FALLBACK_LANGUAGES
  const cityOptions = reference?.cities ?? FALLBACK_CITIES
  const completionLabels = reference?.completion_labels ?? FALLBACK_COMPLETION_LABELS

  const ctLabel = useMemo(() => {
    const m: Record<string, string> = {}
    contentTypeOptions.forEach((c) => { m[c.code] = c.label })
    return m
  }, [contentTypeOptions])

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
      toast({ title: "Image ajoutée" })
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.response?.data?.detail ?? "Échec de l'envoi", variant: "destructive" })
    } finally {
      setGalleryUploading(false)
    }
  }
  const deleteGalleryImage = async (id: number) => {
    try {
      await api.delete(`/influencers/media-kit-images/${id}/`)
      setGallery((g) => g.filter((x) => x.id !== id))
    } catch {
      toast({ title: "Erreur", description: "Suppression impossible", variant: "destructive" })
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
          title: "Synchronisation indisponible",
          description: r.data?.message ?? "Connectez-vous d'abord à la plateforme via OAuth.",
        })
      } else {
        toast({ title: "Statistiques mises à jour" })
        const me = await api.get("/auth/me/")
        const ip = me.data?.influencer_profile ?? {}
        setSocials((ip.social_networks ?? []).map((s: any) => ({
          id: s.id, platform: s.platform, profile_url: s.profile_url,
          followers_count: s.followers_count, avg_views: s.avg_views, engagement_rate: s.engagement_rate,
          verified_via_api: s.verified_via_api, last_synced_at: s.last_synced_at,
        })))
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.response?.data?.detail ?? "Échec sync", variant: "destructive" })
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
        // Real OAuth — redirect the full page so the provider can bring the
        // user back to /influencer/profile?social_connected=<platform>.
        window.location.href = r.data.oauth_url
      }
    } catch {
      toast({ title: t("oauth_social.error_generic"), description: t("oauth_social.unavailable"), variant: "destructive" })
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (avatarFile) {
        const fd = new FormData()
        fd.append("avatar", avatarFile)
        await api.patch("/auth/me/", fd, { headers: { "Content-Type": "multipart/form-data" } })
        setAvatarFile(null)
      }
      const cleanPhone = user_form.phone.replace(/\s/g, "")
      await api.patch("/auth/me/", { ...user_form, phone: cleanPhone })
      const pricingObj: Record<string, number> = {}
      contentTypes.forEach((ct) => {
        const v = Number(pricing[ct] ?? 0)
        if (v > 0) pricingObj[ct] = v
      })
      const profilePayload: any = {
        bio: profile_form.bio,
        display_name: profile_form.display_name,
        languages,
        content_themes: themes,
        content_types_offered: contentTypes,
        pricing: pricingObj,
        payment_method: profile_form.payment_method,
      }
      if (profile_form.payment_details) profilePayload.payment_details = profile_form.payment_details
      await api.patch("/influencers/profile/", profilePayload)
      for (const s of socials) {
        if (!s.profile_url) continue
        const payload = {
          platform: s.platform, profile_url: s.profile_url,
          followers_count: Number(s.followers_count) || 0,
          avg_views: Number(s.avg_views) || 0,
          engagement_rate: Number(s.engagement_rate) || 0,
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
      toast({ title: t("common.error"), description: JSON.stringify(err?.response?.data ?? "").slice(0, 200), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const friendlyMissing = (status?.missing_fields ?? []).map((f) => completionLabels[f] ?? f)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("influencer_profile.title")}</h1>
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
        <Card className="card-base bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100">
          <CardContent className="p-4 space-y-2">
            <Progress value={status.completion_percent} />
            <div className="text-xs text-gray-700">
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
              <Label>{t("influencer_profile.display_name", "Pseudo / nom public")}</Label>
              <Input className="mt-1" placeholder="@monpseudo" value={profile_form.display_name} onChange={(e) => setProfileForm({ ...profile_form, display_name: e.target.value })} />
            </div>
            <div>
              <Label>{t("influencer_profile.phone", "Téléphone")}</Label>
              <Input
                className="mt-1"
                placeholder="06 12 34 56 78"
                value={user_form.phone}
                onChange={(e) => setUserForm({ ...user_form, phone: formatPhoneFR(e.target.value) })}
                inputMode="tel"
              />
              <p className="text-[11px] text-gray-400 mt-1">Format : 06 12 34 56 78 ou +33 6 12 34 56 78</p>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("influencer_profile.location", "Ville")}</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={user_form.location}
                onChange={(e) => setUserForm({ ...user_form, location: e.target.value })}
              >
                <option value="">— Sélectionner une ville —</option>
                {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("influencer_profile.avatar", "Photo de profil")}</Label>
              <div className="mt-1 flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Aperçu" className="h-full w-full object-cover" />
                  ) : user?.avatar ? (
                    <img src={resolveMedia(user.avatar)} alt="Avatar actuel" className="h-full w-full object-cover" />
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
                    className="text-sm block w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    {avatarFile
                      ? t("influencer_profile.avatar_pending", "Sera enregistrée à la sauvegarde")
                      : user?.avatar
                        ? t("influencer_profile.avatar_current", "Photo actuelle — sélectionnez un fichier pour la remplacer")
                        : t("influencer_profile.avatar_hint", "JPG ou PNG, carré recommandé (≥ 400 px)")}
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
              <p className="text-[11px] text-gray-400 mt-1">{profile_form.bio.length} caractère{profile_form.bio.length > 1 ? "s" : ""}</p>
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
            <p className="text-xs text-gray-500 mt-1">Sélectionnez les sujets dont vous parlez à votre audience.</p>
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
            <p className="text-xs text-gray-500 mt-1">Choisissez les formats que vous savez produire — chaque type sélectionné apparaîtra dans votre grille tarifaire.</p>
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
            <p className="text-xs text-gray-500 mt-1">Indiquez votre tarif HT par type de contenu sélectionné ci-dessus.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {contentTypes.length === 0 && (
              <p className="text-sm text-gray-400">Sélectionnez d'abord vos types de contenu pour définir vos tarifs.</p>
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
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
            <div className="flex items-start gap-2 mt-2 text-xs text-gray-500">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-indigo-500" />
              <p>
                La synchronisation automatique nécessite une connexion OAuth officielle
                (Instagram Graph, TikTok Display API, YouTube Data API). En attendant,
                saisissez vos statistiques manuellement.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {socials.length === 0 && <p className="text-sm text-gray-400">{t("influencer_profile.no_socials", "Ajoutez au moins un réseau social")}</p>}
            {socials.map((s, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="grid sm:grid-cols-5 gap-2 items-end">
                  <div>
                    <Label className="text-xs">Plateforme</Label>
                    <select className="mt-1 w-full rounded-md border border-input px-2 py-1.5 text-sm" value={s.platform} onChange={(e) => updateSocial(i, "platform", e.target.value)}>
                      {platformOptions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">URL du profil</Label>
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
                    <Label className="text-xs">Vues moyennes</Label>
                    <Input className="mt-1" type="number" value={s.avg_views ?? 0} onChange={(e) => updateSocial(i, "avg_views", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Engagement (%)</Label>
                    <Input className="mt-1" type="number" step="0.1" value={s.engagement_rate ?? 0} onChange={(e) => updateSocial(i, "engagement_rate", e.target.value)} />
                  </div>
                  {s.id && (
                    <div className="flex items-end gap-1">
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => connectOAuth(s.id!)}
                        title="Connecter votre compte via OAuth officiel"
                      >
                        🔗 OAuth
                      </Button>
                      <Button
                        type="button" variant="outline" size="sm"
                        disabled={syncingId === s.id}
                        onClick={() => syncSocial(s.id!)}
                        title="Synchroniser depuis l'API officielle (OAuth requis)"
                      >
                        {syncingId === s.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                        Synchroniser
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Galerie portfolio (jusqu'à 3 photos affichées dans le kit média) */}
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base">Galerie portfolio</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Ajoutez jusqu'à 3 photos qui seront intégrées à votre kit média (formats : JPG, PNG).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              {gallery.map((g) => (
                <div key={g.id} className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                  <div className="aspect-[5/4] w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.image} alt={g.caption ?? ""} className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteGalleryImage(g.id)}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 rounded-full p-1 shadow"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Input
                    className="rounded-none border-0 border-t border-gray-200 text-xs"
                    placeholder="Légende (optionnel)"
                    defaultValue={g.caption ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value
                      if (v !== (g.caption ?? "")) updateGalleryCaption(g.id, v)
                    }}
                  />
                </div>
              ))}
              {gallery.length < 3 && (
                <label className="flex flex-col items-center justify-center aspect-[5/4] rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 cursor-pointer text-gray-500 hover:text-indigo-600 transition-colors">
                  {galleryUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-6 w-6 mb-1" />
                      <span className="text-xs">Ajouter une photo</span>
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
            <p className="text-xs text-gray-400">
              {gallery.length}/3 image{gallery.length > 1 ? "s" : ""} — les photos sont automatiquement ajoutées au PDF lors de la prochaine génération du kit média.
            </p>
          </CardContent>
        </Card>

        {/* Paiement */}
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("influencer_profile.payment", "Coordonnées de paiement")}</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>{t("influencer_profile.payment_method", "Méthode")}</Label>
              <select className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" value={profile_form.payment_method} onChange={(e) => setProfileForm({ ...profile_form, payment_method: e.target.value })}>
                <option value="">— Sélectionner —</option>
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
              <p className="text-xs text-gray-400 mt-1">{t("influencer_profile.payment_note", "Stocké chiffré (Fernet). Laisser vide pour ne pas modifier.")}</p>
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
