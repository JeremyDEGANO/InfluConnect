import { useState, FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MultiStepForm } from "@/components/shared/MultiStepForm"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Users, Briefcase } from "lucide-react"
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
  const [form, setForm] = useState({
    user_type: (searchParams.get("type") ?? "") as "influencer" | "brand" | "",
    email: "",
    password: "",
    confirm_password: "",
    first_name: "",
    last_name: "",
    company_name: "",
  })

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      toast({ variant: "destructive", title: "Passwords do not match" })
      return
    }
    setLoading(true)
    try {
      await register({ ...form, user_type: form.user_type as "influencer" | "brand" })
      if (form.user_type === "brand") navigate("/brand/dashboard")
      else navigate("/influencer/dashboard")
    } catch {
      toast({ variant: "destructive", title: "Registration failed", description: "Please check your details and try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold gradient-text">InfluConnect ✨</Link>
        </div>
        <Card className="card-base shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">{t("auth.register")}</CardTitle>
            <CardDescription>Create your account to get started</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <MultiStepForm steps={STEPS} currentStep={step}>
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-center text-sm text-gray-600 mb-4">How will you use InfluConnect?</p>
                  <div className="grid grid-cols-2 gap-4">
                    {(["influencer", "brand"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => update("user_type", type)}
                        className={cn(
                          "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                          form.user_type === type ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-300"
                        )}
                      >
                        {type === "influencer" ? <Users className="h-8 w-8 text-purple-500" /> : <Briefcase className="h-8 w-8 text-blue-500" />}
                        <span className="font-semibold text-sm">{t(`auth.i_am_${type}` as const)}</span>
                      </button>
                    ))}
                  </div>
                  <Button variant="gradient" className="w-full mt-4" disabled={!form.user_type} onClick={() => setStep(2)}>
                    {t("common.next")}
                  </Button>
                </div>
              )}
              {step === 2 && (
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
                    <div>
                      <Label htmlFor="company">{t("auth.company_name")}</Label>
                      <Input id="company" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} className="mt-1" />
                    </div>
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
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>{t("common.back")}</Button>
                    <Button type="submit" variant="gradient" className="flex-1" disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("auth.register")}
                    </Button>
                  </div>
                </form>
              )}
            </MultiStepForm>
            <p className="text-center text-sm text-gray-500 mt-4">
              {t("auth.have_account")}{" "}
              <Link to="/login" className="text-purple-600 font-medium hover:underline">{t("auth.login")}</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
