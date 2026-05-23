import { Fragment, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchAuditLog, type AuditEntry } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"

const ACTION_LABELS: Record<string, string> = {
  brand_validated: "Validation marque approuvee",
  brand_rejected: "Validation marque refusee",
  escrow_funded: "Escrow alimente",
  escrow_released: "Escrow libere",
  escrow_refunded: "Escrow rembourse",
  contract_signed: "Contrat signe",
  contract_signed_brand: "Contrat signe (marque)",
  content_validated: "Contenu valide",
  content_rejected: "Contenu rejete",
  admin_arbitrated: "Arbitrage admin",
  subscription_created: "Abonnement cree",
  subscription_changed: "Abonnement modifie",
  subscription_cancelled: "Abonnement annule",
  user_suspended: "Utilisateur suspendu",
  review_moderated: "Avis modere",
  admin_user_status_update: "Statut utilisateur modifie",
  brand_submitted_for_validation: "Marque soumise a validation",
}

function formatAction(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ")
}

function formatTarget(entry: AuditEntry) {
  if (!entry.target_type && !entry.target_id) return "-"
  if (!entry.target_type) return `#${entry.target_id}`
  if (!entry.target_id) return entry.target_type
  return `${entry.target_type} #${entry.target_id}`
}

function metadataSummary(metadata: Record<string, unknown>) {
  if (!metadata || Object.keys(metadata).length === 0) return ["Aucun detail"]
  return Object.entries(metadata)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? "..." : String(value)}`)
}

export default function AdminAuditLog() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("all")

  useEffect(() => {
    setLoading(true)
    fetchAuditLog(1, action).then((d) => setEntries(d.results ?? [])).finally(() => setLoading(false))
  }, [action])

  const actionOptions = useMemo(() => {
    const set = new Set(entries.map((e) => e.action))
    return ["all", ...Array.from(set)]
  }, [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => {
      const haystack = [
        e.actor_email,
        e.actor_username,
        e.action,
        formatAction(e.action),
        e.target_type,
        String(e.target_id ?? ""),
        e.ip_address,
        JSON.stringify(e.metadata ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, search])

  if (loading) return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("admin_page.eyebrow", "Administration")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("admin_audit.title", "Journal d'audit")}</h1>
      <Card className="card-base">
        <CardHeader>
          <CardTitle>{t("admin_audit.readable_title", "Historique des actions sensibles")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin_audit.search", "Rechercher acteur, action, cible, IP...")}
            />
            <div className="flex items-center gap-2">
              {actionOptions.map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={action === a ? "default" : "outline"}
                  onClick={() => setAction(a)}
                >
                  {a === "all" ? t("admin_audit.all_actions", "Toutes") : formatAction(a)}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aurora-surface text-xs text-aurora-ink-3 uppercase">
                <tr>
                  <th className="text-left py-3 px-4">{t("admin_audit.date", "Date")}</th>
                  <th className="text-left py-3 px-4">{t("admin_audit.actor", "Acteur")}</th>
                  <th className="text-left py-3 px-4">{t("admin_audit.action", "Action")}</th>
                  <th className="text-left py-3 px-4">{t("admin_audit.target", "Cible")}</th>
                  <th className="text-left py-3 px-4">IP</th>
                  <th className="text-left py-3 px-4">{t("admin_audit.metadata", "Détails")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <Fragment key={e.id}>
                    <tr className="border-t border-aurora-line hover:bg-aurora-surface cursor-pointer" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                      <td className="py-2 px-4 text-aurora-ink-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="py-2 px-4">
                        <p className="font-medium text-aurora-ink">{e.actor_email || "system"}</p>
                        <p className="text-xs text-aurora-ink-3">{e.actor_username || "-"}</p>
                      </td>
                      <td className="py-2 px-4"><Badge className="bg-indigo-50 text-aurora-blue-deep">{formatAction(e.action)}</Badge></td>
                      <td className="py-2 px-4 text-aurora-ink-2">{formatTarget(e)}</td>
                      <td className="py-2 px-4 text-xs text-aurora-ink-3 font-mono">{e.ip_address || "-"}</td>
                      <td className="py-2 px-4 text-xs text-aurora-ink-3">
                        <div className="flex items-center gap-2">
                          <span>{metadataSummary(e.metadata).join(" | ")}</span>
                          {expandedId === e.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </div>
                      </td>
                    </tr>
                    {expandedId === e.id && (
                      <tr className="border-t border-aurora-line bg-aurora-surface/50">
                        <td colSpan={6} className="px-4 py-3">
                          <pre className="text-xs text-aurora-ink-2 whitespace-pre-wrap break-all">{JSON.stringify(e.metadata ?? {}, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-aurora-ink-3">{t("admin_audit.empty", "Aucune entrée")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
