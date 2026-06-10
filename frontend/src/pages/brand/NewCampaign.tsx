import { useState, useEffect, FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { fetchReference, ReferenceData, sendCampaignProposals } from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiStepForm } from "@/components/shared/MultiStepForm"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, Users, Megaphone, UserCheck, Plus, X, CheckCircle2, HelpCircle } from "lucide-react"
import { cn, resolveMediaUrl } from "@/lib/utils"
import { InfluencerHoverCard } from "@/components/shared/InfluencerHoverCard"

const normalizeCityToken = (value: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const FALLBACK_THEME_OPTIONS = [
  { code: "fashion", label: "Mode" }, { code: "beauty", label: "Beauté" },
  { code: "tech", label: "Tech" }, { code: "food", label: "Cuisine" },
  { code: "travel", label: "Voyage" }, { code: "sport", label: "Sport" },
  { code: "gaming", label: "Gaming" }, { code: "lifestyle", label: "Lifestyle" },
  { code: "finance", label: "Finance" }, { code: "health_wellness", label: "Santé & Bien-être" },
]
const FALLBACK_CONTENT_TYPES = [
  { code: "post", label: "Post" },
  { code: "story", label: "Story" },
  { code: "reel", label: "Reel / Short video" },
  { code: "video", label: "Long video" },
  { code: "live", label: "Live" },
]
const FALLBACK_PLATFORMS = [
  { code: "instagram", label: "Instagram" },
  { code: "tiktok", label: "TikTok" },
  { code: "youtube", label: "YouTube" },
  { code: "twitch", label: "Twitch" },
  { code: "x", label: "X / Twitter" },
]

const AGE_RANGE_OPTIONS = [
  { code: "13-17", label: "13-17" },
  { code: "18-24", label: "18-24" },
  { code: "25-34", label: "25-34" },
  { code: "35-44", label: "35-44" },
  { code: "45-54", label: "45-54" },
  { code: "55+", label: "55+" },
]

const GENDER_OPTIONS = [
  { code: "female", labelKey: "audience.gender_female" },
  { code: "male", labelKey: "audience.gender_male" },
  { code: "non_binary", labelKey: "audience.gender_non_binary" },
  { code: "mixed", labelKey: "audience.gender_mixed" },
]

const FALLBACK_AUDIENCE_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "ar", label: "العربية" },
]

interface InfluencerLite {
  id: number
  pseudo?: string
  display_name: string
  avatar: string | null
  city: string
  content_themes: string[]
  social_networks: { platform: string; followers_count: number }[]
}

