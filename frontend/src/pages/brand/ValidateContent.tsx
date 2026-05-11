import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import { fetchLatestSubmission, validateContent, rejectContent } from "@/lib/apiExtra"
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, Loader2 } from "lucide-react"

interface ProposalData {
  id: number
  campaign: number
  campaign_title: string
  status: string
}

interface SubmissionData {
  id: number
  submission_type: "link" | "upload"
  publication_url?: string
  screenshot?: string | null
  uploaded_file?: string | null
  created_at: string
  publication_date?: string
  rejection_comment?: string
}

const getUploadedKind = (path?: string | null) => {
  const file = (path || "").toLowerCase()
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].some((ext) => file.endsWith(ext))) return "photo"
  if ([".mp4", ".mov", ".avi", ".mkv", ".webm"].some((ext) => file.endsWith(ext))) return "video"
  return "file"
}

const getYouTubeEmbedUrl = (url: string): string | null => {
  try {
    const u = new URL(url)
    let videoId: string | null = null
    if (u.hostname.includes("youtube.com")) videoId = u.searchParams.get("v")
    else if (u.hostname.includes("youtu.be")) videoId = u.pathname.slice(1)
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null
  } catch { return null }
}

const getTikTokEmbedUrl = (url: string): string | null => {
  try {
    const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
    return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : null
  } catch { return null }
}

const getPlatformLabel = (url?: string) => {
  if (!url) return "-"
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname.includes("instagram")) return "Instagram"
    if (hostname.includes("tiktok")) return "TikTok"
    if (hostname.includes("youtube")) return "YouTube"
    if (hostname.includes("twitch")) return "Twitch"
    return hostname.replace("www.", "")
  } catch {
    return "-"
  }
}

