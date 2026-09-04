import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import api from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Loader2, MailWarning } from "lucide-react"

/**
 * Reminder shown while the signed-in user has not confirmed their address.
 * Deliberately non-blocking: the account stays usable, so a bounced email or a
 * lost link never traps someone out of the product.
 */
export function EmailVerificationBanner() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // `undefined` means an older cached session that predates the field: stay
  // quiet rather than nagging someone who is already verified.
  if (!user || user.email_verified !== false) return null

  const resend = async () => {
    setSending(true)
    try {
      await api.post("/auth/verify-email/")
      setSent(true)
      toast({
        title: t("verify_email.sent_title", "Email envoyé"),
        description: t("verify_email.sent_desc", "Vérifiez votre boîte de réception (et vos spams)."),
      })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-5 py-2.5 flex flex-wrap items-center gap-3">
        <MailWarning className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-[13px] text-amber-900 flex-1 min-w-[220px]">
          {t("verify_email.banner", "Confirmez votre adresse email pour sécuriser votre compte.")}{" "}
          <span className="text-amber-800/80">{user.email}</span>
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={resend}
          disabled={sending || sent}
          className="border-amber-300 bg-white hover:bg-amber-100"
        >
          {sending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {sent
            ? t("verify_email.resent", "Email envoyé")
            : t("verify_email.resend", "Renvoyer le lien")}
        </Button>
      </div>
    </div>
  )
}
