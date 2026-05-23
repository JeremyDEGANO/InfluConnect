import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchSocialVideos, type SocialVideo } from "../../lib/apiExtra"

interface Props {
  socialNetworkId: number
  limit?: number
  title?: string
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function TikTokVideosGrid({ socialNetworkId, limit = 12, title }: Props) {
  const { t } = useTranslation()
  const [videos, setVideos] = useState<SocialVideo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchSocialVideos(socialNetworkId, limit)
      .then((rows) => {
        if (active) setVideos(rows)
      })
      .catch((err) => {
        if (active) setError(String(err))
      })
    return () => {
      active = false
    }
  }, [socialNetworkId, limit])

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>
  }
  if (videos === null) {
    return <div className="text-sm text-slate-500">{t("common.loading")}</div>
  }
  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
        {t("tiktok.videos.empty")}
      </div>
    )
  }

  return (
    <section>
      {title && <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {videos.map((v) => (
          <a
            key={v.id}
            href={v.video_url || "#"}
            target="_blank"
            rel="noreferrer noopener"
            className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
          >
            {v.thumbnail_url ? (
              <img
                src={v.thumbnail_url}
                alt={v.caption || "TikTok"}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                {t("tiktok.videos.no_thumbnail")}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px] text-white">
              <div className="flex items-center justify-between font-semibold">
                <span>▶ {compact(v.view_count)}</span>
                <span>♥ {compact(v.like_count)}</span>
              </div>
              {v.caption && (
                <p className="mt-1 line-clamp-2 text-[10px] text-slate-300">{v.caption}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
