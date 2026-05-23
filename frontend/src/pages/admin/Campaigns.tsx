import { Fragment, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Briefcase, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { fetchAdminOverview, type AdminOverviewLiveCampaign } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

function money(value: number) {
  return `EUR ${Number(value ?? 0).toLocaleString()}`
}

function statusClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-700"
  if (status === "paused") return "bg-amber-100 text-amber-700"
  if (status === "completed") return "bg-sky-100 text-sky-700"
  if (status === "cancelled") return "bg-rose-100 text-rose-700"
  return "bg-aurora-surface text-aurora-ink-2"
}

export default function AdminCampaigns() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<AdminOverviewLiveCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [proposalFilter, setProposalFilter] = useState<"all" | "with" | "without">("all")

  useEffect(() => {
    setLoading(true)
    fetchAdminOverview()
      .then((d) => setItems(d.live_campaigns ?? []))
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setLoading(false))
  }, [t, toast])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((c) => {
      const statusMatch = status === "all" ? true : c.status === status
      if (!statusMatch) return false
      if (proposalFilter === "with" && c.proposals_total <= 0) return false
      if (proposalFilter === "without" && c.proposals_total > 0) return false
      if (!q) return true
      return [c.title, c.brand_company_name, String(c.id), c.status].join(" ").toLowerCase().includes(q)
    })
  }, [items, proposalFilter, search, status])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Briefcase className="h-6 w-6 text-aurora-ink-2" />
        <p className="text-sm text-aurora-ink-3">{t("admin_page.eyebrow", "Administration")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("admin_campaigns.title", "Campagnes")}</h1>
      </div>

      <Card className="card-base">
        <CardHeader>
          <CardTitle>{t("admin_page.live_campaigns_list", "Liste des campagnes en cours")} ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin_campaigns.search", "Rechercher campagne, entreprise, statut...")}
            />
            <div className="flex flex-wrap items-center gap-2">
              {[
                ["all", t("admin_campaigns.filter_all", "Tous")],
                ["active", t("campaigns.active")],
                ["paused", t("admin_campaigns.filter_paused", "En pause")],
                ["completed", t("campaigns.completed")],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={status === value ? "default" : "outline"}
                  onClick={() => setStatus(value)}
                >
                  {label}
                </Button>
              ))}
              {[
                ["all", t("admin_campaigns.proposals_all", "Toutes propositions")],
                ["with", t("admin_campaigns.proposals_with", "Avec propositions")],
                ["without", t("admin_campaigns.proposals_without", "Sans proposition")],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={proposalFilter === value ? "default" : "outline"}
                  onClick={() => setProposalFilter(value as "all" | "with" | "without")}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aurora-surface text-xs text-aurora-ink-3 uppercase">
                <tr>
                  <th className="text-left py-2 px-3">{t("admin_page.col_campaign", "Campagne")}</th>
                  <th className="text-left py-2 px-3">{t("admin_page.col_company")}</th>
                  <th className="text-center py-2 px-3">{t("admin_page.col_status")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_deadline", "Échéance")}</th>
                  <th className="text-right py-2 px-3">{t("admin_page.col_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((c: AdminOverviewLiveCampaign) => {
                  const isExpanded = expandedId === c.id
                  return (
                    <Fragment key={c.id}>
                      <tr
                        className="border-t border-aurora-line hover:bg-aurora-surface cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-aurora-ink-3" /> : <ChevronDown className="h-3.5 w-3.5 text-aurora-ink-3" />}
                            <div>
                              <p className="font-medium text-aurora-ink">{c.title}</p>
                              <p className="text-xs text-aurora-ink-3">#{c.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-aurora-ink-2">{c.brand_company_name}</td>
                        <td className="py-2 px-3 text-center"><Badge className={statusClass(c.status)}>{c.status}</Badge></td>
                        <td className="py-2 px-3 text-right text-aurora-ink-3">{c.deadline ? new Date(c.deadline).toLocaleDateString() : "-"}</td>
                        <td className="py-2 px-3 text-right">
                          <Link to={`/brand/campaigns/${c.id}`} onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost">{t("common.view", "Voir")}</Button>
                          </Link>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-aurora-line bg-aurora-surface/50">
                          <td colSpan={5} className="px-4 py-3 text-xs text-aurora-ink-2">
                            <div className="grid md:grid-cols-4 gap-3">
                              <p><span className="text-aurora-ink-3">{t("admin_page.budget", "Budget")}: </span>{c.price_per_influencer != null ? money(Number(c.price_per_influencer)) : "-"}</p>
                              <p><span className="text-aurora-ink-3">{t("admin_page.influencers", "Influenceurs")}: </span>{c.max_influencers}</p>
                              <p><span className="text-aurora-ink-3">{t("admin_page.proposals", "Propositions")}: </span>{c.proposals_total}</p>
                              <p><span className="text-aurora-ink-3">{t("admin_page.in_progress", "En cours")}: </span>{c.proposals_in_progress}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-aurora-ink-3">{t("admin_page.empty_live_campaigns", "Aucune campagne active trouvée.")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}