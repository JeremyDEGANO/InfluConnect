import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchAuditLog, type AuditEntry } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function AdminAuditLog() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAuditLog().then((d) => setEntries(d.results ?? [])).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_audit.title", "Journal d'audit")}</h1>
      <Card className="card-base">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-3 px-4">{t("admin_audit.date", "Date")}</th>
                  <th className="text-left py-3 px-4">{t("admin_audit.actor", "Acteur")}</th>
                  <th className="text-left py-3 px-4">{t("admin_audit.action", "Action")}</th>
                  <th className="text-left py-3 px-4">IP</th>
                  <th className="text-left py-3 px-4">{t("admin_audit.metadata", "Détails")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="py-2 px-4 font-medium">{e.actor_email || "—"}</td>
                    <td className="py-2 px-4"><code className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{e.action}</code></td>
                    <td className="py-2 px-4 text-xs text-gray-400 font-mono">{e.ip_address || "—"}</td>
                    <td className="py-2 px-4 text-xs text-gray-500"><code className="font-mono">{JSON.stringify(e.metadata)}</code></td>
                  </tr>
                ))}
                {entries.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-400">{t("admin_audit.empty", "Aucune entrée")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
