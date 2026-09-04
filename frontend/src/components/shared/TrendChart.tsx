import { useId, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

export interface TrendPoint {
  /** Short axis label, e.g. "sept." */
  label: string
  value: number
  /** Rendered dimmer: the month is not over yet. */
  partial?: boolean
}

interface TrendChartProps {
  points: TrendPoint[]
  /** Series color — one of the validated chart hues. */
  color?: string
  /** Formats the tooltip value and the end label. */
  format?: (value: number) => string
  height?: number
  className?: string
}

/** Nice round ceiling so the axis reads 0 / 500 / 1 000 rather than 0 / 487. */
function niceCeiling(max: number) {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude
    if (max <= candidate) return candidate
  }
  return 10 * magnitude
}

/**
 * Single-series trend over time: 2px line, 10% area wash, end marker with a
 * surface ring, hairline gridlines. One series, so no legend — the caller's
 * card title names what is plotted.
 */
export function TrendChart({
  points,
  color = "#4f46e5",
  format = (v) => String(v),
  height = 160,
  className,
}: TrendChartProps) {
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)

  const W = 560
  const H = height
  const PAD = { top: 14, right: 14, bottom: 22, left: 46 }

  const geometry = useMemo(() => {
    const values = points.map((p) => p.value)
    const max = niceCeiling(Math.max(0, ...values))
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const x = (i: number) =>
      points.length <= 1 ? PAD.left + innerW / 2 : PAD.left + (i / (points.length - 1)) * innerW
    const y = (v: number) => PAD.top + innerH - (max === 0 ? 0 : (v / max) * innerH)
    const coords = points.map((p, i) => ({ x: x(i), y: y(p.value), ...p }))
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ")
    const area = coords.length
      ? `${line} L${coords[coords.length - 1].x.toFixed(2)},${(H - PAD.bottom).toFixed(2)} L${coords[0].x.toFixed(2)},${(H - PAD.bottom).toFixed(2)} Z`
      : ""
    return { coords, line, area, max, innerH }
  }, [points, H])

  const { coords, line, area, max } = geometry
  const last = coords[coords.length - 1]
  const active = hover != null ? coords[hover] : null
  const allZero = points.every((p) => p.value === 0)

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Évolution sur ${points.length} mois`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Gridlines + y ticks — hairline, recessive, clean numbers */}
        {[0, 0.5, 1].map((ratio) => {
          const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - ratio)
          const value = max * ratio
          return (
            <g key={ratio}>
              <line
                x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="currentColor" strokeWidth="1" className="text-aurora-line"
              />
              <text
                x={PAD.left - 8} y={y + 3} textAnchor="end"
                className="fill-aurora-ink-3" style={{ fontSize: 9 }}
              >
                {value >= 1000 ? `${Math.round(value / 1000)}k` : Math.round(value)}
              </text>
            </g>
          )
        })}

        {!allZero && (
          <>
            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={line} fill="none" stroke={color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round"
            />
          </>
        )}

        {/* x labels */}
        {coords.map((c, i) => (
          <text
            key={`${c.label}-${i}`}
            x={c.x} y={H - 6} textAnchor="middle"
            className={cn(c.partial ? "fill-aurora-ink-3" : "fill-aurora-ink-2")}
            style={{ fontSize: 9 }}
          >
            {c.label}
          </text>
        ))}

        {/* End marker: >=8px with a 2px surface ring */}
        {!allZero && last && (
          <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="white" strokeWidth="2" />
        )}

        {/* Hover crosshair */}
        {active && (
          <>
            <line
              x1={active.x} y1={PAD.top} x2={active.x} y2={H - PAD.bottom}
              stroke={color} strokeWidth="1" strokeOpacity="0.35"
            />
            <circle cx={active.x} cy={active.y} r="4.5" fill={color} stroke="white" strokeWidth="2" />
          </>
        )}

        {/* Hit targets — wider than the marks */}
        {coords.map((c, i) => (
          <rect
            key={`hit-${i}`}
            x={c.x - (W - PAD.left - PAD.right) / Math.max(points.length * 2, 1)}
            y={PAD.top}
            width={(W - PAD.left - PAD.right) / Math.max(points.length, 1)}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {/* Tooltip line — keeps values readable without a number on every point */}
      <div className="mt-1 flex items-center justify-between gap-2 min-h-[18px]">
        <span className="text-[11px] text-aurora-ink-3">
          {active ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />
              {active.label} · <span className="font-medium text-aurora-ink">{format(active.value)}</span>
              {active.partial && " (mois en cours)"}
            </>
          ) : (
            last && <>Dernier point · <span className="font-medium text-aurora-ink">{format(last.value)}</span></>
          )}
        </span>
      </div>
    </div>
  )
}
