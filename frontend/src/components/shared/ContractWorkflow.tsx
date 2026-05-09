import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Banknote, Calendar, CheckCircle2, Clock3, FileText, PenTool, Shield, Upload, Wallet } from "lucide-react"
import { useTranslation } from "react-i18next"

export interface ContractWorkflowData {
  status: string
  contract_pdf?: string | null
  brand_signed_at?: string | null
  influencer_signed_at?: string | null
  escrow_funded_at?: string | null
  escrow_released_at?: string | null
  submission_deadline?: string | null
  validation_deadline?: string | null
  latest_submission_kind?: "link" | "photo" | "video" | "upload" | null
  latest_submission_pre_publish?: boolean | null
}

interface ContractWorkflowProps {
  proposal: ContractWorkflowData
  className?: string
  actions?: ReactNode
  extraContent?: ReactNode
}

const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return withTime ? date.toLocaleString() : date.toLocaleDateString()
}

export function ContractWorkflow({ proposal, className, actions, extraContent }: ContractWorkflowProps) {
  const { t } = useTranslation()
  const contentSubmitted = ["content_submitted", "validated", "paid"].includes(proposal.status)
  const paymentReleased = !!proposal.escrow_released_at || proposal.status === "paid"
  const submissionKindLabel =
    proposal.latest_submission_kind === "link"
      ? t("workflow.submission_kind_link")
      : proposal.latest_submission_kind === "photo"
      ? t("workflow.submission_kind_photo")
      : proposal.latest_submission_kind === "video"
      ? t("workflow.submission_kind_video")
      : proposal.latest_submission_kind === "upload"
      ? t("workflow.submission_kind_file")
      : null

  const steps = [
    {
      label: t("workflow.contract_generated"),
      detail: proposal.contract_pdf ? t("workflow.pdf_available") : t("workflow.awaiting_brand_generation"),
      done: !!proposal.contract_pdf,
      icon: FileText,
    },
    {
      label: t("workflow.brand_signature"),
      detail: formatDate(proposal.brand_signed_at, true) || t("workflow.signature_pending"),
      done: !!proposal.brand_signed_at,
      icon: PenTool,
    },
    {
      label: t("workflow.influencer_signature"),
      detail: formatDate(proposal.influencer_signed_at, true) || t("workflow.signature_pending"),
      done: !!proposal.influencer_signed_at,
      icon: PenTool,
    },
    {
      label: t("workflow.escrow_funded"),
      detail: formatDate(proposal.escrow_funded_at) || t("workflow.awaiting_escrow_funding"),
      done: !!proposal.escrow_funded_at,
      icon: Wallet,
    },
    {
      label: t("workflow.content_submitted"),
      detail: contentSubmitted
        ? [
            t("workflow.content_sent_for_validation"),
            submissionKindLabel ? `${t("workflow.submission_type_prefix")}: ${submissionKindLabel}` : null,
            proposal.latest_submission_pre_publish ? t("workflow.pre_publish_review") : null,
          ]
            .filter(Boolean)
            .join(" • ")
        : t("workflow.awaiting_content_submission"),
      done: contentSubmitted,
      icon: Upload,
    },
    {
      label: t("workflow.payment_released"),
      detail: formatDate(proposal.escrow_released_at) || t("workflow.release_after_validation"),
      done: paymentReleased,
      icon: Banknote,
    },
  ]

  return (
    <Card className={cn("card-base", className)}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-500" />
          {t("workflow.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {steps.map(({ label, detail, done, icon: Icon }) => (
            <div key={label} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <div className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                done ? "bg-emerald-100 text-emerald-700" : "bg-white text-gray-400 border border-gray-200"
              )}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{detail}</p>
              </div>
              <Badge variant={done ? "success" : "warning"}>{done ? t("workflow.done") : t("workflow.todo")}</Badge>
            </div>
          ))}
        </div>

        {(proposal.submission_deadline || proposal.validation_deadline) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {proposal.submission_deadline && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("workflow.submit_before")}
                </div>
                <p className="mt-1">{formatDate(proposal.submission_deadline)}</p>
              </div>
            )}
            {proposal.validation_deadline && (
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("workflow.validate_before")}
                </div>
                <p className="mt-1">{formatDate(proposal.validation_deadline)}</p>
              </div>
            )}
          </div>
        )}

        {actions && <div className="flex flex-wrap gap-2 border-t pt-3">{actions}</div>}
        {extraContent}
      </CardContent>
    </Card>
  )
}