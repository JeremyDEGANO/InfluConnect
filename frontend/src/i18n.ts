import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

const resources = {
  en: {
    translation: {
      nav: {
        home: "Home", login: "Login", register: "Register", dashboard: "Dashboard",
        campaigns: "Campaigns", proposals: "Proposals", earnings: "Earnings",
        profile: "Profile", subscription: "Subscription", logout: "Logout",
        admin: "Admin",
      },
      landing: {
        hero_title: "Connect Brands with Influencers",
        hero_subtitle: "The premium marketplace for authentic influencer partnerships. Secure payments, smart contracts, verified profiles.",
        cta_influencer: "I'm an Influencer",
        cta_brand: "I'm a Brand",
        how_it_works: "How It Works",
        step1_title: "Create Your Profile",
        step1_desc: "Brands post campaigns, influencers showcase their audience.",
        step2_title: "Match & Collaborate",
        step2_desc: "Smart matching connects the right influencers to your campaigns.",
        step3_title: "Secure Payment",
        step3_desc: "Funds held in escrow, released on content approval.",
        features: "Features",
        feature_escrow: "Secure Escrow Payments",
        feature_escrow_desc: "Funds protected until content is approved.",
        feature_contracts: "Digital Contracts",
        feature_contracts_desc: "Automated agreements for every partnership.",
        feature_ratings: "Verified Ratings",
        feature_ratings_desc: "Build trust with authentic reviews.",
        pricing: "Pricing",
        testimonials: "What People Say",
      },
      auth: {
        email: "Email", password: "Password", confirm_password: "Confirm Password",
        first_name: "First Name", last_name: "Last Name", login: "Sign In",
        register: "Create Account", forgot_password: "Forgot password?",
        no_account: "Don't have an account?", have_account: "Already have an account?",
        i_am_influencer: "I'm an Influencer", i_am_brand: "I'm a Brand",
        company_name: "Company Name",
      },
      dashboard: {
        welcome: "Welcome back", earnings: "Total Earnings", active_campaigns: "Active Campaigns",
        pending_proposals: "Pending Proposals", avg_rating: "Average Rating",
        recent_proposals: "Recent Proposals", total_spent: "Total Spent",
        influencers_contacted: "Influencers Contacted",
      },
      proposals: {
        title: "Proposals", all: "All", pending: "Pending", accepted: "Accepted",
        declined: "Declined", counter: "Counter Offer", accept: "Accept", decline: "Decline",
        counter_offer: "Counter Offer", send_message: "Send Message",
      },
      campaigns: {
        title: "Campaigns", new_campaign: "New Campaign", active: "Active", draft: "Draft",
        completed: "Completed", budget: "Budget", deadline: "Deadline",
        description: "Description", target_audience: "Target Audience", themes: "Themes",
      },
      common: {
        save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", view: "View",
        loading: "Loading...", error: "An error occurred", success: "Success",
        confirm: "Confirm", back: "Back", next: "Next", submit: "Submit",
        search: "Search", filter: "Filter", sort: "Sort",
      },
      status: {
        pending: "Pending", active: "Active", completed: "Completed", cancelled: "Cancelled",
        accepted: "Accepted", declined: "Declined", draft: "Draft", published: "Published",
      },
    },
  },
  fr: {
    translation: {
      nav: {
        home: "Accueil", login: "Connexion", register: "S'inscrire", dashboard: "Tableau de bord",
        campaigns: "Campagnes", proposals: "Propositions", earnings: "Revenus",
        profile: "Profil", subscription: "Abonnement", logout: "Déconnexion",
        admin: "Admin",
      },
      landing: {
        hero_title: "Connectez les Marques aux Influenceurs",
        hero_subtitle: "La marketplace premium pour des partenariats authentiques. Paiements sécurisés, contrats intelligents, profils vérifiés.",
        cta_influencer: "Je suis Influenceur",
        cta_brand: "Je suis une Marque",
        how_it_works: "Comment ça marche",
        step1_title: "Créez votre Profil",
        step1_desc: "Les marques publient des campagnes, les influenceurs présentent leur audience.",
        step2_title: "Matchez & Collaborez",
        step2_desc: "Le matching intelligent connecte les bons influenceurs à vos campagnes.",
        step3_title: "Paiement Sécurisé",
        step3_desc: "Fonds en séquestre, libérés à l'approbation du contenu.",
        features: "Fonctionnalités",
        feature_escrow: "Paiements en Séquestre",
        feature_escrow_desc: "Fonds protégés jusqu'à l'approbation du contenu.",
        feature_contracts: "Contrats Numériques",
        feature_contracts_desc: "Accords automatisés pour chaque partenariat.",
        feature_ratings: "Notes Vérifiées",
        feature_ratings_desc: "Bâtissez la confiance avec des avis authentiques.",
        pricing: "Tarifs",
        testimonials: "Ce que les gens disent",
      },
      auth: {
        email: "E-mail", password: "Mot de passe", confirm_password: "Confirmer le mot de passe",
        first_name: "Prénom", last_name: "Nom", login: "Se connecter",
        register: "Créer un compte", forgot_password: "Mot de passe oublié ?",
        no_account: "Pas encore de compte ?", have_account: "Vous avez déjà un compte ?",
        i_am_influencer: "Je suis Influenceur", i_am_brand: "Je suis une Marque",
        company_name: "Nom de l'entreprise",
      },
      dashboard: {
        welcome: "Bon retour", earnings: "Revenus totaux", active_campaigns: "Campagnes actives",
        pending_proposals: "Propositions en attente", avg_rating: "Note moyenne",
        recent_proposals: "Propositions récentes", total_spent: "Total dépensé",
        influencers_contacted: "Influenceurs contactés",
      },
      proposals: {
        title: "Propositions", all: "Toutes", pending: "En attente", accepted: "Acceptées",
        declined: "Refusées", counter: "Contre-offre", accept: "Accepter", decline: "Refuser",
        counter_offer: "Contre-offre", send_message: "Envoyer un message",
      },
      campaigns: {
        title: "Campagnes", new_campaign: "Nouvelle campagne", active: "Active", draft: "Brouillon",
        completed: "Terminée", budget: "Budget", deadline: "Date limite",
        description: "Description", target_audience: "Public cible", themes: "Thèmes",
      },
      common: {
        save: "Enregistrer", cancel: "Annuler", delete: "Supprimer", edit: "Modifier", view: "Voir",
        loading: "Chargement...", error: "Une erreur est survenue", success: "Succès",
        confirm: "Confirmer", back: "Retour", next: "Suivant", submit: "Soumettre",
        search: "Rechercher", filter: "Filtrer", sort: "Trier",
      },
      status: {
        pending: "En attente", active: "Actif", completed: "Terminé", cancelled: "Annulé",
        accepted: "Accepté", declined: "Refusé", draft: "Brouillon", published: "Publié",
      },
    },
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  })

export default i18n
