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
import { Loader2, Upload } from "lucide-react"
import { Link } from "react-router-dom"

export default function BrandEditProfile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
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
  })

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.patch("/brands/profile/", {
        company_name: form.company_name,
        siret: form.siret,
        website: form.website,
        sector: form.sector,
        description: form.description,
        billing_address: form.billing_address,
      })
      await refreshProfile()
      toast({ title: t("common.success"), description: t("brand_profile.updated") })
    } catch {
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
            <div><Label>{t("auth.company_name")} *</Label><Input className="mt-1" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} /></div>
            <div><Label>{t("brand_profile.siret", "SIRET")} *</Label><Input className="mt-1" value={form.siret} onChange={(e) => update("siret", e.target.value)} placeholder="14 chiffres" maxLength={14} /></div>
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
              <Label>{t("brand_profile.billing_address", "Adresse de facturation")}</Label>
              <textarea className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.billing_address} onChange={(e) => update("billing_address", e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Button type="submit" variant="gradient" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("common.save")}
        </Button>
      </form>
    </div>
  )
}
