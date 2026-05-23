import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchSocialSnapshots, type SocialStatsSnapshot } from "../../lib/apiExtra"

interface Props {
  socialNetworkId: number
  metric?: "followers_count" | "avg_views" | "engagement_rate"
  range?: "30" | "90" | "365"
  height?: number
}

export default function GrowthChart({
  socialNetworkId,
  metric = "followers_count",
  range = "30",
  height = 160,
}: Props) {
  const { t } = useTranslation()
  const [snapshots, setSnapshots] = useState<SocialStatsSnapshot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentRange, setCurrentRange] = useState<"30" | "90" | "365">(range)

  useEffect(() => {
    let active = true
    setSnapshots(null)
    fetchSocialSnapshots(socialNetworkId, currentRange)
      .then((rows) => active && setSnapshots(rows))
      .catch((err) => active && setError(String(err)))
    return () => {
      active = false
    }
  }, [socialNetworkId, currentRange])

  const points = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []
    return snapshots.map((s) => ({
      date: s.snapshot_date,
      value: metric === "engagement_rate" ? Number(s.engagement_rate || 0) : Number(s[metric] ?? 0),
    }))
  }, [snapshots, metric])

  if (error) return <div className="text-xs text-red-600">{error}</div>
  if (snapshots === null) return <div className="text-xs text-slate-500">{t("common.loading")}</div>
  if (points.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
        {t("tiktok.chart.not_enough_data")}
      </div>
    )
  }

  const width = 400
  const padding = 6
  const ys = points.map((p) => p.value)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const range01 = max - min || 1
  const stepX = (width - padding * 2) / (points.length - 1)
  const path = points
    .map((p, i) => {
      const x = padding + i * stepX
      const y = padding + (height - padding * 2) * (1 - (p.value - min) / range01)
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  const first = points[0].value
  const last = points[points.length - 1].value
  const deltaPct = first > 0 ? ((last - first) / first) * 100 : 0
  const isUp = deltaPct >= 0
  const metricLabel = t(`tiktok.chart.metric.${metric}`)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">{metricLabel}</span>
        <div className="flex items-center gap-2">
          <span className={isUp ? "text-emerald-600" : "text-red-600"}>
            {isUp ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
          </span>
          <select
            value={currentRange}
            onChange={(e) => setCurrentRange(e.target.value as "30" | "90" | "365")}
            className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs text-slate-700"
          >
            <option value="30">{t("tiktok.chart.range.30")}</option>
            <option value="90">{t("tiktok.chart.range.90")}</option>
            <option value="365">{t("tiktok.chart.range.365")}</option>
          </select>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <path d={path} stroke="rgb(59, 130, 246)" strokeWidth="2" fill="none" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  )
}
