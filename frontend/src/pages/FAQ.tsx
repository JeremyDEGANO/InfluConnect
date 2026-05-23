import { useState } from "react"
import { Search, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"

const FAQ_DATA = [
  {
    cat: "Démarrage",
    items: [
      { q: "Comment créer un compte ?", a: "Choisissez votre rôle (marque, agence ou créateur) sur la page d'inscription. La création est gratuite et prend moins de 2 minutes." },
      { q: "Faut-il un SIRET pour s'inscrire en tant que marque ?", a: "Oui, le SIRET est obligatoire pour les marques afin de garantir la conformité KYC et faciliter la facturation." },
      { q: "Combien de temps prend la validation de mon compte ?", a: "Marques : 24 h ouvrées. Créateurs : instantanée après vérification email." },
    ],
  },
  {
    cat: "Paiements & Escrow",
    items: [
      { q: "Comment fonctionne le paiement escrow ?", a: "Stripe bloque le montant à la signature et libère les fonds à validation du contenu (ou après 14 jours sans contestation)." },
      { q: "Quelle commission InfluConnect prélève-t-il ?", a: "15% sur chaque collaboration, payée par la marque. Aucun frais caché." },
      { q: "En combien de temps suis-je payé ?", a: "Sous 7 jours après validation. Virement SEPA gratuit." },
    ],
  },
  {
    cat: "Contrats",
    items: [
      { q: "Les contrats sont-ils légalement valides ?", a: "Oui : signature électronique conforme eIDAS, archivage 10 ans, opposable juridiquement." },
      { q: "Puis-je personnaliser mes templates de contrats ?", a: "Plans Growth et Pro : oui, avec variables dynamiques (livrables, prix, exclusivité…)." },
    ],
  },
  {
    cat: "RGPD & Sécurité",
    items: [
      { q: "Mes données sont-elles hébergées en France ?", a: "Oui : OVH Cloud, région Roubaix. Chiffrement au repos AES-256." },
      { q: "Puis-je exporter ou supprimer mes données ?", a: "Oui, depuis votre profil — droit à la portabilité et à l'oubli automatisés." },
    ],
  },
]

export default function FAQ() {
  const [search, setSearch] = useState("")

  const filtered = FAQ_DATA.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (it) =>
        it.q.toLowerCase().includes(search.toLowerCase()) ||
        it.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((c) => c.items.length > 0)

  return (
    <div className="min-h-screen bg-white">
      <section className="hero-aurora-bg py-20 px-5">
        <div className="container max-w-3xl mx-auto text-center">
          <span className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">FAQ</span>
          <h1 className="text-5xl sm:text-6xl font-semibold text-aurora-ink mt-3 tracking-[-0.04em] text-balance">
            On a sûrement déjà la réponse.
          </h1>
          <div className="mt-8 relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-aurora-ink-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une question…"
              className="pl-11 h-12"
            />
          </div>
        </div>
      </section>

      <section className="py-16 px-5">
        <div className="container max-w-3xl mx-auto space-y-10">
          {filtered.length === 0 && (
            <p className="text-center text-aurora-ink-3">Aucun résultat pour « {search} ».</p>
          )}
          {filtered.map((cat) => (
            <div key={cat.cat}>
              <h2 className="text-sm font-semibold text-aurora-blue-deep uppercase tracking-widest mb-4">{cat.cat}</h2>
              <div className="space-y-2.5">
                {cat.items.map((it) => (
                  <details key={it.q} className="group bg-white rounded-2xl border border-aurora-line p-5 cursor-pointer">
                    <summary className="font-semibold text-aurora-ink flex items-center justify-between list-none text-[14px] tracking-tight">
                      {it.q}
                      <ChevronDown className="h-4 w-4 text-aurora-ink-3 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="text-[13px] text-aurora-ink-2 leading-relaxed mt-3">{it.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
