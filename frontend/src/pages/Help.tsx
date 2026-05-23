import { Link } from "react-router-dom"
import { BookOpen, MessageCircle, Mail, Lightbulb, FileText, Shield, ArrowRight } from "lucide-react"

const TOPICS = [
  { icon: Lightbulb, title: "Démarrage rapide", desc: "Créer votre compte, compléter votre profil, lancer votre première campagne.", to: "/faq" },
  { icon: FileText, title: "Contrats & signature", desc: "Templates, signature électronique eIDAS, archivage légal.", to: "/faq" },
  { icon: Shield, title: "Paiements & escrow", desc: "Comprendre Stripe Connect, libération des fonds, factures.", to: "/faq" },
  { icon: BookOpen, title: "Bonnes pratiques", desc: "Briefs, livrables, validation de contenu et droits d'usage.", to: "/faq" },
]

export default function Help() {
  return (
    <div className="min-h-screen bg-white">
      <section className="hero-aurora-bg py-20 px-5">
        <div className="container max-w-3xl mx-auto text-center">
          <span className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">Centre d'aide</span>
          <h1 className="text-5xl sm:text-6xl font-semibold text-aurora-ink mt-3 tracking-[-0.04em] text-balance">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="text-aurora-ink-2 mt-5 max-w-xl mx-auto">Documentation, FAQ et accès direct à notre équipe support.</p>
        </div>
      </section>

      <section className="py-16 px-5">
        <div className="container max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {TOPICS.map((t) => (
              <Link key={t.title} to={t.to} className="group bg-white border border-aurora-line rounded-2xl p-6 hover:shadow-soft-lg hover:-translate-y-0.5 transition-all ease-aurora">
                <div className="h-10 w-10 rounded-xl bg-aurora-blue/10 flex items-center justify-center mb-4">
                  <t.icon className="h-5 w-5 text-aurora-blue-deep" />
                </div>
                <h3 className="font-semibold text-aurora-ink mb-1.5 tracking-tight">{t.title}</h3>
                <p className="text-[13px] text-aurora-ink-2 leading-relaxed">{t.desc}</p>
                <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-aurora-blue-deep">
                  En savoir plus <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Link to="/faq" className="bg-aurora-surface border border-aurora-line rounded-2xl p-6 flex items-center gap-4 hover:shadow-soft transition">
              <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-soft">
                <MessageCircle className="h-5 w-5 text-aurora-blue-deep" />
              </div>
              <div>
                <h3 className="font-semibold text-aurora-ink tracking-tight">Consulter la FAQ</h3>
                <p className="text-[12px] text-aurora-ink-2">Plus de 50 questions répondues</p>
              </div>
            </Link>
            <Link to="/contact" className="bg-aurora-surface border border-aurora-line rounded-2xl p-6 flex items-center gap-4 hover:shadow-soft transition">
              <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-soft">
                <Mail className="h-5 w-5 text-aurora-blue-deep" />
              </div>
              <div>
                <h3 className="font-semibold text-aurora-ink tracking-tight">Contacter l'équipe</h3>
                <p className="text-[12px] text-aurora-ink-2">Réponse sous 24 h ouvrées</p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
