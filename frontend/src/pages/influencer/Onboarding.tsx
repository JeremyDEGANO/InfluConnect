import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { fetchOnboarding, fetchReference, generateMediaKit, type OnboardingStatus, type ReferenceData } from "@/lib/apiExtra"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Loader2, FileText, ArrowRight, CheckCircle2, Download } from "lucide-react"

const FALLBACK_LABELS: Record<string, string> = {
  avatar: "Photo de profil", bio: "Biographie", display_name: "Pseudo",
  location: "Ville", languages: "Langues", content_themes: "Thématiques",
  content_types_offered: "Types de contenu", pricing: "Tarifs",
  social_networks: "Réseaux sociaux", payment_method: "Paiement",
}

// Resolve relative media URL to absolute against API base
const apiOrigin = (() => {
  try { return new URL(api.defaults.baseURL ?? "").origin } catch { return "" }
})()
const absoluteUrl = (u: string | null | undefined): string => {
  if (!u) return ""
  if (/^https?:/i.test(u)) return u
  return apiOrigin + u
}

export default function Onboarding() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [mediaKitUrl, setMediaKitUrl] = useState<string>("")
  const [mediaKitDate, setMediaKitDate] = useState<string>("")

  useEffect(() => {
    Promise.all([
      fetchOnboarding().then(setStatus),
      fetchReference().then(setReference).catch(() => {}),
      // Pre-load existing media kit (if any)
      api.get("/auth/me/").then((r) => {
        const ip = r.data?.influencer_profile ?? {}
        if (ip.media_kit_pdf) setMediaKitUrl(absoluteUrl(ip.media_kit_pdf))
        if (ip.media_kit_generated_at) setMediaKitDate(ip.media_kit_generated_at)
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const r = await generateMediaKit()
      const url = absoluteUrl(r.media_kit_pdf)
      setMediaKitUrl(url)
      setMediaKitDate(new Date().toISOString())
      toast({ title: t("onboarding.kit_generated", "Kit média généré"), description: t("onboarding.kit_ready", "Cliquez sur Télécharger pour récupérer le PDF") })
    } catch (err: any) {
      toast({ variant: "destructive", title: t("common.error"), description: err?.response?.data?.detail ?? "" })
    } finally { setGenerating(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  const labels = reference?.completion_labels ?? FALLBACK_LABELS
  const friendlyMissing = (status?.missing_fields ?? []).map((f) => labels[f] ?? f)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("onboarding.title", "Complétez votre profil")}</h1>
      <Card className="card-base">
        <CardHeader><CardTitle>{t("onboarding.completion", "Progression")} : {status?.completion_percent ?? 0}%</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Progress value={status?.completion_percent ?? 0} />
          {status?.onboarding_completed ? (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-5 w-5" />
              {t("onboarding.completed", "Profil complet — prêt à recevoir des propositions")}
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-2">{t("onboarding.missing", "Étapes restantes")} :</p>
              <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
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
      <Card className="card-base">
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {t("onboarding.media_kit", "Kit média")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            {t("onboarding.media_kit_desc", "Générez un kit média PDF récapitulant vos réseaux, statistiques et tarifs (nécessite 80 % de profil complet).")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={generating || (status?.completion_percent ?? 0) < 80} variant="gradient">
              {generating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("common.loading")}</>
                : (mediaKitUrl ? t("onboarding.regenerate", "Regénérer") : t("onboarding.generate", "Générer le kit média"))}
            </Button>
            {mediaKitUrl && (
              <Button asChild variant="outline">
                <a href={mediaKitUrl} target="_blank" rel="noopener noreferrer" download>
                  <Download className="h-4 w-4 mr-2" /> {t("onboarding.download", "Télécharger le PDF")}
                </a>
              </Button>
            )}
          </div>
          {mediaKitDate && (
            <p className="text-xs text-gray-400">
              {t("onboarding.last_generated", "Dernière génération")} : {new Date(mediaKitDate).toLocaleString("fr-FR")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
