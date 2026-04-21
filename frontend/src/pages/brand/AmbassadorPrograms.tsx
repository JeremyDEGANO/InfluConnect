import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
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
import { Crown, Loader2, Plus, Calendar } from "lucide-react"

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
  const [influencers, setInfluencers] = useState<InfluencerLite[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    influencer: "", name: "", description: "", monthly_budget: "",
    starts_at: "", ends_at: "", auto_renew: false,
  })

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchAmbassadorPrograms().then((d) => setPrograms((d as any).results ?? d as AmbassadorProgram[])),
      api.get("/influencers/").then((r) => setInfluencers(r.data.results ?? r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
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
      load()
    } catch {
      toast({ variant: "destructive", title: t("ambassadors.error_creating") })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />{t("ambassadors.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("ambassadors.subtitle")}</p>
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
                <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.influencer} onChange={(e) => setForm({ ...form, influencer: e.target.value })}>
                  <option value="">{t("ambassadors.pick_placeholder")}</option>
                  {influencers.map((i) => <option key={i.id} value={i.id}>{i.display_name || `Influencer #${i.id}`}</option>)}
                </select>
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

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("ambassadors.loading")}</div>
      ) : programs.length === 0 ? (
        <Card className="card-base"><CardContent className="py-16 text-center text-gray-400">{t("ambassadors.empty")}</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {programs.map((p) => (
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
                    <p className="text-sm font-medium text-gray-900">{p.influencer_display_name || `Influencer #${p.influencer}`}</p>
                    <p className="text-xs text-gray-500">€{p.monthly_budget ?? 0}{t("ambassadors.per_month")}</p>
                  </div>
                </div>
                {p.description && <p className="text-sm text-gray-600 line-clamp-2">{p.description}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-500">
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
