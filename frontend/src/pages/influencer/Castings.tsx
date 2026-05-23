import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchCastings, applyCastingForCampaign } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Megaphone, Calendar, DollarSign, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { resolveMediaUrl } from "@/lib/utils"
import { BrandHoverCard } from "@/components/shared/BrandHoverCard"

interface Casting {
  id: number
  brand: number
  title: string
  description: string
  brand_name: string
  brand_logo?: string | null
  price_per_influencer: number | null
  deadline: string | null
  target_networks: string[]
  casting_criteria: Record<string, any>
}

export default function Castings() {
  const { t, i18n } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<Casting[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchCastings()
      .then((d) => setItems((d as any).results ?? d as Casting[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const apply = async (id: number) => {
    setSending(true)
    try {
      await applyCastingForCampaign(id, message)
      setAppliedIds((prev) => new Set(prev).add(id))
      toast({ title: t("castings_influencer.sent") })
      setOpen(null)
      setMessage("")
    } catch {
      toast({ variant: "destructive", title: t("castings_influencer.error") })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-aurora-ink-3">{t("influencer_dashboard.eyebrow", "Espace créateur")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5 flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-indigo-500" />{t("castings_influencer.title")}
        </h1>
        <p className="text-sm text-aurora-ink-3 mt-1">{t("castings_influencer.subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("castings_influencer.loading")}</div>
      ) : items.length === 0 ? (
        <Card className="card-base"><CardContent className="py-16 text-center text-aurora-ink-3">{t("castings_influencer.empty")}</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((c) => {
            const applied = appliedIds.has(c.id)
            return (
              <Card key={c.id} className="card-base">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <Badge variant="info">Casting</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <BrandHoverCard brandId={c.brand} brandName={c.brand_name || ""} brandLogo={c.brand_logo}>
                      <a href={`/influencer/brands/${c.brand}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 group cursor-pointer">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={resolveMediaUrl(c.brand_logo)} alt={c.brand_name} />
                          <AvatarFallback className="bg-aurora-ink text-white text-[10px] font-semibold">
                            {(c.brand_name || "??").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-xs text-aurora-ink-3 truncate group-hover:text-aurora-blue transition-colors">{c.brand_name}</p>
                      </a>
                    </BrandHoverCard>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-aurora-ink-2 line-clamp-3">{c.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-aurora-ink-3">
                    {c.price_per_influencer && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />€{c.price_per_influencer}</span>}
                    {c.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(c.deadline).toLocaleDateString(i18n.language)}</span>}
                  </div>
                  {c.target_networks?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.target_networks.map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                    </div>
                  )}
                  {applied ? (
                    <Button size="sm" variant="outline" disabled className="w-full">{t("castings_influencer.applied")}</Button>
                  ) : (
                    <Dialog open={open === c.id} onOpenChange={(o) => setOpen(o ? c.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="gradient" className="w-full">
                          <Send className="h-3.5 w-3.5 mr-2" />{t("castings_influencer.apply")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{t("castings_influencer.apply_to")} Â« {c.title} Â»</DialogTitle></DialogHeader>
                        <div className="space-y-2">
                          <p className="text-sm text-aurora-ink-2">{t("castings_influencer.intro")}</p>
                          <textarea
                            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={t("castings_influencer.placeholder")}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpen(null)}>{t("castings_influencer.cancel")}</Button>
                          <Button variant="gradient" onClick={() => apply(c.id)} disabled={sending || !message.trim()}>
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("castings_influencer.send")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
