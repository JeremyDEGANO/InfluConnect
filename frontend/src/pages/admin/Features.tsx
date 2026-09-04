import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Crown, CalendarCheck, Gift, Loader2, Percent, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  fetchPlatformFeatureSettings,
  updatePlatformFeatureSettings,
  type PlatformFeatureSettings,
} from "@/lib/apiExtra"

const EMPTY: PlatformFeatureSettings = {
  ambassador_programs_enabled: false,
  events_enabled: false,
  referral_program_enabled: false,
  commission_rate: 0,
  annual_discount_percent: 0,
}

export default function AdminFeatures() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [settings, setSettings] = useState<PlatformFeatureSettings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPlatformFeatureSettings()
      .then(setSettings)
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setLoading(false))
  }, [t, toast])

  const items = [
    { key: "ambassador_programs_enabled" as const, icon: Crown, title: t("admin_features.ambassador"), description: t("admin_features.ambassador_desc") },
    { key: "events_enabled" as const, icon: CalendarCheck, title: t("admin_features.events"), description: t("admin_features.events_desc") },
    { key: "referral_program_enabled" as const, icon: Gift, title: t("admin_features.referral"), description: t("admin_features.referral_desc") },
  ]

  const save = async () => {
    setSaving(true)
    try {
      setSettings(await updatePlatformFeatureSettings(settings))
      toast({ title: t("admin_features.saved") })
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-aurora-ink-3"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t("common.loading")}</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-aurora-ink-3">{t("common.plan_admin", "Console admin")}</p>
          <h1 className="mt-0.5 text-3xl font-semibold text-aurora-ink">{t("admin_features.title")}</h1>
          <p className="mt-1 text-sm text-aurora-ink-2">{t("admin_features.subtitle")}</p>
        </div>
        <Button variant="gradient" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("admin_features.save")}
        </Button>
      </div>

      <div className="divide-y divide-aurora-line border-y border-aurora-line bg-white">
        {items.map(({ key, icon: Icon, title, description }) => {
          const enabled = settings[key]
          return (
            <div key={key} className="flex items-center gap-4 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-aurora-surface text-aurora-blue">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-aurora-ink">{title}</p>
                <p className="text-sm text-aurora-ink-3">{description}</p>
              </div>
              <span className={`text-xs font-medium ${enabled ? "text-emerald-700" : "text-aurora-ink-3"}`}>
                {enabled ? t("admin_features.active") : t("admin_features.inactive")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={title}
                onClick={() => setSettings((current) => ({ ...current, [key]: !current[key] }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-aurora-line bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-aurora-surface text-aurora-blue">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-aurora-ink">{t("admin_features.pricing_title")}</p>
            <p className="text-sm text-aurora-ink-3">{t("admin_features.pricing_desc")}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="commission_rate" className="block text-sm font-medium text-aurora-ink-2">
              {t("admin_features.commission_rate")}
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="commission_rate"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={settings.commission_rate ?? 0}
                onChange={(e) => setSettings((c) => ({ ...c, commission_rate: e.target.value }))}
                className="w-28 rounded-lg border border-aurora-line px-3 py-2 text-sm"
              />
              <span className="text-sm text-aurora-ink-3">%</span>
            </div>
            <p className="mt-1.5 text-xs text-aurora-ink-3">{t("admin_features.commission_hint")}</p>
          </div>

          <div>
            <label htmlFor="annual_discount" className="block text-sm font-medium text-aurora-ink-2">
              {t("admin_features.annual_discount")}
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="annual_discount"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={settings.annual_discount_percent ?? 0}
                onChange={(e) => setSettings((c) => ({ ...c, annual_discount_percent: e.target.value }))}
                className="w-28 rounded-lg border border-aurora-line px-3 py-2 text-sm"
              />
              <span className="text-sm text-aurora-ink-3">%</span>
            </div>
            <p className="mt-1.5 text-xs text-aurora-ink-3">{t("admin_features.annual_discount_hint")}</p>
          </div>
        </div>
      </div>
    </div>
  )
}