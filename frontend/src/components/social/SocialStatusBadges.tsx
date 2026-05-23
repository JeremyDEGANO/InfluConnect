import { useTranslation } from "react-i18next"

interface Props {
  lastSyncedAt: string | null | undefined
  isVerified?: boolean
}

export function FreshnessBadge({ lastSyncedAt }: { lastSyncedAt: string | null | undefined }) {
  const { t, i18n } = useTranslation()
  if (!lastSyncedAt) {
    return (
      <span className="text-[11px] text-slate-500">
        {t("tiktok.freshness.unknown")}
      </span>
    )
  }
  const when = new Date(lastSyncedAt).toLocaleString(i18n.language)
  return (
    <span className="text-[11px] text-slate-500">
      {t("tiktok.freshness.last_sync", { when })}
    </span>
  )
}

export function VerifiedBadge() {
  const { t } = useTranslation()
  return (
    <span
      title={t("tiktok.verified_badge")}
      className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700"
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
