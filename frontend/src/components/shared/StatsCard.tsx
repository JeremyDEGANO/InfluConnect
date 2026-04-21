import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: number
  trendLabel?: string
  iconBg?: string
}

export function StatsCard({ title, value, icon: Icon, trend, trendLabel, iconBg = "from-indigo-500 to-violet-600" }: StatsCardProps) {
  const isPositive = (trend ?? 0) >= 0

  return (
    <Card className="card-base">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {trend !== undefined && (
              <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", isPositive ? "text-green-600" : "text-red-500")}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isPositive ? "+" : ""}{trend}% {trendLabel}
              </div>
            )}
          </div>
          <div className={cn("h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center", iconBg)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
