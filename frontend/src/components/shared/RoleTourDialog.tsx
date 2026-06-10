import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type TourRole = "brand" | "influencer"

interface RoleTourDialogProps {
  role: TourRole
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface TourStep {
  titleKey: string
  descKey: string
  href: string
  ctaKey: string
}

export function RoleTourDialog({ role, open, onOpenChange }: RoleTourDialogProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)

  const steps = useMemo<TourStep[]>(() => {
    if (role === "brand") {
      return [
        {
          titleKey: "tour.brand.step1.title",
          descKey: "tour.brand.step1.desc",
          href: "/brand/campaigns/new",
          ctaKey: "tour.brand.step1.cta",
        },
        {
          titleKey: "tour.brand.step2.title",
          descKey: "tour.brand.step2.desc",
          href: "/marketplace",
          ctaKey: "tour.brand.step2.cta",
        },
        {
          titleKey: "tour.brand.step3.title",
          descKey: "tour.brand.step3.desc",
          href: "/brand/messages",
          ctaKey: "tour.brand.step3.cta",
        },
        {
          titleKey: "tour.brand.step4.title",
          descKey: "tour.brand.step4.desc",
          href: "/brand/integrations",
          ctaKey: "tour.brand.step4.cta",
        },
        {
          titleKey: "tour.brand.step5.title",
          descKey: "tour.brand.step5.desc",
          href: "/brand/team",
          ctaKey: "tour.brand.step5.cta",
        },
      ]
    }

    return [
      {
        titleKey: "tour.influencer.step1.title",
        descKey: "tour.influencer.step1.desc",
        href: "/influencer/onboarding",
        ctaKey: "tour.influencer.step1.cta",
      },
      {
        titleKey: "tour.influencer.step2.title",
        descKey: "tour.influencer.step2.desc",
        href: "/influencer/media-kit",
        ctaKey: "tour.influencer.step2.cta",
      },
      {
        titleKey: "tour.influencer.step3.title",
        descKey: "tour.influencer.step3.desc",
        href: "/influencer/proposals",
        ctaKey: "tour.influencer.step3.cta",
      },
      {
        titleKey: "tour.influencer.step4.title",
        descKey: "tour.influencer.step4.desc",
        href: "/influencer/earnings",
        ctaKey: "tour.influencer.step4.cta",
      },
      {
        titleKey: "tour.influencer.step5.title",
        descKey: "tour.influencer.step5.desc",
        href: "/influencer/messages",
        ctaKey: "tour.influencer.step5.cta",
      },
    ]
  }, [role])

  const total = steps.length
  const step = steps[index]
  const isLast = index === total - 1

  const closeDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIndex(0)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(role === "brand" ? "tour.brand.title" : "tour.influencer.title")}</DialogTitle>
          <DialogDescription>
            {t("tour.progress", { current: index + 1, total })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-aurora-line bg-aurora-bg-1 p-4 space-y-2">
          <h3 className="font-semibold text-sm text-aurora-ink">{t(step.titleKey)}</h3>
          <p className="text-sm text-aurora-ink-3">{t(step.descKey)}</p>
          <Link to={step.href} className="inline-flex">
            <Button variant="outline" size="sm" onClick={() => closeDialog(false)}>{t(step.ctaKey)}</Button>
          </Link>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <Button variant="ghost" onClick={() => closeDialog(false)}>{t("tour.skip")}</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIndex((v) => Math.max(0, v - 1))} disabled={index === 0}>
              {t("tour.previous")}
            </Button>
            {!isLast ? (
              <Button onClick={() => setIndex((v) => Math.min(total - 1, v + 1))}>{t("tour.next")}</Button>
            ) : (
              <Button onClick={() => closeDialog(false)}>{t("tour.finish")}</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
