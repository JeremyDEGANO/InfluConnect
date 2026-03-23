import { useState, FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export default function BrandEditProfile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    company_name: "",
    website: "",
    industry: "",
    description: "",
    instagram_url: "",
    linkedin_url: "",
  })

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    toast({ title: t("common.success"), description: "Brand profile updated successfully." })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Brand Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">Contact Person</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label>{t("auth.first_name")}</Label><Input className="mt-1" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} /></div>
            <div><Label>{t("auth.last_name")}</Label><Input className="mt-1" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">Company Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>{t("auth.company_name")}</Label><Input className="mt-1" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Your company name" /></div>
            <div><Label>Industry</Label><Input className="mt-1" value={form.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. Fashion, Technology..." /></div>
            <div><Label>Website</Label><Input className="mt-1" type="url" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://..." /></div>
            <div>
              <Label>Company Description</Label>
              <textarea className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Tell influencers about your brand..." />
            </div>
          </CardContent>
        </Card>
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">Social Links</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Instagram</Label><Input className="mt-1" placeholder="https://instagram.com/..." value={form.instagram_url} onChange={(e) => update("instagram_url", e.target.value)} /></div>
            <div><Label>LinkedIn</Label><Input className="mt-1" placeholder="https://linkedin.com/..." value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} /></div>
          </CardContent>
        </Card>
        <Button type="submit" variant="gradient" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("common.save")}
        </Button>
      </form>
    </div>
  )
}
