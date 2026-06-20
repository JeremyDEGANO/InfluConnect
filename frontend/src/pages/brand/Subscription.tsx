import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { PricingCard } from "@/components/shared/PricingCard"
import { StripeModeBanner } from "@/components/shared/StripeModeBanner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth"
import { fetchPlans, changeSubscription, cancelSubscription, type Plan } from "@/lib/apiExtra"
import { Loader2 } from "lucide-react"

export default function Subscription() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user, refreshUser } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const currentPlan = (user?.brand_profile as any)?.subscription_plan ?? "starter"

  useEffect(() => {
    fetchPlans().then((p) => setPlans(p)).finally(() => setLoading(false))
  }, [])

  const featuresList = (p: Plan) => {
    const d = p.display
    const f = p.features ?? {}
    const list: string[] = []
    if (d) {
      list.push(d.campaigns_per_month === "unlimited" ? "Campagnes illimitées" : `${d.campaigns_per_month} campagnes actives`)
      list.push(d.contacts === "unlimited" ? "Contacts illimités" : `${d.contacts} contacts`)
      list.push(`Analytics: ${d.analytics}`)
      list.push(`Support: ${d.support}`)
      if (d.custom_contracts) list.push("Modèles de documents")
      if (d.dedicated_manager) list.push("Manager dédié")
    }
    if (f.ambassador_programs) list.push("Programme ambassadeurs")
    if (f.events) list.push("Événements")
    if (f.sso_office365_google) list.push("SSO (Office 365)")
    if (f.api_access) list.push("API & webhooks")
    if (f.multi_environments) list.push("Multi-environnements")
    return list
  }

  const handleChange = async (code: string) => {
    if (code === currentPlan) return
    setBusy(code)
    try {
      await changeSubscription(code)
      await refreshUser()
      toast({ title: t("subscription.changed", "Plan modifié"), description: t("subscription.changed_desc", "Votre nouveau plan est actif.") })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally { setBusy(null) }
  }

  const handleCancel = async () => {
    if (!confirm(t("subscription.confirm_cancel", "Annuler votre abonnement ?"))) return
    setBusy("cancel")
    try {
      await cancelSubscription()
      await refreshUser()
      toast({ title: t("subscription.cancelled", "Abonnement annulé") })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally { setBusy(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-aurora-ink-3">{t("brand_dashboard.eyebrow", "Espace marque")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("nav.subscription")}</h1>
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={busy !== null}>
          {t("subscription.cancel", "Annuler l'abonnement")}
        </Button>
      </div>
      <StripeModeBanner />
      <Card className="card-base bg-aurora-blue/5 border-aurora-blue/15">
        <CardHeader><CardTitle className="text-base">{t("subscription.current_plan", "Plan actuel")}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-aurora-ink capitalize">{currentPlan}</p>
            <p className="text-aurora-ink-3 text-sm">{user?.active_brand?.plan_price_eur_monthly ?? plans.find((p) => p.code === currentPlan)?.price_eur ?? 0}€/mois HT</p>
          </div>
          <Badge variant="purple" className="text-sm px-4 py-1.5">Actif</Badge>
        </CardContent>
      </Card>
      <h2 className="text-lg font-semibold text-aurora-ink">{t("subscription.choose_plan", "Choisissez votre plan")}</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <PricingCard
            key={p.code}
            name={p.name}
            price={p.price_eur}
            description={p.code === currentPlan ? t("subscription.your_plan", "Votre plan actuel") : `Plan ${p.name}`}
            features={featuresList(p)}
            cta={p.code === currentPlan ? t("subscription.current_plan_short", "Plan actuel") : busy === p.code ? "..." : t("subscription.upgrade_to", "Passer à") + " " + p.name}
            highlighted={p.code === "growth"}
            onSelect={() => handleChange(p.code)}
          />
        ))}
      </div>
    </div>
  )
}
