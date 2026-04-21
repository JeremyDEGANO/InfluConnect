import { useState, useEffect, FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import api from "@/lib/api"
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
    sector: "",
    description: "",
  })

  useEffect(() => {
    api.get("/auth/me/").then((res) => {
      const bp = res.data.brand_profile
      if (bp) {
        setForm((prev) => ({
          ...prev,
          first_name: res.data.first_name ?? prev.first_name,
          last_name: res.data.last_name ?? prev.last_name,
          company_name: bp.company_name ?? "",
          website: bp.website ?? "",
          sector: bp.sector ?? "",
          description: bp.description ?? "",
        }))
      }
    }).catch(() => {})
  }, [])

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.patch("/brands/profile/", {
        company_name: form.company_name,
        website: form.website,
        sector: form.sector,
        description: form.description,
      })
      toast({ title: t("common.success"), description: t("brand_profile.updated") })
    } catch {
      toast({ title: t("common.error"), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("brand_profile.title")}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("brand_profile.contact_person")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label>{t("auth.first_name")}</Label><Input className="mt-1" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} /></div>
            <div><Label>{t("auth.last_name")}</Label><Input className="mt-1" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">{t("brand_profile.company_info")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>{t("auth.company_name")}</Label><Input className="mt-1" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} /></div>
            <div><Label>{t("brand_profile.industry")}</Label><Input className="mt-1" value={form.sector} onChange={(e) => update("sector", e.target.value)} placeholder="e.g. Fashion, Technology..." /></div>
            <div><Label>{t("brand_profile.website")}</Label><Input className="mt-1" type="url" value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://..." /></div>
            <div>
              <Label>{t("brand_profile.company_description")}</Label>
              <textarea className="mt-1 w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.description} onChange={(e) => update("description", e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Button type="submit" variant="gradient" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("common.save")}
        </Button>
      </form>
    </div>
  )
}
