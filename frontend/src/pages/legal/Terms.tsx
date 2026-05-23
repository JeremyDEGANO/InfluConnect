import { useTranslation } from "react-i18next"

export default function Terms() {
  const { i18n } = useTranslation()
  const isEn = (i18n.language || "fr").toLowerCase().startsWith("en")

  if (isEn) {
    return (
      <div className="container mx-auto max-w-3xl py-12 px-4 prose prose-sm md:prose-base">
        <h1>Terms of Service</h1>
        <p className="text-sm text-aurora-ink-3">Last updated: April 21, 2026</p>

        <h2>1. Service Overview</h2>
        <p>
          InfluConnect (the "Platform") is an online service operated by InfluConnect SAS,
          a company incorporated under French law and headquartered in France. The Platform
          connects brands and content creators ("influencers") to establish paid partnerships.
        </p>

        <h2>2. Acceptance of Terms</h2>
        <p>
          Registration for and use of the Platform imply full acceptance of these Terms of
          Service. By creating an account, users acknowledge that they have read, understood,
          and accepted these Terms and the <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>3. User Accounts and Obligations</h2>
        <p>
          Registration is free for creators. Brands subscribe to a monthly or yearly plan.
          Users must provide accurate information and keep it up to date.
        </p>
        <p>
          Minimum age is 16. Minors must obtain legal guardian authorization and remain
          subject to applicable French law regarding commercial exploitation of minors' image online.
        </p>

        <h2>4. Social Network Connections</h2>
        <p>
          The Platform offers optional OAuth connections to supported social networks
          (TikTok, YouTube, Instagram, Facebook, Twitch). This connection is voluntary and can
          be revoked at any time from the user dashboard or directly from the social platform.
        </p>
        <p>
          When connected, the Platform imports public statistics (followers, views, engagement)
          to build a verified media profile. The Platform never publishes content on behalf of
          users without explicit user action.
        </p>

        <h2>5. Partnerships and Payments</h2>
        <p>
          Partnerships are contracted between brands and creators through the Platform.
          InfluConnect acts as a technical intermediary and payment escrow facilitator via Stripe.
          Platform fees are displayed before each collaboration is confirmed.
        </p>

        <h2>6. Advertising Transparency</h2>
        <p>
          Sponsored content must clearly disclose advertising status in accordance with
          applicable law. Failure to do so may result in account restrictions and legal liability.
        </p>

        <h2>7. Prohibited Content</h2>
        <p>Users must not promote illegal, fraudulent, counterfeit, harmful, or non-compliant products or services through the Platform.</p>

        <h2>8. Intellectual Property</h2>
        <p>
          Content produced under a partnership remains owned by the creator unless contractually
          transferred. InfluConnect brand assets (name, logo, visual identity, software elements)
          are protected by intellectual property laws.
        </p>

        <h2>9. Liability Limitation</h2>
        <p>
          InfluConnect provides a technical intermediation service. To the maximum extent
          permitted by law, InfluConnect shall not be liable for indirect, incidental, special,
          or consequential damages resulting from the relationship between brands and creators.
        </p>

        <h2>10. Governing Law and Jurisdiction</h2>
        <p>
          These Terms are governed by French law. In the absence of amicable resolution,
          disputes related to these Terms fall under the jurisdiction of courts located in Paris,
          subject to mandatory legal provisions.
        </p>

        <h2>11. Suspension and Termination</h2>
        <p>
          InfluConnect may suspend or terminate any account that violates these Terms,
          applicable law, or third-party platform policies.
        </p>

        <h2>12. Changes to Terms</h2>
        <p>
          InfluConnect may update these Terms at any time. Users will be informed of material
          changes before they take effect.
        </p>

        <h2>13. Contact Details</h2>
        <p>
          For any question related to these Terms: <a href="mailto:contact@InfluConnect.fr">contact@InfluConnect.fr</a>
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl py-12 px-4 prose prose-sm md:prose-base">
      <h1>Conditions Générales d'Utilisation</h1>
      <p className="text-sm text-aurora-ink-3">Dernière mise à jour : 21 avril 2026</p>

      <h2>1. Présentation</h2>
      <p>
        InfluConnect (ci-après « la Plateforme ») est un service en ligne édité par
        InfluConnect SAS, société de droit français, dont le siège social est situé en France.
        La Plateforme met en relation des marques et des créateurs de contenu (« influenceurs »)
        en vue de la conclusion de partenariats commerciaux rémunérés.
      </p>

      <h2>2. Acceptation des conditions</h2>
      <p>
        L'inscription et l'utilisation de la Plateforme impliquent l'acceptation pleine
        et entière des présentes Conditions Générales d'Utilisation (CGU). En créant un
        compte, l'utilisateur reconnaît avoir lu, compris et accepté ces CGU ainsi que
        la <a href="/legal/privacy">Politique de Confidentialité</a>.
      </p>

      <h2>3. Comptes utilisateurs</h2>
      <p>
        L'inscription est gratuite pour les créateurs. Les marques souscrivent à un
        abonnement mensuel ou annuel donnant accès à un nombre déterminé de campagnes.
        L'utilisateur s'engage à fournir des informations exactes et à les maintenir à jour.
      </p>
      <p>
        L'âge minimum requis est de 16 ans. Les mineurs doivent obtenir l'autorisation de
        leur représentant légal et sont soumis aux dispositions de la loi française du
        19 octobre 2020 visant à encadrer l'exploitation commerciale de l'image d'enfants
        sur les plateformes en ligne.
      </p>

      <h2>4. Connexion aux réseaux sociaux</h2>
      <p>
        La Plateforme propose une connexion via OAuth aux réseaux sociaux pris en charge
        (TikTok, YouTube, Instagram, Facebook, Twitch). Cette connexion est strictement
        facultative et révocable à tout moment depuis l'espace personnel ou directement
        depuis les paramètres du réseau social concerné.
      </p>
      <p>
        Lorsque l'utilisateur connecte un compte, la Plateforme importe automatiquement
        les statistiques publiques (nombre d'abonnés, vues, engagement) afin de constituer
        un dossier de presse vérifié. Aucune publication n'est effectuée au nom de
        l'utilisateur sans son action explicite.
      </p>

      <h2>5. Partenariats et rémunération</h2>
      <p>
        Les partenariats sont contractualisés directement entre la marque et le créateur
        via la Plateforme. InfluConnect agit en qualité d'intermédiaire technique et de
        séquestre des paiements via Stripe. La commission de la Plateforme est précisée
        avant la confirmation de chaque partenariat.
      </p>
      <p>
        Les paiements sont libérés au créateur après validation du contenu par la marque,
        conformément au calendrier convenu. En cas de litige, la procédure de médiation
        décrite à l'article 9 s'applique.
      </p>

      <h2>6. Obligations de transparence (loi Influence)</h2>
      <p>
        Conformément à la loi n° 2023-451 du 9 juin 2023 visant à encadrer l'influence
        commerciale, tout contenu sponsorisé doit comporter de manière explicite la mention
        « Publicité » ou « Collaboration commerciale ». Le non-respect de cette obligation
        engage la responsabilité du créateur.
      </p>

      <h2>7. Contenu interdit</h2>
      <p>L'utilisateur s'interdit de promouvoir via la Plateforme :</p>
      <ul>
        <li>La chirurgie esthétique (interdiction légale française) ;</li>
        <li>Les paris sportifs et jeux d'argent (encadrement spécifique) ;</li>
        <li>Les produits financiers à risque non régulés ;</li>
        <li>Tout produit illégal, contrefait ou portant atteinte à autrui.</li>
      </ul>

      <h2>8. Propriété intellectuelle</h2>
      <p>
        Les contenus créés dans le cadre d'un partenariat appartiennent au créateur, qui
        accorde à la marque les droits d'usage définis contractuellement. La marque
        InfluConnect, son logo et l'ensemble des éléments graphiques de la Plateforme sont
        protégés par le droit d'auteur.
      </p>

      <h2>9. Médiation et litiges</h2>
      <p>
        En cas de différend, les parties s'engagent à rechercher une solution amiable
        avant toute action judiciaire. Conformément à l'article L.612-1 du Code de la
        consommation, le consommateur peut recourir gratuitement au service de médiation
        de la consommation.
      </p>

      <h2>10. Loi applicable et juridiction</h2>
      <p>
        Les présentes CGU sont régies par le droit français. À défaut de résolution
        amiable, tout litige relatif à l'interprétation, la validité ou l'exécution des
        présentes relève de la compétence des juridictions de Paris, sous réserve des
        dispositions légales impératives contraires.
      </p>

      <h2>11. Suspension et résiliation</h2>
      <p>
        InfluConnect se réserve le droit de suspendre ou de supprimer tout compte qui
        contreviendrait aux présentes CGU, à la législation en vigueur ou aux conditions
        d'utilisation des réseaux sociaux tiers (TikTok, Meta, Google, Twitch).
      </p>

      <h2>12. Modifications</h2>
      <p>
        InfluConnect peut modifier les présentes CGU à tout moment. Les utilisateurs sont
        informés par e-mail au moins quinze (15) jours avant l'entrée en vigueur des
        modifications.
      </p>

      <h2>13. Coordonnées de contact</h2>
      <p>
        Pour toute question relative aux présentes CGU :{" "}
        <a href="mailto:contact@InfluConnect.fr">contact@InfluConnect.fr</a>
      </p>
    </div>
  )
}
