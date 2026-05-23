import { useEffect, useState } from "react"
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { resolveMediaUrl } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, BarChart3, CheckCircle2, Gauge, Loader2, MapPin, Star, Users } from "lucide-react"
import TikTokVideosGrid from "@/components/social/TikTokVideosGrid"
import GrowthChart from "@/components/social/GrowthChart"
import { FreshnessBadge, VerifiedBadge } from "@/components/social/SocialStatusBadges"

interface SocialNetwork {
  id?: number
  platform: string
  followers_count: number
  avg_views?: number
  handle?: string
  engagement_rate?: number
  verified_via_api?: boolean
  last_synced_at?: string | null
  is_verified_external?: boolean
}

interface InfluencerProfile {
  id: number
  display_name: string
  avatar: string | null
  bio: string
  city: string
  content_themes: string[]
  content_types_offered: string[]
  social_networks: SocialNetwork[]
  content_links: { label: string; url: string }[]
  average_rating: number | string | null
  media_kit_pdf?: string | null
}

function normalizeProfile(raw: any): InfluencerProfile {
  const toArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string")
    if (typeof value === "string") {
      return value.split(",").map((s) => s.trim()).filter(Boolean)
    }
    return []
  }

  const socialNetworks: SocialNetwork[] = Array.isArray(raw?.social_networks)
    ? raw.social_networks
      .filter((sn: any) => sn && typeof sn === "object")
      .map((sn: any) => ({
        id: Number.isFinite(Number(sn.id)) ? Number(sn.id) : undefined,
        platform: typeof sn.platform === "string" ? sn.platform : "",
        followers_count: Number.isFinite(Number(sn.followers_count)) ? Number(sn.followers_count) : 0,
        avg_views: Number.isFinite(Number(sn.avg_views)) ? Number(sn.avg_views) : undefined,
        handle: typeof sn.handle === "string" ? sn.handle : undefined,
        engagement_rate: Number.isFinite(Number(sn.engagement_rate)) ? Number(sn.engagement_rate) : undefined,
        verified_via_api: Boolean(sn.verified_via_api),
        last_synced_at: typeof sn.last_synced_at === "string" ? sn.last_synced_at : null,
        is_verified_external: Boolean(sn.is_verified_external),
      }))
      .filter((sn: SocialNetwork) => sn.platform.length > 0)
    : []

  return {
    id: Number.isFinite(Number(raw?.id)) ? Number(raw.id) : 0,
    display_name: typeof raw?.display_name === "string" ? raw.display_name : "",
    avatar: typeof raw?.avatar === "string" ? raw.avatar : null,
    bio: typeof raw?.bio === "string" ? raw.bio : "",
    city: typeof raw?.city === "string" ? raw.city : "",
    content_themes: toArray(raw?.content_themes),
    content_types_offered: toArray(raw?.content_types_offered),
    social_networks: socialNetworks,
    content_links: Array.isArray(raw?.content_links)
      ? raw.content_links
          .filter((l: any) => l && typeof l === "object" && typeof l.url === "string" && l.url)
          .map((l: any) => ({ label: typeof l.label === "string" ? l.label : "", url: l.url }))
      : [],
    average_rating: raw?.average_rating ?? null,
    media_kit_pdf: typeof raw?.media_kit_pdf === "string" ? raw.media_kit_pdf : null,
  }
}

