import { FormEvent, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Mail } from "lucide-react"

export default function PasswordResetRequest() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post("/auth/password-reset/", { email })
      setSent(true)
    } catch {
      toast({ variant: "destructive", title: t("auth.reset.error") })
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
            <CardTitle className="text-2xl font-bold">{t("auth.reset.title")}</CardTitle>
            <CardDescription>{t("auth.reset.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Mail className="h-6 w-6" />
                </div>
                <p className="text-sm text-gray-600">{t("auth.reset.sent")}</p>
                <Link to="/login" className="inline-block text-sm text-indigo-600 hover:underline">{t("auth.reset.back_to_login")}</Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("auth.reset.send")}
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
