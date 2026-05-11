import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchSupportTickets, updateAdminSupportTicket, type SupportTicket } from "@/lib/apiExtra"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Building2, Crown, UserRound } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const REQUESTER_KIND_LABELS: Record<string, string> = {
  influencer: "admin_support.kind_influencer",
  brand: "admin_support.kind_brand",
  agency: "admin_support.kind_agency",
}

const REQUESTER_KIND_STYLES: Record<string, string> = {
  influencer: "bg-fuchsia-100 text-fuchsia-700",
  brand: "bg-sky-100 text-sky-700",
  agency: "bg-emerald-100 text-emerald-700",
}

const SOURCE_LANG_LABELS: Record<string, string> = {
  EN: "admin_support.lang_en",
  FR: "admin_support.lang_fr",
}

const REQUESTER_KIND_META: Record<string, { icon: typeof UserRound; tone: string }> = {
  influencer: { icon: UserRound, tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100" },
  brand: { icon: Building2, tone: "bg-sky-50 text-sky-700 border-sky-100" },
  agency: { icon: Crown, tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
}

const STATUS_OPTIONS: Array<SupportTicket["status"]> = ["open", "in_progress", "closed"]
const PRIORITY_OPTIONS: Array<SupportTicket["priority"]> = ["normal", "high", "urgent"]

function ProtectedImageThumb({ imageUrl }: { imageUrl: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    api.get(imageUrl, { responseType: "blob" })
      .then((res) => {
        if (!active) return
        objectUrl = window.URL.createObjectURL(res.data)
        setBlobUrl(objectUrl)
      })
      .catch(() => setBlobUrl(null))

    return () => {
      active = false
      if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    }
  }, [imageUrl])

  if (!blobUrl) return null

  return (
    <a href={blobUrl} target="_blank" rel="noopener noreferrer">
      <img src={blobUrl} alt="" className="h-20 w-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
    </a>
  )
}

export default function AdminSupport() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [replies, setReplies] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})

  const load = () => {
    setLoading(true)
    fetchSupportTickets().then(setItems).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const save = async (item: SupportTicket) => {
    setBusyId(item.id)
    try {
      await updateAdminSupportTicket(item.id, {
        status: item.status,
        priority: item.priority,
        admin_reply: replies[item.id] ?? item.admin_reply ?? "",
        admin_note: notes[item.id] ?? item.admin_note ?? "",
      })
      toast({ title: t("admin_support.saved") })
      load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_support.title")}</h1>
      <Card className="card-base">
        <CardHeader>
          <CardTitle>{t("admin_support.inbox")} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">{t("admin_support.empty")}</p>
          )}

          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-100 p-4 space-y-3">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {(() => {
                      const kind = item.requester_kind ?? "brand"
                      const meta = REQUESTER_KIND_META[kind] ?? REQUESTER_KIND_META.brand
                      const Icon = meta.icon
                      return (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.tone}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {t(REQUESTER_KIND_LABELS[kind] ?? REQUESTER_KIND_LABELS.brand)}
                        </span>
                      )
                    })()}
                    {item.source_language && SOURCE_LANG_LABELS[item.source_language] && (
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600">
                        {t(SOURCE_LANG_LABELS[item.source_language])}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900">{item.subject}</p>
                  <p className="text-xs text-gray-500">{item.requester_display_name || item.requester_email} · {item.requester_email} · {new Date(item.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-gray-200 px-2 text-sm"
                    value={item.priority}
                    onChange={(e) => setItems((arr) => arr.map((x) => x.id === item.id ? { ...x, priority: e.target.value as SupportTicket["priority"] } : x))}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{t(`admin_support.priority_${p}`)}</option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-gray-200 px-2 text-sm"
                    value={item.status}
                    onChange={(e) => setItems((arr) => arr.map((x) => x.id === item.id ? { ...x, status: e.target.value as SupportTicket["status"] } : x))}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{t(`admin_support.status_${s}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Message utilisateur */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t("admin_support.user_message")}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>
              </div>

              {/* Images du ticket */}
              {item.images && item.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.images.map((img) => (
                    <ProtectedImageThumb key={img.id} imageUrl={img.image_url} />
                  ))}
                </div>
              )}

              {/* Réponse publique (visible par l'utilisateur) */}
              <div>
                <label className="block text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">
                  {t("admin_support.reply_label")}
                </label>
                <textarea
                  value={replies[item.id] ?? item.admin_reply ?? ""}
                  placeholder={t("admin_support.reply_placeholder")}
                  onChange={(e) => setReplies((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md border border-indigo-200 bg-indigo-50/30 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Note interne (non visible par l'utilisateur) */}
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                  {t("admin_support.note_label")}
                </label>
                <textarea
                  value={notes[item.id] ?? item.admin_note ?? ""}
                  placeholder={t("admin_support.note_placeholder")}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <div className="flex justify-end">
                <Button size="sm" variant="gradient" disabled={busyId === item.id} onClick={() => save(item)}>
                  {busyId === item.id ? t("common.loading") : t("admin_support.save")}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
