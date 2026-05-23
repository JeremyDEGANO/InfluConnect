import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  attachTrackedVideo,
  fetchTrackedVideos,
  removeTrackedVideo,
  type CampaignVideoTracking,
} from "../../lib/apiExtra"

interface Props {
  proposalId: number
  canEdit?: boolean
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function MiniSparkline({ values, height = 36 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null
  const width = 120
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const d = values
    .map((v, i) => {
      const x = i * stepX
      const y = height - ((v - min) / span) * height
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-32">
      <path d={d} stroke="rgb(34, 197, 94)" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

export default function CampaignTrackedVideos({ proposalId, canEdit = false }: Props) {
  const { t } = useTranslation()
  const [items, setItems] = useState<CampaignVideoTracking[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)

  const reload = () => {
    fetchTrackedVideos(proposalId)
      .then(setItems)
      .catch((err) => setError(String(err)))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId])

  const onAttach = async () => {
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    try {
      await attachTrackedVideo(proposalId, url.trim())
      setUrl("")
      reload()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(e.response?.data?.detail || e.message || "Error")
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async (id: number) => {
    if (!confirm(t("tiktok.tracking.confirm_remove"))) return
    await removeTrackedVideo(id)
    reload()
  }

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">{t("tiktok.tracking.title")}</h3>
      <p className="mb-3 text-xs text-slate-400">{t("tiktok.tracking.hint")}</p>

      {canEdit && (
        <div className="mb-4 flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@user/video/123..."
            className="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onAttach}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {t("tiktok.tracking.attach")}
          </button>
        </div>
      )}

      {error && <div className="mb-3 text-xs text-red-400">{error}</div>}
      {items === null && <div className="text-xs text-slate-400">{t("common.loading")}</div>}
      {items && items.length === 0 && (
        <div className="text-xs text-slate-400">{t("tiktok.tracking.empty")}</div>
      )}

      <div className="space-y-3">
        {items?.map((it) => {
          const latest = it.latest_stats
          const views = it.daily_stats.map((d) => d.view_count)
          return (
            <div
              key={it.id}
              className="flex items-start gap-3 rounded-lg border border-slate-700/40 bg-slate-900/60 p-3"
            >
              {it.thumbnail_url ? (
                <img
                  src={it.thumbnail_url}
                  alt=""
                  className="h-20 w-12 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-20 w-12 flex-shrink-0 rounded bg-slate-800" />
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={it.video_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block truncate text-sm font-medium text-sky-300 hover:underline"
                >
                  {it.caption || it.external_video_id}
                </a>
                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-300">
                  <span>▶ {compact(latest?.view_count || 0)}</span>
                  <span>♥ {compact(latest?.like_count || 0)}</span>
                  <span>💬 {compact(latest?.comment_count || 0)}</span>
                  <span>↗ {compact(latest?.share_count || 0)}</span>
                  <span className="text-slate-400">
                    {t("tiktok.tracking.engagement")}: {latest?.engagement_rate || "0"}%
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {it.is_frozen
                    ? t("tiktok.tracking.frozen")
                    : `${t("tiktok.tracking.until")} ${new Date(it.tracking_ends_at).toLocaleDateString()}`}
                  {it.last_error && (
                    <span className="ml-2 text-red-400">{it.last_error}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <MiniSparkline values={views} />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemove(it.id)}
                    className="text-[10px] text-red-400 hover:underline"
                  >
                    {t("common.remove")}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
