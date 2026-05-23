import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchPendingBrands, approveBrand, rejectBrand, updateAdminBrand, type BrandPending } from "@/lib/apiExtra"
import { BRAND_SECTOR_OPTIONS } from "@/lib/brandSectors"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp, Pencil } from "lucide-react"

export default function AdminBrands() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<BrandPending[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")
  const [editingBrand, setEditingBrand] = useState<BrandPending | null>(null)
  const [editCompany, setEditCompany] = useState("")
  const [editWebsite, setEditWebsite] = useState("")
  const [editSector, setEditSector] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editStatus, setEditStatus] = useState<"pending" | "approved" | "rejected">("pending")

  const load = () => {
    setLoading(true)
    fetchPendingBrands("all").then(setItems).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((b) => {
      if (statusFilter !== "all" && b.validation_status !== statusFilter) return false
      const haystack = [
        b.company_name,
        b.user_name,
        b.user_email,
        b.website,
        b.siret,
        b.sector,
        b.validation_status,
      ].join(" ").toLowerCase()
      return !q || haystack.includes(q)
    })
  }, [items, search, statusFilter])

  const approve = async (id: number) => {
    setBusy(id)
    try {
      await approveBrand(id)
      toast({ title: t("admin_brands.approved", "Marque approuvée") })
      setItems((prev) => prev.filter((it) => it.id !== id))
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
      setItems((prev) => prev.filter((it) => it.id !== id))
    } catch { toast({ variant: "destructive", title: t("common.error") }) }
    finally { setBusy(null) }
  }

  const openEditBrand = (brand: BrandPending) => {
    setEditingBrand(brand)
    setEditCompany(brand.company_name || "")
    setEditWebsite(brand.website || "")
    setEditSector(brand.sector || "")
    setEditDescription(brand.description || "")
    setEditNotes(brand.validation_notes || "")
    setEditStatus((brand.validation_status as "pending" | "approved" | "rejected") || "pending")
  }

  const submitEditBrand = async () => {
    if (!editingBrand) return
    if (!editCompany.trim()) {
      toast({ variant: "destructive", title: t("common.error"), description: t("admin_brands.edit_company", "Entreprise") })
      return
    }

    setBusy(editingBrand.id)
    try {
      await updateAdminBrand(editingBrand.id, {
        company_name: editCompany.trim(),
        website: editWebsite.trim(),
        sector: editSector.trim(),
        description: editDescription.trim(),
        validation_notes: editNotes.trim(),
        validation_status: editStatus,
      })
      toast({ title: t("admin_brands.updated", "Marque mise à jour") })
      setEditingBrand(null)
      load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("admin_page.eyebrow", "Administration")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("admin_brands.title", "Validation des marques")}</h1>
      <Card className="card-base">
        <CardHeader><CardTitle>{t("admin_brands.pending", "En attente")} ({filteredItems.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin_brands.search", "Rechercher entreprise, email, statut...")} />
            <div className="flex items-center gap-2">
              {(["all", "pending", "approved", "rejected"] as const).map((value) => (
                <Button key={value} size="sm" variant={statusFilter === value ? "default" : "outline"} onClick={() => setStatusFilter(value)}>
                  {value === "all" ? t("admin_brands.filter_all", "Tous") : t(`status.${value}`, value)}
                </Button>
              ))}
            </div>
          </div>
          {filteredItems.length === 0 ? (
            <p className="text-sm text-aurora-ink-3 text-center py-8">{t("admin_brands.empty", "Aucune marque à valider")}</p>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((b) => (
                <div key={b.id} className="border border-aurora-line rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setExpandedId((current) => (current === b.id ? null : b.id))}
                    >
                      <p className="font-semibold text-aurora-ink flex items-center gap-1">
                        {expandedId === b.id ? <ChevronUp className="h-4 w-4 text-aurora-ink-3" /> : <ChevronDown className="h-4 w-4 text-aurora-ink-3" />}
                        {b.company_name}
                      </p>
                      <p className="text-xs text-aurora-ink-3">{b.user_name} · {b.user_email}</p>
                    </button>
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <Badge variant={b.validation_status === "pending" ? "outline" : b.validation_status === "approved" ? "purple" : "destructive"}>
                        {t(`status.${b.validation_status}`, b.validation_status)}
                      </Badge>
                      <Button size="sm" variant="outline" disabled={busy === b.id} onClick={() => openEditBrand(b)}>
                        <Pencil className="h-3.5 w-3.5" />
                        {t("admin_brands.edit_company_cta", "Modifier l'entreprise")}
                      </Button>
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
                  {expandedId === b.id && (
                    <div className="grid md:grid-cols-2 gap-3 text-xs text-aurora-ink-2 bg-aurora-surface rounded-lg p-3">
                      {b.logo && (
                        <div className="md:col-span-2">
                          <img src={b.logo} alt={b.company_name} className="h-16 w-16 rounded-lg border border-aurora-line object-cover" />
                        </div>
                      )}
                      <p><span className="text-aurora-ink-3">SIRET: </span>{b.siret || "-"}</p>
                      <p><span className="text-aurora-ink-3">Secteur: </span>{b.sector || "-"}</p>
                      <p className="md:col-span-2"><span className="text-aurora-ink-3">Site: </span>{b.website || "-"}</p>
                      <p className="md:col-span-2"><span className="text-aurora-ink-3">Description: </span>{b.description || "-"}</p>
                      <p><span className="text-aurora-ink-3">Créé le: </span>{new Date(b.created_at).toLocaleDateString()}</p>
                      <p><span className="text-aurora-ink-3">Note admin: </span>{b.validation_notes || "-"}</p>
                      <div className="md:col-span-2 pt-2">
                        <Button size="sm" variant="outline" disabled={busy === b.id} onClick={() => openEditBrand(b)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {t("admin_brands.edit_company_cta", "Modifier l'entreprise")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingBrand} onOpenChange={(open) => !open && setEditingBrand(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("common.edit", "Modifier")} {editingBrand?.company_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>{t("admin_brands.edit_company", "Entreprise")}</Label>
              <Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin_brands.edit_website", "Site web")}</Label>
              <Input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin_brands.edit_sector", "Secteur")}</Label>
              <select
                value={editSector}
                onChange={(e) => setEditSector(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-aurora-line bg-white px-3 text-sm"
              >
                <option value="">{t("brand_profile.select_sector", "Sélectionnez un secteur")}</option>
                {!BRAND_SECTOR_OPTIONS.includes(editSector as any) && editSector ? <option value={editSector}>{editSector}</option> : null}
                {BRAND_SECTOR_OPTIONS.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>{t("admin_brands.edit_description", "Description")}</Label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="mt-1 w-full min-h-[90px] rounded-md border border-aurora-line bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <Label>{t("admin_page.col_status", "Statut")}</Label>
              <select value={editStatus} onChange={(e) => setEditStatus((e.target.value as "pending" | "approved" | "rejected") || "pending")} className="mt-1 w-full h-10 rounded-md border border-aurora-line bg-white px-3 text-sm">
                <option value="pending">{t("status.pending", "Pending")}</option>
                <option value="approved">{t("admin_brands.status_approved", "Approuvé")}</option>
                <option value="rejected">{t("admin_brands.status_rejected", "Refusé")}</option>
              </select>
            </div>
            <div>
              <Label>{t("admin_brands.edit_notes", "Note admin")}</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBrand(null)}>{t("common.cancel", "Annuler")}</Button>
            <Button variant="gradient" disabled={busy === editingBrand?.id} onClick={submitEditBrand}>
              {busy === editingBrand?.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("common.save", "Enregistrer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
