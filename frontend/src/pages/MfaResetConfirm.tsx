import { FormEvent, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle2, ShieldOff } from "lucide-react"

export default function MfaResetConfirm() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get("token") || ""
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) {
      toast({ variant: "destructive", title: t("security.fill_all") })
      return
    }
    setLoading(true)
    try {
      await api.post("/auth/2fa/reset-confirm/", { token, password })
      setDone(true)
      setTimeout(() => navigate("/login"), 1800)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string | string[] } } })?.response?.data?.detail
      const msg = Array.isArray(detail) ? detail.join(" ") : detail || t("auth.reset.invalid_link")
      toast({ variant: "destructive", title: t("auth.reset.error"), description: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 px-4">
      <div className="w-full max-w-md">
        <Card className="card-base shadow-xl shadow-indigo-500/5">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <ShieldOff className="h-6 w-6 text-amber-500" />
              {t("security.mfa_reset_confirm_title", "Réinitialiser la 2FA")}
            </CardTitle>
            <CardDescription>
              {t(
                "security.mfa_reset_confirm_desc",
                "Confirmez votre mot de passe pour désactiver la double authentification. Vous pourrez ensuite la reconfigurer depuis vos paramètres de sécurité.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {!token ? (
              <p className="text-center text-sm text-red-600">{t("auth.reset.no_token")}</p>
            ) : done ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <p className="text-sm text-gray-700">
                  {t("security.mfa_reset_done", "2FA désactivée. Connectez-vous puis reconfigurez un nouvel authentificateur.")}
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="pw">{t("security.current_password")}</Label>
                  <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1" autoComplete="current-password" />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("security.mfa_reset_confirm_button", "Désactiver la 2FA")}
                </Button>
                <p className="text-center text-xs text-gray-500">
                  <Link to="/login" className="text-indigo-600 hover:underline">{t("auth.reset.back_to_login")}</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
