import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { PricingCard } from "@/components/shared/PricingCard"
import { StarRating } from "@/components/shared/StarRating"
import { Shield, FileText, Star, Zap, Users, TrendingUp, ArrowRight, CheckCircle } from "lucide-react"

const TESTIMONIALS = [
  { name: "Sophie Laurent", role: "Fashion Influencer", rating: 5, text: "InfluConnect transformed my business. I secured 3x more brand deals in my first month!" },
  { name: "Marc Dubois", role: "Marketing Director", rating: 5, text: "The escrow system gives us complete peace of mind. We always know our money is safe." },
  { name: "Emma Chen", role: "Lifestyle Creator", rating: 5, text: "The platform is so intuitive. I love how everything from proposals to payment is in one place." },
]

export default function Landing() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white py-24 px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        </div>
        <div className="relative container max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-sm mb-6 border border-white/20">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span>Trusted by 10,000+ creators & brands</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            {t("landing.hero_title")}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 mt-2">With Confidence ✨</span>
          </h1>
          <p className="text-xl text-purple-200 max-w-2xl mx-auto mb-10">{t("landing.hero_subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-purple-900 hover:bg-white/90 font-semibold text-base px-8" asChild>
              <Link to="/register?type=influencer">{t("landing.cta_influencer")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold text-base px-8" asChild>
              <Link to="/register?type=brand">{t("landing.cta_brand")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-purple-300">
            {["No setup fees", "Free 14-day trial", "Cancel anytime"].map((item) => (
              <span key={item} className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-400" />{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-gray-100 py-10">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10K+", label: "Influencers" },
              { value: "2,500+", label: "Brands" },
              { value: "€5M+", label: "Paid Out" },
              { value: "98%", label: "Satisfaction" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-gray-50" id="features">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">{t("landing.how_it_works")}</h2>
          <p className="text-center text-gray-500 mb-12">Three simple steps to your next successful collaboration</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: 1, icon: Users, title: t("landing.step1_title"), desc: t("landing.step1_desc"), color: "from-purple-500 to-purple-700" },
              { step: 2, icon: Zap, title: t("landing.step2_title"), desc: t("landing.step2_desc"), color: "from-indigo-500 to-indigo-700" },
              { step: 3, icon: Shield, title: t("landing.step3_title"), desc: t("landing.step3_desc"), color: "from-blue-500 to-blue-700" },
            ].map(({ step, icon: Icon, title, desc, color }) => (
              <div key={step} className="text-center group">
                <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <div className="text-sm font-semibold text-purple-600 mb-1">Step {step}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">{t("landing.features")}</h2>
          <p className="text-center text-gray-500 mb-12">Everything you need for successful influencer marketing</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: t("landing.feature_escrow"), desc: t("landing.feature_escrow_desc"), color: "text-green-600 bg-green-50" },
              { icon: FileText, title: t("landing.feature_contracts"), desc: t("landing.feature_contracts_desc"), color: "text-blue-600 bg-blue-50" },
              { icon: Star, title: t("landing.feature_ratings"), desc: t("landing.feature_ratings_desc"), color: "text-yellow-600 bg-yellow-50" },
              { icon: TrendingUp, title: "Analytics Dashboard", desc: "Real-time campaign performance and ROI tracking.", color: "text-purple-600 bg-purple-50" },
              { icon: Users, title: "Smart Matching", desc: "AI-powered influencer recommendations based on your campaign.", color: "text-indigo-600 bg-indigo-50" },
              { icon: Zap, title: "Instant Payments", desc: "Fast, secure payments directly to influencer accounts.", color: "text-pink-600 bg-pink-50" },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`h-11 w-11 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-gray-50" id="pricing">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">{t("landing.pricing")}</h2>
          <p className="text-center text-gray-500 mb-12">Simple, transparent pricing for every stage of growth</p>
          <div className="grid md:grid-cols-3 gap-6">
            <PricingCard name="Starter" price={49} description="Perfect for emerging brands" features={["Up to 5 campaigns/mo", "20 influencer contacts", "Basic analytics", "Email support", "Escrow payments"]} cta="Get Started" onSelect={() => {}} />
            <PricingCard name="Growth" price={149} description="For growing marketing teams" features={["Up to 20 campaigns/mo", "Unlimited contacts", "Advanced analytics", "Priority support", "Custom contracts", "API access"]} cta="Start Growing" highlighted onSelect={() => {}} />
            <PricingCard name="Pro" price={399} description="Enterprise-grade features" features={["Unlimited campaigns", "Unlimited contacts", "Full analytics suite", "Dedicated account manager", "White-label option", "SLA guarantee"]} cta="Go Pro" onSelect={() => {}} />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-white">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">{t("landing.testimonials")}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <StarRating value={t.rating} readonly size="sm" />
                <p className="text-gray-600 text-sm mt-3 leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3 mt-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                    {t.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to grow together? ✨</h2>
          <p className="text-purple-200 mb-8 text-lg">Join thousands of creators and brands already using InfluConnect</p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-white text-purple-900 hover:bg-white/90 font-semibold" asChild>
              <Link to="/register">{t("nav.register")}</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold" asChild>
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
