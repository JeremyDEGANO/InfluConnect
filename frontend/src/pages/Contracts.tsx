import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { fetchContracts, ContractItem } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Loader2, CheckCircle2, Clock } from "lucide-react"
import { Link } from "react-router-dom"

export default function Contracts() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [items, setItems] = useState<ContractItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchContracts()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isBrand = user?.user_type === "brand"
  const detailBase = isBrand ? "/brand/campaigns" : "/influencer/proposals"

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-indigo-500" />
          {t("contracts_list.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("contracts_list.subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />{t("contracts_list.loading")}
        </div>
      ) : items.length === 0 ? (
        <Card className="card-base">
          <CardContent className="py-16 text-center text-gray-400">{t("contracts_list.empty")}</CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((c) => {
            const bothSigned = !!c.brand_signed_at && !!c.influencer_signed_at
            return (
              <Card key={c.id} className="card-base">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-1">{c.campaign_title}</CardTitle>
                    {bothSigned ? (
                      <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{t("contracts_list.signed")}</Badge>
                    ) : (
                      <Badge variant="warning" className="flex items-center gap-1"><Clock className="h-3 w-3" />{t("contracts_list.pending")}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {isBrand ? c.influencer_name : c.brand_company_name}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>
                      <span className="font-medium">{t("contracts_list.brand_signed")}:</span>{" "}
                      {c.brand_signed_at ? new Date(c.brand_signed_at).toLocaleDateString(i18n.language) : "—"}
                    </p>
                    <p>
                      <span className="font-medium">{t("contracts_list.influencer_signed")}:</span>{" "}
                      {c.influencer_signed_at ? new Date(c.influencer_signed_at).toLocaleDateString(i18n.language) : "—"}
                    </p>
                    <p className="text-gray-400">v{c.contract_version}</p>
                  </div>
                  <div className="flex gap-2">
                    {c.contract_pdf && (
                      <a href={c.contract_pdf} target="_blank" rel="noreferrer" className="flex-1">
                        <Button size="sm" variant="outline" className="w-full">
                          <Download className="h-3.5 w-3.5 mr-1.5" />{t("contracts_list.download")}
                        </Button>
                      </a>
                    )}
                    <Link to={`${detailBase}/${isBrand ? c.campaign : c.id}`} className="flex-1">
                      <Button size="sm" variant="gradient" className="w-full">{t("contracts_list.view")}</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
