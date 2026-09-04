import { LEGAL_ENTITY, fullAddress } from "@/lib/legalEntity"

type Article = { title: string; paragraphs: string[] }

const E = LEGAL_ENTITY

const ARTICLES: Article[] = [
  {
    title: "Article 1 — Objet et champ d'application",
    paragraphs: [
      `Les présentes Conditions Générales de Vente (les « CGV ») régissent la fourniture, par ${E.name} (la « Société »), des prestations payantes accessibles sur la plateforme InfluConnect : abonnements donnant accès à la plateforme et service d'intermédiation sur les collaborations rémunérées entre une marque et un créateur de contenu.`,
      "Elles s'appliquent à tout client professionnel agissant dans le cadre de son activité (marque annonceur) ainsi qu'aux créateurs de contenu percevant une rémunération via la plateforme, ci-après désignés ensemble « le Client ».",
      "Toute commande d'abonnement ou toute mise en relation rémunérée sur la plateforme emporte acceptation sans réserve des présentes CGV, qui prévalent sur tout autre document du Client, notamment ses conditions générales d'achat.",
      "Les CGV complètent les Conditions Générales d'Utilisation, qui régissent l'accès et l'usage de la plateforme. En cas de contradiction sur un point strictement commercial ou financier, les présentes CGV prévalent.",
    ],
  },
  {
    title: "Article 2 — Description des prestations",
    paragraphs: [
      "La Société fournit une plateforme technique permettant : la recherche et la sélection de créateurs de contenu, la négociation et la formalisation d'une collaboration, la génération et la signature électronique d'un contrat, la conservation des fonds en séquestre jusqu'à validation des livrables, le suivi des contenus produits et de leurs statistiques, ainsi qu'une procédure de médiation en cas de litige.",
      "La Société agit exclusivement en qualité d'intermédiaire technique. Elle n'est ni l'employeur, ni le mandataire, ni l'agent des créateurs, et n'est pas partie au contrat de collaboration conclu entre la marque et le créateur.",
      "Les fonctionnalités accessibles dépendent de la formule d'abonnement souscrite. La grille des fonctionnalités par formule est consultable en permanence sur la page Tarifs, qui fait foi entre les parties.",
    ],
  },
  {
    title: "Article 3 — Souscription de l'abonnement",
    paragraphs: [
      "La souscription s'effectue en ligne. Le Client sélectionne une formule, renseigne les informations d'identification de son entreprise (dénomination sociale, numéro SIRET, adresse de facturation) et valide son paiement.",
      "La Société se réserve le droit de vérifier les informations déclarées avant activation du compte, et de refuser une inscription en cas d'informations inexactes, incomplètes ou incohérentes, sans que ce refus n'ouvre droit à indemnité.",
      "Le contrat est formé à la confirmation de la commande par la Société et l'activation effective du compte.",
    ],
  },
  {
    title: "Article 4 — Prix, facturation et périodicité",
    paragraphs: [
      "Les prix des abonnements sont indiqués en euros et hors taxes sur la page Tarifs. La TVA au taux légal en vigueur s'ajoute au prix hors taxes. L'autoliquidation intracommunautaire peut s'appliquer sur présentation d'un numéro de TVA valide.",
      "L'abonnement peut être souscrit avec une facturation mensuelle ou annuelle. La facturation annuelle, payable d'avance pour douze mois, ouvre droit à une remise sur le tarif mensuel. Le taux de remise applicable et le montant correspondant sont affichés sur la page Tarifs avant toute souscription.",
      "La Société peut faire évoluer ses tarifs. Toute évolution est notifiée au Client au moins trente (30) jours avant sa prise d'effet et ne s'applique qu'à compter du renouvellement suivant. Le Client qui refuse la nouvelle tarification peut résilier dans les conditions de l'article 8.",
      "Les factures sont émises par voie électronique et mises à disposition dans l'espace client.",
    ],
  },
  {
    title: "Article 5 — Commission de plateforme",
    paragraphs: [
      "Toute collaboration rémunérée conclue via la plateforme donne lieu au prélèvement d'une commission de plateforme, calculée sur le montant de la collaboration.",
      "Cette commission rémunère les services suivants : conservation des fonds en séquestre, génération du contrat, signature électronique et conservation de ses éléments de preuve, suivi des livrables et accès à la procédure de médiation.",
      "Le taux de commission en vigueur est affiché sur la page Tarifs et rappelé avant la validation de chaque campagne rémunérée. Le montant exact prélevé est indiqué sur le récapitulatif de la collaboration ainsi que sur le justificatif correspondant.",
      "Les collaborations réalisées en contrepartie exclusive d'une dotation en produit ou en service (« gifting »), sans versement financier, ne donnent lieu à aucune commission.",
      "Toute évolution du taux de commission est notifiée au moins trente (30) jours avant son entrée en vigueur et ne s'applique pas aux collaborations déjà engagées.",
    ],
  },
  {
    title: "Article 6 — Paiement sous séquestre et versement au créateur",
    paragraphs: [
      `Les paiements sont traités par ${E.paymentProvider}, prestataire de services de paiement agréé. Les données bancaires du Client ne transitent pas par les serveurs de la Société et ne sont pas conservées par elle.`,
      "À l'acceptation d'une collaboration rémunérée, la marque approvisionne un compte de cantonnement (« séquestre »). Les fonds sont débités du compte de la marque mais ne sont pas mis à disposition du créateur tant que les livrables n'ont pas été validés.",
      "La marque dispose d'un délai, précisé sur la plateforme et rappelé dans le contrat, pour valider les livrables ou demander des corrections motivées. À défaut de réponse dans ce délai, la validation est réputée acquise et les fonds sont libérés au bénéfice du créateur.",
      "Après libération, le versement au créateur intervient selon les délais de traitement du prestataire de paiement. La Société ne garantit pas un délai bancaire qui ne dépend pas d'elle.",
      "La Société n'est ni dépositaire ni garante des fonds séquestrés, lesquels demeurent soumis au régime applicable au prestataire de paiement.",
    ],
  },
  {
    title: "Article 7 — Litiges entre marques et créateurs : médiation de plateforme",
    paragraphs: [
      "En cas de désaccord sur la conformité des livrables, chaque partie peut saisir la médiation de plateforme depuis son espace. Les fonds séquestrés demeurent bloqués pendant toute la durée de l'examen.",
      "Chaque partie expose sa position et communique ses éléments : brief, contrat signé, échanges intervenus sur la plateforme et contenus soumis. La Société examine ces éléments et rend une décision motivée portant sur la libération totale, la libération partielle ou le remboursement des fonds séquestrés.",
      "Cette médiation est un service contractuel d'arbitrage des fonds séquestrés. Elle ne constitue pas une décision de justice, ne prive aucune partie de son droit d'agir en justice, et n'emporte aucune appréciation sur d'éventuels préjudices excédant le montant séquestré.",
    ],
  },
  {
    title: "Article 8 — Durée, renouvellement et résiliation",
    paragraphs: [
      "L'abonnement est souscrit pour la période choisie (mensuelle ou annuelle) et se renouvelle par tacite reconduction pour une période de même durée, sauf résiliation.",
      "Le Client peut résilier à tout moment depuis son espace client. La résiliation prend effet au terme de la période en cours ; les sommes déjà réglées au titre de la période en cours restent acquises à la Société et ne donnent lieu à aucun remboursement au prorata.",
      "La Société peut suspendre ou résilier l'accès du Client, après mise en demeure restée sans effet pendant quinze (15) jours, en cas de défaut de paiement ou de manquement grave aux CGV ou aux Conditions Générales d'Utilisation. En cas de fraude, d'atteinte à la sécurité de la plateforme ou d'activité manifestement illicite, la suspension peut être immédiate.",
      "La résiliation de l'abonnement n'affecte pas les collaborations déjà engagées : les contrats en cours et les fonds séquestrés continuent d'être traités jusqu'à leur terme.",
    ],
  },
  {
    title: "Article 9 — Obligations du Client",
    paragraphs: [
      "Le Client garantit l'exactitude des informations communiquées lors de l'inscription et s'engage à les maintenir à jour, notamment ses coordonnées de facturation et ses informations bancaires.",
      "Le Client s'engage à respecter la réglementation applicable à son activité, en particulier les règles relatives à la transparence des communications commerciales et à l'identification du caractère publicitaire des contenus sponsorisés, ainsi que ses obligations fiscales et sociales propres.",
      "Le Client s'interdit de contourner la plateforme dans le but d'éviter la commission due sur une collaboration initiée grâce à celle-ci.",
    ],
  },
  {
    title: "Article 10 — Responsabilité",
    paragraphs: [
      "La Société est tenue d'une obligation de moyens quant à la disponibilité et au bon fonctionnement de la plateforme. Elle ne garantit pas une disponibilité ininterrompue et peut interrompre l'accès pour maintenance, en informant les Clients dans la mesure du possible.",
      "La Société n'étant pas partie au contrat de collaboration, elle ne saurait être tenue responsable de la qualité, de la légalité ou des performances des contenus produits, ni de l'exécution des engagements pris entre la marque et le créateur.",
      "La responsabilité de la Société est en tout état de cause limitée aux dommages directs et prévisibles, et plafonnée au montant des sommes effectivement versées par le Client à la Société au titre des douze (12) mois précédant le fait générateur.",
      "Aucune limitation ne s'applique en cas de dol, de faute lourde, ou dans les cas où la loi l'interdit.",
    ],
  },
  {
    title: "Article 11 — Propriété intellectuelle sur les contenus",
    paragraphs: [
      "La plateforme, sa structure, ses marques et ses développements demeurent la propriété exclusive de la Société.",
      "Les droits portant sur les contenus produits dans le cadre d'une collaboration sont réglés exclusivement par le contrat conclu entre la marque et le créateur, qui précise notamment l'étendue, la durée, les supports et le territoire de la cession ou de la licence consentie.",
      "À défaut de stipulation expresse dans ce contrat, aucune cession de droits n'est présumée au profit de la marque au-delà de la diffusion convenue.",
    ],
  },
  {
    title: "Article 12 — Droit de rétractation",
    paragraphs: [
      "Les prestations étant destinées à des professionnels agissant dans le cadre de leur activité, le droit de rétractation prévu en matière de vente à distance aux consommateurs ne s'applique pas.",
      "Lorsque le Client est une personne physique remplissant les conditions légales pour en bénéficier, il dispose d'un délai de quatorze (14) jours à compter de la souscription pour se rétracter, sauf s'il a expressément demandé l'exécution immédiate du service et reconnu perdre ce droit une fois le service pleinement exécuté.",
    ],
  },
  {
    title: "Article 13 — Protection des données personnelles",
    paragraphs: [
      "Le traitement des données personnelles est décrit dans la Politique de confidentialité, accessible depuis le pied de page du site.",
      "Chaque partie s'engage à respecter la réglementation applicable en matière de protection des données personnelles pour les traitements dont elle est responsable.",
    ],
  },
  {
    title: "Article 14 — Force majeure",
    paragraphs: [
      "Aucune des parties ne pourra être tenue responsable d'un manquement résultant d'un événement de force majeure au sens du droit applicable et de la jurisprudence.",
      "Si l'événement se prolonge au-delà de soixante (60) jours, chaque partie pourra résilier le contrat par notification écrite, sans indemnité.",
    ],
  },
  {
    title: "Article 15 — Modification des CGV",
    paragraphs: [
      "La Société peut modifier les présentes CGV. Toute modification substantielle est notifiée au Client au moins trente (30) jours avant son entrée en vigueur.",
      "Les CGV applicables sont celles en vigueur à la date de la commande ou du renouvellement. La poursuite de l'utilisation après l'entrée en vigueur vaut acceptation de la version modifiée.",
    ],
  },
  {
    title: "Article 16 — Droit applicable et règlement des différends",
    paragraphs: [
      "Les présentes CGV sont soumises au droit français.",
      "En cas de différend, les parties s'engagent à rechercher une solution amiable avant toute action contentieuse.",
      `Le Client consommateur peut recourir gratuitement à un médiateur de la consommation : ${E.mediatorName} — ${E.mediatorUrl}.`,
      "À défaut d'accord amiable, et sous réserve des règles impératives de compétence, tout litige relève de la compétence des tribunaux compétents dans le ressort du siège social de la Société.",
    ],
  },
]

