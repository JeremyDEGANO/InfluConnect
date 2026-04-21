import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { fetchProposalMessages, sendProposalMessage, cancelProposal, deleteCampaign } from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { MessageThread } from "@/components/shared/MessageThread"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Eye, Calendar, DollarSign, Loader2, Send, Users, CheckCircle2, MessageSquare, Trash2, XCircle } from "lucide-react"

interface ChatMessage {
  id: number
  sender_name: string
  content: string
  created_at: string
  is_mine: boolean
}

interface Campaign {
  id: number
  title: string
  description: string
  status: string
  price_per_influencer: number
  deadline: string
  target_networks: string[]
  target_filters: Record<string, any>
}

interface Proposal {
  id: number
  influencer_display_name: string
  influencer: number
  proposed_price: number
  status: string
}

interface SocialNetwork {
  platform: string
  followers_count: number
}

interface MatchedInfluencer {
  id: number
  display_name: string
  avatar: string | null
  city: string
  content_themes: string[]
  social_networks: SocialNetwork[]
  average_rating: number | null
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [matches, setMatches] = useState<MatchedInfluencer[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<Set<number>>(new Set())
  const [sentIds, setSentIds] = useState<Set<number>>(new Set())
  const [chatProposal, setChatProposal] = useState<Proposal | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)

  const handleDeleteCampaign = async () => {
    if (!campaign) return
    try {
      await deleteCampaign(campaign.id)
      toast({ title: t("campaign_detail.deleted") })
      navigate("/brand/campaigns")
    } catch (err: any) {
      toast({ variant: "destructive", title: t("common.error"), description: err?.response?.data?.detail ?? "" })
      setConfirmDelete(false)
    }
  }

  const handleCancelProposal = async (proposalId: number) => {
    setCancelling(proposalId)
    try {
      await cancelProposal(proposalId)
      setProposals((prev) => prev.map((p) => p.id === proposalId ? { ...p, status: "declined" } : p))
      toast({ title: t("campaign_detail.cancelled") })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setCancelling(null)
    }
  }

