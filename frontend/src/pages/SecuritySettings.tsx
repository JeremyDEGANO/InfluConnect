import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Shield, ShieldCheck, ShieldOff, KeyRound } from "lucide-react"

interface SetupData {
  secret: string
  otpauth_url: string
  qr_png_base64: string
}

export default function SecuritySettings() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user, refreshUser } = useAuth()
  const [setup, setSetup] = useState<SetupData | null>(null)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  // Password change
  const [pwdCurrent, setPwdCurrent] = useState("")
  const [pwdNew, setPwdNew] = useState("")
  const [pwdConfirm, setPwdConfirm] = useState("")
  const [pwdLoading, setPwdLoading] = useState(false)

  // MFA reset request
  const [resetEmail, setResetEmail] = useState(user?.email ?? "")
  const [resetSending, setResetSending] = useState(false)

  const totpEnabled = !!user?.totp_enabled
  const emailEnabled = !!user?.email_2fa_enabled
  const activeMode: "none" | "email" | "totp" = totpEnabled ? "totp" : emailEnabled ? "email" : "none"
  const [selectedMode, setSelectedMode] = useState<"none" | "email" | "totp">(activeMode)

  useEffect(() => {
    setSelectedMode(activeMode)
  }, [activeMode])

  const beginSetup = async () => {
    setLoading(true)
    try {
      const { data } = await api.post<SetupData>("/auth/2fa/setup/")
      setSetup(data)
    } catch {
      toast({ variant: "destructive", title: t("security.error") })
    } finally {
      setLoading(false)
    }
  }

  const confirmSetup = async () => {
    if (code.length < 6) return
    setLoading(true)
    try {
      await api.post("/auth/2fa/confirm/", { code })
      toast({ title: t("security.enabled_title"), description: t("security.enabled_desc") })
      setSetup(null)
      setCode("")
      await refreshUser()
    } catch {
      toast({ variant: "destructive", title: t("security.invalid_code") })
    } finally {
      setLoading(false)
    }
  }

  const disable = async () => {
    if (!password || !code) {
      toast({ variant: "destructive", title: t("security.fill_all") })
      return
    }
    setLoading(true)
    try {
      await api.post("/auth/2fa/disable/", { password, code })
      toast({ title: t("security.disabled_title") })
      setPassword("")
      setCode("")
      await refreshUser()
    } catch {
      toast({ variant: "destructive", title: t("security.disable_failed") })
    } finally {
      setLoading(false)
    }
  }

  const enableEmail2FA = async () => {
    setLoading(true)
    try {
      await api.post("/auth/2fa/email/enable/")
      toast({ title: t("security.email_enabled_title") })
      setSetup(null)
      setCode("")
      await refreshUser()
    } catch {
      toast({ variant: "destructive", title: t("security.error") })
    } finally {
      setLoading(false)
    }
  }

  const disableEmail2FA = async () => {
    if (!password) {
      toast({ variant: "destructive", title: t("security.current_password") })
      return
    }
    setLoading(true)
    try {
      await api.post("/auth/2fa/email/disable/", { password })
      toast({ title: t("security.email_disabled_title") })
      setPassword("")
      await refreshUser()
    } catch {
      toast({ variant: "destructive", title: t("security.email_disable_failed") })
    } finally {
      setLoading(false)
    }
  }

  const changePassword = async () => {
    if (!pwdCurrent || !pwdNew || !pwdConfirm) {
      toast({ variant: "destructive", title: t("security.fill_all") })
      return
    }
    if (pwdNew !== pwdConfirm) {
      toast({ variant: "destructive", title: t("security.password_mismatch", "Les mots de passe ne correspondent pas") })
      return
    }
    if (pwdNew.length < 8) {
      toast({ variant: "destructive", title: t("security.password_too_short", "Mot de passe trop court (8 caractères minimum)") })
      return
    }
    setPwdLoading(true)
    try {
      await api.post("/auth/password-change/", { current_password: pwdCurrent, new_password: pwdNew })
      toast({ title: t("security.password_changed", "Mot de passe modifié") })
      setPwdCurrent(""); setPwdNew(""); setPwdConfirm("")
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      toast({
        variant: "destructive",
        title: t("security.password_change_failed", "Échec du changement"),
        description: Array.isArray(detail) ? detail.join(" • ") : (typeof detail === "string" ? detail : undefined),
      })
    } finally {
      setPwdLoading(false)
    }
  }

  const requestMfaReset = async () => {
    if (!resetEmail) {
      toast({ variant: "destructive", title: t("security.fill_all") })
      return
    }
    setResetSending(true)
    try {
      await api.post("/auth/2fa/reset/", { email: resetEmail })
      toast({
        title: t("security.mfa_reset_sent_title", "Email envoyé"),
        description: t("security.mfa_reset_sent_desc", "Si un compte existe avec cet email et que la 2FA est active, un lien de réinitialisation a été envoyé."),
      })
    } catch {
      toast({ variant: "destructive", title: t("security.error") })
    } finally {
      setResetSending(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-aurora-ink-3">{t("common.account", "Compte")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-500" /> {t("security.title")}
        </h1>
        <p className="text-sm text-aurora-ink-3 mt-1">{t("security.subtitle")}</p>
      </div>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-lg">{t("security.method_title")}</CardTitle>
          <CardDescription>{t("security.method_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant={activeMode === "none" ? "outline" : "success"}>
            {activeMode === "totp" ? t("security.method_totp") : activeMode === "email" ? t("security.method_email") : t("security.method_none")}
          </Badge>
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => { setSelectedMode("none"); setSetup(null); setCode("") }}
              className={`rounded-md border px-3 py-2 text-sm text-left transition ${selectedMode === "none" ? "border-indigo-300 bg-indigo-50 text-aurora-blue-deep" : "border-aurora-line hover:bg-aurora-surface"}`}
            >
              {t("security.method_none")}
            </button>
            <button
              type="button"
              onClick={() => { setSelectedMode("email"); setSetup(null); setCode("") }}
              className={`rounded-md border px-3 py-2 text-sm text-left transition ${selectedMode === "email" ? "border-indigo-300 bg-indigo-50 text-aurora-blue-deep" : "border-aurora-line hover:bg-aurora-surface"}`}
            >
              {t("security.method_email")}
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode("totp")}
              className={`rounded-md border px-3 py-2 text-sm text-left transition ${selectedMode === "totp" ? "border-indigo-300 bg-indigo-50 text-aurora-blue-deep" : "border-aurora-line hover:bg-aurora-surface"}`}
            >
              {t("security.method_totp")}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {selectedMode === "none" ? <ShieldOff className="h-5 w-5 text-aurora-ink-3" /> : <ShieldCheck className="h-5 w-5 text-emerald-500" />}
                {selectedMode === "totp" ? t("security.totp_title") : selectedMode === "email" ? t("security.email_title") : t("security.method_none")}
              </CardTitle>
              <CardDescription>
                {selectedMode === "totp" ? t("security.totp_desc") : selectedMode === "email" ? t("security.email_desc") : t("security.method_none")}
              </CardDescription>
            </div>
            <Badge variant={activeMode === selectedMode && selectedMode !== "none" ? "success" : "outline"}>
              {activeMode === selectedMode ? t("security.status_on") : t("security.status_off")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedMode === "email" && !emailEnabled && (
            <Button variant="gradient" onClick={enableEmail2FA} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              {t("security.email_enable")}
            </Button>
          )}

          {selectedMode === "email" && emailEnabled && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm text-aurora-ink-2">{t("security.email_disable_desc")}</p>
              <div>
                <Label htmlFor="email-disable-pw">{t("security.current_password")}</Label>
                <Input id="email-disable-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 max-w-sm" />
              </div>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={disableEmail2FA} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
                {t("security.email_disable")}
              </Button>
            </div>
          )}

          {selectedMode === "totp" && !totpEnabled && !setup && (
            <Button variant="gradient" onClick={beginSetup} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              {t("security.enable")}
            </Button>
          )}

          {selectedMode === "totp" && !totpEnabled && setup && (
            <div className="space-y-4">
              <ol className="list-decimal list-inside text-sm text-aurora-ink-2 space-y-1">
                <li>{t("security.step_install")}</li>
                <li>{t("security.step_scan")}</li>
                <li>{t("security.step_confirm")}</li>
              </ol>
              <div className="flex flex-col sm:flex-row gap-4 items-center bg-aurora-surface rounded-lg p-4">
                <img src={setup.qr_png_base64} alt="QR code" className="h-44 w-44 bg-white rounded border" />
                <div className="flex-1 space-y-2 w-full">
                  <Label>{t("security.manual_key")}</Label>
                  <code className="block text-xs font-mono break-all bg-white border rounded px-2 py-1.5">{setup.secret}</code>
                  <p className="text-[11px] text-aurora-ink-3">{t("security.manual_key_hint")}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="code">{t("security.enter_code")}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 tracking-[0.4em] text-center font-mono max-w-[180px]"
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="gradient" onClick={confirmSetup} disabled={loading || code.length !== 6}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t("security.confirm_enable")}
                </Button>
                <Button variant="outline" onClick={() => { setSetup(null); setCode("") }} disabled={loading}>
                  {t("security.cancel")}
                </Button>
              </div>
            </div>
          )}

          {selectedMode === "totp" && totpEnabled && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm text-aurora-ink-2">{t("security.disable_desc")}</p>
              <div>
                <Label htmlFor="pw">{t("security.current_password")}</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 max-w-sm" />
              </div>
              <div>
                <Label htmlFor="dcode">{t("security.enter_code")}</Label>
                <Input
                  id="dcode"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 tracking-[0.4em] text-center font-mono max-w-[180px]"
                  placeholder="123456"
                />
              </div>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={disable} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
                {t("security.disable")}
              </Button>
            </div>
          )}

          {selectedMode === "none" && activeMode === "email" && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm text-aurora-ink-2">{t("security.email_disable_desc")}</p>
              <div>
                <Label htmlFor="none-disable-email-pw">{t("security.current_password")}</Label>
                <Input id="none-disable-email-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 max-w-sm" />
              </div>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={disableEmail2FA} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
                {t("security.email_disable")}
              </Button>
            </div>
          )}

          {selectedMode === "none" && activeMode === "totp" && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm text-aurora-ink-2">{t("security.disable_desc")}</p>
              <div>
                <Label htmlFor="none-disable-totp-pw">{t("security.current_password")}</Label>
                <Input id="none-disable-totp-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 max-w-sm" />
              </div>
              <div>
                <Label htmlFor="none-disable-totp-code">{t("security.enter_code")}</Label>
                <Input
                  id="none-disable-totp-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 tracking-[0.4em] text-center font-mono max-w-[180px]"
                  placeholder="123456"
                />
              </div>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={disable} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
                {t("security.disable")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-indigo-500" /> {t("security.password_title", "Mot de passe")}
          </CardTitle>
          <CardDescription>{t("security.password_desc", "Modifiez votre mot de passe en saisissant l'actuel et un nouveau (8 caractères minimum).")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="pwd-current">{t("security.current_password")}</Label>
            <Input id="pwd-current" type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} className="mt-1 max-w-sm" autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="pwd-new">{t("security.new_password", "Nouveau mot de passe")}</Label>
            <Input id="pwd-new" type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} className="mt-1 max-w-sm" autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="pwd-confirm">{t("security.confirm_password", "Confirmer le nouveau mot de passe")}</Label>
            <Input id="pwd-confirm" type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} className="mt-1 max-w-sm" autoComplete="new-password" />
          </div>
          <Button variant="gradient" onClick={changePassword} disabled={pwdLoading}>
            {pwdLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
            {t("security.change_password", "Modifier le mot de passe")}
          </Button>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldOff className="h-5 w-5 text-amber-500" /> {t("security.mfa_reset_title", "Authentificateur perdu ?")}
          </CardTitle>
          <CardDescription>
            {t(
              "security.mfa_reset_desc",
              "Si vous n'avez plus accès à votre application d'authentification, demandez un email de réinitialisation. Le lien expire dans 1 heure et requiert votre mot de passe pour valider la désactivation.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="mfa-email">{t("auth.email", "Email")}</Label>
            <Input id="mfa-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="mt-1 max-w-sm" />
          </div>
          <Button variant="outline" onClick={requestMfaReset} disabled={resetSending}>
            {resetSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
            {t("security.mfa_reset_button", "Envoyer le lien de réinitialisation 2FA")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