export default function InfluencerPublicProfile() {
  const { pseudo } = useParams<{ pseudo: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { toast } = useToast()
  const [inf, setInf] = useState<InfluencerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/influencers/p/${pseudo}/`)
        setInf(normalizeProfile(res.data))
      } catch {
        toast({ variant: "destructive", title: t("common.error") })
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pseudo])

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)
  const fmtPct = (n?: number) => (typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)}%` : t("influencer_public.no_data"))

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }
  if (!inf) return <div className="p-6 text-center text-aurora-ink-3">{t("common.error")}</div>

  const totalFollowers = inf.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
  const avgEngagementValues = inf.social_networks
    .map((sn) => sn.engagement_rate)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  const avgEngagement = avgEngagementValues.length
    ? avgEngagementValues.reduce((sum, value) => sum + value, 0) / avgEngagementValues.length
    : null
  const avgViewsValues = inf.social_networks
    .map((sn) => sn.avg_views)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  const avgViews = avgViewsValues.length
    ? Math.round(avgViewsValues.reduce((sum, value) => sum + value, 0) / avgViewsValues.length)
    : null
  const verifiedPlatforms = inf.social_networks.filter((sn) => sn.verified_via_api || sn.is_verified_external).length
  const latestSyncedAt = inf.social_networks
    .map((sn) => sn.last_synced_at)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  const tiktokNetworks = inf.social_networks?.filter((sn) => sn.platform === "tiktok" && sn.id && sn.verified_via_api) ?? []
  const focus = (searchParams.get("focus") || "").toLowerCase()
  const hashFocus = (location.hash || "").replace("#", "").toLowerCase()
  const rating = typeof inf.average_rating === "number"
    ? inf.average_rating
    : typeof inf.average_rating === "string"
      ? Number.parseFloat(inf.average_rating)
      : NaN
  const ratingLabel = Number.isFinite(rating) ? rating.toFixed(1) : null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-xl font-semibold tracking-tight text-aurora-ink">{t("influencer_public.title")}</h1>
      </div>

      <Card className="card-base">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {inf.avatar && <AvatarImage src={resolveMediaUrl(inf.avatar)} />}
              <AvatarFallback className="bg-aurora-ink text-white text-lg font-semibold">
                {(inf.display_name || "??").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl">{inf.display_name || `#${inf.id}`}</CardTitle>
              <div className="flex items-center gap-3 mt-1 text-sm text-aurora-ink-3">
                {inf.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{inf.city}</span>}
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{fmt(totalFollowers)}</span>
                {ratingLabel && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-amber-500" />{ratingLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {inf.bio && (
            <div>
              <p className="text-sm font-medium text-aurora-ink-3 mb-1">{t("influencer_public.bio")}</p>
              <div className="text-sm text-aurora-ink-2 leading-relaxed space-y-3">
                {inf.bio.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para.replace(/\n/g, " ")}</p>
                ))}
              </div>
            </div>
          )}
          {inf.content_themes?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-aurora-ink-3 mb-1">{t("influencer_public.themes")}</p>
              <div className="flex flex-wrap gap-1.5">
                {inf.content_themes.map((th) => <Badge key={th} variant="info">{th}</Badge>)}
              </div>
            </div>
          )}
          {inf.content_types_offered?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-aurora-ink-3 mb-1">{t("influencer_public.content_types")}</p>
              <div className="flex flex-wrap gap-1.5">
                {inf.content_types_offered.map((ct) => <Badge key={ct} variant="outline">{ct}</Badge>)}
              </div>
            </div>
          )}
          {inf.social_networks?.length > 0 && (
            <section className="space-y-4 rounded-2xl border border-aurora-line bg-aurora-surface/40 p-4 sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-aurora-ink-3">{t("influencer_public.networks")}</p>
                  <h3 className="text-lg font-semibold tracking-tight text-aurora-ink">{t("influencer_public.stats_title")}</h3>
                </div>
                <p className="text-sm text-aurora-ink-3">{t("influencer_public.stats_subtitle")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-aurora-line bg-white p-4">
                  <div className="flex items-center gap-2 text-aurora-ink-3">
                    <Users className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-medium uppercase tracking-wide">{t("influencer_public.total_followers")}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-aurora-ink">{fmt(totalFollowers)}</p>
                </div>
                <div className="rounded-2xl border border-aurora-line bg-white p-4">
                  <div className="flex items-center gap-2 text-aurora-ink-3">
                    <Gauge className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-medium uppercase tracking-wide">{t("influencer_public.avg_engagement")}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-aurora-ink">{avgEngagement !== null ? `${avgEngagement.toFixed(2)}%` : t("influencer_public.no_data")}</p>
                </div>
                <div className="rounded-2xl border border-aurora-line bg-white p-4">
                  <div className="flex items-center gap-2 text-aurora-ink-3">
                    <BarChart3 className="h-4 w-4 text-sky-500" />
                    <span className="text-xs font-medium uppercase tracking-wide">{t("influencer_public.avg_views")}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-aurora-ink">{avgViews !== null ? fmt(avgViews) : t("influencer_public.no_data")}</p>
                </div>
                <div className="rounded-2xl border border-aurora-line bg-white p-4">
                  <div className="flex items-center gap-2 text-aurora-ink-3">
                    <CheckCircle2 className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-medium uppercase tracking-wide">{t("influencer_public.verified_platforms")}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-aurora-ink">{verifiedPlatforms}</p>
                  <p className="mt-1 text-xs text-aurora-ink-3">
                    {latestSyncedAt ? t("tiktok.freshness.last_sync", { when: new Date(latestSyncedAt).toLocaleString() }) : t("influencer_public.no_sync")}
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {inf.social_networks.map((sn) => (
                  <div key={sn.platform} className="rounded-2xl border border-aurora-line bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold capitalize text-aurora-ink">{sn.platform}</span>
                          {sn.is_verified_external && <VerifiedBadge />}
                        </div>
                        <div className="mt-1 text-sm text-aurora-ink-3">
                          <FreshnessBadge lastSyncedAt={sn.last_synced_at} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:min-w-[320px] sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-aurora-ink-3">{t("influencer_public.total_followers")}</p>
                          <p className="mt-1 text-base font-semibold text-aurora-ink">{fmt(sn.followers_count)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-aurora-ink-3">{t("influencer_public.avg_engagement")}</p>
                          <p className="mt-1 text-base font-semibold text-aurora-ink">{fmtPct(sn.engagement_rate)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-aurora-ink-3">{t("influencer_public.avg_views")}</p>
                          <p className="mt-1 text-base font-semibold text-aurora-ink">{typeof sn.avg_views === "number" ? fmt(sn.avg_views) : t("influencer_public.no_data")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {tiktokNetworks.map((sn) => (
            <div key={`tt-${sn.id}`} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight text-aurora-ink">{t("influencer_public.tiktok_insights")}</h3>
                <Badge variant="outline">TikTok</Badge>
              </div>
              <GrowthChart socialNetworkId={sn.id!} metric="followers_count" range="30" />
              <TikTokVideosGrid socialNetworkId={sn.id!} limit={12} title={t("tiktok.videos.title")} />
            </div>
          ))}
          {inf.content_links?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-aurora-ink-3 mb-2">{t("influencer_public.content_links", "Liens & contenus")}</p>
              <ul className="space-y-1 text-sm">
                {inf.content_links.map((l, i) => (
                  <li key={i}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-aurora-blue hover:underline break-all">{l.label || l.url}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div id="media-kit" className={focus === "media-kit" || hashFocus === "media-kit" ? "rounded-xl border border-aurora-blue/20 bg-indigo-50 p-3" : ""}>
            <p className="text-sm font-medium text-aurora-ink-3 mb-2">{t("influencer_public.media_kit")}</p>
            {inf.media_kit_pdf ? (
              <Button asChild variant="outline" size="sm">
                <a href={resolveMediaUrl(inf.media_kit_pdf)} target="_blank" rel="noreferrer">{t("influencer_public.open_media_kit")}</a>
              </Button>
            ) : (
              <p className="text-sm text-aurora-ink-3">{t("influencer_public.media_kit_unavailable")}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