  const openChat = async (p: Proposal) => {
    setChatProposal(p)
    setChatLoading(true)
    try {
      const msgs = await fetchProposalMessages(p.id)
      setChatMessages(msgs as ChatMessage[])
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setChatLoading(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!chatProposal) return
    try {
      const msg = await sendProposalMessage(chatProposal.id, content)
      setChatMessages((prev) => [...prev, msg as ChatMessage])
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [campRes, propRes] = await Promise.all([
          api.get(`/campaigns/${id}/`),
          api.get("/proposals/"),
        ])
        setCampaign(campRes.data)
        const allProposals: Proposal[] = propRes.data.results ?? propRes.data
        const campaignProposals = allProposals.filter((p: any) => p.campaign === Number(id))
        setProposals(campaignProposals)
        setSentIds(new Set(campaignProposals.map((p) => p.influencer)))

        try {
          const matchRes = await api.get(`/campaigns/${id}/target/`)
          setMatches(matchRes.data)
        } catch { /* no matches */ }
      } catch {
        // handle error
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const sendProposal = async (influencerId: number) => {
    setSending((prev) => new Set(prev).add(influencerId))
    try {
      await api.post(`/campaigns/${id}/send-proposals/`, {
        influencer_ids: [influencerId],
        proposed_price: campaign?.price_per_influencer ?? 0,
      })
      setSentIds((prev) => new Set(prev).add(influencerId))
      toast({ title: "Proposition envoyée" })
      const propRes = await api.get("/proposals/")
      const all: Proposal[] = propRes.data.results ?? propRes.data
      setProposals(all.filter((p: any) => p.campaign === Number(id)))
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setSending((prev) => { const s = new Set(prev); s.delete(influencerId); return s })
    }
  }

  const sendToAll = async () => {
    const toSend = matches.filter((m) => !sentIds.has(m.id)).map((m) => m.id)
    if (toSend.length === 0) return
    setSending(new Set(toSend))
    try {
      await api.post(`/campaigns/${id}/send-proposals/`, {
        influencer_ids: toSend,
        proposed_price: campaign?.price_per_influencer ?? 0,
      })
      setSentIds((prev) => new Set([...prev, ...toSend]))
      toast({ title: `${toSend.length} proposition(s) envoyée(s)` })
      const propRes = await api.get("/proposals/")
      const all: Proposal[] = propRes.data.results ?? propRes.data
      setProposals(all.filter((p: any) => p.campaign === Number(id)))
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setSending(new Set())
    }
  }

  const fmtFollowers = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  if (!campaign) return <div className="p-6 text-center text-gray-400">{t("common.error")}</div>

  const unsent = matches.filter((m) => !sentIds.has(m.id))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{campaign.title}</h1>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4 mr-1" />{t("campaign_detail.delete")}
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-base">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>{campaign.title}</CardTitle>
                <StatusBadge status={campaign.status as any} />
              </div>
            </CardHeader>
            <CardContent>
              {campaign.description && <p className="text-gray-600 text-sm leading-relaxed mb-4">{campaign.description}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { icon: DollarSign, label: t("campaign_detail.budget"), value: `€${campaign.price_per_influencer ?? 0}` },
                  { icon: Calendar, label: t("campaign_detail.deadline"), value: campaign.deadline ? new Date(campaign.deadline).toLocaleDateString() : "—" },
                  { icon: Eye, label: t("campaign_detail.views"), value: `${proposals.length} ${t("campaign_detail.proposals").toLowerCase()}` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-3 bg-gray-50 rounded-xl text-sm">
                    <div className="flex items-center gap-1 text-gray-400 mb-1"><Icon className="h-3.5 w-3.5" /><span className="text-xs">{label}</span></div>
                    <p className="font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              {campaign.target_networks?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {campaign.target_networks.map((tag) => <Badge key={tag} variant="info">{tag}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Influenceurs correspondants */}
          <Card className="card-base">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  Influenceurs correspondants ({matches.length})
                </CardTitle>
                {unsent.length > 0 && (
                  <Button size="sm" variant="gradient" onClick={sendToAll} disabled={sending.size > 0}>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Proposer à tous ({unsent.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {matches.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucun influenceur ne correspond pour l'instant à vos critères.</p>
              ) : (
                <div className="space-y-3">
                  {matches.map((m) => {
                    const alreadySent = sentIds.has(m.id)
                    const isSending = sending.has(m.id)
                    const totalFollowers = m.social_networks.reduce((sum, sn) => sum + sn.followers_count, 0)
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 shrink-0">
                            {m.avatar && <AvatarImage src={m.avatar} />}
                            <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-violet-600 text-white text-sm font-semibold">
                              {(m.display_name || "??").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{m.display_name || `Influencer #${m.id}`}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {m.city && <span>{m.city}</span>}
                              <span>{fmtFollowers(totalFollowers)} abonnés</span>
                              {m.social_networks.map((sn) => (
                                <Badge key={sn.platform} variant="outline" className="text-[10px] px-1.5 py-0">{sn.platform}</Badge>
                              ))}
                            </div>
                            {m.content_themes?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.content_themes.slice(0, 4).map((th) => (
                                  <Badge key={th} variant="info" className="text-[10px] px-1.5 py-0">{th}</Badge>
                                ))}
                                {m.content_themes.length > 4 && <span className="text-[10px] text-gray-400">+{m.content_themes.length - 4}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 ml-3">
                          {alreadySent ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="h-3.5 w-3.5" />Envoyée</span>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => sendProposal(m.id)} disabled={isSending}>
                              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" />Proposer</>}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Propositions */}
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">{t("campaign_detail.proposals")} ({proposals.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {proposals.length === 0 && <p className="text-sm text-gray-400 text-center py-4">{t("proposals_page.no_proposals")}</p>}
                {proposals.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-violet-600 text-white text-sm font-semibold">
                          {(p.influencer_display_name || "??").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{p.influencer_display_name || `Influencer #${p.id}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-gray-900">€{p.proposed_price}</span>
                      <StatusBadge status={p.status as any} />
                      <Button size="sm" variant="outline" onClick={() => openChat(p)}>
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />{t("campaign_detail.chat")}
                      </Button>
                      {["pending", "counter_offer", "content_submitted"].includes(p.status) && (
                        <Button size="sm" variant="gradient" onClick={() => navigate(`/brand/proposals/${p.id}`)}>{t("campaign_detail.review")}</Button>
                      )}
                      {["pending", "counter_offer"].includes(p.status) && (
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" disabled={cancelling === p.id} onClick={() => handleCancelProposal(p.id)}>
                          {cancelling === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" />{t("campaign_detail.cancel")}</>}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">{t("campaign_detail.quick_stats")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: t("campaign_detail.total_proposals"), value: proposals.length },
                { label: t("campaign_detail.accepted"), value: proposals.filter((p) => p.status === "accepted").length },
                { label: t("campaign_detail.pending_review"), value: proposals.filter((p) => p.status === "pending").length },
                { label: "Influenceurs matchés", value: matches.length },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {campaign.target_filters && Object.keys(campaign.target_filters).length > 0 && (
            <Card className="card-base">
              <CardHeader><CardTitle className="text-base">Critères de ciblage</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {campaign.target_filters.target_audience && (
                  <div><span className="text-gray-500">Audience : </span><span className="font-medium text-gray-900">{campaign.target_filters.target_audience}</span></div>
                )}
                {campaign.target_filters.min_followers && (
                  <div><span className="text-gray-500">Min. abonnés : </span><span className="font-medium text-gray-900">{fmtFollowers(campaign.target_filters.min_followers)}</span></div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("campaign_detail.delete_confirm_title")}</DialogTitle>
            <DialogDescription>{t("campaign_detail.delete_confirm_desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteCampaign}>
              <Trash2 className="h-4 w-4 mr-1" />{t("campaign_detail.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!chatProposal} onOpenChange={(open) => { if (!open) { setChatProposal(null); setChatMessages([]) } }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              {chatProposal?.influencer_display_name || `Influencer #${chatProposal?.id}`}
            </DialogTitle>
          </DialogHeader>
          {chatLoading ? (
            <div className="flex items-center justify-center h-96 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />{t("common.loading")}
            </div>
          ) : (
            <MessageThread messages={chatMessages} onSend={handleSendMessage} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
