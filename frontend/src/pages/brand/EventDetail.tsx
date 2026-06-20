import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, CalendarDays, Loader2, MapPin, Users, CheckCircle2, Camera, CameraOff, ScanLine } from "lucide-react"
import { isNative, scanQrCode } from "@/lib/native"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { checkInEventInvitation, EventItem, fetchBrandEvent } from "@/lib/apiExtra"
import { QRCodeSVG } from "qrcode.react"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

export default function BrandEventDetail() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { id } = useParams()
  const [item, setItem] = useState<EventItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkinInput, setCheckinInput] = useState("")
  const [checkingIn, setCheckingIn] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraBusy, setCameraBusy] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(true)
  const [lastScanValue, setLastScanValue] = useState("")

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!id) return
    fetchBrandEvent(Number(id))
      .then(setItem)
      .catch(() => setItem(null))
      .finally(() => setLoading(false))
  }, [id])

  const refresh = async () => {
    if (!id) return
    const next = await fetchBrandEvent(Number(id))
    setItem(next)
  }

  const doCheckIn = async () => {
    const value = checkinInput.trim()
    if (!value) return
    await doCheckInFromValue(value)
  }

  const doCheckInFromValue = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setCheckingIn(true)
    try {
      const payload = trimmed.startsWith("IC-EVT:") ? { qr_payload: trimmed } : { invitation_token: trimmed }
      const res = await checkInEventInvitation(payload)
      toast({
        title: res.already_checked_in
          ? t("events.already_checked_in", "Déjà check-in")
          : t("events.checked_in", "Check-in validé"),
      })
      setCheckinInput("")
      setLastScanValue(trimmed)
      await refresh()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      toast({ variant: "destructive", title: t("common.error"), description: typeof detail === "string" ? detail : undefined })
    } finally {
      setCheckingIn(false)
    }
  }

  // App native : scanner plein écran ML Kit, puis check-in direct du payload lu.
  const scanNativeAndCheckIn = async () => {
    try {
      const value = await scanQrCode()
      if (!value) return // annulé par l'utilisateur
      setCheckinInput(value)
      await doCheckInFromValue(value)
    } catch {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("events.scan_failed", "Impossible d'ouvrir le scanner. Vérifie l'accès caméra de l'app."),
      })
    }
  }

  const stopCamera = () => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current)
      scanTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraOn(false)
  }

  const startCamera = async () => {
    if (cameraBusy) return
    setCameraBusy(true)
    try {
      const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
      const hasDetector = typeof window !== "undefined" && !!(window as any).BarcodeDetector
      setCameraSupported(hasMedia && hasDetector)
      if (!hasMedia || !hasDetector) {
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] })
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || checkingIn) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (!codes?.length) return
          const raw = String(codes[0]?.rawValue || "").trim()
          if (!raw || raw === lastScanValue) return
          setCheckinInput(raw)
          await doCheckInFromValue(raw)
        } catch {
          // Ignore transient camera decode errors
        }
      }, 900)

      setCameraOn(true)
    } catch {
      setCameraSupported(false)
      stopCamera()
    } finally {
      setCameraBusy(false)
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  if (!item) return <div className="p-6">{t("common.not_found", "Introuvable")}</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink">{item.title}</h1>
        <Badge variant="outline">{item.status}</Badge>
      </div>

      <Card className="card-base">
        <CardContent className="pt-6 grid md:grid-cols-3 gap-4 text-sm">
          <p className="flex items-center gap-1 text-aurora-ink-2"><CalendarDays className="h-4 w-4" />{new Date(item.starts_at).toLocaleString()}</p>
          <p className="flex items-center gap-1 text-aurora-ink-2"><MapPin className="h-4 w-4" />{item.address}</p>
          <p className="flex items-center gap-1 text-aurora-ink-2"><Users className="h-4 w-4" />{item.invitations.length} {t("events.invitations", "invitations")}</p>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader><CardTitle>{t("events.rsvp_overview", "RSVP")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
            <p className="text-sm font-medium text-emerald-900">{t("events.checkin_title", "Check-in à l'entrée")}</p>
            <p className="text-xs text-emerald-800">{t("events.checkin_hint", "Scanne le QR (payload IC-EVT:...) ou colle le token d'invitation")}</p>
            <div className="flex flex-wrap items-center gap-2">
              {isNative ? (
                <Button type="button" variant="gradient" onClick={scanNativeAndCheckIn} disabled={checkingIn}>
                  <ScanLine className="h-4 w-4 mr-1" />{t("events.scan_qr", "Scanner un QR code")}
                </Button>
              ) : !cameraOn ? (
                <Button type="button" variant="outline" onClick={startCamera} disabled={cameraBusy}>
                  <Camera className="h-4 w-4 mr-1" />{t("events.start_camera", "Démarrer caméra")}
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={stopCamera}>
                  <CameraOff className="h-4 w-4 mr-1" />{t("events.stop_camera", "Arrêter caméra")}
                </Button>
              )}
              {!isNative && !cameraSupported && (
                <span className="text-xs text-amber-700">{t("events.camera_not_supported", "Caméra/scan QR non supporté sur ce navigateur. Utilise la saisie manuelle.")}</span>
              )}
            </div>

            {cameraOn && (
              <div className="overflow-hidden rounded-lg border border-emerald-200 bg-black/90">
                <video ref={videoRef} playsInline muted className="w-full max-h-[280px] object-cover" />
              </div>
            )}
            <div className="flex gap-2">
              <Input value={checkinInput} onChange={(e) => setCheckinInput(e.target.value)} placeholder="IC-EVT:... ou token" />
              <Button variant="gradient" onClick={doCheckIn} disabled={checkingIn || !checkinInput.trim()}>
                {checkingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {item.invitations.length === 0 ? (
            <p className="text-sm text-aurora-ink-3">{t("events.no_invites", "Aucune invitation")}</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {item.invitations.map((inv) => (
                <div key={inv.id} className="rounded-xl border p-3 bg-aurora-surface flex gap-3">
                  <div className="shrink-0">
                    <QRCodeSVG value={inv.qr_payload} size={72} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-aurora-ink truncate">{inv.invitee_label || inv.influencer_display_name || inv.invited_email || `#${inv.influencer}`}</p>
                    <p className="text-xs text-aurora-ink-3">{t("events.rsvp", "Réponse")}: {inv.status}</p>
                    <p className="text-xs text-aurora-ink-3">{t("events.plus_ones", "Accompagnants")}: +{inv.plus_ones_confirmed} / +{inv.max_plus_ones}</p>
                    <p className="text-xs text-aurora-ink-3">{t("events.checkin_status", "Entrée")}: {inv.checked_in_at ? t("events.checked_in", "Check-in validé") : t("events.not_checked_in", "Non check-in")}</p>
                    {inv.responded_at && <p className="text-[11px] text-aurora-ink-3">{new Date(inv.responded_at).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
