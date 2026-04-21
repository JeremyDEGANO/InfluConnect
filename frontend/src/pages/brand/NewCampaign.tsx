import { useState, useEffect, FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { fetchReference, ReferenceData, sendCampaignProposals, fetchMarketplace } from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiStepForm } from "@/components/shared/MultiStepForm"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft, Users, Megaphone, UserCheck, Plus, X, Eye, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const THEME_OPTIONS = ["Fashion", "Beauty", "Tech", "Food", "Travel", "Fitness", "Gaming", "Lifestyle", "Finance", "Education"]
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

interface InfluencerLite {
  id: number
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
    target_audience: "",
    deadline: "",
    budget: "",
    min_followers: "",
    themes: [] as string[],
    content_formats: [] as { code: string; quantity: number }[],
    target_networks: [] as string[],
    is_casting: false,
    max_influencers: 1,
  })

  useEffect(() => {
    fetchReference().then(setReference).catch(() => {})
    fetchMarketplace()
      .then((d: any) => setInfluencers(d.results ?? d))
      .catch(() => {})
  }, [])

  const contentTypeOptions = reference?.content_types ?? FALLBACK_CONTENT_TYPES
  const platformOptions = reference?.social_platforms ?? FALLBACK_PLATFORMS

  const STEPS = [
    { id: 1, title: t("new_campaign.basics") },
    { id: 2, title: t("new_campaign.target_timeline") },
    { id: 3, title: t("new_campaign_plus.mode_step") },
    { id: 4, title: t("new_campaign.budget_launch") },
  ]

  const update = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))
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
      const infPlatforms = i.social_networks?.map((sn) => sn.platform.toLowerCase()) ?? []
      if (!form.target_networks.some((p) => infPlatforms.includes(p.toLowerCase()))) return false
    }
    if (form.min_followers) {
      const totalFollowers = i.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
      if (totalFollowers < Number(form.min_followers)) return false
    }
    return true
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post("/campaigns/", {
        title: form.title,
        description: form.description,
        campaign_type: "paid",
        status: "active",
        target_networks: form.target_networks,
        content_formats: form.content_formats,
        price_per_influencer: form.budget ? parseFloat(form.budget) : null,
        deadline: form.deadline || null,
        is_casting: form.is_casting,
        max_influencers: Number(form.max_influencers) || 1,
        target_filters: {
          target_audience: form.target_audience,
          min_followers: form.min_followers ? parseInt(form.min_followers) : null,
          content_themes: form.themes,
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
    } catch {
      toast({ title: t("common.error"), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-2xl font-bold text-gray-900">{t("campaigns.new_campaign")}</h1>
      </div>

      <Card className="card-base">
        <CardContent className="pt-6">
          <MultiStepForm steps={STEPS} currentStep={step}>
            {step === 1 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">{t("new_campaign.basics")}</CardTitle></CardHeader>
                <div>
                  <Label>{t("new_campaign.campaign_title")} *</Label>
                  <Input className="mt-1" placeholder={t("new_campaign_plus.title_placeholder")} value={form.title} onChange={(e) => update("title", e.target.value)} required />
                </div>
                <div>
                  <Label>{t("campaigns.description")} *</Label>
                  <textarea className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={t("new_campaign_plus.description_placeholder")} value={form.description} onChange={(e) => update("description", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">{t("campaigns.themes")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {THEME_OPTIONS.map((theme) => (
                      <Badge key={theme} variant={form.themes.includes(theme) ? "info" : "outline"} className="cursor-pointer" onClick={() => toggle("themes", theme)}>{theme}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>{t("new_campaign_plus.content_formats")}</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-2">{t("new_campaign_plus.content_formats_hint")}</p>
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
                <Button variant="gradient" className="w-full" disabled={!form.title} onClick={() => setStep(2)}>{t("common.next")}</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">{t("new_campaign.target_timeline")}</CardTitle></CardHeader>
                <div>
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">{t("new_campaign_plus.target_networks")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {platformOptions.map((p) => (
                      <Badge key={p.code} variant={form.target_networks.includes(p.code) ? "info" : "outline"} className="cursor-pointer" onClick={() => toggle("target_networks", p.code)}>{p.label}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>{t("campaigns.target_audience")}</Label>
                  <Input className="mt-1" placeholder={t("new_campaign_plus.audience_placeholder")} value={form.target_audience} onChange={(e) => update("target_audience", e.target.value)} />
                </div>
                <div>
                  <Label>{t("new_campaign.min_followers")}</Label>
                  <Input className="mt-1" type="number" placeholder="10000" value={form.min_followers} onChange={(e) => update("min_followers", e.target.value)} />
                </div>
                <div>
                  <Label>{t("campaigns.deadline")}</Label>
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
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => update("is_casting", false)}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      !form.is_casting ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300",
                    )}
                  >
                    <UserCheck className={cn("h-5 w-5 mb-2", !form.is_casting ? "text-indigo-600" : "text-gray-400")} />
                    <p className="font-semibold text-sm text-gray-900">{t("new_campaign_plus.mode_direct_title")}</p>
                    <p className="text-xs text-gray-500 mt-1">{t("new_campaign_plus.mode_direct_desc")}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => update("is_casting", true)}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      form.is_casting ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300",
                    )}
                  >
                    <Megaphone className={cn("h-5 w-5 mb-2", form.is_casting ? "text-indigo-600" : "text-gray-400")} />
                    <p className="font-semibold text-sm text-gray-900">{t("new_campaign_plus.mode_casting_title")}</p>
                    <p className="text-xs text-gray-500 mt-1">{t("new_campaign_plus.mode_casting_desc")}</p>
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
                  <p className="text-xs text-gray-400 mt-1">{t("new_campaign_plus.max_influencers_hint")}</p>
                </div>

                {!form.is_casting && (
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("new_campaign_plus.pick_influencers")}</Label>
                      <Badge variant="info">{selectedIds.size} / {form.max_influencers}</Badge>
                    </div>
                    <Input
                      placeholder={t("new_campaign_plus.search_influencers")}
                      value={infSearch}
                      onChange={(e) => setInfSearch(e.target.value)}
                    />
                    <div className="max-h-[500px] overflow-y-auto grid sm:grid-cols-2 gap-3 border rounded-lg p-3 bg-gray-50">
                      {filteredInfluencers.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6 col-span-full">{t("new_campaign_plus.no_influencers")}</p>
                      ) : filteredInfluencers.slice(0, 40).map((inf) => {
                        const totalFollowers = inf.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
                        const picked = selectedIds.has(inf.id)
                        return (
                          <div
                            key={inf.id}
                            className={cn(
                              "relative p-3 rounded-xl border-2 bg-white transition-all",
                              picked ? "border-indigo-500 shadow-md" : "border-transparent hover:border-gray-200",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Avatar className="h-14 w-14 shrink-0">
                                {inf.avatar && <AvatarImage src={inf.avatar} />}
                                <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-violet-600 text-white font-semibold">
                                  {(inf.display_name || "??").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{inf.display_name || `#${inf.id}`}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
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
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => window.open(`/marketplace/${inf.id}`, "_blank")}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />{t("new_campaign_plus.view_profile")}
                              </Button>
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
                <div>
                  <Label>{t("new_campaign_plus.price_per_influencer")} (€) *</Label>
                  <Input className="mt-1" type="number" placeholder="2000" value={form.budget} onChange={(e) => update("budget", e.target.value)} required />
                  <p className="text-xs text-gray-400 mt-1">
                    {t("new_campaign_plus.total_budget")}: €{((parseFloat(form.budget) || 0) * form.max_influencers).toFixed(2)}
                  </p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-xl text-sm space-y-1">
                  <p className="font-semibold text-indigo-800 mb-2">{t("new_campaign.summary")}</p>
                  <p className="text-indigo-700"><span className="font-medium">{t("new_campaign.field_title")}:</span> {form.title || "—"}</p>
                  <p className="text-indigo-700"><span className="font-medium">{t("new_campaign.field_themes")}:</span> {form.themes.join(", ") || "—"}</p>
                  <p className="text-indigo-700"><span className="font-medium">{t("new_campaign_plus.content_formats")}:</span> {form.content_formats.length > 0 ? form.content_formats.map((cf) => `${cf.quantity}x ${contentTypeOptions.find((c) => c.code === cf.code)?.label || cf.code}`).join(", ") : "—"}</p>
                  <p className="text-indigo-700"><span className="font-medium">{t("new_campaign_plus.target_networks")}:</span> {form.target_networks.join(", ") || "—"}</p>
                  <p className="text-indigo-700"><span className="font-medium">{t("new_campaign_plus.mode_label")}:</span> {form.is_casting ? t("new_campaign_plus.mode_casting_title") : t("new_campaign_plus.mode_direct_title")}</p>
                  <p className="text-indigo-700"><span className="font-medium">{t("new_campaign_plus.max_influencers")}:</span> {form.max_influencers}</p>
                  {!form.is_casting && (
                    <p className="text-indigo-700"><span className="font-medium">{t("new_campaign_plus.picked")}:</span> {selectedIds.size}</p>
                  )}
                  <p className="text-indigo-700"><span className="font-medium">{t("new_campaign.field_deadline")}:</span> {form.deadline || "—"}</p>
                  <p className="text-indigo-700"><span className="font-medium">{t("new_campaign.field_budget")}:</span> {form.budget ? `€${form.budget}` : "—"}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(3)}>{t("common.back")}</Button>
                  <Button type="submit" variant="gradient" className="flex-1" disabled={loading || !form.budget}>
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
