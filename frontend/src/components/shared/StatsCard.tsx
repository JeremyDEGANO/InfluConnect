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

export function StatsCard({ title, value, icon: Icon, trend, trendLabel, iconBg = "" }: StatsCardProps) {
  const isPositive = (trend ?? 0) >= 0

  return (
    <Card className="card-base border border-slate-200/80 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
            {trend !== undefined && (
              <div className={cn("mt-2 flex items-center gap-1 text-xs font-medium", isPositive ? "text-emerald-600" : "text-rose-600")}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isPositive ? "+" : ""}{trend}% {trendLabel}
              </div>
            )}
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50", iconBg)}>
            <Icon className="h-4.5 w-4.5 text-slate-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
