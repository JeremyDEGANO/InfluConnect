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
    const f = p.features
    const list: string[] = []
    list.push(f.campaigns_per_month === "unlimited" ? "Campagnes illimitées" : `${f.campaigns_per_month} campagnes/mois`)
    list.push(f.contacts === "unlimited" ? "Contacts illimités" : `${f.contacts} contacts`)
    list.push(`Analytics: ${f.analytics}`)
    list.push(`Support: ${f.support}`)
    if (f.custom_contracts) list.push("Contrats personnalisés")
    if (f.ambassador_program) list.push("Programme ambassadeurs")
    if (f.dedicated_manager) list.push("Manager dédié")
    if (f.white_label) list.push("White-label")
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

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("nav.subscription")}</h1>
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={busy !== null}>
          {t("subscription.cancel", "Annuler l'abonnement")}
        </Button>
      </div>
      <StripeModeBanner />
      <Card className="card-base bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100">
        <CardHeader><CardTitle className="text-base">{t("subscription.current_plan", "Plan actuel")}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900 capitalize">{currentPlan}</p>
            <p className="text-gray-500 text-sm">{plans.find((p) => p.code === currentPlan)?.price_eur ?? 49}€/mois HT</p>
          </div>
          <Badge variant="purple" className="text-sm px-4 py-1.5">Actif</Badge>
        </CardContent>
      </Card>
      <h2 className="text-lg font-semibold text-gray-900">{t("subscription.choose_plan", "Choisissez votre plan")}</h2>
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