export default function NewCampaign() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [influencers, setInfluencers] = useState<InfluencerLite[]>([])
  const [infSearch, setInfSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const [form, setForm] = useState({
    title: "",
    description: "",
    campaign_type: "paid" as "paid" | "gifting",
    gifting_requires_content: true,
    products_text: "",
    shipping_info: "",
    target_audience: "",
    age_ranges: [] as string[],
    audience_cities: [] as string[],
    audience_languages: [] as string[],
    audience_genders: [] as string[],
    deadline: "",
    budget: "",
    min_followers: "",
    themes: [] as string[],
    content_formats: [] as { code: string; quantity: number }[],
    target_networks: [] as string[],
    is_casting: false,
    max_influencers: 1,
  })
  const [cityInput, setCityInput] = useState("")
  const [brandStatus, setBrandStatus] = useState<"pending" | "approved" | "rejected" | null>(null)

  useEffect(() => {
    fetchReference().then(setReference).catch(() => {})
    api.get("/brands/onboarding/")
      .then((r: any) => setBrandStatus(r.data?.validation_status ?? null))
      .catch(() => {})
    api.get("/influencers/")
      .then((r: any) => {
        console.log("[NewCampaign] /influencers/ success:", r.data)
        setInfluencers(r.data.results ?? r.data)
      })
      .catch((e: any) => {
        console.error("[NewCampaign] /influencers/ failed:", e?.response?.status, e?.message)
      })
  }, [])

  const contentTypeOptions = reference?.content_types ?? FALLBACK_CONTENT_TYPES
  const platformOptions = reference?.social_platforms ?? FALLBACK_PLATFORMS
  const themeOptions = reference?.themes ?? FALLBACK_THEME_OPTIONS
  const audienceLanguageOptions = (reference as any)?.languages ?? FALLBACK_AUDIENCE_LANGUAGES

  const toggleAudienceArr = (
    key: "age_ranges" | "audience_languages" | "audience_genders",
    val: string,
  ) =>
    setForm((p) => ({
      ...p,
      [key]: (p[key] as string[]).includes(val)
        ? (p[key] as string[]).filter((x) => x !== val)
        : [...(p[key] as string[]), val],
    }))
  const addCity = () => {
    const v = cityInput.trim()
    if (!v) return
    if (form.audience_cities.includes(v)) { setCityInput(""); return }
    setForm((p) => ({ ...p, audience_cities: [...p.audience_cities, v] }))
    setCityInput("")
  }
  const removeCity = (v: string) =>
    setForm((p) => ({ ...p, audience_cities: p.audience_cities.filter((x) => x !== v) }))

  const STEPS = [
    { id: 1, title: t("new_campaign.basics") },
    { id: 2, title: t("new_campaign.target_timeline") },
    { id: 3, title: t("new_campaign_plus.mode_step") },
    { id: 4, title: t("new_campaign.budget_launch") },
  ]

  const update = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))
  const updateCampaignType = (type: "paid" | "gifting") => {
    setForm((p) => ({
      ...p,
      campaign_type: type,
      gifting_requires_content: type === "paid" ? true : p.gifting_requires_content,
    }))
  }
  const toggle = (key: "themes" | "target_networks", val: string) =>
    setForm((p) => ({
      ...p,
      [key]: (p[key] as string[]).includes(val)
        ? (p[key] as string[]).filter((x) => x !== val)
        : [...(p[key] as string[]), val],
    }))
  const toggleInfluencer = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const filteredInfluencers = influencers.filter((i) => {
    if (infSearch) {
      const s = infSearch.toLowerCase()
      if (!(i.display_name ?? "").toLowerCase().includes(s) && !(i.city ?? "").toLowerCase().includes(s)) return false
    }
    if (form.target_networks.length > 0) {
      const normalizePlatform = (p: string) => {
        const v = p.toLowerCase()
        return v === "x" ? "twitter" : v
      }
      const infPlatforms = i.social_networks?.map((sn) => normalizePlatform(sn.platform)) ?? []
      if (!form.target_networks.some((p) => infPlatforms.includes(normalizePlatform(p)))) return false
    }
    if (form.min_followers) {
      const totalFollowers = i.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
      if (totalFollowers < Number(form.min_followers)) return false
    }
    if (form.themes.length > 0) {
      const infThemes = (i.content_themes ?? []).map((x) => x.toLowerCase().trim())
      const wants = form.themes.map((x) => x.toLowerCase().trim())
      if (!wants.some((th) => infThemes.includes(th))) return false
    }
    if (form.audience_cities.length > 0) {
      const city = normalizeCityToken(i.city ?? "")
      const wants = form.audience_cities.map((x) => normalizeCityToken(x))
      if (!wants.some((target) => city.includes(target) || target.includes(city))) return false
    }
    return true
  })

  useEffect(() => {
    if (form.campaign_type === "gifting" && !form.gifting_requires_content && form.content_formats.length > 0) {
      setForm((p) => ({ ...p, content_formats: [] }))
    }
  }, [form.campaign_type, form.gifting_requires_content, form.content_formats.length])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const normalizedContentFormats = form.content_formats
      .filter((cf) => Boolean(cf.code) && Number(cf.quantity) > 0)
      .map((cf) => ({ code: cf.code, quantity: Math.max(1, Number(cf.quantity) || 1) }))

    if (form.campaign_type === "gifting" && !form.products_text.trim()) {
      toast({
        title: t("common.error"),
        description: t("new_campaign_plus.products_required", "Ajoute au moins un produit pour une campagne gifting."),
        variant: "destructive",
      })
      return
    }

    if (form.campaign_type === "gifting" && form.gifting_requires_content && normalizedContentFormats.length === 0) {
      toast({
        title: t("common.error"),
        description: t("new_campaign_plus.content_required_formats", "Ajoute au moins un format de contenu si une contrepartie est demandée."),
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const products = form.products_text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)

      const res = await api.post("/campaigns/", {
        title: form.title,
        description: form.description,
        campaign_type: form.campaign_type,
        status: "active",
        products,
        shipping_info: form.shipping_info,
        target_networks: form.target_networks,
        content_formats: (form.campaign_type === "gifting" && !form.gifting_requires_content) ? [] : normalizedContentFormats,
        price_per_influencer: form.campaign_type === "paid" && form.budget ? parseFloat(form.budget) : null,
        deadline: form.deadline || null,
        is_casting: form.is_casting,
        max_influencers: Number(form.max_influencers) || 1,
        target_filters: {
          target_audience: form.target_audience,
          age_ranges: form.age_ranges,
          audience_cities: form.audience_cities,
          audience_languages: form.audience_languages,
          audience_genders: form.audience_genders,
          min_followers: form.min_followers ? parseInt(form.min_followers) : null,
          content_themes: form.themes,
          content_required: form.campaign_type === "paid" ? true : form.gifting_requires_content,
        },
      })
      const campaignId = res.data.id

      // If non-casting and influencers picked → send direct proposals
      if (!form.is_casting && selectedIds.size > 0) {
        try {
          await sendCampaignProposals(
            campaignId,
            Array.from(selectedIds),
            form.budget ? parseFloat(form.budget) : undefined,
          )
        } catch {
          toast({ title: t("new_campaign_plus.proposals_error"), variant: "destructive" })
        }
      }

      toast({ title: t("new_campaign.created"), description: t("new_campaign.created_desc") })
      navigate("/brand/campaigns")
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      toast({
        title: t("common.error"),
        description: typeof detail === "string" ? detail : t("campaigns.create_error"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  if (brandStatus && brandStatus !== "approved") {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
          <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink">{t("campaigns.new_campaign")}</h1>
        </div>
        <Card className="card-base border-l-4 border-l-purple-500">
          <CardContent className="py-8 text-center space-y-4">
            <p className="font-semibold text-aurora-ink">
              {brandStatus === "rejected"
                ? t("new_campaign.blocked_rejected", "Votre compte a été refusé")
                : t("new_campaign.blocked_pending", "Validation requise")}
            </p>
            <p className="text-sm text-aurora-ink-2">{t("new_campaign.blocked_desc", "Votre compte marque doit être validé par notre équipe avant de créer des campagnes.")}</p>
            <Button variant="gradient" onClick={() => navigate("/brand/onboarding")}>
              {t("new_campaign.go_to_onboarding", "Aller à l'onboarding")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink">{t("campaigns.new_campaign")}</h1>
      </div>

      <Card className="card-base">
        <CardContent className="pt-6">
          <MultiStepForm steps={STEPS} currentStep={step}>
            {step === 1 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">{t("new_campaign.basics")}</CardTitle></CardHeader>
                <div>
                  <Label className="text-xs font-medium text-aurora-ink-3 uppercase tracking-wide mb-2 block">
                    {t("new_campaign_plus.campaign_type", "Type de campagne")}
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateCampaignType("paid")}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left transition-all",
                        form.campaign_type === "paid" ? "border-indigo-500 bg-indigo-50" : "border-aurora-line hover:border-gray-300",
                      )}
                    >
                      <p className="font-semibold text-sm text-aurora-ink">{t("new_campaign_plus.campaign_type_paid", "Rémunérée")}</p>
                      <p className="text-xs text-aurora-ink-3 mt-1">{t("new_campaign_plus.campaign_type_paid_desc", "Les influenceurs sont payés par publication.")}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCampaignType("gifting")}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left transition-all",
                        form.campaign_type === "gifting" ? "border-indigo-500 bg-indigo-50" : "border-aurora-line hover:border-gray-300",
                      )}
                    >
                      <p className="font-semibold text-sm text-aurora-ink">{t("new_campaign_plus.campaign_type_gifting", "Gifting")}</p>
                      <p className="text-xs text-aurora-ink-3 mt-1">{t("new_campaign_plus.campaign_type_gifting_desc", "Non rémunérée, envoi de produits aux influenceurs.")}</p>
                    </button>
                  </div>
                </div>
                <div>
                  <Label>{t("new_campaign.campaign_title")} *</Label>
                  <Input className="mt-1" placeholder={t("new_campaign_plus.title_placeholder")} value={form.title} onChange={(e) => update("title", e.target.value)} required />
                </div>
                <div>
                  <Label>{t("campaigns.description")} *</Label>
                  <textarea className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={t("new_campaign_plus.description_placeholder")} value={form.description} onChange={(e) => update("description", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-aurora-ink-3 uppercase tracking-wide mb-2 block">{t("campaigns.themes")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {themeOptions.map((th) => (
                      <Badge key={th.code} variant={form.themes.includes(th.code) ? "info" : "outline"} className="cursor-pointer" onClick={() => toggle("themes", th.code)}>{th.label}</Badge>
                    ))}
                  </div>
                </div>
                {form.campaign_type === "gifting" && (
                  <div>
                    <Label className="text-xs font-medium text-aurora-ink-3 uppercase tracking-wide mb-2 block">
                      {t("new_campaign_plus.gifting_content_question", "Contenu en contrepartie ?")}
                    </Label>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => update("gifting_requires_content", true)}
                        className={cn(
                          "p-3 rounded-xl border text-left text-sm transition-all",
                          form.gifting_requires_content ? "border-indigo-500 bg-indigo-50" : "border-aurora-line hover:border-gray-300",
                        )}
                      >
                        {t("new_campaign_plus.gifting_content_yes", "Oui, je veux du contenu")}
                      </button>
                      <button
                        type="button"
                        onClick={() => update("gifting_requires_content", false)}
                        className={cn(
                          "p-3 rounded-xl border text-left text-sm transition-all",
                          !form.gifting_requires_content ? "border-indigo-500 bg-indigo-50" : "border-aurora-line hover:border-gray-300",
                        )}
                      >
                        {t("new_campaign_plus.gifting_content_no", "Non, envoi de produit sans livrable")}
                      </button>
                    </div>
                  </div>
                )}

                {(form.campaign_type === "paid" || form.gifting_requires_content) && (
                  <div>
                    <Label>{t("new_campaign_plus.content_formats")}</Label>
                    <p className="text-xs text-aurora-ink-3 mt-1 mb-2">{t("new_campaign_plus.content_formats_hint")}</p>
                    <div className="space-y-2">
                      {form.content_formats.map((cf, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                            value={cf.code}
                            onChange={(e) => {
                              const next = [...form.content_formats]
                              next[idx] = { ...next[idx], code: e.target.value }
                              update("content_formats", next)
                            }}
                          >
                            <option value="">{t("new_campaign_plus.pick_placeholder")}</option>
                            {contentTypeOptions.map((ct) => (
                              <option key={ct.code} value={ct.code}>{ct.label}</option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            min={1}
                            className="w-20"
                            value={cf.quantity}
                            onChange={(e) => {
                              const next = [...form.content_formats]
                              next[idx] = { ...next[idx], quantity: Math.max(1, Number(e.target.value) || 1) }
                              update("content_formats", next)
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => update("content_formats", form.content_formats.filter((_, i) => i !== idx))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => update("content_formats", [...form.content_formats, { code: "", quantity: 1 }])}
                      >
                        <Plus className="h-4 w-4 mr-1" />{t("new_campaign_plus.add_format")}
                      </Button>
                    </div>
                  </div>
                )}
                <Button variant="gradient" className="w-full" disabled={!form.title} onClick={() => setStep(2)}>{t("common.next")}</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">{t("new_campaign.target_timeline")}</CardTitle></CardHeader>
                <div>
                  <Label className="text-xs font-medium text-aurora-ink-3 uppercase tracking-wide mb-2 block">{t("new_campaign_plus.target_networks")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {platformOptions.map((p) => (
                      <Badge key={p.code} variant={form.target_networks.includes(p.code) ? "info" : "outline"} className="cursor-pointer" onClick={() => toggle("target_networks", p.code)}>{p.label}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-aurora-ink-3 uppercase tracking-wide mb-2 block">{t("audience.age_ranges", "Tranches d'âge ciblées")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {AGE_RANGE_OPTIONS.map((a) => (
                      <Badge
                        key={a.code}
                        variant={form.age_ranges.includes(a.code) ? "info" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleAudienceArr("age_ranges", a.code)}
                      >
                        {a.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-aurora-ink-3 uppercase tracking-wide mb-2 block">{t("audience.gender", "Genre de l'audience")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {GENDER_OPTIONS.map((g) => (
                      <Badge
                        key={g.code}
                        variant={form.audience_genders.includes(g.code) ? "info" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleAudienceArr("audience_genders", g.code)}
                      >
                        {t(g.labelKey)}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-aurora-ink-3 uppercase tracking-wide mb-2 block">{t("audience.languages", "Langues de l'audience")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {audienceLanguageOptions.map((l: { code: string; label: string }) => (
                      <Badge
                        key={l.code}
                        variant={form.audience_languages.includes(l.code) ? "info" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleAudienceArr("audience_languages", l.code)}
                      >
                        {l.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>{t("audience.cities", "Villes / pays ciblés")}</Label>
                  <p className="text-xs text-aurora-ink-3 mt-1">{t("audience.cities_hint", "Ce filtre réduit aussi la shortlist d'influenceurs ci-dessous.")}</p>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder={t("audience.city_placeholder", "ex : Paris, Lyon, France...")}
                      value={cityInput}
                      autoComplete="off"
                      onChange={(e) => setCityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addCity() }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addCity}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {form.audience_cities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.audience_cities.map((c) => (
                        <Badge key={c} variant="info" className="cursor-pointer" onClick={() => removeCity(c)}>
                          {c} <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>{t("new_campaign.min_followers")}</Label>
                  <Input className="mt-1" type="number" placeholder="10000" value={form.min_followers} onChange={(e) => update("min_followers", e.target.value)} />
                </div>

                <div>
                  <Label>{t("campaigns.target_audience")} ({t("audience.optional_notes", "notes complémentaires")})</Label>
                  <Input className="mt-1" placeholder={t("new_campaign_plus.audience_placeholder")} value={form.target_audience} onChange={(e) => update("target_audience", e.target.value)} />
                </div>

                <div>
                  <Label className="flex items-center gap-1">
                    {t("campaigns.deadline")}
                    <HoverCard openDelay={100}>
                      <HoverCardTrigger asChild>
                        <button type="button" tabIndex={-1} className="inline-flex items-center justify-center text-aurora-ink-3 hover:text-aurora-blue">
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent className="text-xs">
                        {t(
                          "new_campaign_plus.deadline_help",
                          "Date limite de publication des contenus par les influenceurs. Passé ce délai, la campagne ne sera plus considérée active et les livrables non publiés seront marqués en retard.",
                        )}
                      </HoverCardContent>
                    </HoverCard>
                  </Label>
                  <Input className="mt-1" type="date" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>{t("common.back")}</Button>
                  <Button variant="gradient" className="flex-1" onClick={() => setStep(3)}>{t("common.next")}</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">{t("new_campaign_plus.mode_step")}</CardTitle></CardHeader>

                {form.campaign_type === "gifting" && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>{t("new_campaign_plus.products_list", "Produits à offrir")}</Label>
                      <textarea
                        className="mt-1 w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={t("new_campaign_plus.products_list_placeholder", "Ex: Serum 30ml\nBox découverte\nBon d'achat")}
                        value={form.products_text}
                        onChange={(e) => update("products_text", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("new_campaign_plus.shipping_info", "Infos d'expédition")}</Label>
                      <textarea
                        className="mt-1 w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={t("new_campaign_plus.shipping_info_placeholder", "Délais, transporteur, zones livrées, contraintes...")}
                        value={form.shipping_info}
                        onChange={(e) => update("shipping_info", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => update("is_casting", false)}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      !form.is_casting ? "border-indigo-500 bg-indigo-50" : "border-aurora-line hover:border-gray-300",
                    )}
                  >
                    <UserCheck className={cn("h-5 w-5 mb-2", !form.is_casting ? "text-aurora-blue" : "text-aurora-ink-3")} />
                    <p className="font-semibold text-sm text-aurora-ink">{t("new_campaign_plus.mode_direct_title")}</p>
                    <p className="text-xs text-aurora-ink-3 mt-1">{t("new_campaign_plus.mode_direct_desc")}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => update("is_casting", true)}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      form.is_casting ? "border-indigo-500 bg-indigo-50" : "border-aurora-line hover:border-gray-300",
                    )}
                  >
                    <Megaphone className={cn("h-5 w-5 mb-2", form.is_casting ? "text-aurora-blue" : "text-aurora-ink-3")} />
                    <p className="font-semibold text-sm text-aurora-ink">{t("new_campaign_plus.mode_casting_title")}</p>
                    <p className="text-xs text-aurora-ink-3 mt-1">{t("new_campaign_plus.mode_casting_desc")}</p>
                  </button>
                </div>
                <div>
                  <Label>{t("new_campaign_plus.max_influencers")}</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min="1"
                    value={form.max_influencers}
                    onChange={(e) => update("max_influencers", Math.max(1, Number(e.target.value) || 1))}
                  />
                  <p className="text-xs text-aurora-ink-3 mt-1">{t("new_campaign_plus.max_influencers_hint")}</p>
                </div>

                {!form.is_casting && (
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-aurora-ink-3 uppercase tracking-wide">{t("new_campaign_plus.pick_influencers")}</Label>
                      <Badge variant="info">{selectedIds.size} / {form.max_influencers}</Badge>
                    </div>
                    <Input
                      placeholder={t("new_campaign_plus.search_influencers")}
                      value={infSearch}
                      onChange={(e) => setInfSearch(e.target.value)}
                    />
                    <div className="max-h-[500px] overflow-y-auto grid sm:grid-cols-2 gap-3 border rounded-lg p-3 bg-aurora-surface">
                      {filteredInfluencers.length === 0 ? (
                        <p className="text-sm text-aurora-ink-3 text-center py-6 col-span-full">{t("new_campaign_plus.no_influencers")}</p>
                      ) : filteredInfluencers.slice(0, 40).map((inf) => {
                        const totalFollowers = inf.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
                        const picked = selectedIds.has(inf.id)
                        return (
                          <div
                            key={inf.id}
                            className={cn(
                              "relative p-3 rounded-xl border-2 bg-white transition-all",
                              picked ? "border-indigo-500 shadow-md" : "border-transparent hover:border-aurora-line",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Avatar className="h-14 w-14 shrink-0">
                                {inf.avatar && <AvatarImage src={resolveMediaUrl(inf.avatar)} />}
                                <AvatarFallback className="bg-aurora-ink text-white font-semibold">
                                  {(inf.display_name || "??").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <InfluencerHoverCard
                                  influencerId={inf.id}
                                  influencerPseudo={inf.pseudo}
                                  displayName={inf.display_name || `#${inf.id}`}
                                  avatar={inf.avatar}
                                  city={inf.city}
                                  socialNetworks={inf.social_networks}
                                  contentThemes={inf.content_themes}
                                >
                                  {inf.pseudo ? (
                                    <a href={`/brand/influencers/${encodeURIComponent(inf.pseudo)}`} target="_blank" rel="noopener noreferrer" className="group">
                                      <p className="text-sm font-semibold text-aurora-ink truncate group-hover:text-aurora-blue transition-colors">{inf.display_name || `#${inf.id}`}</p>
                                    </a>
                                  ) : (
                                    <p className="text-sm font-semibold text-aurora-ink truncate">{inf.display_name || `#${inf.id}`}</p>
                                  )}
                                </InfluencerHoverCard>
                                <p className="text-xs text-aurora-ink-3 flex items-center gap-1 mt-0.5">
                                  <Users className="h-3 w-3" />{fmt(totalFollowers)}
                                  {inf.city && <span className="ml-1">· {inf.city}</span>}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {inf.social_networks?.slice(0, 3).map((sn) => (
                                    <Badge key={sn.platform} variant="outline" className="text-[10px] px-1.5 py-0">{sn.platform}</Badge>
                                  ))}
                                </div>
                                {inf.content_themes?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {inf.content_themes.slice(0, 3).map((th) => (
                                      <Badge key={th} variant="info" className="text-[10px] px-1.5 py-0">{th}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              {inf.pseudo ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  asChild
                                >
                                  <a href={`/brand/influencers/${encodeURIComponent(inf.pseudo)}#media-kit`} target="_blank" rel="noopener noreferrer">{t("new_campaign_plus.view_media_kit")}</a>
                                </Button>
                              ) : (
                                <Button type="button" size="sm" variant="outline" className="flex-1" disabled>{t("new_campaign_plus.view_media_kit")}</Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant={picked ? "gradient" : "outline"}
                                className="flex-1"
                                onClick={() => toggleInfluencer(inf.id)}
                              >
                                {picked ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />{t("new_campaign_plus.picked")}</> : t("new_campaign_plus.select")}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>{t("common.back")}</Button>
                  <Button variant="gradient" className="flex-1" onClick={() => setStep(4)}>{t("common.next")}</Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">{t("new_campaign.budget_launch")}</CardTitle></CardHeader>
                {form.campaign_type === "paid" ? (
                  <div>
                    <Label>{t("new_campaign_plus.price_per_influencer")} *</Label>
                    <Input className="mt-1" type="number" placeholder="2000" value={form.budget} onChange={(e) => update("budget", e.target.value)} required />
                    <p className="text-xs text-aurora-ink-3 mt-1">
                      {t("new_campaign_plus.total_budget")}: €{((parseFloat(form.budget) || 0) * form.max_influencers).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
                    {t("new_campaign_plus.gifting_budget_hint", "Campagne gifting: pas de rémunération directe, les produits sont envoyés aux influenceurs.")}
                  </div>
                )}
                <div className="p-4 bg-indigo-50 rounded-xl text-sm space-y-1">
                  <p className="font-semibold text-indigo-800 mb-2">{t("new_campaign.summary")}</p>
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign.field_title")}:</span> {form.title || "—"}</p>
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign_plus.campaign_type", "Type de campagne")}:</span> {form.campaign_type === "gifting" ? t("new_campaign_plus.campaign_type_gifting", "Gifting") : t("new_campaign_plus.campaign_type_paid", "Rémunérée")}</p>
                  {form.campaign_type === "gifting" && (
                    <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign_plus.gifting_content_question", "Contenu en contrepartie ?")}:</span> {form.gifting_requires_content ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                  )}
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign.field_themes")}:</span> {form.themes.join(", ") || "—"}</p>
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign_plus.content_formats")}:</span> {(form.campaign_type === "gifting" && !form.gifting_requires_content) ? t("new_campaign_plus.no_content_expected", "Aucun contenu attendu") : (form.content_formats.length > 0 ? form.content_formats.map((cf) => `${cf.quantity}x ${contentTypeOptions.find((c) => c.code === cf.code)?.label || cf.code}`).join(", ") : "—")}</p>
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign_plus.target_networks")}:</span> {form.target_networks.join(", ") || "—"}</p>
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign_plus.mode_label")}:</span> {form.is_casting ? t("new_campaign_plus.mode_casting_title") : t("new_campaign_plus.mode_direct_title")}</p>
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign_plus.max_influencers")}:</span> {form.max_influencers}</p>
                  {!form.is_casting && (
                    <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign_plus.picked")}:</span> {selectedIds.size}</p>
                  )}
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign.field_deadline")}:</span> {form.deadline || "—"}</p>
                  <p className="text-aurora-blue-deep"><span className="font-medium">{t("new_campaign.field_budget")}:</span> {form.campaign_type === "paid" ? (form.budget ? `€${form.budget}` : "—") : t("new_campaign_plus.not_paid", "Non rémunérée")}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(3)}>{t("common.back")}</Button>
                  <Button type="submit" variant="gradient" className="flex-1" disabled={loading || (form.campaign_type === "paid" && !form.budget)}>
                    {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("campaigns.launch")}
                  </Button>
                </div>
              </form>
            )}
          </MultiStepForm>
        </CardContent>
      </Card>
    </div>
  )
}
