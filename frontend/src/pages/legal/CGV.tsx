export default function CGV() {
  return (
    <div className="min-h-screen bg-white py-16 px-5">
      <div className="container max-w-3xl mx-auto">
        <p className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">Légal</p>
        <h1 className="text-4xl sm:text-5xl font-semibold text-aurora-ink mt-2 tracking-[-0.03em]">Conditions Générales de Vente</h1>
        <p className="text-aurora-ink-3 mt-3 text-sm">Dernière mise à jour : 1<sup>er</sup> janvier 2025</p>

        <div className="prose prose-sm max-w-none mt-10 text-aurora-ink-2 leading-relaxed space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">1. Objet</h2>
            <p>Les présentes Conditions Générales de Vente (« CGV ») régissent toutes les ventes de prestations de services proposées par InfluConnect SAS, RCS Paris 932 174 558 (« la Société »), à ses clients professionnels (marques, agences et créateurs).</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">2. Souscription d'un abonnement</h2>
            <p>Les abonnements sont souscrits via le site influconnect.fr. Le paiement s'effectue mensuellement ou annuellement par carte bancaire via Stripe. Les abonnements sont reconduits tacitement à chaque échéance, sauf résiliation par le Client.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">3. Prix</h2>
            <p>Les prix sont indiqués en euros, hors taxes. La TVA française au taux en vigueur s'applique aux clients établis en France. Les autoliquidations intra-communautaires sont admises sur présentation d'un numéro de TVA valide.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">4. Commission de plateforme</h2>
            <p>InfluConnect prélève une commission de 15% TTC sur chaque transaction réalisée entre une marque et un créateur via la plateforme. Cette commission est déduite automatiquement avant libération des fonds vers le créateur.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">5. Paiement escrow</h2>
            <p>Les fonds versés par les marques sont conservés sur un compte séquestre Stripe Connect jusqu'à validation des livrables. La Société n'est ni dépositaire ni garante des fonds, qui restent sous contrôle prudentiel de Stripe Payments Europe.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">6. Résiliation</h2>
            <p>Le Client peut résilier son abonnement à tout moment depuis son espace personnel. La résiliation prend effet à la fin de la période en cours, sans remboursement au prorata.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">7. Responsabilité</h2>
            <p>La Société agit uniquement en qualité d'intermédiaire technique. Elle ne saurait être tenue responsable de la qualité des contenus produits, du respect des engagements contractuels entre marques et créateurs, ni de tout préjudice indirect.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">8. Loi applicable & juridiction</h2>
            <p>Les présentes CGV sont soumises au droit français. Tout litige relève de la compétence exclusive du Tribunal de commerce de Paris, après tentative de résolution amiable.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