export default function CGV() {
  return (
    <div className="min-h-screen bg-white py-16 px-5">
      <div className="container max-w-3xl mx-auto">
        <p className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">Légal</p>
        <h1 className="text-4xl sm:text-5xl font-semibold text-aurora-ink mt-2 tracking-[-0.03em]">
          Conditions Générales de Vente
        </h1>
        <p className="text-aurora-ink-3 mt-3 text-sm">Dernière mise à jour : {E.lastUpdated}</p>

        <div className="mt-8 rounded-2xl border border-aurora-line bg-aurora-surface/60 p-5 text-sm text-aurora-ink-2">
          <p className="font-semibold text-aurora-ink">Éditeur</p>
          <p className="mt-1.5">
            {E.name} — {E.legalForm} au capital de {E.capital}
            <br />Siège social : {fullAddress()}
            <br />RCS {E.rcsCity} {E.rcsNumber} — SIRET {E.siret}
            <br />TVA intracommunautaire : {E.vatNumber}
            <br />Contact : {E.email}
          </p>
        </div>

        <div className="prose prose-sm max-w-none mt-10 text-aurora-ink-2 leading-relaxed space-y-8">
          {ARTICLES.map((article) => (
            <section key={article.title}>
              <h2 className="text-xl font-semibold text-aurora-ink tracking-tight">{article.title}</h2>
              {article.paragraphs.map((paragraph, index) => (
                <p key={index} className="mt-2">{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
