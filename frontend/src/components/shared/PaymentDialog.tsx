import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StripeModeBanner } from "./StripeModeBanner"
import { CreditCard, Loader2, Lock } from "lucide-react"

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
 * Universal payment confirmation dialog. In stub mode it collects mock card
 * fields (not sent to backend) purely for UX — backend fund-escrow endpoint
 * already handles the Stripe PaymentIntent (real or stub). When real Stripe
 * keys are configured, this should be replaced with @stripe/react-stripe-js
 * <Elements> + <CardElement> flow.
 */
export function PaymentDialog({
  open, onClose, onConfirm, title, amount,
  description, ctaLabel,
}: Props) {
  const { t } = useTranslation()
  const [card, setCard] = useState("")
  const [exp, setExp] = useState("")
  const [cvc, setCvc] = useState("")
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

  const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()
  const fmtExp = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4)
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-600" />
            {title ?? t("payment.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <StripeModeBanner />
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{t("payment.amount")}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">€{amount.toFixed(2)}</p>
            {description && <p className="text-xs text-gray-600 mt-2">{description}</p>}
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="card-number" className="text-xs">{t("payment.card_number")}</Label>
              <Input
                id="card-number"
                placeholder="4242 4242 4242 4242"
                value={card}
                onChange={(e) => setCard(fmtCard(e.target.value))}
                maxLength={19}
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="card-exp" className="text-xs">{t("payment.expiration")}</Label>
                <Input
                  id="card-exp"
                  placeholder="MM/AA"
                  value={exp}
                  onChange={(e) => setExp(fmtExp(e.target.value))}
                  maxLength={5}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                />
              </div>
              <div>
                <Label htmlFor="card-cvc" className="text-xs">{t("payment.cvc")}</Label>
                <Input
                  id="card-cvc"
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center text-xs text-gray-400">
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
