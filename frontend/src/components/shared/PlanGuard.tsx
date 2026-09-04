import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { accessContext, canAccessPath, featureKeyForPath } from "@/lib/planAccess"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Lock } from "lucide-react"

/**
 * Blocks a plan-gated page when the subscription does not include it.
 *
 * Hiding the entry in the sidebar was never enough — the page stayed reachable
 * by typing its URL. This closes that hole in the UI; the backend enforces the
 * same entitlements on every call, so this is about honesty, not security.
 */
export function PlanGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()

  const ctx = accessContext(user)
  if (canAccessPath(location.pathname, ctx)) return <>{children}</>

  const featureKey = featureKeyForPath(location.pathname)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="card-base">
        <CardContent className="py-10 text-center">
          <div className="h-12 w-12 rounded-2xl bg-aurora-surface border border-aurora-line flex items-center justify-center mx-auto mb-4">
            <Lock className="h-5 w-5 text-aurora-ink-3" />
          </div>
          <h1 className="text-xl font-semibold text-aurora-ink mb-2">
            {t("plan_guard.title", "Cette fonctionnalité n'est pas incluse dans votre forfait")}
          </h1>
          <p className="text-sm text-aurora-ink-2 mb-1">
            {featureKey
              ? t(`pricing.features.${featureKey}`, featureKey)
              : t("plan_guard.generic", "Fonctionnalité réservée aux forfaits supérieurs.")}
          </p>
          <p className="text-sm text-aurora-ink-3 mb-6">
            {t("plan_guard.desc", "Changez de forfait pour y accéder, ou contactez-nous si vous pensez qu'il s'agit d'une erreur.")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="gradient" asChild>
              <Link to="/brand/subscription">{t("plan_guard.upgrade", "Voir les forfaits")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/brand/dashboard">{t("plan_guard.back", "Retour au tableau de bord")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
