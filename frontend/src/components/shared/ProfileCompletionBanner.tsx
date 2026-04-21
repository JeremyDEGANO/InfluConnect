import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { fetchOnboarding, fetchReference, type OnboardingStatus, type ReferenceData } from "@/lib/apiExtra"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight, X } from "lucide-react"

const DISMISS_KEY = "profile_banner_dismissed_at"
const DISMISS_HOURS = 24
const FALLBACK_LABELS: Record<string, string> = {
  avatar: "Photo de profil", bio: "Biographie", display_name: "Pseudo",
  location: "Ville", languages: "Langues", content_themes: "Thématiques",
  content_types_offered: "Types de contenu", pricing: "Tarifs",
  social_networks: "Réseaux sociaux", payment_method: "Paiement",
}

export function ProfileCompletionBanner() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_HOURS * 3600 * 1000) {
      setHidden(true); return
    }
    fetchOnboarding().then(setStatus).catch(() => {})
    fetchReference().then(setReference).catch(() => {})
  }, [])

  if (hidden || !status || status.completion_percent >= 100) return null

  const labels = reference?.completion_labels ?? FALLBACK_LABELS
  const missing = (status.missing_fields ?? []).map((f) => labels[f] ?? f)

  return (
    <Card className="card-base border-indigo-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-pink-50">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">
            {t("banner.title", "Complétez votre profil")} — {status.completion_percent}%
          </p>
          <p className="text-xs text-gray-600 mt-0.5 truncate">
            {missing.length > 0
              ? t("banner.missing", "Manquant") + " : " + missing.slice(0, 4).join(", ")
              : t("banner.almost", "Presque terminé !")}
          </p>
          <div className="mt-2"><Progress value={status.completion_percent} /></div>
        </div>
        <Link to="/influencer/profile/edit">
          <Button variant="gradient" size="sm">
            {t("banner.complete", "Compléter")} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
        <button
          aria-label="dismiss"
          onClick={() => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setHidden(true) }}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  )
}
