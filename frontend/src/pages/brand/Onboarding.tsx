import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { fetchBrandOnboarding, submitBrandForValidation, type BrandOnboardingStatus } from "@/lib/apiExtra"
import { CheckCircle2, Circle, Loader2, Send, AlertTriangle } from "lucide-react"

const FIELD_LABELS: Record<string, string> = {
  company_name: "brand_onboarding.field_company_name",
  siret: "brand_onboarding.field_siret",
  website: "brand_onboarding.field_website",
  sector: "brand_onboarding.field_sector",
  description: "brand_onboarding.field_description",
  logo: "brand_onboarding.field_logo",
}
const ALL_FIELDS = ["company_name", "siret", "website", "sector", "description", "logo"]

export default function BrandOnboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [status, setStatus] = useState<BrandOnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    fetchBrandOnboarding()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const submit = async () => {
    setSubmitting(true)
    try {
      const next = await submitBrandForValidation()
      setStatus(next)
      toast({ title: t("brand_onboarding.submitted_title", "Profil envoyé pour validation"), description: t("brand_onboarding.submitted_desc", "Notre équipe va l'examiner sous 48h.") })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || t("common.error")
      toast({ variant: "destructive", title: msg })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  if (!status) return <div className="p-6 text-center text-gray-500">{t("common.error")}</div>

  const missing = new Set(status.missing_fields)
  const statusColor = status.validation_status === "approved" ? "purple" : status.validation_status === "rejected" ? "destructive" : "outline"

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("brand_onboarding.title", "Onboarding marque")}</h1>
        <Badge variant={statusColor}>{t(`brand_profile.status_${status.validation_status}`, status.validation_status)}</Badge>
      </div>

      {status.validation_status === "approved" ? (
        <Card className="card-base border-l-4 border-l-green-500">
          <CardContent className="py-6 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-semibold text-gray-900">{t("brand_onboarding.approved_title", "Compte validé")}</p>
              <p className="text-sm text-gray-600">{t("brand_onboarding.approved_desc", "Vous pouvez créer vos campagnes et lancer vos collaborations.")}</p>
            </div>
            <Button className="ml-auto" variant="gradient" onClick={() => navigate("/brand/campaigns/new")}>{t("brand_onboarding.create_campaign", "Créer une campagne")}</Button>
          </CardContent>
        </Card>
      ) : status.validation_status === "rejected" ? (
        <Card className="card-base border-l-4 border-l-red-500">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <p className="font-semibold text-gray-900">{t("brand_onboarding.rejected_title", "Inscription refusée")}</p>
            </div>
            {status.validation_notes && (
              <p className="text-sm text-gray-700 bg-red-50 border border-red-100 rounded-lg p-3 mt-2">
                <span className="font-semibold">{t("brand_onboarding.reason", "Motif")} : </span>{status.validation_notes}
              </p>
            )}
            <p className="text-sm text-gray-600 mt-3">{t("brand_onboarding.rejected_desc", "Corrigez les éléments puis soumettez à nouveau votre profil.")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="card-base border-l-4 border-l-purple-500">
          <CardContent className="py-6">
            <p className="font-semibold text-gray-900">{t("brand_onboarding.pending_title", "Validation en cours")}</p>
            <p className="text-sm text-gray-600 mt-1">{t("brand_onboarding.pending_desc", "Votre profil est en attente de validation par notre équipe (48h ouvrées max).")}</p>
          </CardContent>
        </Card>
      )}

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-base">{t("brand_onboarding.checklist_title", "Pré-requis pour la validation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ALL_FIELDS.map((f) => {
            const ok = !missing.has(f)
            return (
              <div key={f} className="flex items-center gap-2 text-sm">
                {ok ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-gray-300" />}
                <span className={ok ? "text-gray-700" : "text-gray-500"}>{t(FIELD_LABELS[f], f)}</span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Link to="/brand/profile">
          <Button variant="outline">{t("brand_onboarding.edit_profile", "Modifier mon profil")}</Button>
        </Link>
        {status.validation_status !== "approved" && (
          <Button variant="gradient" disabled={!status.ready_to_submit || submitting || status.validation_status === "pending"} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {status.validation_status === "pending"
              ? t("brand_onboarding.already_pending", "En attente de validation")
              : t("brand_onboarding.submit", "Soumettre pour validation")}
          </Button>
        )}
      </div>
    </div>
  )
}
