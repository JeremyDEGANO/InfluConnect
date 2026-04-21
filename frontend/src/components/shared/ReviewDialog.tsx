import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createReview } from "@/lib/apiExtra"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Star, Send } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  proposalId: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CRITERIA_KEYS = ["communication", "professionalism", "quality", "deadlines"] as const

function StarSelector({
  value,
  onChange,
  ariaLabelSuffix,
}: {
  value: number
  onChange: (n: number) => void
  ariaLabelSuffix: string
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-110"
          aria-label={`${n} ${ariaLabelSuffix}`}
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              n <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300",
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function ReviewDialog({ proposalId, open, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [rating, setRating] = useState(5)
  const [criteria, setCriteria] = useState<Record<string, number>>({
    communication: 5,
    professionalism: 5,
    quality: 5,
    deadlines: 5,
  })
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!comment.trim()) {
      toast({ variant: "destructive", title: t("review.comment_required") })
      return
    }
    setSubmitting(true)
    try {
      await createReview(proposalId, {
        rating,
        comment: comment.trim(),
        criteria_ratings: criteria,
      })
      toast({ title: t("review.published") })
      onSuccess()
      onClose()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: t("review.error"),
        description: e?.response?.data?.detail,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("review.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("review.overall")}</Label>
            <StarSelector value={rating} onChange={setRating} ariaLabelSuffix={t("review.stars_aria")} />
          </div>
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">{t("review.criteria")}</Label>
            {CRITERIA_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{t(`review.crit_${key}`)}</span>
                <StarSelector
                  value={criteria[key]}
                  onChange={(n) => setCriteria((p) => ({ ...p, [key]: n }))}
                  ariaLabelSuffix={t("review.stars_aria")}
                />
              </div>
            ))}
          </div>
          <div>
            <Label htmlFor="review-comment">{t("review.comment_label")}</Label>
            <textarea
              id="review-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("review.comment_placeholder")}
              className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>{t("review.cancel")}</Button>
            <Button variant="gradient" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {t("review.publish")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
