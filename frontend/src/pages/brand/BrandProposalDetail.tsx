import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import {
  fetchProposalMessages,
  sendProposalMessage,
  acceptCounterOffer,
  cancelProposal,
  generateContractPdf,
} from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { MessageThread } from "@/components/shared/MessageThread"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, CheckCircle, XCircle, Loader2, FileText, MessageSquare, Download, ExternalLink } from "lucide-react"

interface ProposalData {
  id: number
  campaign: number
  campaign_title: string
  influencer: number
  influencer_display_name: string
  status: string
  proposed_price: number
  counter_price: number | null
  counter_message: string
  decline_reason: string
  contract_pdf: string | null
  brand_signed_at: string | null
  influencer_signed_at: string | null
}

interface ChatMessage {
  id: number
  sender_name: string
  content: string
  created_at: string
  is_mine: boolean
}

export default function BrandProposalDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [proposal, setProposal] = useState<ProposalData | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = async () => {
    try {
      const [propRes, msgs] = await Promise.all([
        api.get(`/proposals/${id}/`),
        fetchProposalMessages(Number(id)),
      ])
      setProposal(propRes.data)
      setMessages(msgs as ChatMessage[])
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  const handleSend = async (content: string) => {
    try {
      const msg = await sendProposalMessage(Number(id), content)
      setMessages((prev) => [...prev, msg as ChatMessage])
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  const handleAcceptCounter = async () => {
    setActing(true)
    try {
      await acceptCounterOffer(Number(id))
      toast({ title: t("brand_proposal.counter_accepted") })
      await load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setActing(false)
    }
  }

  const handleCancel = async () => {
    setActing(true)
    try {
      await cancelProposal(Number(id))
      toast({ title: t("campaign_detail.cancelled") })
      await load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setActing(false)
    }
  }

  const handleGenerateContract = async () => {
    setActing(true)
    try {
      await generateContractPdf(Number(id))
      toast({ title: t("brand_proposal.contract_generated") })
      await load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }
  if (!proposal) {
    return <div className="p-6 text-center text-gray-400">{t("common.error")}</div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}
        </Button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">
          {t("brand_proposal.title")} — {proposal.influencer_display_name}
        </h1>
        <StatusBadge status={proposal.status as any} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-base">
            <CardHeader>
              <CardTitle className="text-base">{t("brand_proposal.campaign")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("brand_proposal.campaign_name")}</span>
                <Button variant="link" size="sm" onClick={() => navigate(`/brand/campaigns/${proposal.campaign}`)}>
                  {proposal.campaign_title}<ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("brand_proposal.proposed_price")}</span>
                <span className="font-semibold">€{proposal.proposed_price}</span>
              </div>
              {proposal.counter_price && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-900">{t("brand_proposal.counter_offer")}</span>
                    <span className="font-bold text-amber-900">€{proposal.counter_price}</span>
                  </div>
                  {proposal.counter_message && (
                    <p className="text-sm italic text-amber-800">« {proposal.counter_message} »</p>
                  )}
                </div>
              )}
              {proposal.decline_reason && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-800">
                  {proposal.decline_reason}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-base">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-500" />{t("brand_proposal.chat")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MessageThread messages={messages} onSend={handleSend} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">{t("brand_proposal.actions")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {proposal.status === "counter_offer" && (
                <Button className="w-full" variant="gradient" disabled={acting} onClick={handleAcceptCounter}>
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" />{t("brand_proposal.accept_counter")}</>}
                </Button>
              )}
              {proposal.status === "accepted" && !proposal.contract_pdf && (
                <Button className="w-full" variant="gradient" disabled={acting} onClick={handleGenerateContract}>
                  <FileText className="h-4 w-4 mr-1" />{t("brand_proposal.generate_contract")}
                </Button>
              )}
              {proposal.contract_pdf && (
                <a href={proposal.contract_pdf} target="_blank" rel="noreferrer" className="block">
                  <Button className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-1" />{t("brand_proposal.download_contract")}
                  </Button>
                </a>
              )}
              {proposal.status === "content_submitted" && (
                <Button className="w-full" variant="gradient" onClick={() => navigate(`/brand/campaigns/${proposal.campaign}/validate/${proposal.id}`)}>
                  {t("brand_proposal.validate_content")}
                </Button>
              )}
              {["pending", "counter_offer"].includes(proposal.status) && (
                <Button className="w-full" variant="ghost" disabled={acting} onClick={handleCancel}>
                  <XCircle className="h-4 w-4 mr-1 text-red-600" />{t("campaign_detail.cancel")}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">{t("brand_proposal.signatures")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t("brand_proposal.brand_signed")}</span>
                <span className="font-medium">{proposal.brand_signed_at ? new Date(proposal.brand_signed_at).toLocaleDateString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t("brand_proposal.influencer_signed")}</span>
                <span className="font-medium">{proposal.influencer_signed_at ? new Date(proposal.influencer_signed_at).toLocaleDateString() : "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
