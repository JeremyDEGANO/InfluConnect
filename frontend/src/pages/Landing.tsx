import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { PricingCard } from "@/components/shared/PricingCard"
import {
  Shield, FileText, Star, Zap, Users, TrendingUp, ArrowRight,
  Search, Lock, MessageSquare, BarChart3, Upload, Heart, Gift,
  UserPlus, Target, Handshake, DollarSign,
} from "lucide-react"

const FEATURE_KEYS = [
  { icon: Search, key: "matching", color: "bg-blue-500/10 text-blue-600" },
  { icon: Lock, key: "escrow", color: "bg-emerald-500/10 text-emerald-600" },
  { icon: FileText, key: "contracts", color: "bg-violet-500/10 text-violet-600" },
  { icon: MessageSquare, key: "messaging", color: "bg-amber-500/10 text-amber-600" },
  { icon: BarChart3, key: "roi", color: "bg-pink-500/10 text-pink-600" },
  { icon: Upload, key: "verification", color: "bg-cyan-500/10 text-cyan-600" },
  { icon: Heart, key: "reviews", color: "bg-rose-500/10 text-rose-600" },
  { icon: Gift, key: "gifting", color: "bg-indigo-500/10 text-indigo-600" },
]

const STEP_KEYS = [
  { num: "01", icon: UserPlus, key: "step1" },
  { num: "02", icon: Target, key: "step2" },
  { num: "03", icon: Handshake, key: "step3" },
  { num: "04", icon: DollarSign, key: "step4" },
]

