import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sendCounterOffer } from "@/lib/apiExtra"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Send } from "lucide-react"

interface Props {
  proposalId: number
  open: boolean
  initialPrice?: number
  onClose: () => void
  onSuccess: () => void
}

export function CounterOfferDialog({ proposalId, open, initialPrice = 0, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [price, setPrice] = useState<string>(initialPrice ? String(initialPrice) : "")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const p = Number(price)
    if (!p || p <= 0) {
      toast({ variant: "destructive", title: t("counter_offer.invalid_price") })
      return
    }
    setSubmitting(true)
    try {
      await sendCounterOffer(proposalId, p, message)
      toast({ title: t("counter_offer.sent") })
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({ variant: "destructive", title: t("counter_offer.error"), description: e?.response?.data?.detail })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("counter_offer.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="counter-price">{t("counter_offer.price_label")}</Label>
            <Input
              id="counter-price"
              type="number"
              min="1"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t("counter_offer.price_placeholder")}
            />
          </div>
          <div>
            <Label htmlFor="counter-message">{t("counter_offer.message_label")}</Label>
            <textarea
              id="counter-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("counter_offer.message_placeholder")}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>{t("counter_offer.cancel")}</Button>
            <Button variant="gradient" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {t("counter_offer.send")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
