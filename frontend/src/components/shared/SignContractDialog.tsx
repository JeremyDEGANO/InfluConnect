import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SignaturePad } from "./SignaturePad"
import api from "@/lib/api"
import { createSignSession, getSignSession, signContract } from "@/lib/apiExtra"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth"
import { Loader2, PenTool, ShieldCheck, QrCode, Smartphone } from "lucide-react"
import QRCode from "qrcode"

interface Props {
  proposalId: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SignContractDialog({ proposalId, open, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { user } = useAuth()
  const [signature, setSignature] = useState<string | null>(null)
  const [accept, setAccept] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signatureMode, setSignatureMode] = useState<"draw" | "brand_name" | "person_name">("draw")
  const [proposal, setProposal] = useState<any | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionUrl, setSessionUrl] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const signAsLabel = useMemo(() => {
    if (!proposal) return ""
    if (user?.user_type === "brand") return proposal.brand_company_name || "Marque"
    return proposal.influencer_display_name || user?.username || "Signataire"
  }, [proposal, user])

  const personLabel = useMemo(() => {
    const first = (user as any)?.first_name || ""
    const last = (user as any)?.last_name || ""
    const full = `${first} ${last}`.trim()
    return full || user?.username || "Signataire"
  }, [user])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const bootstrap = async () => {
      try {
        const [proposalRes, sessionRes] = await Promise.all([
          api.get(`/proposals/${proposalId}/`),
          createSignSession(proposalId),
        ])
        if (cancelled) return
        setProposal(proposalRes.data)
        setSessionToken(sessionRes.token)
        setSessionUrl(sessionRes.sign_url)
        setSessionReady(true)
      } catch {
        if (!cancelled) {
          setSessionReady(false)
        }
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [open, proposalId])

  useEffect(() => {
    if (!open || !sessionToken) return
    const timer = setInterval(async () => {
      try {
        const s = await getSignSession(sessionToken)
        if (s.used) {
          toast({
            title: t("signature.signed_toast"),
            description: t("signature.signed_desc"),
          })
          onSuccess()
          onClose()
          clearInterval(timer)
        }
      } catch {
        // Session may expire or transiently fail; keep dialog usable for direct signing.
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [open, sessionToken, onClose, onSuccess, t, toast])

  useEffect(() => {
    let cancelled = false
    const generateQr = async () => {
      if (!sessionUrl) {
        setQrDataUrl(null)
        return
      }
      try {
        const dataUrl = await QRCode.toDataURL(sessionUrl, {
          margin: 1,
          width: 192,
          errorCorrectionLevel: "M",
        })
        if (!cancelled) {
          setQrDataUrl(dataUrl)
        }
      } catch {
        if (!cancelled) {
          setQrDataUrl(null)
        }
      }
    }
    generateQr()
    return () => {
      cancelled = true
    }
  }, [sessionUrl])

  useEffect(() => {
    if (!open) {
      setSignature(null)
      setAccept(false)
      setSignatureMode("draw")
      setProposal(null)
      setSessionToken(null)
      setSessionUrl(null)
      setSessionReady(false)
      setQrDataUrl(null)
    }
  }, [open])

  const submit = async () => {
    const needDrawn = signatureMode === "draw"
    if (needDrawn && !signature) {
      toast({ variant: "destructive", title: t("signature.missing_signature") })
      return
    }
    if (!accept) {
      toast({ variant: "destructive", title: t("signature.missing_accept") })
      return
    }
    setSubmitting(true)
    try {
      const signatureValue = signatureMode === "brand_name"
        ? signAsLabel
        : signatureMode === "person_name"
          ? personLabel
          : null

      await signContract(proposalId, {
        consent: accept,
        signature_mode: signatureMode,
        signature_value: signatureValue || undefined,
        signature_data: signatureMode === "draw" ? signature : null,
      })
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
            <PenTool className="h-5 w-5 text-aurora-blue" />
            {t("signature.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 items-start p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{t("signature.eidas_notice")}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-aurora-ink-2">Mode de signature</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                className={`text-left p-2 rounded-lg border ${signatureMode === "draw" ? "border-indigo-500 bg-indigo-50" : "border-aurora-line"}`}
                onClick={() => setSignatureMode("draw")}
              >
                Signature manuscrite
              </button>
              <button
                type="button"
                className={`text-left p-2 rounded-lg border ${signatureMode === "brand_name" ? "border-indigo-500 bg-indigo-50" : "border-aurora-line"}`}
                onClick={() => setSignatureMode("brand_name")}
              >
                Signer avec {signAsLabel || "le nom affiché"}
              </button>
              <button
                type="button"
                className={`text-left p-2 rounded-lg border ${signatureMode === "person_name" ? "border-indigo-500 bg-indigo-50" : "border-aurora-line"}`}
                onClick={() => setSignatureMode("person_name")}
              >
                Signer avec {personLabel}
              </button>
            </div>
          </div>

          {signatureMode === "draw" ? (
            <SignaturePad onChange={setSignature} />
          ) : (
            <div className="rounded-xl border border-aurora-line bg-aurora-surface px-3 py-4 text-sm text-aurora-ink-2">
              La signature textuelle sera enregistrée comme :
              <div className="mt-2 font-semibold text-aurora-ink">
                {signatureMode === "brand_name" ? signAsLabel : personLabel}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-aurora-line p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-aurora-ink">
              <QrCode className="h-4 w-4" />
              Signer depuis le téléphone
            </div>
            <p className="text-xs text-aurora-ink-3">
              Scannez ce QR code pour ouvrir un lien unique de signature sur mobile. Une fois signé, ce popup se met à jour automatiquement.
            </p>
            {sessionReady && sessionUrl ? (
              <div className="flex items-center gap-3">
                <img
                  alt="QR signature"
                  className="h-24 w-24 rounded border"
                  src={qrDataUrl || ""}
                />
                <a href={sessionUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-aurora-blue break-all inline-flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5" />
                  Ouvrir le lien mobile
                </a>
              </div>
            ) : (
              <div className="text-xs text-aurora-ink-3">Génération du lien de signature…</div>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-aurora-ink-2">
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
            <Button variant="gradient" onClick={submit} disabled={submitting || (signatureMode === "draw" && !signature) || !accept}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PenTool className="h-4 w-4 mr-2" />}
              {t("signature.sign")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
