import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  FileText, Star, Zap, Users, ArrowRight,
  Search, Lock, MessageSquare, BarChart3, Upload, Heart, Gift,
  UserPlus, Target, Handshake, DollarSign, Check,
} from "lucide-react"

const FEATURE_KEYS = [
  { icon: Search, key: "matching" },
  { icon: Lock, key: "escrow" },
  { icon: FileText, key: "contracts" },
  { icon: MessageSquare, key: "messaging" },
  { icon: BarChart3, key: "roi" },
  { icon: Upload, key: "verification" },
  { icon: Heart, key: "reviews" },
  { icon: Gift, key: "gifting" },
]

const STEP_KEYS = [
  { num: "01", icon: UserPlus, key: "step1" },
  { num: "02", icon: Target, key: "step2" },
  { num: "03", icon: Handshake, key: "step3" },
  { num: "04", icon: DollarSign, key: "step4" },
]

export default function Landing() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<{ creators: number; brands: number; total_paid_eur: number } | null>(null)
  // Entry price comes from the same endpoint as the pricing page so the teaser
  // can never drift from the real plans.
  const [entryPrice, setEntryPrice] = useState<{ monthly: number; annual: number } | null>(null)

  useEffect(() => {
    api.get("/public/stats/").then((r) => setStats(r.data)).catch(() => setStats(null))
  }, [])

  useEffect(() => {
    api.get("/reference/plans/")
      .then((r) => {
        const list = (r.data?.plans ?? []) as Array<{
          price_eur_monthly?: number
          price_eur?: number
          price_eur_monthly_billed_annually?: number
        }>
        const prices = list
          .map((plan) => {
            const monthly = Number(plan.price_eur_monthly ?? plan.price_eur ?? 0)
            return { monthly, annual: Number(plan.price_eur_monthly_billed_annually ?? monthly) }
          })
          .filter((plan) => plan.monthly > 0)
        setEntryPrice(prices.length ? prices.reduce((a, b) => (b.annual < a.annual ? b : a)) : null)
      })
      .catch(() => setEntryPrice(null))
  }, [])

  const fmtPrice = (n: number) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n))

  const statItems = useMemo(() => {
    if (!stats) return []
    const compact = (n: number) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    const items: { value: string; label: string }[] = []
    if (stats.creators > 0) items.push({ value: compact(stats.creators), label: t("landing.stat_creators") })
    if (stats.brands > 0) items.push({ value: compact(stats.brands), label: t("landing.stat_brands") })
    if (stats.total_paid_eur > 0) items.push({ value: `€${compact(stats.total_paid_eur)}`, label: t("landing.stat_paid") })
    return items
  }, [stats, t])

  return (
    <div className="min-h-screen bg-white">
      {/* Hero — Apple keynote light */}
      <section className="relative overflow-hidden hero-aurora-bg">
        <div className="relative container max-w-6xl mx-auto px-5 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md ring-1 ring-aurora-line rounded-full px-3.5 py-1 text-[12px] mb-7 fade-in-up shadow-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-aurora-ink-2 font-medium">{t("landing.badge")}</span>
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-[80px] font-semibold leading-[1.05] tracking-[-0.04em] text-aurora-ink mb-6 fade-in-up fade-in-up-delay-1 text-balance">
            {t("landing.hero_title_1")}{" "}
            <span className="text-aurora-blue">{t("landing.hero_title_2")}</span>
          </h1>
          <p className="text-lg sm:text-xl text-aurora-ink-2 max-w-2xl mx-auto mb-9 leading-relaxed fade-in-up fade-in-up-delay-2 text-pretty">
            {t("landing.hero_subtitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-9 fade-in-up fade-in-up-delay-2">
            <span className="inline-flex items-center gap-1.5 bg-white ring-1 ring-aurora-line rounded-full px-3 py-1 text-[12px] text-aurora-ink-2 font-medium">
              <Zap className="h-3.5 w-3.5 text-aurora-blue" />
              {t("landing.role_brand")}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white ring-1 ring-aurora-line rounded-full px-3 py-1 text-[12px] text-aurora-ink-2 font-medium">
              <Users className="h-3.5 w-3.5 text-aurora-blue" />
              {t("landing.role_influencer")}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center fade-in-up fade-in-up-delay-3">
            <Button size="lg" variant="gradient" asChild>
              <Link to="/register?type=influencer">
                <Users className="h-4 w-4" />
                {t("landing.cta_influencer")}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/register?type=brand">
                <Zap className="h-4 w-4" />
                {t("landing.cta_brand")}
              </Link>
            </Button>
          </div>

          {/* Stats bar — real platform figures, hidden until they are meaningful */}
          {statItems.length > 0 && (
            <div className="mt-16 grid gap-6 max-w-2xl mx-auto fade-in-up fade-in-up-delay-4" style={{ gridTemplateColumns: `repeat(${statItems.length}, minmax(0, 1fr))` }}>
              {statItems.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="num text-3xl sm:text-4xl font-semibold text-aurora-ink tracking-[-0.02em]">{stat.value}</div>
                  <div className="text-[12px] text-aurora-ink-3 mt-1.5 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-5 bg-aurora-surface" id="features">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">{t("landing.features_tag")}</span>
            <h2 className="text-4xl sm:text-5xl font-semibold text-aurora-ink mt-3 tracking-[-0.03em] text-balance">{t("landing.features_title")}</h2>
            <p className="text-aurora-ink-2 mt-4 max-w-xl mx-auto">{t("landing.features_subtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURE_KEYS.map(({ icon: Icon, key }) => (
              <div key={key} className="group bg-white rounded-2xl border border-aurora-line p-6 hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-300 ease-aurora">
                <div className="h-11 w-11 rounded-xl bg-aurora-blue/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-aurora-blue-deep" />
                </div>
                <h3 className="font-semibold text-aurora-ink mb-1.5 text-[15px] tracking-tight">{t(`landing.feat_${key}`)}</h3>
                <p className="text-[13px] text-aurora-ink-2 leading-relaxed">{t(`landing.feat_${key}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-5 bg-white" id="how-it-works">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">{t("landing.how_tag")}</span>
            <h2 className="text-4xl sm:text-5xl font-semibold text-aurora-ink mt-3 tracking-[-0.03em] text-balance">{t("landing.how_title")}</h2>
            <p className="text-aurora-ink-2 mt-4">{t("landing.how_subtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEP_KEYS.map(({ num, icon: Icon, key }) => (
              <div key={num} className="relative text-center group">
                <div className="num text-7xl font-semibold text-aurora-blue/10 group-hover:text-aurora-blue/20 transition-colors mb-3 tracking-tight">{num}</div>
                <div className="h-12 w-12 rounded-2xl bg-aurora-blue flex items-center justify-center mx-auto mb-5 shadow-soft group-hover:-translate-y-0.5 transition-transform ease-aurora">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[16px] font-semibold text-aurora-ink mb-1.5 tracking-tight">{t(`landing.${key}_title`)}</h3>
                <p className="text-[13px] text-aurora-ink-2 leading-relaxed">{t(`landing.${key}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-24 px-5 bg-aurora-surface">
        <div className="container max-w-5xl mx-auto text-center">
          <span className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">{t("nav.pricing")}</span>
          <h2 className="text-4xl sm:text-5xl font-semibold text-aurora-ink mt-3 tracking-[-0.03em] text-balance">
            {t("landing.pricing_title", "Une tarification simple, prévisible.")}
          </h2>
          <p className="text-aurora-ink-2 mt-4 max-w-xl mx-auto">{t("landing.pricing_subtitle", "Choisissez l'offre adaptée à votre rôle. Sans engagement.")}</p>
          <div className="mt-10 max-w-md mx-auto">
            <div className="bg-white rounded-3xl border border-aurora-line p-8 text-left shadow-soft">
              <h3 className="text-lg font-semibold text-aurora-ink tracking-tight">{t("landing.role_brand")}</h3>
              {entryPrice && (
                <>
                  <p className="text-sm text-aurora-ink-2 mt-2">
                    À partir de <span className="num font-semibold text-aurora-ink">{fmtPrice(entryPrice.annual)}€</span> / mois
                  </p>
                  {entryPrice.annual < entryPrice.monthly && (
                    <p className="text-[12px] text-aurora-ink-3 mt-1">
                      Avec facturation annuelle — <span className="num">{fmtPrice(entryPrice.monthly)}€</span> / mois sans engagement.
                    </p>
                  )}
                </>
              )}
              <ul className="mt-5 space-y-2 text-[13px] text-aurora-ink-2">
                <li className="flex gap-2"><Check className="h-4 w-4 text-aurora-blue shrink-0 mt-0.5" /> Recherche illimitée</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-aurora-blue shrink-0 mt-0.5" /> Escrow sécurisé Stripe</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-aurora-blue shrink-0 mt-0.5" /> Contrats électroniques signés en ligne</li>
              </ul>
              <Button variant="gradient" className="mt-6 w-full" asChild><Link to="/pricing/brands">Voir les offres marques</Link></Button>
            </div>
          </div>
          {/* Offre agences temporairement retirée de la communication — à remettre plus tard */}
          <div className="mt-8">
            <Link to="/compare" className="inline-flex items-center gap-1.5 text-sm font-medium text-aurora-blue-deep hover:underline">
              Comparer toutes les offres <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white">
        <div className="container max-w-6xl mx-auto px-5">
          <h2 className="text-4xl sm:text-5xl font-semibold text-center text-aurora-ink mb-3 tracking-[-0.03em] text-balance">Ils nous font confiance</h2>
          <p className="text-aurora-ink-2 text-center mb-12 max-w-2xl mx-auto">
            Plus de 1 200 marques et 15 000 créateurs utilisent InfluConnect chaque mois.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "Camille R.", role: "CMO, Maison Verte (bio)", quote: "On a divisé par 3 le temps de gestion de nos campagnes. Le matching est bluffant, et l'escrow rassure tout le monde." },
              { name: "Sofiane M.", role: "Créateur lifestyle • 42k followers", quote: "Enfin une plateforme qui paye vite, où les contrats sont clairs et où je peux négocier sans me battre pendant 15 mails." },
              { name: "Lucie D.", role: "Fondatrice, Studio Rose", quote: "Le programme ambassadeurs + les contrats personnalisés ont remplacé 3 outils qu'on utilisait avant. ROI immédiat." },
            ].map((tm) => (
              <div key={tm.name} className="p-6 rounded-3xl border border-aurora-line bg-white hover:shadow-soft-lg transition-shadow ease-aurora">
                <div className="flex gap-0.5 mb-4">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-aurora-ink text-[14px] leading-relaxed mb-5">« {tm.quote} »</p>
                <div className="flex items-center gap-3 pt-4 border-t border-aurora-line">
                  <div className="h-9 w-9 rounded-full bg-aurora-ink flex items-center justify-center text-white text-sm font-semibold">
                    {tm.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-aurora-ink text-[13px]">{tm.name}</p>
                    <p className="text-[11px] text-aurora-ink-3">{tm.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-aurora-surface">
        <div className="container max-w-3xl mx-auto px-5">
          <h2 className="text-4xl sm:text-5xl font-semibold text-center text-aurora-ink mb-10 tracking-[-0.03em] text-balance">Questions fréquentes</h2>
          <div className="space-y-2.5">
            {[
              { q: "Comment fonctionne le paiement escrow ?", a: "La marque bloque le montant de la collaboration sur son compte Stripe lors de la signature. Les fonds sont libérés automatiquement à l'influenceur après validation du contenu (ou après 14 jours sans contestation)." },
              { q: "Est-ce gratuit pour les influenceurs ?", a: "Oui. L'inscription, la création du media kit, la réception de propositions et le paiement sont 100% gratuits. Nous prélevons une commission de 15% sur chaque collaboration, payée par la marque." },
              { q: "Puis-je personnaliser mes contrats ?", a: "Oui, les plans Growth et Pro permettent de créer vos propres modèles avec variables dynamiques (livrables, prix, exclusivité, etc.). Les contrats sont signés électroniquement et archivés." },
              { q: "Êtes-vous conforme RGPD ?", a: "Oui, hébergement France (OVH Cloud), données chiffrées au repos, DPA disponible, droit à l'oubli automatisé et registre des traitements à jour." },
              { q: "Que se passe-t-il en cas de litige ?", a: "Notre équipe de médiation intervient sous 48 heures. Les fonds restent bloqués en escrow jusqu'à résolution. En dernier recours, le Tribunal de commerce de Paris est compétent." },
            ].map((faq) => (
              <details key={faq.q} className="group bg-white rounded-2xl border border-aurora-line p-5 cursor-pointer">
                <summary className="font-semibold text-aurora-ink flex items-center justify-between list-none text-[14px] tracking-tight">
                  {faq.q}
                  <ArrowRight className="h-3.5 w-3.5 text-aurora-ink-3 transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-[13px] text-aurora-ink-2 leading-relaxed mt-3">{faq.a}</p>
              </details>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/faq" className="text-sm font-medium text-aurora-blue-deep hover:underline">Voir toutes les questions →</Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-5 bg-aurora-ink text-white relative overflow-hidden hero-aurora-dark">
        <div className="relative container max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-semibold mb-4 tracking-[-0.03em] text-balance">{t("landing.cta_title")}</h2>
          <p className="text-white/70 mb-10 text-lg max-w-xl mx-auto text-pretty">{t("landing.cta_subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" variant="gradient" asChild>
              <Link to="/register">{t("landing.cta_create")} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline-dark" asChild>
              <Link to="/login">{t("landing.cta_demo")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
