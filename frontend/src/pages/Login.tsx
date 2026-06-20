import { useState, FormEvent, useEffect, useRef } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { isNative, openExternal } from "@/lib/native"
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react"

type SSODiscovery = { sso: boolean; provider?: string; enforce?: boolean; brand_name?: string }

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState("")
  const [emailOtpRequired, setEmailOtpRequired] = useState(false)
  const [emailOtpCode, setEmailOtpCode] = useState("")
  const [sso, setSso] = useState<SSODiscovery>({ sso: false })
  const [ssoChecking, setSsoChecking] = useState(false)
  const discoverTimer = useRef<number | null>(null)

  // Single entry point: when the user types a work email we silently check
  // whether the domain is bound to a verified SSO workspace. If yes we switch
  // the form to "Continue with Microsoft" (and hide the password if enforced).
  useEffect(() => {
    if (discoverTimer.current) window.clearTimeout(discoverTimer.current)
    if (!identifier.includes("@") || identifier.length < 4) {
      setSso({ sso: false }); return
    }
    discoverTimer.current = window.setTimeout(async () => {
      setSsoChecking(true)
      try {
        const { data } = await api.get<SSODiscovery>("/auth/sso/discover/", { params: { email: identifier } })
        setSso(data)
      } catch { setSso({ sso: false }) }
      finally { setSsoChecking(false) }
    }, 350)
    return () => { if (discoverTimer.current) window.clearTimeout(discoverTimer.current) }
  }, [identifier])

  // Retour SSO en erreur (deep link mobile ou redirection web) : informer l'utilisateur.
  useEffect(() => {
    const ssoError = searchParams.get("sso_error")
    if (ssoError) {
      toast({ variant: "destructive", title: t("auth.sso_failed", "SSO sign-in failed"), description: ssoError })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const startSSO = async () => {
    setLoading(true)
    try {
      // En natif, Microsoft s'ouvre dans le navigateur système (Custom Tab) et
      // revient dans l'app via le deep link influconnect://login/sso?code=...
      const { data } = await api.post("/auth/sso/office365/start/", {
        email: identifier,
        client: isNative ? "mobile" : "web",
      })
      if (isNative) {
        await openExternal(data.authorize_url)
        setLoading(false)
        return
      }
      window.location.href = data.authorize_url
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast({ variant: "destructive", title: t("auth.sso_unavailable", "SSO unavailable"), description: detail || t("auth.sso_unavailable_desc") })
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // SSO-only redirect: bypass password entirely.
    if (sso.sso && !secondFactorRequired) return startSSO()
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
      const redirectTo = searchParams.get("redirect")
      if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) navigate(redirectTo)
      else if (user.user_type === "brand") navigate("/brand/dashboard")
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
  // When SSO is detected and enforced, hide local password entry entirely.
  const ssoOnly = sso.sso && !!sso.enforce && !secondFactorRequired
  const ssoActive = sso.sso && !secondFactorRequired

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
                {ssoChecking && !secondFactorRequired && (
                  <p className="text-[11px] text-aurora-ink-3 mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{t("auth.sso_checking", "Checking workspace…")}</p>
                )}
                {ssoActive && (
                  <div className="mt-2 rounded-md border border-aurora-blue/30 bg-aurora-blue/5 px-3 py-2 text-xs text-aurora-ink-2 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-aurora-blue shrink-0 mt-0.5" />
                    <span>
                      {sso.enforce
                        ? t("auth.sso_enforced", "Microsoft SSO is required for {{brand}}. You'll be redirected to Office 365.", { brand: sso.brand_name || "" })
                        : t("auth.sso_available", "Microsoft SSO is enabled for {{brand}}.", { brand: sso.brand_name || "" })}
                    </span>
                  </div>
                )}
              </div>
              {!ssoOnly && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <Link to="/reset-password" className="text-xs text-aurora-blue hover:underline">{t("auth.forgot_password")}</Link>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required={!ssoActive} disabled={secondFactorRequired} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-ink-3 hover:text-aurora-ink-2">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
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
              <Button type="submit" variant={ssoActive ? "outline" : "gradient"} className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> :
                  secondFactorRequired ? t("auth.totp_verify") :
                  ssoActive ? (
                    <>
                      <svg className="h-4 w-4 mr-2" viewBox="0 0 23 23" aria-hidden>
                        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                        <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
                        <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
                        <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
                      </svg>
                      {t("auth.continue_microsoft", "Continue with Microsoft")}
                    </>
                  ) : t("auth.login")}
              </Button>
              {ssoActive && !sso.enforce && (
                <p className="text-[11px] text-aurora-ink-3 text-center">
                  {t("auth.sso_or_password", "Or fill the password above to use a local account.")}
                </p>
              )}
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
