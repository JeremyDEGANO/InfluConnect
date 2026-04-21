import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { fetchBrandPublic, BrandPublic } from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2, Globe, Star, Briefcase } from "lucide-react"

export default function BrandPublicProfile() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [brand, setBrand] = useState<BrandPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchBrandPublic(Number(id))
        setBrand(data)
      } catch {
        toast({ variant: "destructive", title: t("common.error") })
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }
  if (!brand) return <div className="p-6 text-center text-gray-400">{t("common.error")}</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-xl font-bold text-gray-900">{t("brand_public.title")}</h1>
      </div>

      <Card className="card-base">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {brand.logo && <AvatarImage src={brand.logo} />}
              <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-violet-600 text-white text-lg font-semibold">
                {(brand.company_name || "??").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-xl">{brand.company_name}</CardTitle>
              {brand.sector && <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Briefcase className="h-3.5 w-3.5" />{brand.sector}</p>}
            </div>
            {brand.average_rating !== null && (
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-amber-500" />
                <span className="font-semibold">{brand.average_rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {brand.description && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{t("brand_public.about")}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{brand.description}</p>
            </div>
          )}
          {brand.website && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{t("brand_public.website")}</p>
              <a href={brand.website} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />{brand.website}
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
