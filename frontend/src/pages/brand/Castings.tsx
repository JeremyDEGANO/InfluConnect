import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { fetchCastingApplications, decideCastingApplication } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, XCircle, Loader2, Megaphone, Inbox } from "lucide-react"

interface Campaign {
  id: number
  title: string
  is_casting?: boolean
  status: string
  deadline: string | null
}

interface Application {
  id: number
  influencer: number
  influencer_display_name: string
  motivation: string
  examples: any[]
  status: "pending" | "selected" | "rejected"
  created_at: string
}

export default function BrandCastings() {
  const { t, i18n } = useTranslation()
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [appsLoading, setAppsLoading] = useState(false)
  const [acting, setActing] = useState<number | null>(null)

  useEffect(() => {
    api.get("/campaigns/")
      .then((r) => {
        const all: Campaign[] = r.data.results ?? r.data
        setCampaigns(all.filter((c) => (c as any).is_casting))
      })
      .finally(() => setLoading(false))
  }, [])

  const openCampaign = async (c: Campaign) => {
    setSelected(c)
    setAppsLoading(true)
    try {
      const r = await fetchCastingApplications(c.id)
      setApps((r as any).results ?? r)
    } finally {
      setAppsLoading(false)
    }
  }

  const decide = async (appId: number, decision: "selected" | "rejected") => {
    setActing(appId)
    try {
      await decideCastingApplication(appId, decision)
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: decision } : a))
      toast({ title: decision === "selected" ? t("castings_brand.selected_toast") : t("castings_brand.rejected_toast") })
    } catch (e: any) {
      toast({ variant: "destructive", title: t("common.error"), description: e?.response?.data?.detail })
    } finally {
      setActing(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-indigo-600" />
          {t("castings_brand.title")}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">{t("castings_brand.subtitle")}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Campaign list */}
        <Card className="card-base lg:col-span-1">
          <CardHeader><CardTitle className="text-base">{t("castings_brand.your_castings")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {campaigns.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t("castings_brand.empty_castings")}</p>
            ) : campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => openCampaign(c)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id === c.id
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="font-semibold text-sm text-gray-900 truncate">{c.title}</div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="info" className="text-xs">{c.status}</Badge>
                  {c.deadline && <span className="text-xs text-gray-400">{t("castings_brand.until")} {new Date(c.deadline).toLocaleDateString(i18n.language)}</span>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Applications */}
        <Card className="card-base lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              {t("castings_brand.applications")} {selected ? `– ${selected.title}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-gray-400 text-center py-12">{t("castings_brand.pick_prompt")}</p>
            ) : appsLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : apps.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t("castings_brand.no_applications")}</p>
            ) : (
              <div className="space-y-3">
                {apps.map((a) => (
                  <div key={a.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-violet-600 text-white text-sm font-semibold">
                            {(a.influencer_display_name || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{a.influencer_display_name}</p>
                          <p className="text-xs text-gray-400">{t("castings_brand.applied_on")} {new Date(a.created_at).toLocaleDateString(i18n.language)}</p>
                        </div>
                      </div>
                      <Badge variant={a.status === "selected" ? "success" : a.status === "rejected" ? "destructive" : "info"}>
                        {a.status === "pending" ? t("castings_brand.status_pending") : a.status === "selected" ? t("castings_brand.status_selected") : t("castings_brand.status_rejected")}
                      </Badge>
                    </div>

                    {a.motivation && (
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 italic">« {a.motivation} »</p>
                    )}

                    {a.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="gradient" disabled={acting === a.id} onClick={() => decide(a.id, "selected")}>
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />{t("castings_brand.select")}
                        </Button>
                        <Button size="sm" variant="outline" disabled={acting === a.id} onClick={() => decide(a.id, "rejected")}>
                          <XCircle className="h-4 w-4 mr-1.5" />{t("castings_brand.reject")}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