export default function ValidateContent() {
  const { id, proposalId } = useParams<{ id: string; proposalId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [proposal, setProposal] = useState<ProposalData | null>(null)
  const [submission, setSubmission] = useState<SubmissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [feedback, setFeedback] = useState("")
  const [screenshotBlobUrl, setScreenshotBlobUrl] = useState<string | null>(null)
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!proposalId) return
      setLoading(true)
      try {
        const [propRes, submissionRes] = await Promise.all([
          api.get(`/proposals/${proposalId}/`),
          fetchLatestSubmission(Number(proposalId)),
        ])
        setProposal(propRes.data)
        setSubmission(submissionRes)
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: e?.response?.data?.detail,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [proposalId, t, toast])

  useEffect(() => {
    let active = true
    let screenshotObj: string | null = null
    let fileObj: string | null = null

    const loadProtectedAssets = async () => {
      if (!submission) {
        setScreenshotBlobUrl(null)
        setFileBlobUrl(null)
        return
      }

      try {
        if (submission.screenshot) {
          const res = await api.get(submission.screenshot, { responseType: "blob" })
          if (active) {
            screenshotObj = window.URL.createObjectURL(res.data)
            setScreenshotBlobUrl(screenshotObj)
          }
        } else {
          setScreenshotBlobUrl(null)
        }
      } catch {
        if (active) setScreenshotBlobUrl(null)
      }

      try {
        if (submission.uploaded_file) {
          const res = await api.get(submission.uploaded_file, { responseType: "blob" })
          if (active) {
            fileObj = window.URL.createObjectURL(res.data)
            setFileBlobUrl(fileObj)
          }
        } else {
          setFileBlobUrl(null)
        }
      } catch {
        if (active) setFileBlobUrl(null)
      }
    }

    loadProtectedAssets()

    return () => {
      active = false
      if (screenshotObj) window.URL.revokeObjectURL(screenshotObj)
      if (fileObj) window.URL.revokeObjectURL(fileObj)
    }
  }, [submission])

  const handleApprove = async () => {
    if (!proposalId) return
    setActing(true)
    try {
      await validateContent(Number(proposalId))
      toast({ title: t("proposal_detail.content_validated", "Contenu validé — paiement libéré") })
      navigate(`/brand/proposals/${proposalId}`)
    } catch (e: any) {
      toast({ variant: "destructive", title: t("common.error"), description: e?.response?.data?.detail })
    } finally {
      setActing(false)
    }
  }

  const handleReject = async () => {
    if (!proposalId) return
    if (!rejectionReason || !feedback.trim()) {
      toast({ variant: "destructive", title: t("common.error"), description: t("brand_proposal.correction_reason_required") })
      return
    }
    setActing(true)
    try {
      await rejectContent(Number(proposalId), {
        rejection_reason: rejectionReason,
        rejection_comment: feedback.trim(),
      })
      toast({ title: t("proposal_detail.content_rejected", "Contenu refusé — correction demandée") })
      navigate(`/brand/proposals/${proposalId}`)
    } catch (e: any) {
      toast({ variant: "destructive", title: t("common.error"), description: e?.response?.data?.detail })
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  if (!proposal || !submission) {
    return <div className="p-6 text-center text-gray-400">{t("common.error")}</div>
  }

  const publicationUrl = submission.publication_url || ""
  const screenshotUrl = screenshotBlobUrl
  const fileUrl = fileBlobUrl
  const submittedAt = submission.publication_date || submission.created_at
  const beforePublish = !publicationUrl
  const uploadedKind = getUploadedKind(submission.uploaded_file)
  const submissionTypeKey =
    submission.submission_type === "link"
      ? "link"
      : uploadedKind

  // Embed logic
  const youtubeEmbed = publicationUrl ? getYouTubeEmbedUrl(publicationUrl) : null
  const tiktokEmbed = publicationUrl ? getTikTokEmbedUrl(publicationUrl) : null
  const isVideoFile = uploadedKind === "video" && !!fileUrl

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-xl font-bold text-gray-900">{t("brand_proposal.validate_content")} — #{proposalId}</h1>
      </div>

      <Card className="card-base">
        <CardHeader><CardTitle>{t("brand_proposal.validate_content")}</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl mb-4 overflow-hidden bg-gray-100">
            {youtubeEmbed ? (
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={youtubeEmbed}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  frameBorder={0}
                  title="YouTube embed"
                />
              </div>
            ) : tiktokEmbed ? (
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={tiktokEmbed}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay"
                  allowFullScreen
                  frameBorder={0}
                  title="TikTok embed"
                />
              </div>
            ) : isVideoFile ? (
              <video
                src={fileUrl!}
                controls
                className="w-full max-h-96 object-contain"
              />
            ) : screenshotUrl ? (
              <img src={screenshotUrl} alt={t("brand_proposal.submission_screenshot_alt")} className="w-full max-h-96 object-contain" />
            ) : (
              <div className="aspect-video flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <ExternalLink className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("brand_proposal.view_submitted_content")}</p>
                  {publicationUrl && (
                    <a href={publicationUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm hover:underline mt-1 block">
                      {t("common.view")} →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-xl text-center"><p className="text-gray-500 text-xs">{t("common.platform")}</p><p className="font-semibold">{getPlatformLabel(publicationUrl)}</p></div>
              <div className="p-3 bg-gray-50 rounded-xl text-center"><p className="text-gray-500 text-xs">{t("common.type")}</p><p className="font-semibold">{t(`submission.kind_${submissionTypeKey}`)}</p></div>
              <div className="p-3 bg-gray-50 rounded-xl text-center"><p className="text-gray-500 text-xs">{t("common.status")}</p><p className="font-semibold">{new Date(submittedAt).toLocaleDateString()}</p></div>
            </div>
            {beforePublish && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                {t("submission.pre_publish_review")}
              </div>
            )}
            {publicationUrl && (
              <div className="p-3 bg-gray-50 rounded-xl text-sm">
                <p className="font-semibold text-gray-700 mb-1">{t("common.url")}</p>
                <a href={publicationUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">{publicationUrl}</a>
              </div>
            )}
            {fileUrl && (
              <div className="p-3 bg-gray-50 rounded-xl text-sm">
                <p className="font-semibold text-gray-700 mb-1">{t("common.file")}</p>
                <a href={fileUrl} target="_blank" rel="noreferrer" download className="text-indigo-600 hover:underline break-all">
                  {t("common.view")} →
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader><CardTitle className="text-base">{t("proposal_detail.request_correction")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">{t("brand_proposal.correction_reason_label")}</label>
            <select
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            >
              <option value="">{t("brand_proposal.correction_reason_placeholder")}</option>
              <option value="brief_not_followed">{t("brand_proposal.rejection_reason_brief_not_followed")}</option>
              <option value="wrong_platform">{t("brand_proposal.rejection_reason_wrong_platform")}</option>
              <option value="missing_mention">{t("brand_proposal.rejection_reason_missing_mention")}</option>
              <option value="insufficient_quality">{t("brand_proposal.rejection_reason_insufficient_quality")}</option>
              <option value="late_delivery">{t("brand_proposal.rejection_reason_late_delivery")}</option>
              <option value="other">{t("brand_proposal.rejection_reason_other")}</option>
            </select>
          </div>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t("brand_proposal.correction_comment_placeholder")}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="flex gap-3">
            <Button className="flex-1" variant="gradient" disabled={acting || proposal.status !== "content_submitted"} onClick={handleApprove}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {t("brand_proposal.validate_content")}
            </Button>
            <Button
              className="flex-1"
              variant="destructive"
              disabled={acting || proposal.status !== "content_submitted" || !rejectionReason || !feedback.trim()}
              onClick={handleReject}
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              {t("proposal_detail.request_correction", "Demander correction")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
