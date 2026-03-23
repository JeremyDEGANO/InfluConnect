import { Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PricingCardProps {
  name: string
  price: number
  period?: string
  description: string
  features: string[]
  highlighted?: boolean
  cta: string
  onSelect?: () => void
}

export function PricingCard({ name, price, period = "/mo", description, features, highlighted = false, cta, onSelect }: PricingCardProps) {
  return (
    <Card className={cn("relative card-base transition-all duration-200 hover:shadow-lg", highlighted && "border-2 border-purple-500 shadow-lg shadow-purple-100")}>
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
        </div>
      )}
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">{name}</CardTitle>
        <div className="mt-2">
          <span className="text-4xl font-bold text-gray-900">€{price}</span>
          <span className="text-gray-500 text-sm">{period}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 mb-6">
          {features.map((feat, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
              <Check className="h-4 w-4 text-green-500 shrink-0" />
              {feat}
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          variant={highlighted ? "gradient" : "outline"}
          onClick={onSelect}
        >
          {cta}
        </Button>
      </CardContent>
    </Card>
  )
}
