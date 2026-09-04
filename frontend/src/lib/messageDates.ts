import i18n from "@/i18n"

/** Local calendar day key, so messages are grouped by the reader's own day. */
export function dayKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * Instagram-style separator label: "Today", "Yesterday", a weekday within the
 * last week, then a full date beyond that.
 */
export function formatDaySeparator(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""

  const locale = i18n.language || "fr"
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const now = new Date()
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000,
  )

  if (diffDays === 0) return i18n.t("messages.today", "Aujourd'hui")
  if (diffDays === 1) return i18n.t("messages.yesterday", "Hier")
  if (diffDays > 1 && diffDays < 7) {
    const weekday = d.toLocaleDateString(locale, { weekday: "long" })
    return weekday.charAt(0).toUpperCase() + weekday.slice(1)
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(locale, { day: "numeric", month: "long" })
  }
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
}

/** Insert a separator before the first message of each calendar day. */
export function withDaySeparators<T extends { created_at?: string }>(
  messages: T[],
): Array<{ type: "separator"; key: string; label: string } | { type: "message"; key: string; message: T }> {
  const out: Array<{ type: "separator"; key: string; label: string } | { type: "message"; key: string; message: T }> = []
  let lastKey: string | null = null

  messages.forEach((message, index) => {
    if (message.created_at) {
      const key = dayKey(message.created_at)
      if (key !== lastKey) {
        out.push({ type: "separator", key: `sep-${key}`, label: formatDaySeparator(message.created_at) })
        lastKey = key
      }
    }
    out.push({ type: "message", key: `msg-${index}`, message })
  })

  return out
}
