import { Fragment, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchAdminOverview, updateAdminBrand, type AdminOverviewBrand } from "@/lib/apiExtra"
import { BRAND_SECTOR_OPTIONS } from "@/lib/brandSectors"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronDown, ChevronUp, Building2, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-aurora-surface text-aurora-ink-2",
  growth: "bg-blue-100 text-blue-700",
  pro: "bg-emerald-100 text-emerald-700",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
}

function money(value: number) {
  return `EUR ${Number(value ?? 0).toLocaleString()}`
}

export default function AdminCompanies() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<AdminOverviewBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [editingCompany, setEditingCompany] = useState<AdminOverviewBrand | null>(null)
  const [editCompanyName, setEditCompanyName] = useState("")
  const [editWebsite, setEditWebsite] = useState("")
  const [editSector, setEditSector] = useState("")
  const [editValidationNotes, setEditValidationNotes] = useState("")
  const [editValidationStatus, setEditValidationStatus] = useState<"pending" | "approved" | "rejected">("pending")
  const [editPlan, setEditPlan] = useState<"starter" | "growth" | "pro" | "">("")
  const [editPriceOverride, setEditPriceOverride] = useState("")

  const load = () => {
    setLoading(true)
    fetchAdminOverview()
      .then((d) => setItems(d.brands ?? []))
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [t, toast])

  const openEditCompany = (brand: AdminOverviewBrand) => {
    setEditingCompany(brand)
    setEditCompanyName(brand.company_name || "")
    setEditWebsite(brand.website || "")
    setEditSector(brand.sector || "")
    setEditValidationNotes(brand.validation_notes || "")
    setEditValidationStatus(brand.validation_status || "pending")
    setEditPlan(brand.subscription_plan || "")
    setEditPriceOverride(brand.subscription_price_override != null ? String(brand.subscription_price_override) : "")
  }

  const submitEditCompany = async () => {
    if (!editingCompany) return
    if (!editCompanyName.trim()) {
      toast({ variant: "destructive", title: t("common.error"), description: t("admin_brands.edit_company", "Entreprise") })
      return
    }

    setBusyId(editingCompany.id)
    try {
      await updateAdminBrand(editingCompany.id, {
        company_name: editCompanyName.trim(),
        website: editWebsite.trim(),
        sector: editSector.trim(),
        validation_notes: editValidationNotes.trim(),
        validation_status: editValidationStatus,
        ...(editPlan ? { subscription_plan: editPlan } : {}),
        subscription_price_override: editPriceOverride.trim() === "" ? null : editPriceOverride.trim(),
      })
      toast({ title: t("admin_brands.updated", "Marque mise à jour") })
      setEditingCompany(null)
      load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setBusyId(null)
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((b) => {
      const haystack = [
        b.company_name,
        b.owner_name,
        b.email,
        b.website,
        b.sector,
        b.siret,
        b.validation_status,
        b.subscription_plan,
      ].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-aurora-ink-2" />
        <p className="text-sm text-aurora-ink-3">{t("admin_page.eyebrow", "Administration")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("admin_companies.title")}</h1>
      </div>

      <Card className="card-base">
        <CardHeader>
          <CardTitle>{t("admin_page.company_list")} ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin_page.search_companies")}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aurora-surface text-xs text-aurora-ink-3 uppercase">
                <tr>
                  <th className="text-left py-2 px-3">{t("admin_page.col_company")}</th>
                  <th className="text-left py-2 px-3">{t("admin_page.col_plan")}</th>
                  <th className="text-center py-2 px-3">{t("admin_page.col_status")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_mrr")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_team")}</th>
                  <th className="text-right py-2 px-3">{t("common.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((b) => {
                  const key = String(b.id)
                  const isExpanded = expandedId === key
                  return (
                    <Fragment key={b.id}>
                      <tr
                        className="border-t border-aurora-line hover:bg-aurora-surface cursor-pointer"
                        onClick={() => setExpandedId((current) => (current === key ? null : key))}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-aurora-ink-3" /> : <ChevronDown className="h-3.5 w-3.5 text-aurora-ink-3" />}
                            <div>
                              <p className="font-medium text-aurora-ink">{b.company_name}</p>
                              <p className="text-xs text-aurora-ink-3">{b.owner_name} · {b.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3"><Badge className={PLAN_COLORS[b.subscription_plan || "starter"]}>{b.subscription_plan || "-"}</Badge></td>
                        <td className="py-2 px-3 text-center"><Badge className={STATUS_COLORS[b.validation_status]}>{b.validation_status}</Badge></td>
                        <td className="py-2 px-3 text-right font-medium">{money(b.plan_price_monthly)}</td>
                        <td className="py-2 px-3 text-right">{b.team_size}</td>
                        <td className="py-2 px-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === b.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditCompany(b)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t("admin_brands.edit_company_cta", "Modifier l'entreprise")}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-aurora-line bg-aurora-surface/50">
                          <td colSpan={6} className="px-4 py-3 text-xs text-aurora-ink-2">
                            <div className="grid md:grid-cols-3 gap-3">
                              <div>
                                <p><span className="text-aurora-ink-3">{t("admin_page.website")}: </span>{b.website || "-"}</p>
                                <p><span className="text-aurora-ink-3">{t("admin_page.sector")}: </span>{b.sector || "-"}</p>
                                <p><span className="text-aurora-ink-3">SIRET: </span>{b.siret || "-"}</p>
                              </div>
                              <div>
                                <p><span className="text-aurora-ink-3">{t("admin_page.campaigns")}: </span>{b.campaigns_count}</p>
                                <p><span className="text-aurora-ink-3">{t("admin_page.subscription_active")}: </span>{b.subscription_active ? t("common.yes", "Oui") : t("common.no", "Non")}</p>
                                <p><span className="text-aurora-ink-3">{t("admin_page.subscription_expires")}: </span>{b.subscription_expires_at ? new Date(b.subscription_expires_at).toLocaleDateString() : "-"}</p>
                              </div>
                              <div>
                                <p><span className="text-aurora-ink-3">{t("admin_page.validated_by")}: </span>{b.validated_by_username || "-"}</p>
                                <p><span className="text-aurora-ink-3">{t("admin_page.days_since_signup")}: </span>{b.days_since_signup}</p>
                                <p><span className="text-aurora-ink-3">{t("admin_page.validation_note")}: </span>{b.validation_notes || "-"}</p>
                                <div className="pt-2">
                                  <Button size="sm" variant="outline" disabled={busyId === b.id} onClick={() => openEditCompany(b)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                    {t("admin_brands.edit_company_cta", "Modifier l'entreprise")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-aurora-ink-3">{t("admin_page.empty_companies")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("common.edit", "Modifier")} {editingCompany?.company_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>{t("admin_brands.edit_company", "Entreprise")}</Label>
              <Input value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} className="mt-1" />
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
            <div>
              <Label>{t("admin_page.col_status", "Statut")}</Label>
              <select
                value={editValidationStatus}
                onChange={(e) => setEditValidationStatus((e.target.value as "pending" | "approved" | "rejected") || "pending")}
                className="mt-1 w-full h-10 rounded-md border border-aurora-line bg-white px-3 text-sm"
              >
                <option value="pending">{t("status.pending", "En attente")}</option>
                <option value="approved">{t("admin_brands.status_approved", "Approuvé")}</option>
                <option value="rejected">{t("admin_brands.status_rejected", "Refusé")}</option>
              </select>
            </div>
            <div>
              <Label>{t("admin_brands.edit_notes", "Note admin")}</Label>
              <Input value={editValidationNotes} onChange={(e) => setEditValidationNotes(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{t("admin_brands.edit_plan", "Abonnement")}</Label>
              <select
                value={editPlan}
                onChange={(e) => setEditPlan((e.target.value as "starter" | "growth" | "pro") || "")}
                className="mt-1 w-full h-10 rounded-md border border-aurora-line bg-white px-3 text-sm"
              >
                <option value="">-</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div>
              <Label>{t("admin_brands.edit_price_override", "Tarif négocié (€/mois)")}</Label>
              <Input
                type="number"
                min={0}
                value={editPriceOverride}
                onChange={(e) => setEditPriceOverride(e.target.value)}
                placeholder={t("admin_brands.edit_price_override_ph", "Vide = tarif global du plan")}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(null)}>{t("common.cancel", "Annuler")}</Button>
            <Button variant="gradient" disabled={busyId === editingCompany?.id} onClick={submitEditCompany}>
              {busyId === editingCompany?.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("common.save", "Enregistrer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
