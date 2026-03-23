import { Calendar, DollarSign, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "./StatusBadge"
import { useTranslation } from "react-i18next"

type CampaignStatus = "pending" | "active" | "completed" | "cancelled" | "accepted" | "declined" | "draft" | "published"

interface CampaignCardProps {
  id: number
  title: string
  budget: number
  deadline: string
  status: CampaignStatus
  themes: string[]
  proposals_count?: number
  onView?: (id: number) => void
}

export function CampaignCard({ id, title, budget, deadline, status, themes, proposals_count, onView }: CampaignCardProps) {
  const { t } = useTranslation()
  return (
    <Card className="card-base hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
          <StatusBadge status={status} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {themes.slice(0, 3).map((theme) => (
            <span key={theme} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{theme}</span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="font-medium text-gray-900">€{budget.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span>{new Date(deadline).toLocaleDateString()}</span>
          </div>
          {proposals_count !== undefined && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Users className="h-4 w-4 text-purple-500" />
              <span>{proposals_count} proposals</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => onView?.(id)}>{t("common.view")}</Button>
      </CardContent>
    </Card>
  )
}
