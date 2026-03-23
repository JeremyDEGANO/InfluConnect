import { useTranslation } from "react-i18next"
import { PricingCard } from "@/components/shared/PricingCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

export default function Subscription() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const handleUpgrade = () => toast({ title: "Upgrade initiated", description: "Redirecting to payment..." })
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("nav.subscription")}</h1>
      </div>
      <Card className="card-base bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100">
        <CardHeader><CardTitle className="text-base">Current Plan</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div><p className="text-2xl font-bold text-gray-900">Starter</p><p className="text-gray-500 text-sm">€49/month · Renews Apr 1, 2024</p></div>
          <Badge variant="purple" className="text-sm px-4 py-1.5">Active</Badge>
        </CardContent>
      </Card>
      <h2 className="text-lg font-semibold text-gray-900">Upgrade Your Plan</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <PricingCard name="Starter" price={49} description="Your current plan" features={["5 campaigns/mo", "20 contacts", "Basic analytics", "Email support"]} cta="Current Plan" onSelect={() => {}} />
        <PricingCard name="Growth" price={149} description="For growing teams" features={["20 campaigns/mo", "Unlimited contacts", "Advanced analytics", "Priority support", "Custom contracts"]} cta="Upgrade to Growth" highlighted onSelect={handleUpgrade} />
        <PricingCard name="Pro" price={399} description="Enterprise features" features={["Unlimited campaigns", "Unlimited contacts", "Full analytics", "Dedicated manager", "White-label"]} cta="Upgrade to Pro" onSelect={handleUpgrade} />
      </div>
    </div>
  )
}
