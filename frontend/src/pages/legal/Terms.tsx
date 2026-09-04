import { LEGAL_ENTITY, fullAddress } from "@/lib/legalEntity"

type Article = { title: string; paragraphs: string[] }

const E = LEGAL_ENTITY

const ARTICLES: Article[] = [
  {
    title: "Article 1 — Objet",
    paragraphs: [
      `Les présentes Conditions Générales d'Utilisation (les « CGU ») définissent les conditions d'accès et d'utilisation de la plateforme InfluConnect, éditée par ${E.name} (la « Société »).`,
      "InfluConnect est une plateforme de mise en relation entre des marques annonceurs et des créateurs de contenu, permettant de formaliser, sécuriser et suivre des collaborations d'influence.",
      "Toute création de compte et toute utilisation de la plateforme emportent acceptation pleine et entière des présentes CGU. L'utilisateur qui n'accepte pas ces conditions doit renoncer à utiliser le service.",
      "Les conditions financières (abonnements, commission, séquestre) sont régies par les Conditions Générales de Vente, qui complètent les présentes.",
    ],
  },
  {
    title: "Article 2 — Définitions",
    paragraphs: [
      "« Plateforme » : le site influconnect.fr, ses applications et l'ensemble des services associés.",
      "« Utilisateur » : toute personne disposant d'un compte, qu'elle agisse en qualité de Marque ou de Créateur.",
      "« Marque » : personne morale ou entrepreneur individuel utilisant la plateforme pour commander des prestations de création de contenu.",
      "« Créateur » : personne proposant des prestations de création et de diffusion de contenu, incluant les créateurs UGC produisant des contenus destinés aux canaux propres de la Marque.",
      "« Campagne » : opération créée par une Marque, définissant un brief, des livrables attendus et une contrepartie.",
      "« Collaboration » : relation contractuelle formée entre une Marque et un Créateur à la suite de l'acceptation d'une proposition.",
    ],
  },
  {
    title: "Article 3 — Accès au service et création de compte",
    paragraphs: [
      "L'inscription est réservée aux personnes âgées d'au moins 18 ans et juridiquement capables. Les Marques doivent être immatriculées et fournir un numéro SIRET valide.",
      "L'Utilisateur s'engage à fournir des informations exactes, complètes et à jour. Toute information manifestement fausse ou trompeuse peut entraîner le refus ou la fermeture du compte.",
      "Les comptes Marque font l'objet d'une vérification préalable par la Société avant activation. Cette vérification porte sur la cohérence entre la dénomination sociale, le numéro d'immatriculation et l'activité déclarée.",
      "Le compte est strictement personnel. L'Utilisateur est responsable de la confidentialité de ses identifiants et de toute activité réalisée depuis son compte. Il lui est recommandé d'activer la double authentification proposée dans ses réglages de sécurité.",
      "L'Utilisateur informe sans délai la Société de toute utilisation non autorisée de son compte.",
    ],
  },
  {
    title: "Article 4 — Profil du Créateur et visibilité dans la marketplace",
    paragraphs: [
      "Le Créateur renseigne un profil comprenant notamment un pseudonyme, une présentation, ses thématiques, les formats proposés, ses tarifs indicatifs et ses réseaux sociaux.",
      "Le profil n'est rendu visible aux Marques dans la marketplace que lorsqu'il est intégralement complété. Cette exigence vise à garantir la pertinence des mises en relation.",
      "Le Créateur peut déclarer produire des contenus UGC. Cette information est affichée aux Marques et permet un filtrage dédié dans la marketplace.",
      "Le Créateur garantit l'exactitude des statistiques d'audience qu'il déclare. Lorsqu'un réseau social est connecté via son interface officielle, les statistiques sont récupérées directement auprès de la plateforme concernée et signalées comme telles.",
      "Toute manipulation artificielle d'audience ou d'engagement, notamment par achat d'abonnements ou d'interactions, constitue un manquement grave aux présentes CGU.",
    ],
  },
  {
    title: "Article 5 — Fonctionnement des collaborations",
    paragraphs: [
      "Une Marque peut proposer une Collaboration à un Créateur qu'elle sélectionne, ou publier un casting ouvert auquel les Créateurs éligibles peuvent candidater.",
      "Le Créateur est libre d'accepter, de refuser ou de formuler une contre-proposition tarifaire. Un refus, motivé au moyen des options proposées, n'emporte aucune conséquence défavorable sur son profil.",
      "L'acceptation d'une proposition déclenche la génération d'un contrat reprenant les termes convenus : livrables, montant, échéances, droits d'exploitation et, le cas échéant, exclusivité.",
      "Le contrat est signé électroniquement par les deux parties. La signature, l'adresse IP et l'horodatage sont enregistrés afin de constituer un faisceau de preuves de l'engagement. Le contrat signé est archivé et reste téléchargeable par les deux parties.",
      "Le Créateur soumet ensuite ses livrables via la plateforme. La Marque dispose d'un délai pour les valider ou formuler une demande de correction motivée.",
    ],
  },
  {
    title: "Article 6 — Documents et échanges",
    paragraphs: [
      "La Marque peut joindre à une Campagne des documents complémentaires (chartes, visuels, exemples), dans la limite du nombre et des formats autorisés par la plateforme. Ces documents ne sont accessibles qu'aux Créateurs concernés par la Campagne.",
      "Une messagerie est mise à disposition pour les échanges liés à une Collaboration. Les Utilisateurs s'engagent à y conserver leurs échanges relatifs à l'exécution de la Collaboration, ces messages pouvant être examinés en cas de médiation.",
      "Les Utilisateurs s'interdisent d'utiliser la messagerie pour diffuser des contenus illicites, harcelants, diffamatoires ou constitutifs d'un démarchage étranger à la Collaboration.",
    ],
  },
  {
    title: "Article 7 — Obligations de transparence publicitaire",
    paragraphs: [
      "Les contenus publiés dans le cadre d'une Collaboration rémunérée ou compensée constituent des communications commerciales.",
      "Le Créateur s'engage à en signaler le caractère publicitaire de manière claire, lisible et non ambiguë, conformément à la réglementation applicable et aux règles propres à chaque réseau social.",
      "La Marque s'engage à ne pas demander au Créateur de dissimuler le caractère commercial d'un contenu.",
      "Le Créateur demeure seul responsable des mentions légales apposées sur les contenus qu'il publie sur ses propres comptes.",
    ],
  },
  {
    title: "Article 8 — Comportements interdits",
    paragraphs: [
      "Il est interdit d'utiliser la plateforme à des fins illicites ou contraires à l'ordre public et aux bonnes mœurs.",
      "Sont notamment prohibés : la publication de contenus contrefaisants, diffamatoires, haineux, violents ou pornographiques ; l'usurpation d'identité ; la collecte non autorisée de données d'autres Utilisateurs ; toute tentative d'atteinte à la sécurité ou à l'intégrité de la plateforme ; l'utilisation de moyens automatisés d'extraction de données non expressément autorisés.",
      "Il est également interdit de solliciter le règlement d'une Collaboration en dehors de la plateforme dans le but d'éviter la commission due, ou de contourner les mécanismes de sécurisation des paiements.",
      "Tout manquement peut entraîner la suspension immédiate du compte, sans préjudice des actions judiciaires que la Société pourrait engager.",
    ],
  },
  {
    title: "Article 9 — Propriété intellectuelle",
    paragraphs: [
      "La plateforme, son architecture, ses interfaces, ses bases de données et ses signes distinctifs sont protégés et demeurent la propriété exclusive de la Société. Aucune reproduction ou exploitation n'est autorisée sans accord écrit préalable.",
      "Le Créateur conserve la titularité des droits d'auteur sur les contenus qu'il produit, sous réserve des droits expressément cédés ou concédés à la Marque dans le contrat de Collaboration.",
      "Le Créateur concède à la Société une licence non exclusive et gratuite d'utilisation de ses éléments de profil (pseudonyme, photographie, présentation, extraits de contenus) aux seules fins d'affichage et de promotion de son profil au sein de la plateforme. Cette licence prend fin à la suppression du compte.",
    ],
  },
  {
    title: "Article 10 — Kit média et documents générés",
    paragraphs: [
      "La plateforme permet au Créateur de générer un kit média au format PDF à partir des informations de son profil.",
      "Ce document n'est accessible qu'aux utilisateurs authentifiés sur la plateforme. Il n'est pas publié sur le web ouvert et n'est pas indexé par les moteurs de recherche.",
      "Le Créateur demeure responsable de l'exactitude des informations qu'il y fait figurer.",
    ],
  },
  {
    title: "Article 11 — Disponibilité et évolutions du service",
    paragraphs: [
      "La Société met en œuvre les moyens raisonnables pour assurer la disponibilité de la plateforme, sans garantir un fonctionnement ininterrompu et exempt d'erreurs.",
      "Elle peut interrompre temporairement l'accès pour des opérations de maintenance, en informant les Utilisateurs dans la mesure du possible.",
      "La Société peut faire évoluer les fonctionnalités de la plateforme. Toute suppression d'une fonctionnalité substantielle est annoncée dans un délai raisonnable.",
    ],
  },
  {
    title: "Article 12 — Données personnelles",
    paragraphs: [
      "Les traitements de données personnelles mis en œuvre sont décrits dans la Politique de confidentialité, accessible depuis le pied de page.",
      "L'Utilisateur dispose des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, qu'il peut exercer depuis son espace ou en écrivant à l'adresse de contact indiquée.",
      "Certaines données sont conservées au-delà de la fermeture du compte lorsque la loi l'impose, notamment les contrats signés et les pièces comptables.",
    ],
  },
  {
    title: "Article 13 — Suspension et suppression du compte",
    paragraphs: [
      "L'Utilisateur peut demander la suppression de son compte à tout moment. Les Collaborations en cours et les fonds séquestrés continuent d'être traités jusqu'à leur terme.",
      "La Société peut suspendre ou supprimer un compte en cas de manquement aux présentes CGU, après mise en demeure restée sans effet, ou immédiatement en cas de fraude, d'activité illicite ou d'atteinte à la sécurité de la plateforme.",
      "La suppression du compte entraîne la perte d'accès aux fonctionnalités, sans préjudice de la conservation légale de certaines données.",
    ],
  },
  {
    title: "Article 14 — Responsabilité",
    paragraphs: [
      "La Société agit en qualité d'intermédiaire technique et n'est pas partie aux Collaborations conclues entre Marques et Créateurs.",
      "Elle ne garantit ni la qualité, ni les performances, ni les résultats commerciaux des contenus produits, ni la solvabilité ou le sérieux des Utilisateurs, au-delà des vérifications qu'elle met raisonnablement en œuvre.",
      "La responsabilité de la Société ne peut être engagée pour les dommages indirects, ni pour les conséquences d'un manquement imputable à un Utilisateur.",
    ],
  },
  {
    title: "Article 15 — Modification des CGU",
    paragraphs: [
      "La Société peut modifier les présentes CGU pour tenir compte d'évolutions légales, techniques ou fonctionnelles.",
      "Toute modification substantielle est portée à la connaissance des Utilisateurs. La poursuite de l'utilisation après l'entrée en vigueur vaut acceptation de la version modifiée.",
    ],
  },
  {
    title: "Article 16 — Droit applicable et juridiction",
    paragraphs: [
      "Les présentes CGU sont soumises au droit français.",
      "En cas de différend, les parties s'efforceront de trouver une solution amiable avant toute action contentieuse.",
      "À défaut, et sous réserve des règles impératives de compétence protectrices du consommateur, tout litige relève des tribunaux compétents dans le ressort du siège social de la Société.",
    ],
  },
]

export default function Terms() {
  return (
    <div className="min-h-screen bg-white py-16 px-5">
      <div className="container max-w-3xl mx-auto">
        <p className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">Légal</p>
        <h1 className="text-4xl sm:text-5xl font-semibold text-aurora-ink mt-2 tracking-[-0.03em]">
          Conditions Générales d'Utilisation
        </h1>
        <p className="text-aurora-ink-3 mt-3 text-sm">Dernière mise à jour : {E.lastUpdated}</p>

        <div className="mt-8 rounded-2xl border border-aurora-line bg-aurora-surface/60 p-5 text-sm text-aurora-ink-2">
          <p className="font-semibold text-aurora-ink">Éditeur</p>
          <p className="mt-1.5">
            {E.name} — {E.legalForm} au capital de {E.capital}
            <br />Siège social : {fullAddress()}
            <br />RCS {E.rcsCity} {E.rcsNumber} — SIRET {E.siret}
            <br />Directeur de la publication : {E.publicationDirector}
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
