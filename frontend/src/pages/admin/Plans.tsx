import { Fragment, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  fetchAdminPlans, updateAdminPlan,
  type AdminPlansPayload, type PlanFeatureDef, type PlanFeatureValue,
} from "@/lib/apiExtra"
import { Check, X, Loader2, Save, CreditCard } from "lucide-react"

type EditablePlan = {
  code: string
  name: string
  price_eur_monthly: string
  features: Record<string, PlanFeatureValue>
  dirty: boolean
}

const SUPPORT_LABELS: Record<string, string> = {
  none: "Standard",
  email_48h: "Email (48h)",
  email_phone_24h: "Email & Tél. (24h)",
}

export default function AdminPlans() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [featureDefs, setFeatureDefs] = useState<PlanFeatureDef[]>([])
  const [plans, setPlans] = useState<EditablePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetchAdminPlans()
      .then((d: AdminPlansPayload) => {
        setFeatureDefs(d.feature_defs)
        setPlans(d.plans.map((p) => ({
          code: p.code,
          name: p.name,
          price_eur_monthly: String(p.price_eur_monthly),
          features: { ...p.features },
          dirty: false,
        })))
      })
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setLoading(false))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const map = new Map<string, PlanFeatureDef[]>()
    for (const def of featureDefs) {
      if (!map.has(def.group)) map.set(def.group, [])
      map.get(def.group)!.push(def)
    }
    return Array.from(map.entries())
  }, [featureDefs])

  const setFeature = (code: string, key: string, value: PlanFeatureValue) =>
    setPlans((prev) => prev.map((p) =>
      p.code === code ? { ...p, features: { ...p.features, [key]: value }, dirty: true } : p,
    ))

  const setPrice = (code: string, value: string) =>
    setPlans((prev) => prev.map((p) => (p.code === code ? { ...p, price_eur_monthly: value, dirty: true } : p)))

  const saveAll = async () => {
    const dirty = plans.filter((p) => p.dirty)
    if (dirty.length === 0) return
    setSaving(true)
    try {
      for (const p of dirty) {
        await updateAdminPlan(p.code, {
          price_eur_monthly: p.price_eur_monthly === "" ? null : p.price_eur_monthly,
          features: p.features,
        })
      }
      toast({
        title: t("admin_plans.saved", "Plans mis à jour"),
        description: t("admin_plans.saved_desc", "Les pages Tarifs / Comparer les offres et les droits des marques sont à jour."),
      })
      load()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: e?.response?.data?.detail ?? "",
      })
    } finally {
      setSaving(false)
    }
  }

  const renderCell = (plan: EditablePlan, def: PlanFeatureDef) => {
    const value = plan.features[def.key]
    if (def.type === "bool") {
      const on = Boolean(value)
      return (
        <button
          type="button"
          onClick={() => setFeature(plan.code, def.key, !on)}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            on ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-aurora-line bg-white text-aurora-ink-3/50 hover:text-aurora-ink-3"
          }`}
          title={on ? t("admin_plans.included", "Inclus") : t("admin_plans.not_included", "Non inclus")}
        >
          {on ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      )
    }
    if (def.type === "limit") {
      return (
        <Input
          type="number"
          min={-1}
          className="w-24 mx-auto text-center h-8"
          value={String(value ?? 0)}
          onChange={(e) => setFeature(plan.code, def.key, e.target.value === "" ? 0 : parseInt(e.target.value, 10))}
        />
      )
    }
    return (
      <select
        className="h-8 rounded-lg border border-aurora-line bg-white px-2 text-xs"
        value={String(value ?? def.choices?.[0] ?? "")}
        onChange={(e) => setFeature(plan.code, def.key, e.target.value)}
      >
        {(def.choices ?? []).map((c) => (
          <option key={c} value={c}>{SUPPORT_LABELS[c] ?? c}</option>
        ))}
      </select>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-aurora-ink-3">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}
      </div>
    )
  }

  const hasDirty = plans.some((p) => p.dirty)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-aurora-ink-3">{t("common.plan_admin", "Console admin")}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5 flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-aurora-blue" />
            {t("admin_plans.title", "Plans & tarifs")}
          </h1>
        </div>
        <Button variant="gradient" onClick={saveAll} disabled={!hasDirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("admin_plans.save", "Enregistrer les modifications")}
        </Button>
      </div>

      <p className="text-sm text-aurora-ink-2">
        {t(
          "admin_plans.intro",
          "Définissez ici quelles fonctionnalités sont incluses dans chaque abonnement, les limites (-1 = illimité, 0 = non inclus) et le tarif mensuel global. Les pages publiques Tarifs / Comparer les offres et les droits appliqués aux marques sont mis à jour immédiatement. Le tarif d'une marque précise peut être surchargé depuis Admin → Sociétés.",
        )}
      </p>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-base">{t("admin_plans.matrix", "Matrice des fonctionnalités")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-aurora-surface/70 border-b border-aurora-line">
                  <th className="text-left font-semibold text-aurora-ink-2 px-5 py-3 w-1/3">
                    {t("admin_plans.feature", "Fonctionnalité")}
                  </th>
                  {plans.map((p) => (
                    <th key={p.code} className="px-5 py-3 text-center">
                      <div className="font-semibold text-aurora-ink capitalize">{p.name}</div>
                      <div className="mt-1.5 flex items-center justify-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          className="w-24 h-8 text-center"
                          value={p.price_eur_monthly}
                          onChange={(e) => setPrice(p.code, e.target.value)}
                        />
                        <span className="text-xs text-aurora-ink-3">€/mois</span>
                      </div>
                      {p.dirty && <Badge variant="info" className="mt-1.5 text-[10px]">{t("admin_plans.modified", "Modifié")}</Badge>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([group, defs]) => (
                  <Fragment key={group}>
                    <tr className="bg-aurora-surface/40 border-t border-aurora-line">
                      <td colSpan={plans.length + 1} className="px-5 py-2 text-[11px] font-semibold uppercase tracking-widest text-aurora-ink-3">
                        {t(`pricing.groups.${group}`, group)}
                      </td>
                    </tr>
                    {defs.map((def) => (
                      <tr key={def.key} className="border-t border-aurora-line">
                        <td className="px-5 py-2.5 text-aurora-ink-2">
                          {def.label}
                          {def.type === "limit" && (
                            <span className="block text-[11px] text-aurora-ink-3">-1 = illimité · 0 = non inclus</span>
                          )}
                        </td>
                        {plans.map((p) => (
                          <td key={p.code} className="px-5 py-2.5 text-center">
                            {renderCell(p, def)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
