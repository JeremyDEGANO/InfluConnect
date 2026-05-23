import { useTranslation } from "react-i18next"

interface Props {
  lastSyncedAt: string | null | undefined
  isVerified?: boolean
}

function ageDays(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return ms / (1000 * 60 * 60 * 24)
}

export function FreshnessBadge({ lastSyncedAt }: { lastSyncedAt: string | null | undefined }) {
  const { t } = useTranslation()
  if (!lastSyncedAt) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-300">
        {t("tiktok.freshness.unknown")}
      </span>
    )
  }
  const days = ageDays(lastSyncedAt)
  if (days < 7) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
        ● {t("tiktok.freshness.fresh")}
      </span>
    )
  }
  if (days < 30) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
        ● {t("tiktok.freshness.stale")}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">
      ● {t("tiktok.freshness.outdated")}
    </span>
  )
}

export function VerifiedBadge() {
  const { t } = useTranslation()
  return (
    <span
      title={t("tiktok.verified_badge")}
      className="inline-flex items-center rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300"
    >
      ✓ {t("tiktok.verified_badge")}
    </span>
  )
}

export default function SocialStatusBadges({ lastSyncedAt, isVerified }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <FreshnessBadge lastSyncedAt={lastSyncedAt} />
      {isVerified && <VerifiedBadge />}
    </div>
  )
}
