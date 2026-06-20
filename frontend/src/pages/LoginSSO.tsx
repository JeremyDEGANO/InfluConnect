import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export default function LoginSSO() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth() as unknown as { refreshUser: () => Promise<void> }
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = params.get("code")
    const ssoError = params.get("sso_error")
    if (ssoError) {
      setError(ssoError)
      return
    }
    if (!code) {
      setError("missing_code")
      return
    }
    ;(async () => {
      try {
        // Single-use code → tokens via POST (JWTs never appear in the URL).
        const { data } = await api.post("/auth/sso/exchange/", { code })
        localStorage.setItem("access_token", data.access)
        localStorage.setItem("refresh_token", data.refresh)
        if (data?.user?.active_brand_workspace_id) {
          localStorage.setItem("selected_brand_id", String(data.user.active_brand_workspace_id))
        }
        if (typeof refreshUser === "function") {
          await refreshUser()
        }
        const user = data.user
        const next = data.next || "/"
        if (next && next !== "/" && next.startsWith("/") && !next.startsWith("//")) {
          navigate(next)
        } else if (user.user_type === "brand") {
          navigate("/brand/dashboard")
        } else if (user.user_type === "admin") {
          navigate("/admin")
        } else {
          navigate("/influencer/dashboard")
        }
      } catch {
        setError("exchange_failed")
      }
    })()
  }, [params, navigate, refreshUser])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold mb-2">{t("auth.sso_failed", "SSO sign-in failed")}</h1>
          <p className="text-aurora-ink-3 text-sm mb-4">{error}</p>
          <button className="text-aurora-blue underline" onClick={() => navigate("/login")}>
            {t("auth.back_to_login", "Back to login")}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-aurora-ink-3 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("auth.sso_finalizing", "Finalizing sign-in…")}
      </div>
    </div>
  )
}
