import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { StripeModeBanner } from "./StripeModeBanner"
import { CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title?: string
  amount: number
  description?: string
  ctaLabel?: string
}

/**
 * Payment confirmation only. Card details must only ever be collected by
 * Stripe Elements once the live integration is enabled.
 */
export function PaymentDialog({
  open, onClose, onConfirm, title, amount,
  description, ctaLabel,
}: Props) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-aurora-blue" />
            {title ?? t("payment.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <StripeModeBanner />
          <div className="p-4 bg-aurora-blue/10 rounded-xl">
            <p className="text-xs text-aurora-ink-3 uppercase tracking-wide">{t("payment.amount")}</p>
            <p className="text-3xl font-semibold tracking-tight text-aurora-ink mt-1">€{amount.toFixed(2)}</p>
            {description && <p className="text-xs text-aurora-ink-2 mt-2">{description}</p>}
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-aurora-line bg-aurora-surface p-3 text-sm text-aurora-ink-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-aurora-blue" />
            <p>{t("payment.provider_notice", "Payment details are handled only by the configured payment provider. InfluConnect never stores card numbers.")}</p>
          </div>
          <div className="flex gap-2 items-center text-xs text-aurora-ink-3">
            <Lock className="h-3 w-3" /> {t("payment.secure")}
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={submitting}>{t("payment.cancel")}</Button>
            <Button variant="gradient" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
              {ctaLabel ?? t("payment.pay")} €{amount.toFixed(2)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
