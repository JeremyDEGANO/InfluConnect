import { FormEvent, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle2 } from "lucide-react"

export default function PasswordResetConfirm() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get("token") || ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast({ variant: "destructive", title: t("auth.reset.too_short") })
      return
    }
    if (password !== confirm) {
      toast({ variant: "destructive", title: t("auth.reset.mismatch") })
      return
    }
    setLoading(true)
    try {
      await api.post("/auth/password-reset-confirm/", { token, new_password: password })
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
            <CardTitle className="text-2xl font-bold">{t("auth.reset.confirm_title")}</CardTitle>
            <CardDescription>{t("auth.reset.confirm_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {!token ? (
              <p className="text-center text-sm text-red-600">{t("auth.reset.no_token")}</p>
            ) : done ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <p className="text-sm text-gray-700">{t("auth.reset.success")}</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="pw">{t("auth.reset.new_password")}</Label>
                  <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pw2">{t("auth.reset.confirm_password")}</Label>
                  <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="mt-1" />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("auth.reset.update")}
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
