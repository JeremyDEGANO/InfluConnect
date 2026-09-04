import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { accessContext, canAccessPath } from "@/lib/planAccess"
import { Button } from "@/components/ui/button"

type TourRole = "brand" | "influencer"

type TourStep = {
  path: string
  titleKey: string
  descKey: string
  ctaKey: string
  /**
   * Sidebar link to highlight. Some steps navigate to a page that has no menu
   * entry of its own (a "new X" form, the marketplace): without this the
   * highlight found nothing and the step looked broken.
   */
  anchor?: string
}

const TOUR_VERSION = "v4"
const TOUR_REPLAY_EVENT = "tour:replay"

const BRAND_STEPS: TourStep[] = [
  { path: "/brand/campaigns/new", anchor: "/brand/campaigns/new", titleKey: "tour.brand.step1.title", descKey: "tour.brand.step1.desc", ctaKey: "tour.brand.step1.cta" },
  { path: "/marketplace", anchor: "/marketplace", titleKey: "tour.brand.step2.title", descKey: "tour.brand.step2.desc", ctaKey: "tour.brand.step2.cta" },
  { path: "/brand/messages", titleKey: "tour.brand.step3.title", descKey: "tour.brand.step3.desc", ctaKey: "tour.brand.step3.cta" },
  { path: "/brand/events", titleKey: "tour.brand.step4.title", descKey: "tour.brand.step4.desc", ctaKey: "tour.brand.step4.cta" },
  // Contracts and contract templates used to be two steps saying the same
  // thing; one step covers the contract lifecycle, templates included.
  { path: "/brand/contracts", titleKey: "tour.brand.step5.title", descKey: "tour.brand.step5.desc", ctaKey: "tour.brand.step5.cta" },
  { path: "/brand/ambassadors", titleKey: "tour.brand.step7.title", descKey: "tour.brand.step7.desc", ctaKey: "tour.brand.step7.cta" },
  { path: "/brand/integrations", titleKey: "tour.brand.step8.title", descKey: "tour.brand.step8.desc", ctaKey: "tour.brand.step8.cta" },
  { path: "/brand/team", titleKey: "tour.brand.step9.title", descKey: "tour.brand.step9.desc", ctaKey: "tour.brand.step9.cta" },
]

const INFLUENCER_STEPS: TourStep[] = [
  { path: "/influencer/onboarding", titleKey: "tour.influencer.step1.title", descKey: "tour.influencer.step1.desc", ctaKey: "tour.influencer.step1.cta" },
  { path: "/influencer/media-kit", titleKey: "tour.influencer.step2.title", descKey: "tour.influencer.step2.desc", ctaKey: "tour.influencer.step2.cta" },
  { path: "/influencer/proposals", titleKey: "tour.influencer.step3.title", descKey: "tour.influencer.step3.desc", ctaKey: "tour.influencer.step3.cta" },
  { path: "/influencer/earnings", titleKey: "tour.influencer.step4.title", descKey: "tour.influencer.step4.desc", ctaKey: "tour.influencer.step4.cta" },
  { path: "/influencer/messages", titleKey: "tour.influencer.step5.title", descKey: "tour.influencer.step5.desc", ctaKey: "tour.influencer.step5.cta" },
]

function seenKey(userId: number, role: TourRole): string {
  return `ic_portal_tour_seen_${TOUR_VERSION}_${role}_${userId}`
}

