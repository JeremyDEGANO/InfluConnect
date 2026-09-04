import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const PRESET_KEYS = [
  "budget_too_low",
  "not_my_niche",
  "no_availability",
  "deadline_too_short",
  "brand_mismatch",
  "other",
] as const

type PresetKey = (typeof PRESET_KEYS)[number]

interface DeclineReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<void> | void
  title?: string
  description?: string
  confirmLabel?: string
}

export function DeclineReasonDialog({
  open, onOpenChange, onConfirm, title, description, confirmLabel,
}: DeclineReasonDialogProps) {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<PresetKey | null>(null)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setPreset(null)
      setComment("")
      setSubmitting(false)
    }
  }, [open])

  const presetLabel = (key: PresetKey) => t(`decline_dialog.reason_${key}`)

  const needsComment = preset === "other"
  const canSubmit = Boolean(preset) && (!needsComment || comment.trim().length >= 3) && !submitting

  const handleConfirm = async () => {
    if (!preset || !canSubmit) return
    const base = presetLabel(preset)
    const extra = comment.trim()
    const reason = needsComment ? extra : (extra ? `${base} — ${extra}` : base)
    setSubmitting(true)
    try {
      await onConfirm(reason)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? t("decline_dialog.title")}</DialogTitle>
          <DialogDescription>{description ?? t("decline_dialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  preset === key
                    ? "border-aurora-blue bg-indigo-50 text-aurora-blue-deep font-medium"
                    : "border-aurora-line hover:bg-aurora-surface text-aurora-ink-2",
                )}
              >
                {presetLabel(key)}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decline-comment">
              {needsComment ? t("decline_dialog.comment_required") : t("decline_dialog.comment_optional")}
            </Label>
            <textarea
              id="decline-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("decline_dialog.comment_placeholder")}
              maxLength={500}
              className="w-full px-3 py-2 border border-aurora-line rounded-lg text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel ?? t("decline_dialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
