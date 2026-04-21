import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Loader2, MapPin, Star, Users } from "lucide-react"

interface SocialNetwork {
  platform: string
  followers_count: number
}

interface Influencer {
  id: number
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

export default function Marketplace() {
  const { t } = useTranslation()
  const [items, setItems] = useState<Influencer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [theme, setTheme] = useState<string>("")

  useEffect(() => {
    api.get("/public/marketplace/")
      .then((r) => setItems(r.data.results ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = items
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((i) => (i.display_name ?? "").toLowerCase().includes(s) || (i.city ?? "").toLowerCase().includes(s))
    }
    if (theme) list = list.filter((i) => i.content_themes?.some((t) => t.toLowerCase() === theme.toLowerCase()))
    return list
  }, [items, search, theme])

  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">{t("marketplace.title")}</h1>
          <p className="text-gray-600">{t("marketplace.subtitle")}</p>
        </div>

        <Card className="card-base mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input className="pl-10" placeholder={t("marketplace.search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={theme === "" ? "info" : "outline"} className="cursor-pointer" onClick={() => setTheme("")}>{t("marketplace.filter_all")}</Badge>
              {ALL_THEMES.map((t) => (
                <Badge key={t} variant={theme === t ? "info" : "outline"} className="cursor-pointer" onClick={() => setTheme(t)}>{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("marketplace.loading")}</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-20">{t("marketplace.no_results")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((inf) => {
              const totalFollowers = inf.social_networks?.reduce((s, sn) => s + sn.followers_count, 0) ?? 0
              return (
                <Card key={inf.id} className="card-base hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-14 w-14">
                        {inf.avatar && <AvatarImage src={inf.avatar} />}
                        <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-violet-600 text-white font-semibold">
                          {(inf.display_name || "??").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{inf.display_name || `Influencer #${inf.id}`}</p>
                        {inf.city && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{inf.city}</p>}
                      </div>
                    </div>
                    {inf.bio && <p className="text-xs text-gray-600 line-clamp-2 mb-3">{inf.bio}</p>}
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
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
                    <Link to="/register?type=brand">
                      <Button variant="outline" size="sm" className="w-full">{t("marketplace.contact_via_brand")}</Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
