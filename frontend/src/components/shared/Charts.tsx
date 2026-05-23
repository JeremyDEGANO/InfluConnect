import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

interface DataPoint {
  label: string
  value: number
}

function niceMax(raw: number): number {
  if (raw === 0) return 10
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = mag >= 1 ? mag : 1
  return Math.ceil(raw / step) * step
}

function fmtShort(n: number, fmt?: (n: number) => string): string {
  if (fmt) return fmt(n)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`
  return String(Math.round(n))
}

function cubicPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return ""
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const cx = (p0.x + p1.x) / 2
    d += ` C${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`
  }
  return d
}

// ─── SimpleLineChart ───────────────────────────────────────────────────────────

interface LineChartProps {
  data: DataPoint[]
  height?: number
  formatValue?: (n: number) => string
  stroke?: string
  showArea?: boolean
  className?: string
}

export function SimpleLineChart({
  data,
  height = 200,
  formatValue,
  stroke = "#4f46e5",
  showArea = true,
  className,
}: LineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const W = 480
  const H = height
  const padL = 44
  const padR = 12
  const padT = 16
  const padB = 32
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const max = useMemo(() => niceMax(Math.max(1, ...data.map((d) => d.value))), [data])
  const yTicks = [0, max / 2, max]

  const xFor = (i: number) =>
    data.length <= 1 ? padL + chartW / 2 : padL + (i / (data.length - 1)) * chartW
  const yFor = (v: number) => padT + chartH - (v / max) * chartH

  const pts = useMemo(
    () => data.map((d, i) => ({ x: xFor(i), y: yFor(d.value), label: d.label, value: d.value })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, max],
  )
  const linePath = cubicPath(pts)
  const gradId = `area-${stroke.replace(/[^a-z0-9]/gi, "")}`

  if (data.length === 0) {
    return <div className="flex items-center justify-center py-10 text-sm text-aurora-ink-3">Aucune donnée</div>
  }

  return (
    <div className={cn("w-full select-none", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, ti) => {
          const y = yFor(tick)
          return (
            <g key={ti}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={ti === 0 ? "none" : "4 4"} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="inherit">
                {fmtShort(tick, tick === 0 ? undefined : formatValue)}
              </text>
            </g>
          )
        })}

        {showArea && pts.length > 0 && (
          <path
            d={`${linePath} L${pts[pts.length - 1].x},${padT + chartH} L${pts[0].x},${padT + chartH} Z`}
            fill={`url(#${gradId})`}
          />
        )}

        <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <rect x={p.x - 14} y={padT} width={28} height={chartH} fill="transparent" className="cursor-default" />
            <circle
              cx={p.x} cy={p.y}
              r={hovered === i ? 5 : 3.5}
              fill="white" stroke={stroke}
              strokeWidth={hovered === i ? 2.5 : 1.8}
              className="transition-all duration-100"
            />
            {hovered === i && (
              <g>
                <rect x={p.x - 32} y={p.y - 30} width={64} height={22} rx={4} fill="#1e293b" opacity={0.9} />
                <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize="10" fill="white" fontFamily="inherit" fontWeight="600">
                  {fmtShort(p.value, formatValue)}
                </text>
              </g>
            )}
            <text x={p.x} y={padT + chartH + 16} textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontFamily="inherit">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ─── SimpleBarChart ────────────────────────────────────────────────────────────

interface BarChartProps {
  data: DataPoint[]
  height?: number
  formatValue?: (n: number) => string
  color?: string
  className?: string
}

export function SimpleBarChart({
  data,
  height = 180,
  formatValue,
  color = "#4f46e5",
  className,
}: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const W = 480
  const H = height
  const padL = 44
  const padR = 12
  const padT = 16
  const padB = 32
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const max = useMemo(() => niceMax(Math.max(1, ...data.map((d) => d.value))), [data])
  const yTicks = [0, max / 2, max]
  const yFor = (v: number) => padT + chartH - (v / max) * chartH

  const slotW = chartW / Math.max(data.length, 1)
  const barW = Math.min(48, Math.max(6, slotW * 0.5))
  const xFor = (i: number) => padL + slotW * i + slotW / 2

  if (data.length === 0) {
    return <div className="flex items-center justify-center py-10 text-sm text-aurora-ink-3">Aucune donnée</div>
  }

  return (
    <div className={cn("w-full select-none", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height }}>
        {yTicks.map((tick, ti) => {
          const y = yFor(tick)
          return (
            <g key={ti}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={ti === 0 ? "none" : "4 4"} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="inherit">
                {fmtShort(tick, tick === 0 ? undefined : formatValue)}
              </text>
            </g>
          )
        })}

        {data.map((d, i) => {
          const x = xFor(i)
          const barH = Math.max(2, (d.value / max) * chartH)
          const y = padT + chartH - barH
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect x={x - barW / 2} y={y} width={barW} height={barH} rx={3} fill={color} opacity={hovered === i ? 1 : 0.72} className="transition-opacity duration-100" />
              {hovered === i && (
                <g>
                  <rect x={x - 32} y={y - 28} width={64} height={22} rx={4} fill="#1e293b" opacity={0.9} />
                  <text x={x} y={y - 12} textAnchor="middle" fontSize="10" fill="white" fontFamily="inherit" fontWeight="600">
                    {fmtShort(d.value, formatValue)}
                  </text>
                </g>
              )}
              <text x={x} y={padT + chartH + 16} textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontFamily="inherit">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── DonutChart ────────────────────────────────────────────────────────────────

interface DonutSlice {
  label: string
  value: number
  color: string
}

interface DonutProps {
  slices: DonutSlice[]
  size?: number
}

export function DonutChart({ slices, size = 160 }: DonutProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  const filtered = slices.filter((s) => s.value > 0)

  if (total === 0) {
    return <div className="flex items-center justify-center py-10 text-sm text-aurora-ink-3">Aucune donnée</div>
  }

  const r = size / 2 - 14
  const circ = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2
  let offset = 0

  return (
    <div className="flex items-center gap-6 flex-wrap select-none">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
        {filtered.map((s, i) => {
          const frac = s.value / total
          const dash = frac * circ
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="transparent"
              stroke={s.color}
              strokeWidth={hovered === i ? 22 : 18}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              className="transition-all duration-150 cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          )
          offset += dash
          return el
        })}
        <text
          x={cx} y={cy + 5}
          textAnchor="middle" fontSize="16" fontWeight="700" fill="#1e293b"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px` }}
        >
          {hovered !== null ? filtered[hovered]?.value ?? total : total}
        </text>
      </svg>

      <div className="space-y-2 text-sm min-w-0">
        {filtered.map((s, i) => (
          <div
            key={i}
            className={cn("flex items-center gap-2 cursor-default transition-opacity duration-150", hovered !== null && hovered !== i ? "opacity-35" : "opacity-100")}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-aurora-ink-2 truncate">{s.label}</span>
            <span className="text-aurora-ink-3 tabular-nums ml-auto font-medium">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
