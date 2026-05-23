import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { contactInfluencerFromMarketplace } from "@/lib/apiExtra"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Search, Loader2, MapPin, Star, Users, Send, SlidersHorizontal, X, ChevronDown } from "lucide-react"
import { FreshnessBadge, VerifiedBadge } from "@/components/social/SocialStatusBadges"

interface SocialNetwork {
  platform: string
  followers_count: number
  last_synced_at?: string | null
  is_verified_external?: boolean
}

interface Influencer {
  id: number
  pseudo?: string
  display_name: string
  bio: string
  avatar: string | null
  city: string
  content_themes: string[]
  social_networks: SocialNetwork[]
  average_rating: number | null
  total_collaborations: number
}

const ALL_THEMES = ["Beauty", "Fashion", "Tech", "Food", "Travel", "Fitness", "Gaming", "Lifestyle", "Finance", "Education"]

const ALL_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok",    label: "TikTok" },
  { value: "youtube",   label: "YouTube" },
  { value: "twitter",   label: "X / Twitter" },
  { value: "twitch",    label: "Twitch" },
  { value: "linkedin",  label: "LinkedIn" },
  { value: "snapchat",  label: "Snapchat" },
  { value: "pinterest", label: "Pinterest" },
]

const FOLLOWER_RANGES = [
  { label: "< 10K",       min: 0,         max: 10_000 },
  { label: "10K – 50K",   min: 10_000,    max: 50_000 },
  { label: "50K – 200K",  min: 50_000,    max: 200_000 },
  { label: "200K – 1M",   min: 200_000,   max: 1_000_000 },
  { label: "> 1M",        min: 1_000_000, max: Infinity },
]

const SORT_OPTIONS = [
  { value: "random",    labelEN: "Featured",              labelFR: "Mis en avant" },
  { value: "followers", labelEN: "Most followers",        labelFR: "Plus de followers" },
  { value: "rating",    labelEN: "Best rated",            labelFR: "Mieux notés" },
  { value: "collabs",   labelEN: "Most collaborations",   labelFR: "Plus de collabs" },
]

