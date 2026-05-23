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
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState("")
  const [emailOtpRequired, setEmailOtpRequired] = useState(false)
  const [emailOtpCode, setEmailOtpCode] = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await login(
        identifier,
        password,
        totpRequired ? totpCode : undefined,
        emailOtpRequired ? emailOtpCode : undefined,
      )
      if (res.totp_required) {
        setEmailOtpRequired(false)
        setTotpRequired(true)
        toast({ title: t("auth.totp_required_title"), description: t("auth.totp_required_desc") })
        return
      }
      if (res.email_otp_required) {
        setTotpRequired(false)
        setEmailOtpRequired(true)
        toast({ title: t("auth.email_otp_required_title"), description: t("auth.email_otp_required_desc") })
        return
      }
      const user = res.user!
      if (user.user_type === "brand") navigate("/brand/dashboard")
      else if (user.user_type === "admin") navigate("/admin")
      else navigate("/influencer/dashboard")
    } catch {
      toast({
        variant: "destructive",
        title: t("auth.login_failed"),
        description: totpRequired ? t("auth.totp_invalid") : emailOtpRequired ? t("auth.email_otp_invalid") : t("auth.login_failed_desc"),
      })
    } finally {
      setLoading(false)
    }
  }

  const secondFactorRequired = totpRequired || emailOtpRequired

  return (
    <div className="min-h-screen flex items-center justify-center hero-aurora-bg px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-aurora-blue to-aurora-blue-deep flex items-center justify-center text-white text-xs font-black shadow-soft">IC</div>
            <span className="text-xl font-semibold text-aurora-ink tracking-tight">InfluConnect</span>
          </Link>
        </div>
        <Card className="card-base shadow-soft-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-3xl font-semibold tracking-tight">{t("auth.login")}</CardTitle>
            <CardDescription className="text-aurora-ink-3">{t("auth.welcome_back")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="identifier">{t("auth.email")}</Label>
                <Input id="identifier" type="text" placeholder="admin@local.dev" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="mt-1" disabled={secondFactorRequired} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Link to="/reset-password" className="text-xs text-aurora-blue hover:underline">{t("auth.forgot_password")}</Link>
                </div>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={secondFactorRequired} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-ink-3 hover:text-aurora-ink-2">
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
                  <p className="text-[11px] text-aurora-ink-3 mt-1">{t("auth.totp_hint")}</p>
                </div>
              )}
              {emailOtpRequired && (
                <div>
                  <Label htmlFor="email-otp">{t("auth.email_otp_code")}</Label>
                  <Input
                    id="email-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    className="mt-1 tracking-[0.4em] text-center font-mono"
                  />
                  <p className="text-[11px] text-aurora-ink-3 mt-1">{t("auth.email_otp_hint")}</p>
                </div>
              )}
              <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : secondFactorRequired ? t("auth.totp_verify") : t("auth.login")}
              </Button>
              {secondFactorRequired && (
                <button
                  type="button"
                  onClick={() => {
                    setTotpRequired(false)
                    setEmailOtpRequired(false)
                    setTotpCode("")
                    setEmailOtpCode("")
                  }}
                  className="text-xs text-aurora-ink-3 hover:text-aurora-ink-2 block mx-auto"
                >
                  {t("auth.use_different_account")}
                </button>
              )}
            </form>
            <p className="text-center text-sm text-aurora-ink-3 mt-4">
              {t("auth.no_account")}{" "}
              <Link to="/register" className="text-aurora-blue font-medium hover:underline">{t("auth.register")}</Link>
            </p>
            {totpRequired && (
              <p className="text-center text-xs text-aurora-ink-3 mt-3">
                <Link to="/reset-password" className="hover:text-aurora-ink-2 hover:underline mr-3">
                  {t("auth.forgot_password")}
                </Link>
                <Link to="/reset-password?mfa=1" className="hover:text-aurora-ink-2 hover:underline">
                  {t("auth.lost_authenticator", "Authentificateur perdu ?")}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
