import { useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Shield, ShieldCheck, ShieldOff } from "lucide-react"

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

  const enabled = !!user?.totp_enabled

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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-500" /> {t("security.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("security.subtitle")}</p>
      </div>

      <Card className="card-base">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {enabled ? <ShieldCheck className="h-5 w-5 text-emerald-500" /> : <ShieldOff className="h-5 w-5 text-gray-400" />}
                {t("security.totp_title")}
              </CardTitle>
              <CardDescription>{t("security.totp_desc")}</CardDescription>
            </div>
            {enabled
              ? <Badge variant="success">{t("security.status_on")}</Badge>
              : <Badge variant="outline">{t("security.status_off")}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enabled && !setup && (
            <Button variant="gradient" onClick={beginSetup} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              {t("security.enable")}
            </Button>
          )}

          {!enabled && setup && (
            <div className="space-y-4">
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                <li>{t("security.step_install")}</li>
                <li>{t("security.step_scan")}</li>
                <li>{t("security.step_confirm")}</li>
              </ol>
              <div className="flex flex-col sm:flex-row gap-4 items-center bg-gray-50 rounded-lg p-4">
                <img src={setup.qr_png_base64} alt="QR code" className="h-44 w-44 bg-white rounded border" />
                <div className="flex-1 space-y-2 w-full">
                  <Label>{t("security.manual_key")}</Label>
                  <code className="block text-xs font-mono break-all bg-white border rounded px-2 py-1.5">{setup.secret}</code>
                  <p className="text-[11px] text-gray-500">{t("security.manual_key_hint")}</p>
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

          {enabled && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm text-gray-600">{t("security.disable_desc")}</p>
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
        </CardContent>
      </Card>
    </div>
  )
}