export function PortalGuidedTour() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [sidebarRect, setSidebarRect] = useState<DOMRect | null>(null)

  const role = (user?.user_type === "brand" || user?.user_type === "influencer") ? user.user_type : null
  const isBrandApproved = (user?.brand_profile as { validation_status?: string } | undefined)?.validation_status === "approved"

  const isEligible = Boolean(
    user?.id
    && role
    && (role !== "brand" || isBrandApproved)
  )

  // Only walk through what this subscription actually includes: showing the
  // API/integrations step to a plan without API access advertised a feature
  // the user cannot use, and its CTA led to a page they should not reach.
  const accessCtx = useMemo(() => accessContext(user), [user])
  const steps = useMemo(() => {
    if (role === "brand") return BRAND_STEPS.filter((s) => canAccessPath(s.path, accessCtx))
    if (role === "influencer") return INFLUENCER_STEPS
    return []
  }, [role, accessCtx])

  const homePath = role === "brand" ? "/brand/dashboard" : role === "influencer" ? "/influencer/dashboard" : null

  const startTour = () => {
    if (!isEligible || steps.length === 0) return
    setIndex(0)
    setActive(true)
    navigate(steps[0].path)
  }

  const finishTour = () => {
    if (user?.id && role) {
      localStorage.setItem(seenKey(user.id, role), "1")
    }
    setActive(false)
    setIndex(0)
    setTargetRect(null)
    setSidebarRect(null)
  }

  const skipTour = () => {
    finishTour()
    if (homePath) navigate(homePath)
  }

  const goToStep = (nextIndex: number) => {
    if (!steps[nextIndex]) return
    setIndex(nextIndex)
    navigate(steps[nextIndex].path)
  }

  const onNext = () => {
    if (index >= steps.length - 1) {
      finishTour()
      if (homePath) navigate(homePath)
      return
    }
    goToStep(index + 1)
  }

  const onPrevious = () => {
    if (index <= 0) return
    goToStep(index - 1)
  }

  useEffect(() => {
    if (!isEligible || !user?.id || !role || !homePath) return
    if (location.pathname !== homePath) return

    const alreadySeen = localStorage.getItem(seenKey(user.id, role)) === "1"
    if (!alreadySeen) startTour()
  }, [homePath, isEligible, location.pathname, role, user?.id])

  useEffect(() => {
    const onReplay = () => {
      if (!isEligible || !user?.id || !role) return
      localStorage.removeItem(seenKey(user.id, role))
      startTour()
    }
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay)
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay)
  }, [isEligible, role, steps])

  useEffect(() => {
    if (!active || !steps[index]) {
      setTargetRect(null)
      setSidebarRect(null)
      return
    }

    const updateRect = () => {
      const sidebarEl = document.querySelector("aside") as HTMLElement | null
      if (sidebarEl) {
        setSidebarRect(sidebarEl.getBoundingClientRect())
      } else {
        setSidebarRect(null)
      }

      const current = steps[index]
      // Try the explicit anchor, then the step path, then the closest parent
      // section (e.g. /brand/events for /brand/events/new).
      const candidates = [current.anchor, current.path]
        .filter((value): value is string => Boolean(value))
      const parent = current.path.split("/").slice(0, 3).join("/")
      if (parent && !candidates.includes(parent)) candidates.push(parent)

      let el: HTMLElement | null = null
      for (const candidate of candidates) {
        el = document.querySelector(
          `aside a[href='${candidate}'], a[href='${candidate}']`,
        ) as HTMLElement | null
        if (el) break
      }
      if (!el) {
        // No menu entry to point at: the card still shows, centred, rather
        // than leaving a step that looks dead.
        setTargetRect(null)
        return
      }
      setTargetRect(el.getBoundingClientRect())
    }

    updateRect()
    window.addEventListener("resize", updateRect)
    window.addEventListener("scroll", updateRect, true)
    return () => {
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
    }
  }, [active, index, location.pathname, steps])

  if (!active || !steps[index]) return null

  const step = steps[index]
  const isLast = index === steps.length - 1

  const spotlightStyle = targetRect
    ? {
        left: `${Math.max(8, targetRect.left - 6)}px`,
        top: `${Math.max(8, targetRect.top - 6)}px`,
        width: `${targetRect.width + 12}px`,
        height: `${targetRect.height + 12}px`,
      }
    : undefined

  const sidebarDimStyle = sidebarRect
    ? {
        left: `${Math.max(0, sidebarRect.left)}px`,
        top: `${Math.max(0, sidebarRect.top)}px`,
        width: `${Math.max(0, sidebarRect.width)}px`,
        height: `${Math.max(0, sidebarRect.height)}px`,
      }
    : undefined

  const hole = (targetRect && sidebarRect)
    ? {
        left: Math.max(sidebarRect.left, targetRect.left - 6),
        top: Math.max(sidebarRect.top, targetRect.top - 6),
        right: Math.min(sidebarRect.right, targetRect.right + 6),
        bottom: Math.min(sidebarRect.bottom, targetRect.bottom + 6),
      }
    : null

  const cardStyle = targetRect
    ? {
        top: `${Math.min(window.innerHeight - 260, Math.max(24, targetRect.top))}px`,
        left: `${Math.min(window.innerWidth - 380, targetRect.right + 16)}px`,
      }
    : {
        top: "96px",
        right: "24px",
      }

  return (
    <div className="fixed inset-0 z-[120]">
      {sidebarRect && !hole && sidebarDimStyle && (
        <div className="absolute bg-slate-950/55 pointer-events-none" style={sidebarDimStyle} />
      )}

      {sidebarRect && hole && (
        <>
          <div
            className="absolute bg-slate-950/55 pointer-events-none"
            style={{
              left: `${sidebarRect.left}px`,
              top: `${sidebarRect.top}px`,
              width: `${sidebarRect.width}px`,
              height: `${Math.max(0, hole.top - sidebarRect.top)}px`,
            }}
          />
          <div
            className="absolute bg-slate-950/55 pointer-events-none"
            style={{
              left: `${sidebarRect.left}px`,
              top: `${hole.bottom}px`,
              width: `${sidebarRect.width}px`,
              height: `${Math.max(0, sidebarRect.bottom - hole.bottom)}px`,
            }}
          />
          <div
            className="absolute bg-slate-950/55 pointer-events-none"
            style={{
              left: `${sidebarRect.left}px`,
              top: `${hole.top}px`,
              width: `${Math.max(0, hole.left - sidebarRect.left)}px`,
              height: `${Math.max(0, hole.bottom - hole.top)}px`,
            }}
          />
          <div
            className="absolute bg-slate-950/55 pointer-events-none"
            style={{
              left: `${hole.right}px`,
              top: `${hole.top}px`,
              width: `${Math.max(0, sidebarRect.right - hole.right)}px`,
              height: `${Math.max(0, hole.bottom - hole.top)}px`,
            }}
          />
        </>
      )}

      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-white/95 shadow-[0_0_0_2px_rgba(59,130,246,0.45)] pointer-events-none"
          style={spotlightStyle}
        />
      )}

      <div
        className="absolute w-[min(360px,calc(100vw-24px))] rounded-xl border border-aurora-line bg-white p-4 shadow-2xl"
        style={cardStyle}
      >
        <p className="text-xs uppercase tracking-wide text-aurora-ink-3 mb-1">
          {t("tour.progress", { current: index + 1, total: steps.length })}
        </p>
        <h3 className="text-sm font-semibold text-aurora-ink">{t(step.titleKey)}</h3>
        <p className="text-sm text-aurora-ink-3 mt-1">{t(step.descKey)}</p>

        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => navigate(step.path)}>{t(step.ctaKey)}</Button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={skipTour}>{t("tour.skip")}</Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onPrevious} disabled={index === 0}>{t("tour.previous")}</Button>
            <Button size="sm" onClick={onNext}>{isLast ? t("tour.finish") : t("tour.next")}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const PORTAL_TOUR_REPLAY_EVENT = TOUR_REPLAY_EVENT
