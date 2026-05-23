import { Link } from "react-router-dom"
import { Check, X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type Plan = {
  name: string
  price: string
  tagline: string
  cta: string
  to: string
  highlighted?: boolean
}

const BRAND_PLANS: Plan[] = [
  { name: "Starter", price: "49€", tagline: "Pour découvrir", cta: "Commencer", to: "/register?type=brand" },
  { name: "Growth", price: "149€", tagline: "Pour scaler", cta: "Choisir Growth", to: "/register?type=brand", highlighted: true },
  { name: "Pro", price: "399€", tagline: "Pour les équipes marketing", cta: "Choisir Pro", to: "/register?type=brand" },
]

const AGENCY_PLANS: Plan[] = [
  { name: "Studio", price: "149€", tagline: "Jusqu'à 5 marques", cta: "Commencer", to: "/register?type=agency" },
  { name: "Network", price: "399€", tagline: "Jusqu'à 25 marques", cta: "Choisir Network", to: "/register?type=agency", highlighted: true },
  { name: "Enterprise", price: "Sur mesure", tagline: "Multi-pays, illimité", cta: "Nous contacter", to: "/contact" },
]

const BRAND_FEATURES = [
  { label: "Recherche d'influenceurs", values: [true, true, true] },
  { label: "Campagnes actives par mois", values: ["3", "15", "Illimité"] },
  { label: "Membres d'équipe", values: ["2", "10", "Illimité"] },
  { label: "Templates de contrats personnalisés", values: [false, true, true] },
  { label: "Programme ambassadeurs", values: [false, true, true] },
  { label: "Castings ouverts", values: [false, true, true] },
  { label: "Reporting avancé & exports CSV", values: [false, true, true] },
  { label: "API & webhooks", values: [false, false, true] },
  { label: "Account manager dédié", values: [false, false, true] },
  { label: "SSO / SCIM", values: [false, false, true] },
]

const AGENCY_FEATURES = [
  { label: "Marques sous gestion", values: ["5", "25", "Illimité"] },
  { label: "Talents internes", values: ["10", "50", "Illimité"] },
  { label: "Délégations campagnes", values: [true, true, true] },
  { label: "Commissions automatisées", values: [true, true, true] },
  { label: "Reporting consolidé multi-marques", values: [false, true, true] },
  { label: "White-label (sous-domaine)", values: [false, false, true] },
  { label: "Formation & onboarding dédié", values: [false, true, true] },
  { label: "SLA contractuel", values: [false, false, true] },
]

function PlanGrid({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid md:grid-cols-3 gap-4 mb-10">
      {plans.map((p) => (
        <div
          key={p.name}
          className={`rounded-3xl border p-6 ${p.highlighted ? "border-aurora-blue bg-white shadow-soft-lg ring-1 ring-aurora-blue/30" : "border-aurora-line bg-white shadow-soft"}`}
        >
          {p.highlighted && (
            <div className="inline-block bg-aurora-blue/10 text-aurora-blue-deep text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full mb-3">Recommandé</div>
          )}
          <h3 className="text-lg font-semibold text-aurora-ink tracking-tight">{p.name}</h3>
          <p className="text-[12px] text-aurora-ink-3 mt-0.5">{p.tagline}</p>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="num text-3xl font-semibold text-aurora-ink tracking-[-0.02em]">{p.price}</span>
            {p.price !== "Sur mesure" && <span className="text-[12px] text-aurora-ink-3">/ mois</span>}
          </div>
          <Button variant={p.highlighted ? "gradient" : "outline"} className="mt-5 w-full" asChild>
            <Link to={p.to}>{p.cta}</Link>
          </Button>
        </div>
      ))}
    </div>
  )
}

function FeatureTable({ plans, features }: { plans: Plan[]; features: { label: string; values: (string | boolean)[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full bg-white rounded-2xl border border-aurora-line overflow-hidden">
        <thead className="bg-aurora-surface">
          <tr>
            <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-aurora-ink-3">Fonctionnalité</th>
            {plans.map((p) => (
              <th key={p.name} className="text-center px-5 py-3 text-[12px] font-semibold text-aurora-ink">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-aurora-line">
          {features.map((f) => (
            <tr key={f.label}>
              <td className="px-5 py-3 text-[13px] text-aurora-ink-2">{f.label}</td>
              {f.values.map((v, i) => (
                <td key={i} className="px-5 py-3 text-center text-[13px] text-aurora-ink">
                  {typeof v === "boolean" ? (
                    v ? <Check className="h-4 w-4 text-aurora-blue mx-auto" /> : <X className="h-4 w-4 text-aurora-ink-3/40 mx-auto" />
                  ) : (
                    <span className="num font-medium">{v}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Compare() {
  return (
    <div className="min-h-screen bg-white">
      <section className="hero-aurora-bg py-20 px-5">
        <div className="container max-w-4xl mx-auto text-center">
          <span className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">Comparer les offres</span>
          <h1 className="text-5xl sm:text-6xl font-semibold text-aurora-ink mt-3 tracking-[-0.04em] text-balance">
            Toutes les fonctionnalités, côte à côte.
          </h1>
          <p className="text-aurora-ink-2 mt-5 max-w-xl mx-auto text-pretty">
            Choisissez l'offre qui correspond exactement à votre rôle et à votre stade de croissance.
          </p>
        </div>
      </section>

      <section className="py-16 px-5">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-aurora-ink mb-2 tracking-[-0.02em]">Pour les marques</h2>
          <p className="text-aurora-ink-2 mb-8">Lancez vos campagnes en toute sécurité, du brief au paiement.</p>
          <PlanGrid plans={BRAND_PLANS} />
          <FeatureTable plans={BRAND_PLANS} features={BRAND_FEATURES} />
        </div>
      </section>

      <section className="py-16 px-5 bg-aurora-surface">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-aurora-ink mb-2 tracking-[-0.02em]">Pour les agences</h2>
          <p className="text-aurora-ink-2 mb-8">Gérez plusieurs marques et talents depuis une seule interface.</p>
          <PlanGrid plans={AGENCY_PLANS} />
          <FeatureTable plans={AGENCY_PLANS} features={AGENCY_FEATURES} />
        </div>
      </section>

      <section className="py-16 px-5">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-semibold text-aurora-ink mb-3 tracking-[-0.02em]">Une question sur les offres ?</h2>
          <p className="text-aurora-ink-2 mb-7">Notre équipe vous aide à choisir le plan adapté à vos enjeux.</p>
          <Button variant="gradient" asChild><Link to="/contact">Parler à un conseiller <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </section>
    </div>
  )
}
