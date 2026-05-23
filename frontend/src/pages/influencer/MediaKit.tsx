import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchOnboarding, generateMediaKit, type OnboardingStatus } from "@/lib/apiExtra"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, FileText, Eye, AlertCircle, Upload, Trash2 } from "lucide-react"

const apiOrigin = (() => {
  try { return new URL(api.defaults.baseURL ?? "").origin } catch { return "" }
})()

const absoluteUrl = (u: string | null | undefined): string => {
  if (!u) return ""
  if (/^https?:/i.test(u)) return u
  return apiOrigin + u
}

export default function InfluencerMediaKit() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [mediaKitUrl, setMediaKitUrl] = useState<string>("")
  const [mediaKitDate, setMediaKitDate] = useState<string>("")
  const [isCustom, setIsCustom] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const missingCollaborationPitch = status?.missing_fields?.includes("collaboration_pitch") ?? false

  useEffect(() => {
    Promise.all([
      fetchOnboarding().then(setStatus).catch(() => {}),
      api.get("/auth/me/").then((r) => {
        const ip = r.data?.influencer_profile ?? {}
        if (ip.media_kit_pdf) setMediaKitUrl(absoluteUrl(ip.media_kit_pdf))
        if (ip.media_kit_generated_at) setMediaKitDate(ip.media_kit_generated_at)
        setIsCustom(Boolean(ip.media_kit_is_custom))
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast({ variant: "destructive", title: t("media_kit.pdf_only", "PDF uniquement") })
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: t("media_kit.too_large", "Fichier trop volumineux (10 Mo max)") })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", f)
      const r = await api.post("/influencers/media-kit/upload/", fd, { headers: { "Content-Type": "multipart/form-data" } })
      const ip = r.data
      setMediaKitUrl(absoluteUrl(ip.media_kit_pdf))
      setMediaKitDate(ip.media_kit_generated_at)
      setIsCustom(true)
      toast({ title: t("media_kit.uploaded", "Kit média personnalisé téléversé") })
    } catch (err: any) {
      toast({ variant: "destructive", title: t("common.error"), description: err?.response?.data?.detail ?? "" })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleRemove = async () => {
    if (!confirm(t("media_kit.confirm_delete", "Supprimer le kit média actuel ?"))) return
    setRemoving(true)
    try {
      await api.delete("/influencers/media-kit/upload/")
      setMediaKitUrl("")
      setMediaKitDate("")
      setIsCustom(false)
      toast({ title: t("media_kit.removed", "Kit média supprimé") })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setRemoving(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const r = await generateMediaKit()
      const url = absoluteUrl(r.media_kit_pdf)
      setMediaKitUrl(url)
      setMediaKitDate(new Date().toISOString())
      toast({
        title: t("onboarding.kit_generated", "Kit média généré"),
        description: t("onboarding.kit_ready", "Cliquez sur Télécharger pour récupérer le PDF"),
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err?.response?.data?.detail ?? "",
      })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-center h-64 text-aurora-ink-3">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("influencer_dashboard.eyebrow", "Espace créateur")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("onboarding.media_kit", "Kit média")}</h1>
      <Card className="card-base">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {t("onboarding.media_kit", "Kit média")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-aurora-ink-2">
            {t("onboarding.media_kit_desc", "Générez un kit média PDF récapitulant vos réseaux, statistiques et tarifs (nécessite 80 % de profil complet).")}
          </p>
          {missingCollaborationPitch && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("onboarding.collaboration_pitch_required", "Avant de générer le PDF, remplissez la case “Pourquoi collaborer avec vous ?” dans votre profil. Ce texte sera utilisé tel quel sur la page 5.")}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={generating || missingCollaborationPitch || (status?.completion_percent ?? 0) < 80} variant="gradient">
              {generating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("common.loading")}</>
                : (mediaKitUrl ? t("onboarding.regenerate", "Regénérer") : t("onboarding.generate", "Générer le kit média"))}
            </Button>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {t("media_kit.upload_custom", "Téléverser mon propre PDF")}
            </Button>
            {mediaKitUrl && (
              <>
                <Button asChild variant="outline">
                  <a href={mediaKitUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4 mr-2" /> {t("influencer_public.open_media_kit", "Ouvrir le kit média (PDF)")}
                  </a>
                </Button>
                <Button type="button" variant="destructive" disabled={removing} onClick={handleRemove}>
                  {removing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  {t("media_kit.remove", "Supprimer")}
                </Button>
              </>
            )}
          </div>
          {mediaKitDate && (
            <p className="text-xs text-aurora-ink-3 flex items-center gap-2">
              {isCustom && <Badge variant="purple">{t("media_kit.custom_badge", "PDF personnalisé")}</Badge>}
              <span>{t("onboarding.last_generated", "Dernière génération")} : {new Date(mediaKitDate).toLocaleString("fr-FR")}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
