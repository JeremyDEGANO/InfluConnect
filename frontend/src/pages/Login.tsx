import { useState, FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Eye, EyeOff } from "lucide-react"

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await login(email, password, totpRequired ? totpCode : undefined)
      if (res.totp_required) {
        setTotpRequired(true)
        toast({ title: t("auth.totp_required_title"), description: t("auth.totp_required_desc") })
        return
      }
      const user = res.user!
      if (user.user_type === "brand") navigate("/brand/dashboard")
      else if (user.user_type === "admin") navigate("/admin")
      else navigate("/influencer/dashboard")
    } catch {
      toast({ variant: "destructive", title: t("auth.login_failed"), description: totpRequired ? t("auth.totp_invalid") : t("auth.login_failed_desc") })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-black shadow-sm">IC</div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">InfluConnect</span>
          </Link>
        </div>
        <Card className="card-base shadow-xl shadow-indigo-500/5">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">{t("auth.login")}</CardTitle>
            <CardDescription>{t("auth.welcome_back")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" disabled={totpRequired} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Link to="/reset-password" className="text-xs text-indigo-600 hover:underline">{t("auth.forgot_password")}</Link>
                </div>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={totpRequired} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {totpRequired && (
                <div>
                  <Label htmlFor="totp">{t("auth.totp_code")}</Label>
                  <Input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    className="mt-1 tracking-[0.4em] text-center font-mono"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">{t("auth.totp_hint")}</p>
                </div>
              )}
              <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : totpRequired ? t("auth.totp_verify") : t("auth.login")}
              </Button>
              {totpRequired && (
                <button
                  type="button"
                  onClick={() => { setTotpRequired(false); setTotpCode("") }}
                  className="text-xs text-gray-500 hover:text-gray-700 block mx-auto"
                >
                  {t("auth.use_different_account")}
                </button>
              )}
            </form>
            <p className="text-center text-sm text-gray-500 mt-4">
              {t("auth.no_account")}{" "}
              <Link to="/register" className="text-indigo-600 font-medium hover:underline">{t("auth.register")}</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
