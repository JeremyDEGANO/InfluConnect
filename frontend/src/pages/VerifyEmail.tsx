import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

type State = "checking" | "ok" | "error"

/**
 * Confirms an email address from the link sent at signup. The token travels in
 * the URL fragment (never the query string) so it stays out of server logs and
 * Referer headers, matching the password-reset flow.
 */
export default function VerifyEmail() {
  const { t } = useTranslation()
  const [state, setState] = useState<State>("checking")
  const [message, setMessage] = useState("")
  // React 18 StrictMode mounts twice in dev; the token is single-use, so a
  // second POST would always fail and show a spurious error.
  const consumed = useRef(false)

  useEffect(() => {
    if (consumed.current) return
    consumed.current = true

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
    const token = new URLSearchParams(hash).get("token") || ""
    if (!token) {
      setState("error")
      setMessage(t("verify_email.missing", "Lien de confirmation incomplet."))
      return
    }

    api
      .post("/auth/verify-email-confirm/", { token })
      .then(() => {
        setState("ok")
        // Drop the token from the address bar once it has been used.
        window.history.replaceState(null, "", window.location.pathname)
      })
      .catch((err) => {
        setState("error")
        setMessage(
          err?.response?.data?.detail ||
            t("verify_email.failed", "Ce lien est invalide ou a déjà été utilisé."),
        )
      })
  }, [t])

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-aurora-surface">
      <Card className="card-base w-full max-w-md">
        <CardContent className="py-10 text-center">
          {state === "checking" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-aurora-blue mx-auto mb-4" />
              <p className="text-aurora-ink-2">{t("verify_email.checking", "Vérification en cours…")}</p>
            </>
          )}

          {state === "ok" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-aurora-ink mb-2">
                {t("verify_email.ok_title", "Adresse email confirmée")}
              </h1>
              <p className="text-sm text-aurora-ink-2 mb-6">
                {t("verify_email.ok_desc", "Merci ! Votre compte est maintenant pleinement actif.")}
              </p>
              <Button variant="gradient" asChild>
                <Link to="/login">{t("verify_email.go_login", "Se connecter")}</Link>
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <XCircle className="h-12 w-12 text-rose-600 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-aurora-ink mb-2">
                {t("verify_email.error_title", "Confirmation impossible")}
              </h1>
              <p className="text-sm text-aurora-ink-2 mb-6">{message}</p>
              <p className="text-xs text-aurora-ink-3 mb-5">
                {t(
                  "verify_email.error_hint",
                  "Connectez-vous puis demandez un nouveau lien depuis le bandeau affiché en haut de votre espace.",
                )}
              </p>
              <Button variant="outline" asChild>
                <Link to="/login">{t("verify_email.go_login", "Se connecter")}</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
