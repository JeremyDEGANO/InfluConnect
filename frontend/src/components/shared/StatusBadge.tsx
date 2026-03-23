import { Badge } from "@/components/ui/badge"
import { useTranslation } from "react-i18next"

type Status = "pending" | "active" | "completed" | "cancelled" | "accepted" | "declined" | "draft" | "published"

const STATUS_VARIANT: Record<Status, "warning" | "success" | "secondary" | "destructive" | "info" | "outline" | "purple" | "default"> = {
  pending: "warning",
  active: "success",
  completed: "info",
  cancelled: "destructive",
  accepted: "success",
  declined: "destructive",
  draft: "secondary",
  published: "purple",
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation()
  return <Badge variant={STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>
}
