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

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"}>
      {t(`status.${status}`, { defaultValue: toLabelFallback(status) })}
    </Badge>
  )
}