export default function Landing() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-float-delayed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative container max-w-6xl mx-auto px-4 pt-20 pb-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-8 border border-white/10 fade-in-up">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-300">{t("landing.badge")}</span>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6 fade-in-up fade-in-up-delay-1">
              {t("landing.hero_title_1")}{" "}
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                {t("landing.hero_title_2")}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed fade-in-up fade-in-up-delay-2">
              {t("landing.hero_subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center fade-in-up fade-in-up-delay-3">
              <Button size="lg" variant="gradient" className="text-base px-8" asChild>
                <Link to="/register?type=influencer">
                  <Users className="h-5 w-5" />
                  {t("landing.cta_influencer")}
                </Link>
              </Button>
              <Button size="lg" variant="outline-dark" className="text-base px-8" asChild>
                <Link to="/register?type=brand">
                  <Zap className="h-5 w-5" />
                  {t("landing.cta_brand")}
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto fade-in-up fade-in-up-delay-4">
            {[
              { value: "2,847", label: t("landing.stat_creators") },
              { value: "412", label: t("landing.stat_brands") },
              { value: "€1.3M", label: t("landing.stat_paid") },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-gray-50/50" id="features">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-indigo-600 tracking-wider uppercase">{t("landing.features_tag")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3">{t("landing.features_title")}</h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto">{t("landing.features_subtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURE_KEYS.map(({ icon: Icon, key, color }) => (
              <div key={key} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className={`h-12 w-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{t(`landing.feat_${key}`)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`landing.feat_${key}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-white" id="how-it-works">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-indigo-600 tracking-wider uppercase">{t("landing.how_tag")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3">{t("landing.how_title")}</h2>
            <p className="text-gray-500 mt-4">{t("landing.how_subtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEP_KEYS.map(({ num, icon: Icon, key }) => (
              <div key={num} className="relative text-center group">
                <div className="text-6xl font-black text-indigo-100 group-hover:text-indigo-200 transition-colors mb-4">{num}</div>
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t(`landing.${key}_title`)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`landing.${key}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4 bg-gray-50/50" id="pricing">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-indigo-600 tracking-wider uppercase">{t("landing.pricing_tag")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-3">{t("landing.pricing_title")}</h2>
            <p className="text-gray-500 mt-4">{t("landing.pricing_subtitle")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <PricingCard
              name={t("landing.plan_starter")}
              price={49}
              description={t("landing.plan_starter_desc")}
              features={["5 campaigns/mo", "20 contacts", "Basic analytics", "Email support"]}
              cta={t("landing.cta_trial")}
              onSelect={() => {}}
            />
            <PricingCard
              name={t("landing.plan_growth")}
              price={149}
              description={t("landing.plan_growth_desc")}
              features={["25 campaigns/mo", "Unlimited contacts", "Advanced analytics", "Priority support", "Custom contracts"]}
              cta={t("landing.cta_trial")}
              highlighted
              onSelect={() => {}}
            />
            <PricingCard
              name={t("landing.plan_pro")}
              price={399}
              description={t("landing.plan_pro_desc")}
              features={["Unlimited campaigns", "Multi-brand management", "API access", "White-label reports", "Dedicated manager"]}
              cta={t("landing.cta_sales")}
              onSelect={() => {}}
            />
          </div>
          <div className="text-center mt-10">
            <Button variant="outline" asChild>
              <Link to="/pricing">{t("landing.compare_plans")} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("landing.cta_title")}</h2>
          <p className="text-gray-400 mb-10 text-lg max-w-xl mx-auto">{t("landing.cta_subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="gradient" className="text-base px-8" asChild>
              <Link to="/register">{t("landing.cta_create")} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 text-base px-8" asChild>
              <Link to="/login">{t("landing.cta_demo")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="container max-w-6xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-3">Ils nous font confiance</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Plus de 1 200 marques et 15 000 créateurs utilisent InfluConnect chaque mois.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Camille R.",
                role: "CMO, Maison Verte (bio)",
                quote: "On a divisé par 3 le temps de gestion de nos campagnes. Le matching est bluffant, et l'escrow rassure tout le monde.",
              },
              {
                name: "Sofiane M.",
                role: "Créateur lifestyle • 42k followers",
                quote: "Enfin une plateforme qui paye vite, où les contrats sont clairs et où je peux négocier sans me battre pendant 15 mails.",
              },
              {
                name: "Lucie D.",
                role: "Fondatrice, Studio Rose",
                quote: "Le programme ambassadeurs + les contrats personnalisés ont remplacé 3 outils qu'on utilisait avant. ROI immédiat.",
              },
            ].map((tm) => (
              <div key={tm.name} className="p-6 rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 hover:shadow-lg transition-shadow">
                <div className="flex gap-0.5 mb-4">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4 italic">« {tm.quote} »</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white font-semibold">
                    {tm.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{tm.name}</p>
                    <p className="text-xs text-gray-500">{tm.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="container max-w-3xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-10">Questions fréquentes</h2>
          <div className="space-y-3">
            {[
              {
                q: "Comment fonctionne le paiement escrow ?",
                a: "La marque bloque le montant de la collaboration sur son compte Stripe lors de la signature. Les fonds sont libérés automatiquement à l'influenceur après validation du contenu (ou après 14 jours sans contestation).",
              },
              {
                q: "Est-ce gratuit pour les influenceurs ?",
                a: "Oui. L'inscription, la création du media kit, la réception de propositions et le paiement sont 100% gratuits. Nous prélevons une commission de 15% sur chaque collaboration, payée par la marque.",
              },
              {
                q: "Puis-je personnaliser mes contrats ?",
                a: "Oui, les plans Growth et Pro permettent de créer vos propres templates HTML avec variables dynamiques (livrables, prix, exclusivité, etc.). Les contrats sont signés électroniquement (eIDAS) et archivés 10 ans.",
              },
              {
                q: "Êtes-vous conforme RGPD ?",
                a: "Oui, hébergement France (OVH Cloud), données chiffrées au repos, DPA disponible, droit à l'oubli automatisé et registre des traitements à jour.",
              },
              {
                q: "Que se passe-t-il en cas de litige ?",
                a: "Notre équipe de médiation intervient sous 48 heures. Les fonds restent bloqués en escrow jusqu'à résolution. En dernier recours, le Tribunal de commerce de Paris est compétent.",
              },
            ].map((faq) => (
              <details key={faq.q} className="group bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer">
                <summary className="font-semibold text-gray-900 flex items-center justify-between list-none">
                  {faq.q}
                  <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-sm text-gray-600 leading-relaxed mt-3">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
