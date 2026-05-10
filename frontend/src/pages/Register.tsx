import { useState, FormEvent, useEffect } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { fetchPlans, type Plan } from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MultiStepForm } from "@/components/shared/MultiStepForm"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Users, Briefcase, Building2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: 1, title: "Role" },
  { id: 2, title: "Details" },
  { id: 3, title: "Done" },
]

export default function Register() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { register } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const roleFromQuery = searchParams.get("type") ?? ""
  const [form, setForm] = useState({
    user_type: (roleFromQuery === "influencer" ? "influencer" : (roleFromQuery === "brand" || roleFromQuery === "agency") ? "brand" : "") as "influencer" | "brand" | "",
    email: "",
    password: "",
    confirm_password: "",
    first_name: "",
    last_name: "",
    company_name: "",
    siret: "",
    subscription_plan: "",
    is_agency: roleFromQuery === "agency",
  })
  const [plans, setPlans] = useState<Plan[]>([])
  useEffect(() => { fetchPlans().then(setPlans).catch(() => {}) }, [])

  const update = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))
  const selectedRole: "influencer" | "brand" | "agency" | "" =
    form.user_type === "influencer" ? "influencer" : form.user_type === "brand" ? (form.is_agency ? "agency" : "brand") : ""

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      toast({ variant: "destructive", title: t("auth.passwords_mismatch") })
      return
    }
    if (form.user_type === "brand" && !form.subscription_plan) {
      toast({ variant: "destructive", title: t("auth.choose_plan_first", "Choisissez un plan d'abord") })
      setStep(2)
      return
    }
    setLoading(true)
    try {
      const payload: Record<string, string | boolean> = {
        user_type: form.user_type,
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
        first_name: form.first_name,
        last_name: form.last_name,
      }
      if (form.user_type === "brand") {
        payload.company_name = form.company_name
        if (form.siret) payload.siret = form.siret
        payload.subscription_plan = form.subscription_plan
        payload.is_agency = form.is_agency
      }
      const user = await register(payload)
      if (user.user_type === "brand") navigate("/brand/dashboard")
      else navigate("/influencer/dashboard")
    } catch (err: any) {
      const detail = err?.response?.data ? JSON.stringify(err.response.data) : t("auth.register_failed_desc")
      toast({ variant: "destructive", title: t("auth.register_failed"), description: detail })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-black shadow-sm">IC</div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">InfluConnect</span>
          </Link>
        </div>
        <Card className="card-base shadow-xl shadow-indigo-500/5">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">{t("auth.register")}</CardTitle>
            <CardDescription>{t("auth.create_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <MultiStepForm steps={STEPS} currentStep={step}>
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-center text-sm text-gray-600 mb-4">{t("auth.choose_role")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {([
                      { key: "influencer", icon: Users },
                      { key: "brand", icon: Briefcase },
                      { key: "agency", icon: Building2 },
                    ] as const).map(({ key, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (key === "influencer") {
                            update("user_type", "influencer")
                            update("is_agency", false)
                            return
                          }
                          update("user_type", "brand")
                          update("is_agency", key === "agency")
                        }}
                        className={cn(
                          "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                          selectedRole === key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"
                        )}
                      >
                        {key === "influencer" ? (
                          <Icon className="h-8 w-8 text-indigo-500" />
                        ) : key === "brand" ? (
                          <Icon className="h-8 w-8 text-violet-500" />
                        ) : (
                          <Icon className="h-8 w-8 text-cyan-600" />
                        )}
                        <span className="font-semibold text-sm">{t(`auth.i_am_${key}` as const)}</span>
                      </button>
                    ))}
                  </div>
                  <Button variant="gradient" className="w-full mt-4" disabled={!form.user_type} onClick={() => setStep(form.user_type === "brand" ? 2 : 3)}>
                    {t("common.next")}
                  </Button>
                </div>
              )}
              {step === 2 && form.user_type === "brand" && (
                <div className="space-y-3">
                  <p className="text-center text-sm text-gray-600 mb-2">{t("auth.choose_plan", "Choisissez votre plan")}</p>
                  <div className="space-y-2">
                    {plans.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => update("subscription_plan", p.code)}
                        className={cn(
                          "w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between",
                          form.subscription_plan === p.code ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"
                        )}
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.features.campaigns_per_month === "unlimited" ? "Campagnes illimit\u00e9es" : `${p.features.campaigns_per_month} campagnes/mois`} · {p.features.support}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-indigo-600">{p.price_eur}€</p>
                          <p className="text-xs text-gray-400">/mois HT</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>{t("common.back")}</Button>
                    <Button type="button" variant="gradient" className="flex-1" disabled={!form.subscription_plan} onClick={() => setStep(3)}>{t("common.next")}</Button>
                  </div>
                </div>
              )}
              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="fname">{t("auth.first_name")}</Label>
                      <Input id="fname" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="lname">{t("auth.last_name")}</Label>
                      <Input id="lname" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required className="mt-1" />
                    </div>
                  </div>
                  {form.user_type === "brand" && (
                    <>
                      <div>
                        <Label htmlFor="company">{t("auth.company_name")}</Label>
                        <Input id="company" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} className="mt-1" required />
                      </div>
                      <div>
                        <Label htmlFor="siret">SIRET</Label>
                        <Input id="siret" value={form.siret} onChange={(e) => update("siret", e.target.value)} className="mt-1" placeholder="14 chiffres" maxLength={14} />
                      </div>
                      {form.subscription_plan && (
                        <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                          <Check className="h-3.5 w-3.5" />
                          {t("auth.plan_selected", "Plan s\u00e9lectionn\u00e9")}: <span className="font-semibold capitalize">{form.subscription_plan}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <Label htmlFor="email">{t("auth.email")}</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="pw">{t("auth.password")}</Label>
                    <Input id="pw" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="cpw">{t("auth.confirm_password")}</Label>
                    <Input id="cpw" type="password" value={form.confirm_password} onChange={(e) => update("confirm_password", e.target.value)} required className="mt-1" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(form.user_type === "brand" ? 2 : 1)}>{t("common.back")}</Button>
                    <Button type="submit" variant="gradient" className="flex-1" disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("auth.register")}
                    </Button>
                  </div>
                </form>
              )}
            </MultiStepForm>
            <p className="text-center text-sm text-gray-500 mt-4">
              {t("auth.have_account")}{" "}
              <Link to="/login" className="text-indigo-600 font-medium hover:underline">{t("auth.login")}</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
