import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  /** Optional, kept for backward-compat. Not rendered in the Aurora style. */
  icon?: LucideIcon
  trend?: number
  trendLabel?: string
  iconBg?: string
  /** Progress bar fill 0..100 (mockup-style hairline bar) */
  progress?: number
  /** Tailwind class for the progress fill, e.g. "bg-aurora-blue" */
  progressColor?: string
  /** Subtle line below the number, e.g. "2 expirent demain" */
  hint?: string
}

export function StatsCard({ title, value, trend, trendLabel, progress, progressColor, hint }: StatsCardProps) {
  const isPositive = (trend ?? 0) >= 0
  const fill = progressColor ?? "bg-aurora-blue"
  const pct = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : 60

  return (
    <div className="rounded-2xl bg-white border border-aurora-line p-5 shadow-soft">
      <div className="text-xs text-aurora-ink-3">{title}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="num text-3xl font-semibold text-aurora-ink">{value}</span>
        {trend !== undefined && (
          <span className={cn("text-xs font-medium inline-flex items-center gap-0.5", isPositive ? "text-emerald-600" : "text-rose-600")}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{trend}{trendLabel ? ` ${trendLabel}` : "%"}
          </span>
        )}
      </div>
      {hint && <div className="text-xs text-aurora-ink-3 mt-1">{hint}</div>}
      <div className="mt-3 h-1 rounded-full bg-aurora-line/60 overflow-hidden">
        <div className={cn("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
