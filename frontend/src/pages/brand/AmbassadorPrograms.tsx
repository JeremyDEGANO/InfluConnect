import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import api, { apiErrorMessage } from "@/lib/api"
import { fetchAmbassadorPrograms } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Crown, Loader2, Plus, Calendar, Search, X } from "lucide-react"

interface InfluencerLite { id: number; display_name: string }

interface AmbassadorProgram {
  id: number
  influencer: number
  influencer_display_name: string
  name: string
  description: string
  monthly_budget: number
  status: "draft" | "active" | "paused" | "ended"
  starts_at: string | null
  ends_at: string | null
  auto_renew: boolean
}

const STATUS_VARIANT: Record<string, "info" | "outline" | "success" | "warning"> = {
  draft: "outline",
  active: "success",
  paused: "warning",
  ended: "info",
}

export default function AmbassadorPrograms() {
  const { t, i18n } = useTranslation()
  const { toast } = useToast()
  const [programs, setPrograms] = useState<AmbassadorProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listQuery, setListQuery] = useState("")
  const [form, setForm] = useState({
    influencer: "", name: "", description: "", monthly_budget: "",
    starts_at: "", ends_at: "", auto_renew: false,
  })

  // Influencer autocomplete (server-side search, debounced)
  const [influencerQuery, setInfluencerQuery] = useState("")
  const [influencerResults, setInfluencerResults] = useState<InfluencerLite[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerLite | null>(null)
  const searchTimer = useRef<number | null>(null)

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current)
    const q = influencerQuery.trim()
    if (q.length < 2 || selectedInfluencer) {
      setInfluencerResults([])
      return
    }
    setSearching(true)
    searchTimer.current = window.setTimeout(async () => {
      try {
        const r = await api.get("/influencers/", { params: { search: q, page_size: 10 } })
        const rows = (r.data.results ?? r.data) as InfluencerLite[]
        setInfluencerResults(rows.slice(0, 10))
      } catch {
        setInfluencerResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => { if (searchTimer.current) window.clearTimeout(searchTimer.current) }
  }, [influencerQuery, selectedInfluencer])

  const pickInfluencer = (i: InfluencerLite) => {
    setSelectedInfluencer(i)
    setForm((f) => ({ ...f, influencer: String(i.id) }))
    setInfluencerQuery("")
    setInfluencerResults([])
  }

  const clearInfluencer = () => {
    setSelectedInfluencer(null)
    setForm((f) => ({ ...f, influencer: "" }))
  }

  const filteredPrograms = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return programs
    return programs.filter((p) =>
      p.name.toLowerCase().includes(q)
      || (p.influencer_display_name || "").toLowerCase().includes(q)
    )
  }, [programs, listQuery])

  const load = () => {
    setLoading(true)
    fetchAmbassadorPrograms()
      .then((d) => setPrograms((d as any).results ?? d as AmbassadorProgram[]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const create = async () => {
    if (!form.influencer || !form.name) {
      toast({ variant: "destructive", title: t("ambassadors.required_fields") })
      return
    }
    setSaving(true)
    try {
      await api.post("/ambassador-programs/", {
        influencer: Number(form.influencer),
        name: form.name,
        description: form.description,
        monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        auto_renew: form.auto_renew,
        status: "active",
      })
      toast({ title: t("ambassadors.created") })
      setOpen(false)
      setForm({ influencer: "", name: "", description: "", monthly_budget: "", starts_at: "", ends_at: "", auto_renew: false })
      setSelectedInfluencer(null)
      setInfluencerQuery("")
      load()
    } catch (e) {
      toast({ variant: "destructive", title: t("ambassadors.error_creating"), description: apiErrorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-aurora-ink-3">{t("brand_dashboard.eyebrow", "Espace marque")}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5 flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />{t("ambassadors.title")}
          </h1>
          <p className="text-sm text-aurora-ink-3 mt-1">{t("ambassadors.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient"><Plus className="h-4 w-4 mr-2" />{t("ambassadors.new")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("ambassadors.new_title")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("ambassadors.influencer_label")}</Label>
                {selectedInfluencer ? (
                  <div className="mt-1 flex items-center justify-between gap-2 h-10 rounded-md border border-input bg-aurora-surface/60 px-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] font-semibold">
                          {(selectedInfluencer.display_name || "??").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-aurora-ink truncate">
                        {selectedInfluencer.display_name || `Influencer #${selectedInfluencer.id}`}
                      </span>
                    </span>
                    <button type="button" onClick={clearInfluencer} className="text-aurora-ink-3 hover:text-aurora-ink shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-aurora-ink-3" />
                    <Input
                      className="pl-9"
                      placeholder={t("ambassadors.search_placeholder", "Rechercher un influenceur (nom, pseudo)…")}
                      value={influencerQuery}
                      onChange={(e) => setInfluencerQuery(e.target.value)}
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-aurora-ink-3" />}
                    {influencerResults.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl border border-aurora-line bg-white shadow-soft-lg max-h-56 overflow-y-auto py-1">
                        {influencerResults.map((i) => (
                          <button
                            key={i.id}
                            type="button"
                            onClick={() => pickInfluencer(i)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-aurora-surface"
                          >
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] font-semibold">
                                {(i.display_name || "??").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{i.display_name || `Influencer #${i.id}`}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {influencerQuery.trim().length >= 2 && !searching && influencerResults.length === 0 && (
                      <p className="text-xs text-aurora-ink-3 mt-1">{t("ambassadors.search_no_result", "Aucun influenceur trouvé.")}</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label>{t("ambassadors.name_label")}</Label>
                <Input className="mt-1" placeholder={t("ambassadors.name_placeholder")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>{t("ambassadors.description_label")}</Label>
                <textarea className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder={t("ambassadors.description_placeholder")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("ambassadors.monthly_budget")}</Label>
                  <Input className="mt-1" type="number" placeholder="2000" value={form.monthly_budget} onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} />
                    {t("ambassadors.auto_renew")}
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("ambassadors.start_date")}</Label>
                  <Input className="mt-1" type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <Label>{t("ambassadors.end_date")}</Label>
                  <Input className="mt-1" type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("ambassadors.cancel")}</Button>
              <Button variant="gradient" onClick={create} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("ambassadors.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {programs.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-aurora-ink-3" />
          <Input
            className="pl-9"
            placeholder={t("ambassadors.filter_placeholder", "Filtrer par nom ou influenceur…")}
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("ambassadors.loading")}</div>
      ) : programs.length === 0 ? (
        <Card className="card-base"><CardContent className="py-16 text-center text-aurora-ink-3">{t("ambassadors.empty")}</CardContent></Card>
      ) : filteredPrograms.length === 0 ? (
        <Card className="card-base"><CardContent className="py-16 text-center text-aurora-ink-3">{t("ambassadors.no_match", "Aucun programme ne correspond à votre recherche.")}</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredPrograms.map((p) => (
            <Card key={p.id} className="card-base">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{t(`ambassadors.status_${p.status}`)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-semibold">
                      {(p.influencer_display_name || "??").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-aurora-ink">{p.influencer_display_name || `Influencer #${p.influencer}`}</p>
                    <p className="text-xs text-aurora-ink-3">€{p.monthly_budget ?? 0}{t("ambassadors.per_month")}</p>
                  </div>
                </div>
                {p.description && <p className="text-sm text-aurora-ink-2 line-clamp-2">{p.description}</p>}
                <div className="flex items-center gap-3 text-xs text-aurora-ink-3">
                  {p.starts_at && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.starts_at).toLocaleDateString(i18n.language)}</span>}
                  {p.ends_at && <span>→ {new Date(p.ends_at).toLocaleDateString(i18n.language)}</span>}
                  {p.auto_renew && <Badge variant="outline" className="text-[10px]">{t("ambassadors.auto_renew_badge")}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
