import { FormEvent, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Loader2, Plus, X } from "lucide-react"
import api from "@/lib/api"
import { createBrandEvent, fetchReference, inviteInfluencersToEvent, ReferenceData } from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface InfluencerLite {
  id: number
  display_name: string
  city: string
  content_themes: string[]
  social_networks: { platform: string; followers_count: number }[]
}

export default function NewEvent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [influencers, setInfluencers] = useState<InfluencerLite[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [externalEmails, setExternalEmails] = useState<string[]>([])
  const [externalEmailInput, setExternalEmailInput] = useState("")
  const [search, setSearch] = useState("")
  const [minFollowers, setMinFollowers] = useState("")
  const [platforms, setPlatforms] = useState<string[]>([])
  const [themes, setThemes] = useState<string[]>([])

  const [form, setForm] = useState({
    title: "",
    description: "",
    address: "",
    city: "",
    starts_at: "",
    ends_at: "",
    max_plus_ones: 0,
  })

  useEffect(() => {
    fetchReference().then(setReference).catch(() => {})
    api.get("/influencers/")
      .then((r) => setInfluencers(r.data.results ?? r.data))
      .catch(() => setInfluencers([]))
  }, [])

  const filtered = useMemo(() => {
    return influencers.filter((i) => {
      if (search) {
        const s = search.toLowerCase()
        if (!(i.display_name || "").toLowerCase().includes(s) && !(i.city || "").toLowerCase().includes(s)) return false
      }
      if (platforms.length > 0) {
        const infPlatforms = i.social_networks?.map((sn) => sn.platform.toLowerCase()) ?? []
        if (!platforms.some((p) => infPlatforms.includes(p.toLowerCase()))) return false
      }
      if (themes.length > 0) {
        const infThemes = (i.content_themes || []).map((x) => x.toLowerCase())
        if (!themes.some((th) => infThemes.includes(th.toLowerCase()))) return false
      }
      if (minFollowers) {
        const total = i.social_networks?.reduce((sum, sn) => sum + sn.followers_count, 0) ?? 0
        if (total < Number(minFollowers)) return false
      }
      return true
    })
  }, [influencers, search, platforms, themes, minFollowers])

  const toggleId = (id: number) => setSelectedIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const toggleArray = (key: "platforms" | "themes", value: string) => {
    if (key === "platforms") {
      setPlatforms((prev) => prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value])
    } else {
      setThemes((prev) => prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value])
    }
  }

  const addExternalEmail = () => {
    const email = externalEmailInput.trim().toLowerCase()
    if (!email) return
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!ok) {
      toast({ variant: "destructive", title: t("common.error"), description: t("events.invalid_email", "Email invalide") })
      return
    }
    if (externalEmails.includes(email)) {
      setExternalEmailInput("")
      return
    }
    setExternalEmails((prev) => [...prev, email])
    setExternalEmailInput("")
  }

  const removeExternalEmail = (email: string) => {
    setExternalEmails((prev) => prev.filter((x) => x !== email))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.address || !form.starts_at) {
      toast({ variant: "destructive", title: t("common.error"), description: t("events.required_fields", "Titre, adresse et date sont requis") })
      return
    }
    if (selectedIds.size === 0 && externalEmails.length === 0) {
      toast({ variant: "destructive", title: t("common.error"), description: t("events.invite_at_least_one", "Sélectionne au moins un influenceur") })
      return
    }

    setLoading(true)
    try {
      const event = await createBrandEvent({
        title: form.title,
        description: form.description,
        address: form.address,
        city: form.city,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        status: "published",
        max_invitees: selectedIds.size + externalEmails.length,
      })

      await inviteInfluencersToEvent(event.id, {
        influencer_ids: Array.from(selectedIds),
        invited_emails: externalEmails,
        max_plus_ones: Math.max(0, Math.min(2, Number(form.max_plus_ones) || 0)),
      })

      toast({ title: t("events.created", "Événement créé"), description: t("events.invitations_sent", "Invitations envoyées") })
      navigate(`/brand/events/${event.id}`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast({ variant: "destructive", title: t("common.error"), description: typeof detail === "string" ? detail : undefined })
    } finally {
      setLoading(false)
    }
  }

  const platformOptions = reference?.social_platforms ?? []
  const themeOptions = reference?.themes ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-2xl font-bold text-gray-900">{t("events.new_event", "Créer un événement")}</h1>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card className="card-base">
          <CardHeader><CardTitle>{t("events.details", "Détails de l'événement")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>{t("events.title_label", "Titre")} *</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>{t("events.description", "Description")}</Label><textarea className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>{t("events.address", "Adresse")} *</Label><Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></div>
              <div><Label>{t("events.city", "Ville")}</Label><Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} /></div>
              <div><Label>{t("events.start", "Début")} *</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} /></div>
              <div><Label>{t("events.end", "Fin")}</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))} /></div>
            </div>
            <div>
              <Label>{t("events.max_plus_ones", "Accompagnants autorisés")} (0, +1, +2)</Label>
              <Input type="number" min={0} max={2} value={form.max_plus_ones} onChange={(e) => setForm((p) => ({ ...p, max_plus_ones: Number(e.target.value) || 0 }))} />
            </div>
          </CardContent>
        </Card>

        <Card className="card-base">
          <CardHeader><CardTitle>{t("events.select_influencers", "Choisir les influenceurs")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
              <Label>{t("events.external_email_invites", "Inviter un email externe (hors plateforme)")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="contact@exemple.com"
                  value={externalEmailInput}
                  onChange={(e) => setExternalEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addExternalEmail()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addExternalEmail}><Plus className="h-4 w-4" /></Button>
              </div>
              {externalEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {externalEmails.map((email) => (
                    <Badge key={email} variant="info" className="cursor-pointer" onClick={() => removeExternalEmail(email)}>
                      {email} <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-2">
              <Input placeholder={t("events.search", "Recherche nom/ville")} value={search} onChange={(e) => setSearch(e.target.value)} />
              <Input type="number" placeholder={t("events.min_followers", "Min followers")} value={minFollowers} onChange={(e) => setMinFollowers(e.target.value)} />
              <Badge variant="info" className="justify-center">{selectedIds.size + externalEmails.length} {t("events.selected", "sélectionnés")}</Badge>
            </div>

            <div>
              <Label className="text-xs text-gray-500 uppercase">{t("events.filter_platforms", "Plateformes")}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {platformOptions.map((p) => (
                  <Badge key={p.code} variant={platforms.includes(p.code) ? "info" : "outline"} className="cursor-pointer" onClick={() => toggleArray("platforms", p.code)}>{p.label}</Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-500 uppercase">{t("events.filter_themes", "Thèmes")}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {themeOptions.map((th) => (
                  <Badge key={th.code} variant={themes.includes(th.code) ? "info" : "outline"} className="cursor-pointer" onClick={() => toggleArray("themes", th.code)}>{th.label}</Badge>
                ))}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto border rounded-lg p-3 bg-gray-50 grid sm:grid-cols-2 gap-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center col-span-full py-4">{t("events.no_results", "Aucun influenceur")}</p>
              ) : filtered.map((inf) => {
                const picked = selectedIds.has(inf.id)
                return (
                  <div key={inf.id} className="bg-white border rounded-lg p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{inf.display_name || `#${inf.id}`}</p>
                      <p className="text-xs text-gray-500 truncate">{inf.city || "-"}</p>
                      <div className="text-[11px] text-gray-400 mt-1">
                        {(inf.social_networks || []).slice(0, 3).map((sn) => sn.platform).join(" · ")}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant={picked ? "gradient" : "outline"} onClick={() => toggleId(inf.id)}>
                      {picked ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/brand/events")}>{t("common.cancel")}</Button>
          <Button type="submit" variant="gradient" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("events.create_and_invite", "Créer et inviter")}
          </Button>
        </div>
      </form>
    </div>
  )
}
