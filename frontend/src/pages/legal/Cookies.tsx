export default function Cookies() {
  return (
    <div className="min-h-screen bg-white py-16 px-5">
      <div className="container max-w-3xl mx-auto">
        <p className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">Légal</p>
        <h1 className="text-4xl sm:text-5xl font-semibold text-aurora-ink mt-2 tracking-[-0.03em]">Politique de cookies</h1>
        <p className="text-aurora-ink-3 mt-3 text-sm">Dernière mise à jour : 1<sup>er</sup> janvier 2025</p>

        <div className="mt-10 text-aurora-ink-2 leading-relaxed space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight mb-2">Qu'est-ce qu'un cookie ?</h2>
            <p>Un cookie est un petit fichier texte déposé sur votre appareil lors de la visite d'un site web. Il permet d'enregistrer des informations relatives à votre navigation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight mb-4">Cookies utilisés sur InfluConnect</h2>
            <div className="overflow-x-auto">
              <table className="w-full border border-aurora-line rounded-2xl overflow-hidden bg-white">
                <thead className="bg-aurora-surface">
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-aurora-ink-3">Catégorie</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-aurora-ink-3">Finalité</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-aurora-ink-3">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aurora-line text-[13px]">
                  <tr><td className="px-4 py-3 font-medium text-aurora-ink">Essentiels</td><td className="px-4 py-3">Authentification, sécurité, équilibrage de charge</td><td className="px-4 py-3">Session</td></tr>
                  <tr><td className="px-4 py-3 font-medium text-aurora-ink">Préférences</td><td className="px-4 py-3">Langue, thème, paramètres d'affichage</td><td className="px-4 py-3">12 mois</td></tr>
                  <tr><td className="px-4 py-3 font-medium text-aurora-ink">Mesure d'audience</td><td className="px-4 py-3">Statistiques anonymisées (Plausible)</td><td className="px-4 py-3">12 mois</td></tr>
                  <tr><td className="px-4 py-3 font-medium text-aurora-ink">Stripe</td><td className="px-4 py-3">Paiements sécurisés, anti-fraude</td><td className="px-4 py-3">12 mois</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight mb-2">Gérer vos préférences</h2>
            <p>Vous pouvez accepter ou refuser les cookies non essentiels via la bannière qui s'affiche lors de votre première visite, ou ajuster vos paramètres à tout moment depuis votre navigateur. Le refus des cookies essentiels rendra le site inutilisable.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-aurora-ink tracking-tight mb-2">Contact</h2>
            <p>Pour toute question relative à notre politique de cookies, contactez notre DPO à <a href="mailto:dpo@influconnect.fr" className="text-aurora-blue-deep hover:underline">dpo@influconnect.fr</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
