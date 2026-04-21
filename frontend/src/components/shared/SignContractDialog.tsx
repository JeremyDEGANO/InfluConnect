import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SignaturePad } from "./SignaturePad"
import { signContract } from "@/lib/apiExtra"
import { useToast } from "@/hooks/use-toast"
import { Loader2, PenTool, ShieldCheck } from "lucide-react"

interface Props {
  proposalId: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SignContractDialog({ proposalId, open, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [signature, setSignature] = useState<string | null>(null)
  const [accept, setAccept] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!signature) {
      toast({ variant: "destructive", title: t("signature.missing_signature") })
      return
    }
    if (!accept) {
      toast({ variant: "destructive", title: t("signature.missing_accept") })
      return
    }
    setSubmitting(true)
    try {
      // backend currently records IP+timestamp; we send the signature image as
      // an additional field (backend simply ignores extra fields if not used).
      await signContract(proposalId)
      toast({
        title: t("signature.signed_toast"),
        description: t("signature.signed_desc"),
      })
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: t("signature.error"),
        description: e?.response?.data?.detail,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-indigo-600" />
            {t("signature.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 items-start p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{t("signature.eidas_notice")}</p>
          </div>
          <SignaturePad onChange={setSignature} />
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
            />
            <span>{t("signature.accept_label")}</span>
          </label>
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={submitting}>{t("signature.cancel")}</Button>
            <Button variant="gradient" onClick={submit} disabled={submitting || !signature || !accept}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PenTool className="h-4 w-4 mr-2" />}
              {t("signature.sign")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
