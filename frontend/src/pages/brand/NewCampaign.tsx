import { useState, FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiStepForm } from "@/components/shared/MultiStepForm"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ArrowLeft } from "lucide-react"

const STEPS = [
  { id: 1, title: "Basics" },
  { id: 2, title: "Details" },
  { id: 3, title: "Budget" },
]

const THEME_OPTIONS = ["Fashion", "Beauty", "Tech", "Food", "Travel", "Fitness", "Gaming", "Lifestyle", "Finance", "Education"]

export default function NewCampaign() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", target_audience: "", deadline: "", budget: "", min_followers: "", themes: [] as string[] })

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const toggleTheme = (theme: string) => setForm((p) => ({ ...p, themes: p.themes.includes(theme) ? p.themes.filter((t) => t !== theme) : [...p.themes, theme] }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
    toast({ title: "Campaign created!", description: "Your campaign is now live." })
    navigate("/brand/campaigns")
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-2xl font-bold text-gray-900">{t("campaigns.new_campaign")}</h1>
      </div>

      <Card className="card-base">
        <CardContent className="pt-6">
          <MultiStepForm steps={STEPS} currentStep={step}>
            {step === 1 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">Campaign Basics</CardTitle></CardHeader>
                <div>
                  <Label>Campaign Title *</Label>
                  <Input className="mt-1" placeholder="e.g. Summer Collection 2024" value={form.title} onChange={(e) => update("title", e.target.value)} required />
                </div>
                <div>
                  <Label>Description *</Label>
                  <textarea className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Describe your campaign..." value={form.description} onChange={(e) => update("description", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">{t("campaigns.themes")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {THEME_OPTIONS.map((theme) => (
                      <Badge key={theme} variant={form.themes.includes(theme) ? "purple" : "outline"} className="cursor-pointer" onClick={() => toggleTheme(theme)}>{theme}</Badge>
                    ))}
                  </div>
                </div>
                <Button variant="gradient" className="w-full" disabled={!form.title} onClick={() => setStep(2)}>{t("common.next")}</Button>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">Target & Timeline</CardTitle></CardHeader>
                <div>
                  <Label>{t("campaigns.target_audience")}</Label>
                  <Input className="mt-1" placeholder="e.g. Women 18-35 interested in fashion" value={form.target_audience} onChange={(e) => update("target_audience", e.target.value)} />
                </div>
                <div>
                  <Label>Min Influencer Followers</Label>
                  <Input className="mt-1" type="number" placeholder="e.g. 10000" value={form.min_followers} onChange={(e) => update("min_followers", e.target.value)} />
                </div>
                <div>
                  <Label>{t("campaigns.deadline")}</Label>
                  <Input className="mt-1" type="date" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>{t("common.back")}</Button>
                  <Button variant="gradient" className="flex-1" onClick={() => setStep(3)}>{t("common.next")}</Button>
                </div>
              </div>
            )}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <CardHeader className="p-0 pb-4"><CardTitle className="text-base">Budget & Launch</CardTitle></CardHeader>
                <div>
                  <Label>{t("campaigns.budget")} (€) *</Label>
                  <Input className="mt-1" type="number" placeholder="e.g. 2000" value={form.budget} onChange={(e) => update("budget", e.target.value)} required />
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-sm">
                  <p className="font-semibold text-purple-800 mb-2">Campaign Summary</p>
                  <p className="text-purple-700"><span className="font-medium">Title:</span> {form.title || "—"}</p>
                  <p className="text-purple-700"><span className="font-medium">Themes:</span> {form.themes.join(", ") || "—"}</p>
                  <p className="text-purple-700"><span className="font-medium">Deadline:</span> {form.deadline || "—"}</p>
                  <p className="text-purple-700"><span className="font-medium">Budget:</span> {form.budget ? `€${form.budget}` : "—"}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>{t("common.back")}</Button>
                  <Button type="submit" variant="gradient" className="flex-1" disabled={loading || !form.budget}>
                    {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : "Launch Campaign 🚀"}
                  </Button>
                </div>
              </form>
            )}
          </MultiStepForm>
        </CardContent>
      </Card>
    </div>
  )
}
