import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface DataPoint {
  label: string
  value: number
}

interface Props {
  data: DataPoint[]
  height?: number
  formatValue?: (n: number) => string
  color?: string
  className?: string
}

/**
 * Minimalist CSS bar chart — no third-party library.
 * Renders equal-width vertical bars with a subtle gradient + baseline grid.
 */
export function SimpleBarChart({
  data,
  height = 160,
  formatValue = (n) => String(n),
  color = "from-indigo-400 to-violet-600",
  className,
}: Props) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data])

  if (data.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">Aucune donnée</div>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((d) => {
          const h = (d.value / max) * 100
          return (
            <div key={d.label} className="flex-1 flex flex-col items-center group">
              <div className="text-xs text-gray-500 mb-1 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                {formatValue(d.value)}
              </div>
              <div
                className={cn(
                  "w-full rounded-t-md bg-gradient-to-t transition-all",
                  color,
                  d.value === 0 && "opacity-20",
                )}
                style={{ height: `${Math.max(2, h)}%` }}
                title={`${d.label}: ${formatValue(d.value)}`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between gap-2 mt-2">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-xs text-gray-400 truncate">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

interface DonutSlice {
  label: string
  value: number
  color: string
}

interface DonutProps {
  slices: DonutSlice[]
  size?: number
}

/**
 * SVG donut chart, centered total, with legend on the right. No library used.
 */
export function DonutChart({ slices, size = 160 }: DonutProps) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const filtered = slices.filter((s) => s.value > 0)
  if (total === 0) {
    return <div className="text-center text-gray-400 text-sm py-8">Aucune donnée</div>
  }
  const radius = size / 2 - 10
  const circ = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
        {filtered.map((s) => {
          const frac = s.value / total
          const dash = frac * circ
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
            />
          )
          offset += dash
          return el
        })}
        <text
          x={size / 2}
          y={size / 2 + 6}
          textAnchor="middle"
          className="fill-gray-800 font-bold text-base rotate-90"
          style={{ transform: "rotate(90deg)", transformOrigin: `${size / 2}px ${size / 2}px` }}
        >
          {total}
        </text>
      </svg>
      <div className="space-y-1.5 text-sm">
        {slices.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-gray-600">{s.label}</span>
            <span className="text-gray-400 tabular-nums ml-auto">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
