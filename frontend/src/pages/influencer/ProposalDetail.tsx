import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { fundEscrow, generateContractPdf, validateContent, rejectContent, submitContent, acceptCounterOffer } from "@/lib/apiExtra"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { MessageThread } from "@/components/shared/MessageThread"
import { CounterOfferDialog } from "@/components/shared/CounterOfferDialog"
import { ReviewDialog } from "@/components/shared/ReviewDialog"
import { SignContractDialog } from "@/components/shared/SignContractDialog"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, CheckCircle, XCircle, MessageSquare, Loader2, FileText, PenTool, Wallet, Upload, Download, Shield, Repeat, Star } from "lucide-react"

interface ProposalData {
  id: number
  campaign_title: string
  brand_company_name: string
  brand_id?: number
  influencer_name?: string
  status: string
  proposed_price: number
  counter_price?: number | null
  counter_message?: string
  campaign: number
  brand_signed_at?: string | null
  influencer_signed_at?: string | null
  contract_pdf?: string | null
  escrow_funded_at?: string | null
  escrow_released_at?: string | null
  submission_deadline?: string | null
  validation_deadline?: string | null
}

interface Message {
  id: number
  sender_name: string
  content: string
  created_at: string
  is_mine: boolean
}

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const [proposal, setProposal] = useState<ProposalData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [contentUrl, setContentUrl] = useState("")
  const [contentNotes, setContentNotes] = useState("")
  const [showSubmit, setShowSubmit] = useState(false)
  const [showCounter, setShowCounter] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showSignDialog, setShowSignDialog] = useState(false)
  const [showPayDialog, setShowPayDialog] = useState(false)

  const isBrand = user?.user_type === "brand"

  const reload = async () => {
    const r = await api.get(`/proposals/${id}/`)
    setProposal(r.data)
  }

  const loadMessages = async () => {
    try {
      const msgRes = await api.get(`/proposals/${id}/messages/`)
      const list = (msgRes.data.results ?? msgRes.data).map((m: any) => ({
        id: m.id,
        sender_name: m.sender_username || m.sender_name || "User",
        content: m.content,
        created_at: m.created_at,
        is_mine: m.sender === user?.id || m.is_mine === true,
      }))
      setMessages(list)
    } catch { /* */ }
  }

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([reload(), loadMessages()])
      } catch { /* */ }
      finally { setLoading(false) }
    }
    load()
    // Poll messages every 5s while page is open
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleAction = async (action: "accept" | "decline") => {
    setActionLoading(true)
    try {
      const res = await api.post(`/proposals/${id}/${action}/`)
      setProposal((prev) => prev ? { ...prev, status: res.data.status ?? prev.status } : prev)
      toast({ title: action === "accept" ? t("proposals.accept") + "!" : t("proposals.decline") })
      await reload()
    } catch { toast({ title: t("common.error"), variant: "destructive" }) }
    finally { setActionLoading(false) }
  }

  const handleSign = async () => {
    setShowSignDialog(true)
  }

  const handleAcceptCounter = async () => {
    if (!confirm("Accepter la contre-offre de l'influenceur ?")) return
    setActionLoading(true)
    try {
      await acceptCounterOffer(Number(id))
      toast({ title: "Contre-offre acceptée" })
      await reload()
    } catch (e: any) { toast({ title: t("common.error"), description: e?.response?.data?.detail, variant: "destructive" }) }
    finally { setActionLoading(false) }
  }

  const handleGenerateContract = async () => {
    setActionLoading(true)
    try {
      const r = await generateContractPdf(Number(id))
      toast({ title: t("proposal_detail.contract_generated", "Contrat PDF généré") })
      setProposal((p) => p ? { ...p, contract_pdf: r.contract_pdf } : p)
    } catch (e: any) { toast({ title: t("common.error"), description: e?.response?.data?.detail, variant: "destructive" }) }
    finally { setActionLoading(false) }
  }

  const handleFundEscrow = async () => {
    setShowPayDialog(true)
  }

  const doFundEscrow = async () => {
    try {
      await fundEscrow(Number(id))
      toast({ title: t("proposal_detail.escrow_funded", "Escrow approvisionné") })
      await reload()
    } catch (e: any) {
      toast({ title: t("common.error"), description: e?.response?.data?.detail, variant: "destructive" })
      throw e
    }
  }

  const handleSubmitContent = async () => {
    if (!contentUrl) return
    setActionLoading(true)
    try {
      await submitContent(Number(id), { content_url: contentUrl, notes: contentNotes })
      toast({ title: t("proposal_detail.content_submitted", "Contenu soumis") })
      setShowSubmit(false); setContentUrl(""); setContentNotes("")
      await reload()
    } catch (e: any) { toast({ title: t("common.error"), description: e?.response?.data?.detail, variant: "destructive" }) }
    finally { setActionLoading(false) }
  }

  const handleValidate = async () => {
    setActionLoading(true)
    try {
      await validateContent(Number(id))
      toast({ title: t("proposal_detail.content_validated", "Contenu validé — paiement libéré") })
      await reload()
    } catch (e: any) { toast({ title: t("common.error"), description: e?.response?.data?.detail, variant: "destructive" }) }
    finally { setActionLoading(false) }
  }

  const handleReject = async () => {
    const reason = prompt(t("proposal_detail.reject_reason", "Raison du refus ?")) ?? ""
    if (!reason) return
    setActionLoading(true)
    try {
      await rejectContent(Number(id), reason)
      toast({ title: t("proposal_detail.content_rejected", "Contenu refusé — correction demandée") })
      await reload()
    } catch (e: any) { toast({ title: t("common.error"), description: e?.response?.data?.detail, variant: "destructive" }) }
    finally { setActionLoading(false) }
  }

  const handleSend = async (content: string) => {
    try {
      const res = await api.post(`/proposals/${id}/messages/send/`, { content })
      setMessages((prev) => [...prev, {
        id: res.data.id, sender_name: "You", content: res.data.content,
        created_at: res.data.created_at, is_mine: true,
      }])
    } catch { toast({ title: t("common.error"), variant: "destructive" }) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  if (!proposal) return <div className="p-6 text-center text-gray-400">{t("common.error")}</div>

  const bothSigned = proposal.brand_signed_at && proposal.influencer_signed_at
  const mySigned = isBrand ? proposal.brand_signed_at : proposal.influencer_signed_at
  const canSign = proposal.status === "accepted" && !mySigned
  const canFund = isBrand && bothSigned && !proposal.escrow_funded_at
  const canSubmit = !isBrand && proposal.escrow_funded_at && proposal.status !== "completed"
  const canValidate = isBrand && proposal.status === "content_submitted"

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-xl font-bold text-gray-900">{proposal.campaign_title}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-base">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{proposal.campaign_title}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{isBrand ? proposal.influencer_name : proposal.brand_company_name}</p>
                </div>
                <StatusBadge status={proposal.status as any} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-xs">{t("campaigns.budget")}</p>
                    <p className="font-semibold mt-1 text-green-700">€{proposal.proposed_price}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-xs">Status</p>
                    <p className="font-semibold mt-1">{proposal.status}</p>
                  </div>
                </div>

                {!isBrand && proposal.status === "pending" && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button className="flex-1 min-w-[140px]" variant="gradient" disabled={actionLoading} onClick={() => handleAction("accept")}>
                      <CheckCircle className="h-4 w-4 mr-2" />{t("proposals.accept")}
                    </Button>
                    <Button className="flex-1 min-w-[140px]" variant="outline" disabled={actionLoading} onClick={() => setShowCounter(true)}>
                      <Repeat className="h-4 w-4 mr-2" />Contre-offre
                    </Button>
                    <Button className="flex-1 min-w-[140px]" variant="destructive" disabled={actionLoading} onClick={() => handleAction("decline")}>
                      <XCircle className="h-4 w-4 mr-2" />{t("proposals.decline")}
                    </Button>
                  </div>
                )}

                {isBrand && proposal.status === "counter_offer" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-amber-700">Contre-offre reçue</p>
                      <p className="text-2xl font-bold text-amber-900 mt-1">€{proposal.counter_price}</p>
                      {proposal.counter_message && (
                        <p className="text-sm text-amber-800 mt-2 italic">« {proposal.counter_message} »</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="gradient" size="sm" disabled={actionLoading} onClick={handleAcceptCounter}>
                        <CheckCircle className="h-4 w-4 mr-2" />Accepter
                      </Button>
                      <Button variant="destructive" size="sm" disabled={actionLoading} onClick={() => handleAction("decline")}>
                        <XCircle className="h-4 w-4 mr-2" />Refuser
                      </Button>
                    </div>
                  </div>
                )}

                {proposal.status === "paid" && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-green-900">Collaboration terminée</p>
                      <p className="text-xs text-green-700">Partagez votre expérience avec un avis.</p>
                    </div>
                    <Button variant="gradient" size="sm" onClick={() => setShowReview(true)}>
                      <Star className="h-4 w-4 mr-2" />Laisser un avis
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Workflow Card */}
          {proposal.status !== "pending" && proposal.status !== "declined" && (
            <Card className="card-base">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> {t("proposal_detail.workflow", "Workflow contractuel")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-gray-500 space-y-1">
                  <p>✓ Marque signée: {proposal.brand_signed_at ? new Date(proposal.brand_signed_at).toLocaleString() : "—"}</p>
                  <p>✓ Influenceur signé: {proposal.influencer_signed_at ? new Date(proposal.influencer_signed_at).toLocaleString() : "—"}</p>
                  <p>✓ Escrow: {proposal.escrow_funded_at ? "✅ approvisionné " + new Date(proposal.escrow_funded_at).toLocaleDateString() : "en attente"}</p>
                  <p>✓ Paiement libéré: {proposal.escrow_released_at ? "✅ " + new Date(proposal.escrow_released_at).toLocaleDateString() : "—"}</p>
                  {proposal.submission_deadline && <p>📅 Soumission avant: {new Date(proposal.submission_deadline).toLocaleDateString()}</p>}
                  {proposal.validation_deadline && <p>📅 Validation avant: {new Date(proposal.validation_deadline).toLocaleDateString()}</p>}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {proposal.contract_pdf ? (
                    <a href={proposal.contract_pdf} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />{t("proposal_detail.download_contract", "Télécharger contrat")}</Button>
                    </a>
                  ) : (
                    <Button variant="outline" size="sm" disabled={actionLoading} onClick={handleGenerateContract}>
                      <FileText className="h-4 w-4 mr-1" />{t("proposal_detail.generate_contract", "Générer contrat")}
                    </Button>
                  )}
                  {canSign && (
                    <Button variant="gradient" size="sm" disabled={actionLoading} onClick={handleSign}>
                      <PenTool className="h-4 w-4 mr-1" />{t("proposal_detail.sign", "Signer")}
                    </Button>
                  )}
                  {canFund && (
                    <Button variant="gradient" size="sm" disabled={actionLoading} onClick={handleFundEscrow}>
                      <Wallet className="h-4 w-4 mr-1" />{t("proposal_detail.fund_escrow", "Approvisionner escrow")}
                    </Button>
                  )}
                  {canSubmit && !showSubmit && (
                    <Button variant="gradient" size="sm" onClick={() => setShowSubmit(true)}>
                      <Upload className="h-4 w-4 mr-1" />{t("proposal_detail.submit_content", "Soumettre contenu")}
                    </Button>
                  )}
                  {canValidate && (
                    <>
                      <Button variant="gradient" size="sm" disabled={actionLoading} onClick={handleValidate}>
                        <CheckCircle className="h-4 w-4 mr-1" />{t("proposal_detail.validate", "Valider")}
                      </Button>
                      <Button variant="destructive" size="sm" disabled={actionLoading} onClick={handleReject}>
                        <XCircle className="h-4 w-4 mr-1" />{t("proposal_detail.request_correction", "Demander correction")}
                      </Button>
                    </>
                  )}
                </div>

                {showSubmit && (
                  <div className="border-t pt-3 space-y-2">
                    <input
                      type="url" placeholder="URL du contenu publié"
                      value={contentUrl} onChange={(e) => setContentUrl(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <textarea
                      placeholder="Notes (optionnel)" value={contentNotes}
                      onChange={(e) => setContentNotes(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm" rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="gradient" disabled={!contentUrl || actionLoading} onClick={handleSubmitContent}>{t("common.submit", "Envoyer")}</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowSubmit(false)}>{t("common.cancel", "Annuler")}</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="card-base">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />{t("proposal_detail.messages")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MessageThread messages={messages} onSend={handleSend} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">{t("proposal_detail.brand_info")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-lg mb-3">
                  {(proposal.brand_company_name || "?")[0].toUpperCase()}
                </div>
                <p className="font-semibold text-gray-900">{proposal.brand_company_name}</p>
                {proposal.brand_id && !isBrand && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(`/influencer/brands/${proposal.brand_id}`)}>
                    {t("proposal_detail.view_brand")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CounterOfferDialog
        proposalId={Number(id)}
        open={showCounter}
        initialPrice={proposal.proposed_price}
        onClose={() => setShowCounter(false)}
        onSuccess={reload}
      />
      <ReviewDialog
        proposalId={Number(id)}
        open={showReview}
        onClose={() => setShowReview(false)}
        onSuccess={reload}
      />
      <SignContractDialog
        proposalId={Number(id)}
        open={showSignDialog}
        onClose={() => setShowSignDialog(false)}
        onSuccess={reload}
      />
      <PaymentDialog
        open={showPayDialog}
        onClose={() => setShowPayDialog(false)}
        onConfirm={doFundEscrow}
        title="Approvisionner l'escrow"
        amount={Number(proposal.proposed_price) || 0}
        description="Les fonds sont sécurisés par InfluConnect et libérés à l'influenceur après validation du contenu."
        ctaLabel="Bloquer"
      />
    </div>
  )
}
