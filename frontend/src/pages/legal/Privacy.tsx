export default function Privacy() {
  return (
    <div className="container mx-auto max-w-3xl py-12 px-4 prose prose-sm md:prose-base">
      <h1>Politique de Confidentialité</h1>
      <p className="text-sm text-gray-500">Dernière mise à jour : 21 avril 2026</p>

      <p>
        InfluConnect SAS (« nous », « notre », « la Plateforme ») accorde une importance
        primordiale à la protection des données personnelles. La présente politique
        décrit, conformément au Règlement (UE) 2016/679 (RGPD) et à la loi française
        Informatique et Libertés, les données collectées, leur finalité, leur durée de
        conservation et les droits dont vous disposez.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        InfluConnect SAS — France.<br />
        Délégué à la protection des données :{" "}
        <a href="mailto:dpo@influconnect.fr">dpo@influconnect.fr</a>
      </p>

      <h2>2. Données collectées et finalités</h2>

      <h3>2.1 Données d'inscription</h3>
      <ul>
        <li>Nom, prénom, e-mail, téléphone, adresse, date de naissance ;</li>
        <li>Pour les marques : raison sociale, SIRET, IBAN ;</li>
        <li>Mot de passe (stocké de manière irréversible — hash PBKDF2).</li>
      </ul>
      <p>Finalité : création et gestion du compte. Base légale : exécution du contrat.</p>

      <h3>2.2 Données importées depuis les réseaux sociaux (OAuth)</h3>
      <p>
        Lorsque vous connectez un compte TikTok, YouTube, Instagram, Facebook ou Twitch
        via OAuth, nous accédons et stockons les informations suivantes&nbsp;:
      </p>
      <ul>
        <li>
          <strong>TikTok</strong> (scopes <code>user.info.profile</code>,{" "}
          <code>user.info.stats</code>) : identifiant TikTok (open_id), nom d'utilisateur,
          avatar, biographie, lien profil, nombre d'abonnés, nombre d'abonnements, total
          de likes reçus, nombre de vidéos publiées.
        </li>
        <li>
          <strong>YouTube</strong> : identifiant de chaîne, nombre d'abonnés, vues totales,
          nombre de vidéos, statistiques agrégées des 10 dernières vidéos publiques.
        </li>
        <li>
          <strong>Instagram / Facebook</strong> (Meta Graph API) : identifiant utilisateur,
          nom d'utilisateur, nombre d'abonnés, métriques d'engagement publiques (réservé
          aux comptes Business ou Creator).
        </li>
        <li>
          <strong>Twitch</strong> : identifiant utilisateur, nom d'utilisateur, nombre
          d'abonnés, vues moyennes des dernières diffusions.
        </li>
      </ul>
      <p>
        <strong>Finalité&nbsp;:</strong> constituer un dossier de presse vérifié à
        destination des marques et leur permettre de prendre une décision éclairée.
        <br />
        <strong>Base légale&nbsp;:</strong> consentement explicite (vous initiez
        manuellement la connexion OAuth).
      </p>
      <p>
        <strong>Stockage des jetons&nbsp;:</strong> les jetons d'accès et de
        rafraîchissement émis par les plateformes tierces sont chiffrés au repos via
        l'algorithme symétrique Fernet (AES-128-CBC + HMAC-SHA256). Ils ne sont jamais
        partagés avec les marques ni avec d'autres tiers.
      </p>
      <p>
        <strong>Aucune publication automatique&nbsp;:</strong> InfluConnect ne publie
        jamais de contenu en votre nom et n'accède jamais à vos messages privés.
      </p>

      <h3>2.3 Données de paiement</h3>
      <p>
        Les informations bancaires (carte, IBAN) sont collectées et traitées exclusivement
        par notre prestataire <strong>Stripe Payments Europe Ltd</strong>, certifié
        PCI-DSS niveau 1. InfluConnect ne stocke aucun numéro de carte. Voir la{" "}
        <a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer">
          politique Stripe
        </a>.
      </p>

      <h3>2.4 Données techniques</h3>
      <ul>
        <li>Adresse IP, journaux de connexion (12 mois — obligation légale LCEN) ;</li>
        <li>Cookies de session strictement nécessaires (pas de cookies publicitaires).</li>
      </ul>

      <h2>3. Durées de conservation</h2>
      <ul>
        <li>Compte actif : pendant toute la durée de la relation contractuelle ;</li>
        <li>Compte inactif : suppression automatique après 3 ans d'inactivité ;</li>
        <li>Données de facturation : 10 ans (obligation comptable) ;</li>
        <li>Jetons OAuth : supprimés immédiatement à la déconnexion ou à la révocation ;</li>
        <li>Logs techniques : 12 mois.</li>
      </ul>

      <h2>4. Destinataires des données</h2>
      <p>Les données ne sont communiquées qu'aux destinataires suivants :</p>
      <ul>
        <li>Personnel autorisé d'InfluConnect (support, modération) ;</li>
        <li>Marques avec lesquelles vous concluez un partenariat (données de contact uniquement) ;</li>
        <li>Sous-traitants techniques : Stripe (paiement), OVHcloud (hébergement, France), SendGrid (e-mails transactionnels) ;</li>
        <li>Autorités compétentes sur réquisition légale.</li>
      </ul>
      <p>
        Aucune donnée n'est vendue. Aucun transfert hors Union Européenne n'est effectué
        sans garanties appropriées (clauses contractuelles types de la Commission européenne).
      </p>

      <h2>5. Vos droits (RGPD)</h2>
      <p>Vous disposez des droits suivants :</p>
      <ul>
        <li>Droit d'accès à vos données ;</li>
        <li>Droit de rectification ;</li>
        <li>Droit à l'effacement (« droit à l'oubli ») ;</li>
        <li>Droit à la limitation et à l'opposition au traitement ;</li>
        <li>Droit à la portabilité ;</li>
        <li>Droit de retirer votre consentement à tout moment ;</li>
        <li>Droit de définir des directives post-mortem.</li>
      </ul>
      <p>
        <strong>Pour les données importées via TikTok, YouTube, Instagram, Facebook ou
        Twitch :</strong> vous pouvez révoquer notre accès à tout moment&nbsp;:
      </p>
      <ul>
        <li>Soit depuis votre profil InfluConnect (bouton « Déconnecter » à côté du réseau social) ;</li>
        <li>Soit directement depuis les paramètres du réseau social :
          <ul>
            <li>TikTok : Paramètres → Sécurité et connexion → Gérer les applications connectées ;</li>
            <li>YouTube/Google : <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a> ;</li>
            <li>Meta : Paramètres → Apps et sites web ;</li>
            <li>Twitch : Paramètres → Connexions.</li>
          </ul>
        </li>
      </ul>
      <p>
        Pour exercer ces droits, contactez{" "}
        <a href="mailto:dpo@influconnect.fr">dpo@influconnect.fr</a>. Une réponse vous sera
        apportée dans un délai maximal d'un mois.
      </p>

      <h2>6. Réclamation</h2>
      <p>
        Vous avez le droit d'introduire une réclamation auprès de la Commission Nationale
        de l'Informatique et des Libertés (CNIL) — 3 place de Fontenoy, 75007 Paris —{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>.
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées :
        chiffrement TLS 1.3 en transit, chiffrement Fernet des jetons OAuth au repos,
        hashing PBKDF2 des mots de passe, sauvegardes chiffrées, journaux d'accès, accès
        aux données sur la base du moindre privilège, double authentification pour
        l'équipe technique.
      </p>

      <h2>8. Mineurs</h2>
      <p>
        L'inscription est réservée aux personnes âgées d'au moins 16 ans. Pour les
        utilisateurs entre 16 et 18 ans, l'autorisation parentale est requise pour la
        conclusion de partenariats rémunérés, conformément à la loi française.
      </p>

      <h2>9. Modifications</h2>
      <p>
        Nous pouvons mettre à jour cette politique. Toute modification substantielle vous
        sera notifiée par e-mail au moins quinze (15) jours avant son entrée en vigueur.
      </p>

      <h2>10. Contact</h2>
      <p>
        Délégué à la protection des données :{" "}
        <a href="mailto:dpo@influconnect.fr">dpo@influconnect.fr</a>
        <br />
        Support général :{" "}
        <a href="mailto:contact@influconnect.fr">contact@influconnect.fr</a>
      </p>
    </div>
  )
}
