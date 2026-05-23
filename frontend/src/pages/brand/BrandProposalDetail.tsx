import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { downloadProtectedFile, openProtectedFile } from "@/lib/apiExtra"
import {
  fetchProposalMessages,
  sendProposalMessage,
  acceptCounterOffer,
  cancelProposal,
  fundEscrow,
  generateContractPdf,
  fetchContractTemplates,
} from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { InfluencerHoverCard } from "@/components/shared/InfluencerHoverCard"
import { MessageThread } from "@/components/shared/MessageThread"
import { SignContractDialog } from "@/components/shared/SignContractDialog"
import { ContractWorkflow } from "@/components/shared/ContractWorkflow"
import CampaignTrackedVideos from "@/components/social/CampaignTrackedVideos"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, CheckCircle, XCircle, Loader2, FileText, MessageSquare, Download, ExternalLink, PenTool, DollarSign, Eye } from "lucide-react"

interface ProposalData {
  id: number
  campaign: number
  campaign_title: string
  influencer: number
  influencer_pseudo: string
  influencer_display_name: string
  status: string
  proposed_price: number
  counter_price: number | null
  counter_message: string
  decline_reason: string
  contract_pdf: string | null
  contract_version?: number | null
  brand_signed_at: string | null
  influencer_signed_at: string | null
  escrow_funded_at?: string | null
  escrow_released_at?: string | null
  submission_deadline?: string | null
  validation_deadline?: string | null
}

interface ChatMessage {
  id: number
  sender_name: string
  content: string
  created_at: string
  is_mine: boolean
}

interface ContractTemplate {
  id: number
  name: string
  description: string
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
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [showSignDialog, setShowSignDialog] = useState(false)

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

  const loadTemplates = async () => {
    try {
      const data = await fetchContractTemplates()
      const list = Array.isArray(data) ? data : []
      setTemplates(list)
      // Auto-select default template if available
      const defaultTemplate = list.find((t: any) => t.is_default)
      if (defaultTemplate) setSelectedTemplate(defaultTemplate.id)
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  useEffect(() => { 
    load()
    loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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

  const handleGenerateContractClick = () => {
    if (templates.length === 0) {
      toast({ variant: "destructive", title: t("contracts.empty") })
      return
    }
    setShowTemplateDialog(true)
  }

  const handleGenerateContract = async () => {
    setActing(true)
    try {
      await generateContractPdf(Number(id), selectedTemplate || undefined)
      toast({ title: t("brand_proposal.contract_generated") })
      setShowTemplateDialog(false)
      await load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setActing(false)
    }
  }

  const handleFundEscrow = async () => {
    setActing(true)
    try {
      await fundEscrow(Number(id))
      toast({ title: t("proposal_detail.escrow_funded", "Escrow approvisionné") })
      await load()
    } catch (err: any) {
      toast({ variant: "destructive", title: t("common.error"), description: err?.response?.data?.detail ?? "" })
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }
  if (!proposal) {
    return <div className="p-6 text-center text-aurora-ink-3">{t("common.error")}</div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}
        </Button>
        <h1 className="text-xl font-semibold tracking-tight text-aurora-ink flex-1">
          {t("brand_proposal.title")} — <InfluencerHoverCard influencerId={proposal.influencer} influencerPseudo={proposal.influencer_pseudo} displayName={proposal.influencer_display_name}>{proposal.influencer_pseudo ? <a href={`/brand/influencers/${encodeURIComponent(proposal.influencer_pseudo)}`} target="_blank" rel="noopener noreferrer" className="hover:text-aurora-blue transition-colors">{proposal.influencer_display_name}</a> : <span>{proposal.influencer_display_name}</span>}</InfluencerHoverCard>
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
                <span className="text-sm text-aurora-ink-3">{t("brand_proposal.campaign_name")}</span>
                <Button variant="link" size="sm" onClick={() => navigate(`/brand/campaigns/${proposal.campaign}`)}>
                  {proposal.campaign_title}<ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-aurora-ink-3">{t("brand_proposal.proposed_price")}</span>
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
              {proposal.influencer_pseudo ? (
                <Button className="w-full" variant="outline" asChild>
                  <a href={`/brand/influencers/${encodeURIComponent(proposal.influencer_pseudo)}#media-kit`} target="_blank" rel="noopener noreferrer">{t("campaign_detail.view_media_kit")}</a>
                </Button>
              ) : (
                <Button className="w-full" variant="outline" disabled>{t("campaign_detail.view_media_kit")}</Button>
              )}
              {proposal.status === "counter_offer" && (
                <Button className="w-full" variant="gradient" disabled={acting} onClick={handleAcceptCounter}>
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" />{t("brand_proposal.accept_counter")}</>}
                </Button>
              )}
              {proposal.status === "accepted" && !proposal.contract_pdf && (
                <Button className="w-full" variant="gradient" disabled={acting} onClick={handleGenerateContractClick}>
                  <FileText className="h-4 w-4 mr-1" />{t("brand_proposal.generate_contract")}
                </Button>
              )}
              {proposal.contract_pdf && !proposal.brand_signed_at && (
                <Button className="w-full" variant="gradient" disabled={acting} onClick={() => setShowSignDialog(true)}>
                  <PenTool className="h-4 w-4 mr-1" />Signer le contrat
                </Button>
              )}
              {proposal.contract_pdf && proposal.brand_signed_at && proposal.influencer_signed_at && !proposal.escrow_funded_at && (
                <Button className="w-full" variant="gradient" disabled={acting} onClick={handleFundEscrow}>
                  <DollarSign className="h-4 w-4 mr-1" />Approvisionner escrow
                </Button>
              )}
              {proposal.contract_pdf && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => proposal.contract_pdf && openProtectedFile(proposal.contract_pdf)}
                >
                  <Eye className="h-4 w-4 mr-1" />Voir contrat
                </Button>
              )}
              {proposal.contract_pdf && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => proposal.contract_pdf && downloadProtectedFile(proposal.contract_pdf, `contract-${proposal.id}.pdf`)}
                >
                  <Download className="h-4 w-4 mr-1" />{t("brand_proposal.download_contract")}
                </Button>
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

          {proposal.status !== "pending" && proposal.status !== "declined" && (
            <ContractWorkflow proposal={proposal} />
          )}
          {proposal.status === "accepted" && (
            <CampaignTrackedVideos proposalId={proposal.id} canEdit />
          )}
        </div>
      </div>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir un modèle de contrat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedTemplate === template.id 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-aurora-line hover:border-indigo-300'
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="font-medium text-sm">{template.name}</div>
                {template.description && (
                  <div className="text-xs text-aurora-ink-3 mt-1">{template.description}</div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>{t("contracts.cancel")}</Button>
            <Button 
              variant="gradient" 
              disabled={!selectedTemplate || acting} 
              onClick={handleGenerateContract}
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("brand_proposal.generate_contract")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignContractDialog
        proposalId={Number(id)}
        open={showSignDialog}
        onClose={() => setShowSignDialog(false)}
        onSuccess={load}
      />
    </div>
  )
}
