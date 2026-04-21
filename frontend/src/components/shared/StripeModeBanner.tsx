import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ShieldCheck, AlertTriangle } from "lucide-react"
import { fetchStripeConfig } from "@/lib/apiExtra"

export function StripeModeBanner() {
  const { t } = useTranslation()
  const [live, setLive] = useState<boolean | null>(null)
  useEffect(() => {
    fetchStripeConfig()
      .then((c) => setLive(c.live))
      .catch(() => setLive(false))
  }, [])

  if (live === null) return null

  if (live) {
    return (
      <div className="flex gap-2 items-start p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          <strong>{t("stripe_banner.live_title")}</strong> — {t("stripe_banner.live_desc")}
        </p>
      </div>
    )
  }
  return (
    <div className="flex gap-2 items-start p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>
        <strong>{t("stripe_banner.test_title")}</strong> — {t("stripe_banner.test_desc")}
      </p>
    </div>
  )
}
