import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchPendingBrands, approveBrand, rejectBrand, type BrandPending } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

export default function AdminBrands() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<BrandPending[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    fetchPendingBrands().then(setItems).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const approve = async (id: number) => {
    setBusy(id)
    try {
      await approveBrand(id)
      toast({ title: t("admin_brands.approved", "Marque approuvée") })
      load()
    } catch { toast({ variant: "destructive", title: t("common.error") }) }
    finally { setBusy(null) }
  }
  const reject = async (id: number) => {
    const reason = prompt(t("admin_brands.reject_reason", "Raison du refus ?")) ?? ""
    if (!reason) return
    setBusy(id)
    try {
      await rejectBrand(id, reason)
      toast({ title: t("admin_brands.rejected", "Marque refusée") })
      load()
    } catch { toast({ variant: "destructive", title: t("common.error") }) }
    finally { setBusy(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_brands.title", "Validation des marques")}</h1>
      <Card className="card-base">
        <CardHeader><CardTitle>{t("admin_brands.pending", "En attente")} ({items.filter(b => b.validation_status === "pending").length})</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t("admin_brands.empty", "Aucune marque à valider")}</p>
          ) : (
            <div className="space-y-3">
              {items.map((b) => (
                <div key={b.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{b.company_name}</p>
                    <p className="text-xs text-gray-500">{b.user_name} · {b.user_email}</p>
                    {b.siret && <p className="text-xs text-gray-400 mt-0.5">SIRET: {b.siret}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(b.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.validation_status === "pending" ? "outline" : b.validation_status === "approved" ? "purple" : "destructive"}>
                      {b.validation_status}
                    </Badge>
                    {b.validation_status === "pending" && (
                      <>
                        <Button size="sm" variant="gradient" disabled={busy === b.id} onClick={() => approve(b.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />{t("admin_brands.approve", "Approuver")}
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy === b.id} onClick={() => reject(b.id)}>
                          <XCircle className="h-4 w-4 mr-1" />{t("admin_brands.reject", "Refuser")}
                        </Button>
                      </>
                    )}
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
