import { useState, useEffect, FormEvent, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import api from "@/lib/api"
import { BRAND_SECTOR_OPTIONS } from "@/lib/brandSectors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete"
import { Loader2, Upload } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

export default function BrandEditProfile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [validationStatus, setValidationStatus] = useState<string>("pending")
  const [validationNotes, setValidationNotes] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    company_name: "",
    siret: "",
    website: "",
    sector: "",
    description: "",
    billing_address: "",
    billing_postal_code: "",
    billing_city: "",
    billing_country: "FR",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSubmitted, setShowSubmitted] = useState(false)

  const refreshProfile = () => {
    return api.get("/auth/me/").then((res) => {
      const bp = res.data.brand_profile
      if (bp) {
        setForm((prev) => ({
          ...prev,
          first_name: res.data.first_name ?? prev.first_name,
          last_name: res.data.last_name ?? prev.last_name,
          company_name: bp.company_name ?? "",
          siret: bp.siret ?? "",
          website: bp.website ?? "",
          sector: bp.sector ?? "",
          description: bp.description ?? "",
          billing_address: bp.billing_address ?? "",
          billing_postal_code: bp.billing_postal_code ?? "",
          billing_city: bp.billing_city ?? "",
          billing_country: bp.billing_country || "FR",
        }))
        setLogoUrl(bp.logo ?? null)
        setValidationStatus(bp.validation_status ?? "pending")
        setValidationNotes(bp.validation_notes ?? "")
      }
    })
  }

  useEffect(() => {
    refreshProfile().catch(() => {})
  }, [])

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: t("brand_profile.logo_too_large", "Logo trop volumineux (max 5 Mo)") })
      return
    }
    setLogoUploading(true)
    const fd = new FormData()
    fd.append("logo_upload", file)
    try {
      const res = await api.patch("/brands/profile/", fd, { headers: { "Content-Type": "multipart/form-data" } })
      setLogoUrl(res.data.logo ?? null)
      toast({ title: t("brand_profile.logo_updated", "Logo mis à jour") })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  /** Mirrors the backend rules so the user sees the problem before the round-trip. */
  const validate = () => {
    const next: Record<string, string> = {}
    const siret = form.siret.replace(/\s+/g, "")
    if (!form.company_name.trim()) next.company_name = t("brand_profile.err_required", "Champ obligatoire")
    if (!siret) next.siret = t("brand_profile.err_required", "Champ obligatoire")
    else if (!/^\d{14}$/.test(siret)) next.siret = t("brand_profile.err_siret", "Le SIRET doit contenir exactement 14 chiffres.")
    if (!form.sector) next.sector = t("brand_profile.err_required", "Champ obligatoire")
    if (!form.website.trim()) next.website = t("brand_profile.err_required", "Champ obligatoire")
    if (!form.description.trim()) next.description = t("brand_profile.err_required", "Champ obligatoire")
    if (!form.billing_address.trim()) next.billing_address = t("brand_profile.err_required", "Champ obligatoire")
    const postal = form.billing_postal_code.replace(/\s+/g, "")
    if (!postal) next.billing_postal_code = t("brand_profile.err_required", "Champ obligatoire")
    else if (!/^[A-Za-z0-9-]{4,10}$/.test(postal)) next.billing_postal_code = t("brand_profile.err_postal", "Code postal invalide.")
    if (!form.billing_city.trim()) next.billing_city = t("brand_profile.err_required", "Champ obligatoire")
    if (form.billing_country && !/^[A-Za-z]{2}$/.test(form.billing_country.trim())) {
      next.billing_country = t("brand_profile.err_country", "Code pays ISO à 2 lettres (ex. FR).")
    }
    setErrors(next)
    return next
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate()
    if (Object.keys(found).length > 0) {
      // Previously the click did nothing at all when a field was wrong.
      toast({
        variant: "destructive",
        title: t("brand_profile.err_title", "Formulaire incomplet"),
        description: t("brand_profile.err_desc", "Corrigez les champs en rouge avant d'enregistrer."),
      })
      const firstInvalid = document.querySelector<HTMLElement>("[data-invalid='true']")
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setLoading(true)
    try {
      // The contact name lives on the user, not the brand profile: it used to
      // be collected here and silently dropped.
      await api.patch("/auth/me/", {
        first_name: form.first_name,
        last_name: form.last_name,
      })
      await api.patch("/brands/profile/", {
        company_name: form.company_name,
        siret: form.siret.replace(/\s+/g, ""),
        website: form.website,
        sector: form.sector,
        description: form.description,
        billing_address: form.billing_address,
        billing_postal_code: form.billing_postal_code.replace(/\s+/g, ""),
        billing_city: form.billing_city,
        billing_country: (form.billing_country || "FR").toUpperCase(),
      })
      await refreshProfile()
      setErrors({})
      toast({ title: t("common.success"), description: t("brand_profile.updated") })
      // Tell the user what happens next instead of leaving them guessing.
      if (validationStatus !== "approved") setShowSubmitted(true)
    } catch (err: any) {
      const data = err?.response?.data
      if (data && typeof data === "object") {
        const serverErrors: Record<string, string> = {}
        for (const [key, value] of Object.entries(data)) {
          serverErrors[key] = Array.isArray(value) ? String(value[0]) : String(value)
        }
        setErrors(serverErrors)
      }
      toast({ title: t("common.error"), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-aurora-ink-3">{t("brand_dashboard.eyebrow", "Espace marque")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("brand_profile.title")}</h1>
        <Badge variant={validationStatus === "approved" ? "purple" : validationStatus === "rejected" ? "destructive" : "outline"}>
          {t(`brand_profile.status_${validationStatus}`, validationStatus)}
        </Badge>
      </div>

      {validationStatus !== "approved" && (
        <Card className="card-base border-l-4 border-l-purple-500">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-aurora-ink">
                {validationStatus === "rejected"
                  ? t("brand_profile.banner_rejected_title", "Inscription refusée")
                  : t("brand_profile.banner_pending_title", "Validation requise")}
              </p>
              <p className="text-sm text-aurora-ink-2 mt-0.5">
                {validationStatus === "rejected" && validationNotes
                  ? validationNotes
                  : t("brand_profile.banner_pending_desc", "Complétez votre profil et soumettez-le pour validation.")}
              </p>
            </div>
            <Link to="/brand/onboarding">
              <Button variant="gradient" size="sm">{t("brand_profile.go_to_onboarding", "Voir l'onboarding")}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("brand_profile.contact_person")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label>{t("auth.first_name")}</Label><Input className="mt-1" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} /></div>
            <div><Label>{t("auth.last_name")}</Label><Input className="mt-1" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("brand_profile.company_info")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border border-aurora-line bg-aurora-surface flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" className="object-contain w-full h-full" />
                ) : (
                  <span className="text-xs text-aurora-ink-3">{t("brand_profile.no_logo", "Aucun logo")}</span>
                )}
              </div>
              <div className="flex-1">
                <Label>{t("brand_profile.logo", "Logo")}</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  <Button type="button" variant="outline" size="sm" disabled={logoUploading} onClick={() => fileInputRef.current?.click()}>
                    {logoUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {t("brand_profile.upload_logo", "Téléverser")}
                  </Button>
                  <span className="text-xs text-aurora-ink-3">{t("brand_profile.logo_hint", "PNG/JPG, 5 Mo max")}</span>
                </div>
              </div>
            </div>
            <div>
              <Label>{t("auth.company_name")} *</Label>
              <Input className="mt-1" value={form.company_name} data-invalid={!!errors.company_name}
                     aria-invalid={!!errors.company_name}
                     onChange={(e) => update("company_name", e.target.value)} />
              <FieldError message={errors.company_name} />
            </div>
            <div>
              <Label>{t("brand_profile.siret", "SIRET")} *</Label>
              <Input className="mt-1" value={form.siret} data-invalid={!!errors.siret}
                     aria-invalid={!!errors.siret}
                     onChange={(e) => update("siret", e.target.value)} placeholder="14 chiffres" maxLength={17} />
              <FieldError message={errors.siret} />
            </div>
            <div>
              <Label>{t("brand_profile.industry")} *</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.sector}
                onChange={(e) => update("sector", e.target.value)}
              >
                <option value="">{t("brand_profile.select_sector", "Sélectionnez un secteur")}</option>
                {!BRAND_SECTOR_OPTIONS.includes(form.sector as any) && form.sector && <option value={form.sector}>{form.sector}</option>}
                {BRAND_SECTOR_OPTIONS.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>
            <div><Label>{t("brand_profile.website")} *</Label><Input className="mt-1" type="url" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://..." /></div>
            <div>
              <Label>{t("brand_profile.company_description")} *</Label>
              <textarea className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.description} onChange={(e) => update("description", e.target.value)} />
            </div>
            <div>
              <Label>{t("brand_profile.billing_address", "Adresse de facturation")} *</Label>
              <div className="mt-1">
                <AddressAutocomplete
                  value={form.billing_address}
                  country={form.billing_country || "FR"}
                  invalid={!!errors.billing_address}
                  placeholder={t("brand_profile.address_placeholder", "N° et nom de rue")}
                  onChange={(street) => update("billing_address", street)}
                  onSelect={(s) =>
                    setForm((prev) => ({
                      ...prev,
                      billing_address: s.street || s.label,
                      billing_postal_code: s.postal_code || prev.billing_postal_code,
                      billing_city: s.city || prev.billing_city,
                      billing_country: s.country || prev.billing_country,
                    }))
                  }
                />
              </div>
              <FieldError message={errors.billing_address} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>{t("brand_profile.postal_code", "Code postal")} *</Label>
                <Input className="mt-1" value={form.billing_postal_code} data-invalid={!!errors.billing_postal_code}
                       aria-invalid={!!errors.billing_postal_code}
                       placeholder="75011" maxLength={10}
                       onChange={(e) => update("billing_postal_code", e.target.value)} />
                <FieldError message={errors.billing_postal_code} />
              </div>
              <div>
                <Label>{t("brand_profile.city", "Ville")} *</Label>
                <Input className="mt-1" value={form.billing_city} data-invalid={!!errors.billing_city}
                       aria-invalid={!!errors.billing_city}
                       placeholder="Paris"
                       onChange={(e) => update("billing_city", e.target.value)} />
                <FieldError message={errors.billing_city} />
              </div>
              <div>
                <Label>{t("brand_profile.country", "Pays")}</Label>
                <Input className="mt-1" value={form.billing_country} data-invalid={!!errors.billing_country}
                       aria-invalid={!!errors.billing_country}
                       placeholder="FR" maxLength={2}
                       onChange={(e) => update("billing_country", e.target.value.toUpperCase())} />
                <FieldError message={errors.billing_country} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Button type="submit" variant="gradient" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("common.save")}
        </Button>
      </form>

      <Dialog open={showSubmitted} onOpenChange={setShowSubmitted}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {validationStatus === "pending"
                ? t("brand_profile.saved_title_pending", "Modifications enregistrées")
                : t("brand_profile.saved_title", "Informations enregistrées")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-aurora-ink-2">
            {validationStatus === "pending" ? (
              <>
                <p>{t("brand_profile.saved_pending", "Vos informations sont enregistrées.")}</p>
                <p>
                  {t(
                    "brand_profile.saved_pending_next",
                    "Votre dossier est déjà en cours d'examen par notre équipe. Vos modifications ont été prises en compte : vous recevrez un email dès qu'il sera traité (48h ouvrées).",
                  )}
                </p>
              </>
            ) : validationStatus === "rejected" ? (
              <>
                <p>{t("brand_profile.saved_pending", "Vos informations sont enregistrées.")}</p>
                <p>
                  {t(
                    "brand_profile.saved_rejected_next",
                    "Votre dossier avait été refusé : soumettez-le à nouveau depuis la page Onboarding pour un nouvel examen.",
                  )}
                </p>
              </>
            ) : (
              <>
                <p>
                  {t(
                    "brand_profile.saved_review",
                    "Vos informations sont enregistrées. Votre dossier doit être vérifié par notre équipe avant que vous puissiez lancer des campagnes.",
                  )}
                </p>
                <p>
                  {t(
                    "brand_profile.saved_next",
                    "Rendez-vous sur la page Onboarding pour vérifier qu'il ne manque rien, puis soumettez votre dossier. Vous recevrez un email dès qu'il sera examiné (48h ouvrées).",
                  )}
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitted(false)}>
              {t("common.close", "Fermer")}
            </Button>
            {validationStatus !== "pending" && (
              <Button variant="gradient" onClick={() => navigate("/brand/onboarding")}>
                {t("brand_profile.go_to_onboarding", "Voir l'onboarding")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Inline validation message under a field. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-rose-600 mt-1">{message}</p>
}
