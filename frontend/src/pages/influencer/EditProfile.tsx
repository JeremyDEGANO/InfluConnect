import { useState, FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, Plus } from "lucide-react"

const THEME_OPTIONS = ["Fashion", "Beauty", "Tech", "Food", "Travel", "Fitness", "Gaming", "Lifestyle", "Finance", "Education"]

export default function InfluencerEditProfile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    bio: "",
    followers_count: "",
    engagement_rate: "",
    min_price: "",
    instagram_url: "",
    youtube_url: "",
    tiktok_url: "",
  })
  const [themes, setThemes] = useState<string[]>(["Fashion", "Lifestyle"])

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const toggleTheme = (t: string) => setThemes((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    toast({ title: t("common.success"), description: "Profile updated successfully." })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("auth.first_name")}</Label>
              <Input className="mt-1" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </div>
            <div>
              <Label>{t("auth.last_name")}</Label>
              <Input className="mt-1" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Bio</Label>
              <textarea className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.bio} onChange={(e) => update("bio", e.target.value)} placeholder="Tell brands about yourself..." />
            </div>
          </CardContent>
        </Card>

        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">Audience Stats</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <Label>Followers</Label>
              <Input className="mt-1" type="number" value={form.followers_count} onChange={(e) => update("followers_count", e.target.value)} placeholder="50000" />
            </div>
            <div>
              <Label>Engagement Rate (%)</Label>
              <Input className="mt-1" type="number" step="0.1" value={form.engagement_rate} onChange={(e) => update("engagement_rate", e.target.value)} placeholder="4.5" />
            </div>
            <div>
              <Label>Min Price (€)</Label>
              <Input className="mt-1" type="number" value={form.min_price} onChange={(e) => update("min_price", e.target.value)} placeholder="100" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">Themes / Niches</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {THEME_OPTIONS.map((theme) => (
                <Badge key={theme} variant={themes.includes(theme) ? "purple" : "outline"} className="cursor-pointer text-sm py-1 px-3" onClick={() => toggleTheme(theme)}>
                  {themes.includes(theme) ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}{theme}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">Social Links</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Instagram URL</Label><Input className="mt-1" placeholder="https://instagram.com/..." value={form.instagram_url} onChange={(e) => update("instagram_url", e.target.value)} /></div>
            <div><Label>YouTube URL</Label><Input className="mt-1" placeholder="https://youtube.com/..." value={form.youtube_url} onChange={(e) => update("youtube_url", e.target.value)} /></div>
            <div><Label>TikTok URL</Label><Input className="mt-1" placeholder="https://tiktok.com/..." value={form.tiktok_url} onChange={(e) => update("tiktok_url", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Button type="submit" variant="gradient" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("common.save")}
        </Button>
      </form>
    </div>
  )
}
