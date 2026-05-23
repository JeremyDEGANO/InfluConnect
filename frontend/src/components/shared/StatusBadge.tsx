import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"

const toLabelFallback = (status: string) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const STATUS_VARIANT: Record<string, "warning" | "success" | "secondary" | "destructive" | "info" | "outline" | "purple" | "default"> = {
  pending: "warning",
  active: "success",
  paused: "warning",
  completed: "info",
  cancelled: "destructive",
  accepted: "success",
  declined: "destructive",
  draft: "secondary",
  published: "info",
  counter_offer: "warning",
  contract_signed: "info",
  in_progress: "info",
  content_submitted: "purple",
  validated: "success",
  paid: "success",
  disputed: "destructive",
}

const CAMPAIGN_PHASE_VARIANT: Record<string, "warning" | "success" | "secondary" | "destructive" | "info" | "outline" | "purple" | "default"> = {
  planning: "secondary",
  recruiting: "info",
  closing_soon: "warning",
  overdue: "destructive",
  paused: "outline",
  completed: "success",
  cancelled: "destructive",
}

export function getCampaignPhaseKey(status: string, deadline?: string | null) {
  if (status === "draft") return "planning"
  if (status === "paused") return "paused"
  if (status === "completed") return "completed"
  if (status === "cancelled") return "cancelled"
  if (status !== "active") return null
  if (!deadline) return "recruiting"

  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) return "recruiting"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadlineDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) return "overdue"
  if (diffDays <= 7) return "closing_soon"
  return "recruiting"
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"}>
      {t(`status.${status}`, { defaultValue: toLabelFallback(status) })}
    </Badge>
  )
}

export function CampaignPhaseBadge({ status, deadline }: { status: string; deadline?: string | null }) {
  const { t } = useTranslation()
  const phaseKey = getCampaignPhaseKey(status, deadline)
  if (!phaseKey) return null

  return (
    <Badge variant={CAMPAIGN_PHASE_VARIANT[phaseKey] ?? "outline"}>
      {t(`campaigns_page.phase_${phaseKey}`)}
    </Badge>
  )
}
