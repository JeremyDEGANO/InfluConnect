import { useState } from "react"
import { Search, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"

const FAQ_DATA = [
  {
    cat: "Démarrage",
    items: [
      {
        q: "Comment créer un compte ?",
        a: "Choisissez votre rôle sur la page d'inscription : créateur ou marque. Pour un créateur, la création est gratuite et prend moins de deux minutes : vous renseignez votre pseudo, connectez vos réseaux sociaux et complétez votre profil. Pour une marque, vous renseignez en plus vos informations d'entreprise (raison sociale, SIRET) et choisissez un abonnement. Votre dossier est ensuite examiné par notre équipe avant activation.",
      },
      {
        q: "Faut-il un SIRET pour s'inscrire en tant que marque ?",
        a: "Oui. Le SIRET est obligatoire pour toute marque car la plateforme génère des contrats et des flux financiers entre professionnels. Il nous permet de vérifier l'existence juridique de l'entreprise, d'établir des factures conformes et de respecter nos obligations de connaissance client. Un numéro de TVA intracommunautaire peut être demandé pour les sociétés hors de France.",
      },
      {
        q: "Combien de temps prend la validation de mon compte ?",
        a: "Les comptes marque sont examinés sous 48 heures ouvrées. Nous vérifions la cohérence entre la raison sociale, le SIRET et le site web déclarés. Si un élément manque, nous vous écrivons pour vous demander un complément plutôt que de refuser le dossier. Les comptes créateurs sont actifs immédiatement après vérification de l'adresse email.",
      },
      {
        q: "Mon profil doit-il être complet pour apparaître dans la marketplace ?",
        a: "Oui. Un profil créateur n'est visible par les marques que lorsqu'il est complété à 100 % : photo, bio, pseudo, ville, langues, thématiques, formats proposés, tarifs, au moins un réseau social, des visuels de portfolio, votre pitch de collaboration et un moyen de paiement. Cette exigence garantit aux marques des profils exploitables et vous évite d'être contacté pour des campagnes hors sujet.",
      },
      {
        q: "Qu'est-ce qu'un créateur UGC et comment l'indiquer ?",
        a: "L'UGC (contenu généré par l'utilisateur) désigne des contenus produits pour la marque, qu'elle diffuse ensuite sur ses propres canaux et publicités, sans publication sur votre audience. Vous pouvez le déclarer dès l'inscription ou depuis votre profil. Les marques peuvent filtrer la marketplace sur ce critère, et un badge UGC apparaît sur votre carte.",
      },
    ],
  },
  {
    cat: "Paiements & séquestre",
    items: [
      {
        q: "Comment fonctionne le paiement sous séquestre ?",
        a: "Dès que la collaboration est acceptée et le contrat signé, la marque approvisionne un compte séquestre : les fonds quittent son compte mais ne vous sont pas encore versés. Ils sont conservés par notre prestataire de paiement. Vous produisez le contenu en sachant que l'argent est déjà bloqué. Après validation du contenu par la marque, les fonds vous sont libérés. Ce mécanisme protège les deux parties : le créateur ne travaille pas sans garantie, la marque ne paie pas sans livrable.",
      },
      {
        q: "Quelle commission InfluConnect prélève-t-il ?",
        a: "Une commission de plateforme s'applique sur les campagnes rémunérées, prélevée sur le montant de la collaboration. Elle couvre le séquestre des fonds, la génération du contrat, la signature électronique, le suivi des livrables et la médiation en cas de litige. Le taux exact en vigueur est affiché sur la page Tarifs et rappelé avant chaque validation de campagne. Les campagnes en dotation de produit (gifting) ne supportent aucune commission.",
      },
      {
        q: "En combien de temps suis-je payé ?",
        a: "Le versement est déclenché dès la validation du contenu par la marque. Les fonds arrivent ensuite sur votre compte bancaire selon les délais de traitement de notre prestataire de paiement, généralement sous quelques jours ouvrés. Vous suivez chaque étape depuis votre espace « Revenus ».",
      },
      {
        q: "Que se passe-t-il si la marque ne valide pas mon contenu ?",
        a: "La marque dispose d'un délai défini pour valider ou demander des corrections. Passé ce délai sans réponse de sa part, la validation intervient automatiquement et le paiement est libéré. Si la marque demande des corrections, vous recevez le motif détaillé et pouvez soumettre une nouvelle version. En cas de désaccord persistant, la médiation InfluConnect est saisie.",
      },
      {
        q: "Comment se passe une médiation en cas de litige ?",
        a: "Chaque partie expose sa position et joint ses éléments (brief, échanges, livrables). Notre équipe examine le contrat signé, les messages échangés sur la plateforme et les contenus soumis, puis rend une décision motivée sur la libération totale, partielle ou le remboursement des fonds séquestrés. Les fonds restent bloqués pendant toute la durée de l'examen.",
      },
      {
        q: "Puis-je payer mon abonnement à l'année ?",
        a: "Oui. Le paiement annuel donne droit à une remise par rapport au tarif mensuel. Le montant exact et l'économie réalisée sont affichés sur la page Tarifs en basculant sur l'affichage annuel. La commission sur les campagnes reste inchangée quel que soit le mode de facturation.",
      },
    ],
  },
  {
    cat: "Campagnes & contrats",
    items: [
      {
        q: "Les contrats sont-ils légalement valides ?",
        a: "Chaque collaboration donne lieu à un contrat généré automatiquement à partir des termes négociés (livrables, prix, délais, droits d'image, exclusivité). Il est signé électroniquement par les deux parties ; la signature, l'adresse IP et l'horodatage sont enregistrés pour constituer un faisceau de preuves, et le document signé est archivé et téléchargeable à tout moment par les deux parties.",
      },
      {
        q: "Puis-je personnaliser mes modèles de contrat ?",
        a: "Selon votre abonnement, vous pouvez créer vos propres modèles avec des variables dynamiques renseignées automatiquement (nom du créateur, livrables, montant, échéances, clauses d'exclusivité). Vous pouvez définir un modèle par défaut et l'associer à une campagne précise. Le nombre de modèles disponibles dépend du plan.",
      },
      {
        q: "Quelle est la différence entre un casting sur sélection et un casting ouvert ?",
        a: "Dans un casting sur sélection, la marque choisit elle-même une liste d'influenceurs dans la marketplace et leur envoie une proposition directe : seuls les créateurs contactés voient la campagne. Dans un casting ouvert, la campagne est publiée et tous les créateurs éligibles peuvent postuler avec une lettre de motivation ; la marque choisit ensuite parmi les candidatures. Les castings sur sélection sont inclus dans tous les plans.",
      },
      {
        q: "La marque peut-elle joindre des documents à sa campagne ?",
        a: "Oui. Une marque peut attacher jusqu'à cinq documents à une campagne (PDF ou images) : charte graphique, exemples de contenus attendus, visuels produit, bons de réduction. Ces documents ne sont accessibles qu'aux créateurs concernés par la campagne, jamais publiquement.",
      },
      {
        q: "Puis-je refuser une proposition de campagne ?",
        a: "Bien sûr, et sans justification obligatoire. Il vous est simplement demandé d'indiquer un motif parmi une liste (budget insuffisant, hors thématique, indisponibilité, délai trop court…) avec un commentaire facultatif. Ce retour aide la marque à mieux cibler ses prochaines propositions et n'a aucune incidence négative sur votre profil.",
      },
    ],
  },
  {
    cat: "Statistiques & profil",
    items: [
      {
        q: "Que signifient des « statistiques certifiées » ?",
        a: "Lorsque vous connectez un réseau social via son interface officielle, les chiffres affichés (abonnés, vues moyennes, engagement) sont récupérés directement auprès de la plateforme et non saisis manuellement. Ils sont horodatés et rafraîchis régulièrement. Les marques distinguent visuellement un compte certifié par connexion d'un compte simplement déclaré.",
      },
      {
        q: "Qu'est-ce que le kit média et qui peut le consulter ?",
        a: "Le kit média est un PDF généré à partir de votre profil : présentation, audience, thématiques, formats, tarifs et portfolio. Il se régénère à la demande pour rester à jour. Il n'est accessible qu'aux utilisateurs connectés à la plateforme : il n'est jamais exposé publiquement sur le web ni indexé par les moteurs de recherche.",
      },
    ],
  },
  {
    cat: "RGPD & sécurité",
    items: [
      {
        q: "Mes données sont-elles hébergées dans l'Union européenne ?",
        a: "Oui, les données de la plateforme sont hébergées au sein de l'Union européenne. Les données bancaires ne transitent jamais par nos serveurs : elles sont traitées directement par notre prestataire de paiement agréé. Les informations sensibles stockées par nos soins sont chiffrées.",
      },
      {
        q: "Puis-je exporter ou supprimer mes données ?",
        a: "Oui. Vous pouvez demander l'export de vos données personnelles dans un format lisible, ainsi que la suppression de votre compte, depuis votre espace ou en écrivant à notre contact dédié. Certaines données doivent toutefois être conservées pour la durée légale imposée en matière comptable et contractuelle, notamment les factures et les contrats signés.",
      },
      {
        q: "Comment sécuriser l'accès à mon compte ?",
        a: "Activez la double authentification depuis vos réglages de sécurité : soit par application d'authentification (code temporaire), soit par code envoyé par email à chaque connexion. Vous pouvez également consulter et révoquer vos sessions ; un changement de mot de passe déconnecte automatiquement tous vos appareils.",
      },
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
