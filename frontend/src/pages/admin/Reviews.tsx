import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchPendingReviews, publishReview, rejectReview } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, XCircle, Star } from "lucide-react"

interface ReviewItem {
  id: number
  rating: number
  comment: string
  reviewer_name: string
  reviewee_name: string
  criteria_ratings: Record<string, number>
  created_at: string
}

export default function AdminReviews() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = () => { setLoading(true); fetchPendingReviews().then(setItems).finally(() => setLoading(false)) }
  useEffect(load, [])

  const publish = async (id: number) => {
    setBusy(id)
    try { await publishReview(id); toast({ title: t("admin_reviews.published", "Avis publié") }); load() }
    catch { toast({ variant: "destructive", title: t("common.error") }) }
    finally { setBusy(null) }
  }
  const reject = async (id: number) => {
    const reason = prompt(t("admin_reviews.reject_reason", "Raison ?")) ?? ""
    if (!reason) return
    setBusy(id)
    try { await rejectReview(id, reason); toast({ title: t("admin_reviews.rejected", "Avis refusé") }); load() }
    catch { toast({ variant: "destructive", title: t("common.error") }) }
    finally { setBusy(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_reviews.title", "Modération des avis")}</h1>
      <Card className="card-base">
        <CardHeader><CardTitle>{t("admin_reviews.pending", "En attente")} ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">{t("admin_reviews.empty", "Aucun avis à modérer")}</p> : (
            <div className="space-y-3">
              {items.map((r) => (
                <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{r.reviewer_name}</span>
                      <span className="text-gray-400 text-sm">→</span>
                      <span className="text-gray-700 text-sm">{r.reviewee_name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= r.rating ? "fill-current" : "text-gray-200"}`} />)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{r.comment}</p>
                  {r.criteria_ratings && Object.keys(r.criteria_ratings).length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                      {Object.entries(r.criteria_ratings).map(([k, v]) => <span key={k} className="bg-gray-50 px-2 py-1 rounded">{k}: {v}/5</span>)}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="gradient" disabled={busy === r.id} onClick={() => publish(r.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />{t("admin_reviews.publish", "Publier")}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => reject(r.id)}>
                      <XCircle className="h-4 w-4 mr-1" />{t("admin_reviews.reject", "Refuser")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
