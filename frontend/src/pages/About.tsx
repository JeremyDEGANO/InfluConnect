import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Sparkles, Shield, Heart, Users, ArrowRight } from "lucide-react"

export default function About() {
  const values = [
    { icon: Shield, title: "Confiance", desc: "Escrow Stripe, contrats eIDAS, KYC vérifié — chaque interaction est sécurisée." },
    { icon: Sparkles, title: "Excellence", desc: "Une expérience produit pensée dans le moindre détail, du matching à la facturation." },
    { icon: Heart, title: "Bienveillance", desc: "Marques, créateurs, agences : tout le monde gagne quand la collaboration est saine." },
    { icon: Users, title: "Communauté", desc: "Une plateforme construite avec et pour ses utilisateurs, à l'écoute chaque jour." },
  ]

  return (
    <div className="min-h-screen bg-white">
      <section className="hero-aurora-bg py-24 px-5">
        <div className="container max-w-4xl mx-auto text-center">
          <span className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">À propos</span>
          <h1 className="text-5xl sm:text-6xl font-semibold text-aurora-ink mt-3 tracking-[-0.04em] text-balance">
            Construire la confiance entre marques et créateurs.
          </h1>
          <p className="text-lg text-aurora-ink-2 mt-6 max-w-2xl mx-auto text-pretty">
            InfluConnect est née d'un constat simple : le marketing d'influence souffre d'opacité, de paiements lents et de contrats flous. Nous résolvons ces frictions, à la française.
          </p>
        </div>
      </section>

      <section className="py-20 px-5">
        <div className="container max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-3xl font-semibold text-aurora-ink tracking-[-0.02em] mb-4">Notre mission</h2>
            <p className="text-aurora-ink-2 leading-relaxed">
              Permettre à chaque marque, agence et créateur de collaborer en toute confiance, en quelques clics, partout en Europe — sans dépendre d'intermédiaires opaques.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-aurora-ink tracking-[-0.02em] mb-4">Notre histoire</h2>
            <p className="text-aurora-ink-2 leading-relaxed">
              Fondée en 2024 à Paris par une équipe d'entrepreneurs et créateurs, InfluConnect a vu le jour pour réinventer un marché de 16 milliards € où la confiance manquait cruellement.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 px-5 bg-aurora-surface">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-4xl font-semibold text-aurora-ink text-center tracking-[-0.03em] mb-12">Nos valeurs</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map((v) => (
              <div key={v.title} className="bg-white p-6 rounded-2xl border border-aurora-line shadow-soft">
                <div className="h-10 w-10 rounded-xl bg-aurora-blue/10 flex items-center justify-center mb-4">
                  <v.icon className="h-5 w-5 text-aurora-blue-deep" />
                </div>
                <h3 className="font-semibold text-aurora-ink mb-2 tracking-tight">{v.title}</h3>
                <p className="text-[13px] text-aurora-ink-2 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-5">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-semibold text-aurora-ink mb-4 tracking-[-0.02em]">Rejoignez l'aventure</h2>
          <p className="text-aurora-ink-2 mb-8">Marque, agence ou créateur ? On vous accompagne pour vos prochaines collaborations.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="gradient" asChild><Link to="/register">Créer mon compte <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button variant="outline" asChild><Link to="/contact">Nous contacter</Link></Button>
          </div>
        </div>
      </section>
    </div>
  )
}