export default function Marketplace() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const isBrand = user?.user_type === "brand"
  const [items, setItems] = useState<Influencer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState("")
  const [theme, setTheme] = useState<string>("")
  const [platforms, setPlatforms] = useState<string[]>([])
  const [followerRangeIdx, setFollowerRangeIdx] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<string>("random")
  const [showFilters, setShowFilters] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null)
  const [contactMessage, setContactMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const extractPage = (payload: any): { results: Influencer[]; next: string | null } => {
    if (Array.isArray(payload)) return { results: payload, next: null }
    return {
      results: Array.isArray(payload?.results) ? payload.results : [],
      next: payload?.next ?? null,
    }
  }

  const loadFirstPage = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get("/public/marketplace/")
      const page = extractPage(r.data)
      setItems(page.results)
      setNextPageUrl(page.next)
      setHasMore(Boolean(page.next))
    } catch {
      setItems([])
      setNextPageUrl(null)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!nextPageUrl || loadingMore) return
    setLoadingMore(true)
    try {
      const r = await api.get(nextPageUrl)
      const page = extractPage(r.data)
      setItems((prev) => {
        const merged = [...prev, ...page.results]
        const dedup = new Map<number, Influencer>()
        merged.forEach((inf) => dedup.set(inf.id, inf))
        return Array.from(dedup.values())
      })
      setNextPageUrl(page.next)
      setHasMore(Boolean(page.next))
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }, [nextPageUrl, loadingMore])

  useEffect(() => {
    loadFirstPage()
  }, [loadFirstPage])

  // Auto lazy loading when sentinel enters viewport.
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore()
      }
    }, { rootMargin: "160px" })
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const filtered = useMemo(() => {
    let list = items
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((i) => (i.display_name ?? "").toLowerCase().includes(s) || (i.city ?? "").toLowerCase().includes(s))
    }
    if (theme) list = list.filter((i) => i.content_themes?.some((t) => t.toLowerCase() === theme.toLowerCase()))
    if (platforms.length > 0) {
      list = list.filter((i) => i.social_networks?.some((sn) => platforms.includes(sn.platform)))
    }
    if (followerRangeIdx !== null) {
      const { min, max } = FOLLOWER_RANGES[followerRangeIdx]
      list = list.filter((i) => {
        const total = i.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
        return total >= min && (max === Infinity ? true : total < max)
      })
    }
    if (sortBy === "followers") {
      list = [...list].sort((a, b) => {
        const fa = a.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
        const fb = b.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
        return fb - fa
      })
    } else if (sortBy === "rating") {
      list = [...list].sort((a, b) => (Number(b.average_rating) || 0) - (Number(a.average_rating) || 0))
    } else if (sortBy === "collabs") {
      list = [...list].sort((a, b) => (b.total_collaborations ?? 0) - (a.total_collaborations ?? 0))
    }
    return list
  }, [items, search, theme, platforms, followerRangeIdx, sortBy])

  const activeFilterCount = (theme ? 1 : 0) + platforms.length + (followerRangeIdx !== null ? 1 : 0)
  const clearFilters = () => { setTheme(""); setPlatforms([]); setFollowerRangeIdx(null); setSortBy("random") }
  const lang = i18n.language?.startsWith("fr") ? "FR" : "EN"

  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  const openContact = (influencer: Influencer) => {
    setSelectedInfluencer(influencer)
    setContactMessage("")
    setContactOpen(true)
  }

  const sendContactMessage = async () => {
    if (!selectedInfluencer) return
    const message = contactMessage.trim()
    if (message.length < 10) {
      toast({ variant: "destructive", title: t("marketplace.message_too_short", "Le message doit contenir au moins 10 caractères") })
      return
    }
    setSendingMessage(true)
    try {
      await contactInfluencerFromMarketplace({ influencer_id: selectedInfluencer.id, message })
      toast({ title: t("marketplace.message_sent", "Message envoyé") })
      setContactOpen(false)
      setSelectedInfluencer(null)
      setContactMessage("")
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast({ variant: "destructive", title: detail || t("common.error") })
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="min-h-screen bg-aurora-surface">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold text-aurora-ink mb-3">{t("marketplace.title")}</h1>
          <p className="text-aurora-ink-2">{t("marketplace.subtitle")}</p>
        </div>

        <Card className="card-base mb-6">
          <CardContent className="pt-6 space-y-4">
            {/* Row 1: search + filter toggle + sort */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-aurora-ink-3" />
                <Input className="pl-10" placeholder={t("marketplace.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(v => !v)}
                className={cn("gap-2 shrink-0", showFilters && "bg-indigo-50 border-indigo-300")}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {t("marketplace.filters", "Filtres")}
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-indigo-600 text-white text-xs w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
                )}
                <ChevronDown className={cn("h-3 w-3 transition-transform", showFilters && "rotate-180")} />
              </Button>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="shrink-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{lang === "FR" ? opt.labelFR : opt.labelEN}</option>
                ))}
              </select>
            </div>

            {/* Expandable filters panel */}
            {showFilters && (
              <div className="border-t border-aurora-line pt-4 space-y-4">
                {/* Themes */}
                <div>
                  <p className="text-xs font-semibold text-aurora-ink-3 uppercase tracking-wide mb-2">{t("marketplace.filter_theme", "Thème")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={theme === "" ? "info" : "outline"} className="cursor-pointer" onClick={() => setTheme("")}>{t("marketplace.filter_all")}</Badge>
                    {ALL_THEMES.map((th) => (
                      <Badge key={th} variant={theme === th ? "info" : "outline"} className="cursor-pointer" onClick={() => setTheme(th)}>{th}</Badge>
                    ))}
                  </div>
                </div>

                {/* Platforms */}
                <div>
                  <p className="text-xs font-semibold text-aurora-ink-3 uppercase tracking-wide mb-2">{t("marketplace.filter_platform", "Plateforme")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_PLATFORMS.map((p) => {
                      const active = platforms.includes(p.value)
                      return (
                        <Badge
                          key={p.value}
                          variant={active ? "info" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setPlatforms(prev => active ? prev.filter(x => x !== p.value) : [...prev, p.value])}
                        >
                          {p.label}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                {/* Follower range */}
                <div>
                  <p className="text-xs font-semibold text-aurora-ink-3 uppercase tracking-wide mb-2">{t("marketplace.filter_followers", "Nombre de followers")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={followerRangeIdx === null ? "info" : "outline"} className="cursor-pointer" onClick={() => setFollowerRangeIdx(null)}>{t("marketplace.filter_all")}</Badge>
                    {FOLLOWER_RANGES.map((r, idx) => (
                      <Badge key={idx} variant={followerRangeIdx === idx ? "info" : "outline"} className="cursor-pointer" onClick={() => setFollowerRangeIdx(followerRangeIdx === idx ? null : idx)}>{r.label}</Badge>
                    ))}
                  </div>
                </div>

                {/* Clear */}
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-aurora-ink-3 hover:text-aurora-ink-2">
                    <X className="h-3 w-3" />{t("marketplace.clear_filters", "Effacer les filtres")}
                  </button>
                )}
              </div>
            )}

            {/* Active filters summary (when panel is closed) */}
            {!showFilters && activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                {theme && <Badge variant="info" className="cursor-pointer gap-1" onClick={() => setTheme("")}>{theme} <X className="h-2.5 w-2.5" /></Badge>}
                {platforms.map(p => <Badge key={p} variant="info" className="cursor-pointer gap-1" onClick={() => setPlatforms(prev => prev.filter(x => x !== p))}>{ALL_PLATFORMS.find(x => x.value === p)?.label} <X className="h-2.5 w-2.5" /></Badge>)}
                {followerRangeIdx !== null && <Badge variant="info" className="cursor-pointer gap-1" onClick={() => setFollowerRangeIdx(null)}>{FOLLOWER_RANGES[followerRangeIdx].label} <X className="h-2.5 w-2.5" /></Badge>}
                <button onClick={clearFilters} className="text-xs text-aurora-ink-3 hover:text-aurora-ink-2 underline">{t("marketplace.clear_filters", "Effacer")}</button>
              </div>
            )}
          </CardContent>
        </Card>

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("marketplace.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-aurora-ink-3 mb-3">{t("marketplace.no_results")}</p>
            {activeFilterCount > 0 && <Button variant="outline" size="sm" onClick={clearFilters}>{t("marketplace.clear_filters", "Effacer les filtres")}</Button>}
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((inf) => {
              const totalFollowers = inf.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
              return (
                <Card key={inf.id} className="card-base hover:shadow-lg transition-shadow flex flex-col">
                  <CardContent className="pt-6 flex flex-col gap-3 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-14 w-14">
                          {inf.avatar && <AvatarImage src={inf.avatar} />}
                          <AvatarFallback className="bg-aurora-ink text-white font-semibold">
                            {(inf.display_name || "??").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold text-aurora-ink truncate">{inf.display_name || `Influencer #${inf.id}`}</p>
                          {inf.city && <p className="text-xs text-aurora-ink-3 flex items-center gap-1"><MapPin className="h-3 w-3" />{inf.city}</p>}
                        </div>
                      </div>
                      {isBrand && (
                        <button onClick={() => openContact(inf)} className="flex-shrink-0 p-2 hover:bg-aurora-surface rounded-lg transition-colors" title={t("marketplace.send_message", "Message")}>
                          <Send className="h-5 w-5 text-aurora-blue" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1">
                      {inf.bio && <p className="text-xs text-aurora-ink-2 line-clamp-2 mb-3">{inf.bio}</p>}
                      <div className="flex items-center gap-3 text-xs text-aurora-ink-3 mb-3">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{fmt(totalFollowers)}</span>
                        {inf.average_rating != null && (
                          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400 fill-amber-400" />{Number(inf.average_rating).toFixed(1)}</span>
                        )}
                        <span>{inf.total_collaborations ?? 0} {t("marketplace.collabs_suffix")}</span>
                      </div>
                      {inf.content_themes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {inf.content_themes.slice(0, 4).map((th) => (
                            <Badge key={th} variant="outline" className="text-[10px] px-1.5 py-0">{th}</Badge>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const tiktok = inf.social_networks?.find((sn) => sn.platform === "tiktok")
                        if (!tiktok) return null
                        return (
                          <div className="flex items-center gap-1 mb-2">
                            <FreshnessBadge lastSyncedAt={tiktok.last_synced_at} />
                            {tiktok.is_verified_external && <VerifiedBadge />}
                          </div>
                        )
                      })()}
                    </div>
                    {isBrand ? (
                      <div className="grid grid-cols-2 gap-2">
                        {inf.pseudo ? (
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/brand/influencers/${encodeURIComponent(inf.pseudo)}`}>{t("marketplace.view_profile", "Voir profil")}</Link>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled>{t("marketplace.view_profile", "Voir profil")}</Button>
                        )}
                        <Button asChild variant="gradient" size="sm">
                          <Link to={`/brand/campaigns/new?influencer=${inf.id}`}>{t("marketplace.create_campaign", "Créer campagne")}</Link>
                        </Button>
                      </div>
                    ) : (
                      <Link to="/register?type=brand">
                        <Button variant="outline" size="sm" className="w-full">{t("marketplace.contact_via_brand")}</Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )
              })}
            </div>

            {hasMore && (
              <div ref={loadMoreRef} className="py-8 flex items-center justify-center">
                {loadingMore ? (
                  <span className="inline-flex items-center text-sm text-aurora-ink-3"><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("marketplace.loading_more", "Chargement...")}</span>
                ) : (
                  <Button variant="outline" size="sm" onClick={loadMore}>{t("marketplace.load_more", "Charger plus")}</Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("marketplace.contact_title", "Contacter l'influenceur")}</DialogTitle>
            <DialogDescription>
              {selectedInfluencer
                ? t("marketplace.contact_desc", "Votre message sera envoyé à {{name}}.", { name: selectedInfluencer.display_name || `#${selectedInfluencer.id}` })
                : t("marketplace.contact_desc_empty", "Votre message sera envoyé à l'influenceur.")}
            </DialogDescription>
          </DialogHeader>
          <div>
            <textarea
              className="w-full min-h-[130px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              placeholder={t("marketplace.message_placeholder", "Présentez votre marque et votre besoin de collaboration...")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>{t("common.cancel", "Annuler")}</Button>
            <Button variant="gradient" onClick={sendContactMessage} disabled={sendingMessage}>
              {sendingMessage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("marketplace.send_message", "Message")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
