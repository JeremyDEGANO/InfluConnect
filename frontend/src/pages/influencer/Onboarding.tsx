import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { fetchOnboarding, fetchReference, type OnboardingStatus, type ReferenceData } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react"

const FALLBACK_LABELS: Record<string, string> = {
  avatar: "Photo de profil", bio: "Biographie", display_name: "Pseudo",
  location: "Ville", languages: "Langues", content_themes: "Thématiques",
  content_types_offered: "Types de contenu", pricing: "Tarifs",
  social_networks: "Réseaux sociaux", media_kit_images: "Images du kit média",
  collaboration_pitch: "Pourquoi collaborer avec vous", payment_method: "Paiement",
}

export default function Onboarding() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchOnboarding().then(setStatus),
      fetchReference().then(setReference).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  const labels = reference?.completion_labels ?? FALLBACK_LABELS
  const friendlyMissing = (status?.missing_fields ?? []).map((f) => labels[f] ?? f)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("influencer_dashboard.eyebrow", "Espace créateur")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("onboarding.title", "Complétez votre profil")}</h1>
      <Card className="card-base">
        <CardHeader><CardTitle>{t("onboarding.completion", "Progression")} : {status?.completion_percent ?? 0}%</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Progress value={status?.completion_percent ?? 0} />
          {status?.onboarding_completed ? (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-5 w-5" />
              {t("onboarding.completed", "Profil complet – prêt à recevoir des propositions")}
            </div>
          ) : (
            <div>
              <p className="text-sm text-aurora-ink-2 mb-2">{t("onboarding.missing", "Étapes restantes")} :</p>
              <ul className="text-sm text-aurora-ink-3 space-y-1 list-disc list-inside">
                {friendlyMissing.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          <Link to="/influencer/profile/edit">
            <Button variant="gradient" className="w-full">
              {t("onboarding.go_edit", "Compléter mon profil")} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
