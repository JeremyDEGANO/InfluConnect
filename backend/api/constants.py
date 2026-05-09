"""
Centralized constants for InfluConnect.
Pricing/plans/themes/etc. are defined here so they can be reused across
serializers, views and frontend endpoints.
"""

# ---------------------------------------------------------------------------
# Subscription plans (Brands)
# ---------------------------------------------------------------------------
SUBSCRIPTION_PLANS = {
    "starter": {
        "id": "starter",
        "name": "Starter",
        "price_eur_monthly": 49,
        "stripe_price_id": "price_starter_stub",
        "features": {
            "concurrent_campaigns": 3,
            "monthly_influencer_contacts": 50,
            "users": 1,
            "basic_analytics": True,
            "advanced_analytics": False,
            "contract_templates_max": 0,
            "sso_office365_google": False,
            "slack_teams_integration": False,
            "api_access": False,
            "crm_integration": False,
            "dedicated_account_manager": False,
            "priority_support": "none",
        },
    },
    "growth": {
        "id": "growth",
        "name": "Growth",
        "price_eur_monthly": 149,
        "stripe_price_id": "price_growth_stub",
        "features": {
            "concurrent_campaigns": 10,
            "monthly_influencer_contacts": 200,
            "users": 3,
            "basic_analytics": True,
            "advanced_analytics": True,
            "contract_templates_max": 5,
            "sso_office365_google": True,
            "slack_teams_integration": True,
            "api_access": False,
            "crm_integration": False,
            "dedicated_account_manager": False,
            "priority_support": "email_48h",
        },
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price_eur_monthly": 399,
        "stripe_price_id": "price_pro_stub",
        "features": {
            "concurrent_campaigns": -1,  # unlimited
            "monthly_influencer_contacts": -1,
            "users": -1,
            "basic_analytics": True,
            "advanced_analytics": True,
            "contract_templates_max": -1,
            "sso_office365_google": True,
            "slack_teams_integration": True,
            "api_access": True,
            "crm_integration": True,
            "dedicated_account_manager": True,
            "priority_support": "email_phone_24h",
        },
    },
}

# ---------------------------------------------------------------------------
# Content themes (CDC §4.1) — with French labels
# ---------------------------------------------------------------------------
CONTENT_THEMES = [
    {"code": "hospitality", "label": "Hôtellerie"},
    {"code": "restaurant", "label": "Restaurant"},
    {"code": "fashion", "label": "Mode"},
    {"code": "beauty", "label": "Beauté"},
    {"code": "travel", "label": "Voyage"},
    {"code": "food", "label": "Cuisine"},
    {"code": "tech", "label": "Tech"},
    {"code": "sport", "label": "Sport"},
    {"code": "lifestyle", "label": "Lifestyle"},
    {"code": "gaming", "label": "Gaming"},
    {"code": "parenting", "label": "Parentalité"},
    {"code": "health_wellness", "label": "Santé & Bien-être"},
    {"code": "finance", "label": "Finance"},
    {"code": "sustainability", "label": "Développement durable"},
    {"code": "other", "label": "Autre"},
]

# ---------------------------------------------------------------------------
# Content types (CDC §4.1)
# ---------------------------------------------------------------------------
CONTENT_TYPES = [
    {"code": "post_photo", "label": "Post photo"},
    {"code": "carousel", "label": "Carrousel photo"},
    {"code": "story", "label": "Story"},
    {"code": "reel_short", "label": "Reel / Short"},
    {"code": "tiktok_video", "label": "Vidéo TikTok"},
    {"code": "youtube_short", "label": "YouTube Short"},
    {"code": "long_video", "label": "Vidéo longue (YouTube)"},
    {"code": "ugc_video", "label": "Vidéo UGC (sans diffusion)"},
    {"code": "unboxing", "label": "Unboxing"},
    {"code": "tutorial", "label": "Tutoriel / How-to"},
    {"code": "review", "label": "Test / Avis"},
    {"code": "vlog", "label": "Vlog"},
    {"code": "thread", "label": "Thread / Tweet"},
    {"code": "live", "label": "Live"},
    {"code": "podcast", "label": "Podcast"},
    {"code": "blog_article", "label": "Article de blog"},
]

# ---------------------------------------------------------------------------
# Social platforms (CDC §4.1 + §8.1)
# ---------------------------------------------------------------------------
SOCIAL_PLATFORMS = [
    {"code": "instagram", "label": "Instagram"},
    {"code": "tiktok", "label": "TikTok"},
    {"code": "youtube", "label": "YouTube"},
    {"code": "twitter", "label": "X (Twitter)"},
    {"code": "pinterest", "label": "Pinterest"},
    {"code": "twitch", "label": "Twitch"},
    {"code": "linkedin", "label": "LinkedIn"},
    {"code": "snapchat", "label": "Snapchat"},
]

# ---------------------------------------------------------------------------
# Payment methods
# ---------------------------------------------------------------------------
PAYMENT_METHODS = [
    {"code": "iban", "label": "Virement SEPA (IBAN)"},
    {"code": "paypal", "label": "PayPal"},
    {"code": "stripe", "label": "Stripe Connect"},
]

# ---------------------------------------------------------------------------
# Languages
# ---------------------------------------------------------------------------
LANGUAGES = [
    {"code": "fr", "label": "Français"},
    {"code": "en", "label": "Anglais"},
    {"code": "es", "label": "Espagnol"},
    {"code": "de", "label": "Allemand"},
    {"code": "it", "label": "Italien"},
    {"code": "pt", "label": "Portugais"},
    {"code": "ar", "label": "Arabe"},
    {"code": "zh", "label": "Chinois"},
    {"code": "nl", "label": "Néerlandais"},
    {"code": "ja", "label": "Japonais"},
]

# ---------------------------------------------------------------------------
# Countries + cities by country (for profile forms)
# ---------------------------------------------------------------------------
COUNTRIES = [
    {"code": "FR", "label": "France", "dial_code": "+33"},
    {"code": "BE", "label": "Belgique", "dial_code": "+32"},
    {"code": "CH", "label": "Suisse", "dial_code": "+41"},
    {"code": "LU", "label": "Luxembourg", "dial_code": "+352"},
    {"code": "MC", "label": "Monaco", "dial_code": "+377"},
    {"code": "AD", "label": "Andorre", "dial_code": "+376"},
    {"code": "ES", "label": "Espagne", "dial_code": "+34"},
    {"code": "IT", "label": "Italie", "dial_code": "+39"},
    {"code": "DE", "label": "Allemagne", "dial_code": "+49"},
    {"code": "NL", "label": "Pays-Bas", "dial_code": "+31"},
    {"code": "PT", "label": "Portugal", "dial_code": "+351"},
    {"code": "GB", "label": "Royaume-Uni", "dial_code": "+44"},
    {"code": "IE", "label": "Irlande", "dial_code": "+353"},
    {"code": "US", "label": "Etats-Unis", "dial_code": "+1"},
    {"code": "CN", "label": "Chine", "dial_code": "+86"},
    {"code": "MA", "label": "Maroc", "dial_code": "+212"},
    {"code": "TN", "label": "Tunisie", "dial_code": "+216"},
    {"code": "DZ", "label": "Algérie", "dial_code": "+213"},
    {"code": "SN", "label": "Sénégal", "dial_code": "+221"},
    {"code": "CI", "label": "Côte d'Ivoire", "dial_code": "+225"},
    {"code": "CM", "label": "Cameroun", "dial_code": "+237"},
    {"code": "CD", "label": "RDC", "dial_code": "+243"},
    {"code": "CA", "label": "Canada", "dial_code": "+1"},
]

CITIES_BY_COUNTRY = {
    "FR": [
        "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier",
        "Strasbourg", "Bordeaux", "Lille", "Rennes", "Reims", "Le Havre",
        "Saint-Étienne", "Toulon", "Grenoble", "Dijon", "Angers", "Nîmes",
        "Villeurbanne", "Saint-Denis (974)", "Aix-en-Provence", "Brest", "Le Mans",
        "Amiens", "Tours", "Limoges", "Clermont-Ferrand", "Besançon", "Metz",
        "Perpignan", "Orléans", "Rouen", "Mulhouse", "Caen", "Nancy", "Avignon",
        "Saint-Denis (93)", "Argenteuil", "Montreuil",
    ],
    "BE": ["Bruxelles", "Anvers", "Liège", "Gand", "Charleroi"],
    "CH": ["Genève", "Lausanne", "Zurich", "Bâle", "Berne"],
    "LU": ["Luxembourg", "Esch-sur-Alzette", "Differdange"],
    "MC": ["Monaco"],
    "AD": ["Andorre-la-Vieille", "Escaldes-Engordany", "Encamp"],
    "ES": ["Madrid", "Barcelone", "Valence", "Séville", "Bilbao", "Malaga"],
    "IT": ["Rome", "Milan", "Turin", "Naples", "Bologne", "Florence"],
    "DE": ["Berlin", "Hambourg", "Munich", "Cologne", "Francfort", "Düsseldorf"],
    "NL": ["Amsterdam", "Rotterdam", "La Haye", "Utrecht", "Eindhoven"],
    "PT": ["Lisbonne", "Porto", "Braga", "Coimbra", "Faro"],
    "GB": ["Londres", "Manchester", "Birmingham", "Liverpool", "Leeds", "Glasgow"],
    "IE": ["Dublin", "Cork", "Galway", "Limerick", "Waterford"],
    "US": ["New York", "Los Angeles", "Miami", "Chicago", "Austin", "San Francisco"],
    "CN": ["Pékin", "Shanghai", "Shenzhen", "Guangzhou", "Chengdu", "Hangzhou"],
    "MA": ["Casablanca", "Rabat", "Marrakech", "Tanger"],
    "TN": ["Tunis", "Sfax", "Sousse"],
    "DZ": ["Alger", "Oran", "Constantine"],
    "SN": ["Dakar", "Thiès", "Saint-Louis", "Mbour"],
    "CI": ["Abidjan", "Yamoussoukro", "Bouaké", "San-Pédro"],
    "CM": ["Douala", "Yaoundé", "Bafoussam", "Garoua"],
    "CD": ["Kinshasa", "Lubumbashi", "Goma", "Bukavu"],
    "CA": ["Montréal", "Québec", "Toronto", "Vancouver"],
}

# Backward compatibility for older frontend clients expecting a flat FR city list.
CITIES_FR = CITIES_BY_COUNTRY["FR"]

# ---------------------------------------------------------------------------
# Profile completion field labels (FR) for human-friendly missing fields display
# ---------------------------------------------------------------------------
COMPLETION_LABELS_FR = {
    "avatar": "Photo de profil",
    "bio": "Biographie (≥ 10 caractères)",
    "display_name": "Pseudo / nom public",
    "location": "Ville",
    "languages": "Langues parlées",
    "content_themes": "Thématiques",
    "content_types_offered": "Types de contenu",
    "pricing": "Grille tarifaire",
    "social_networks": "Réseaux sociaux",
    "media_kit_images": "Images du kit média",
    "collaboration_pitch": "Pourquoi collaborer avec vous",
    "payment_method": "Coordonnées de paiement",
}

# ---------------------------------------------------------------------------
# Profile completion weights (must sum to 100)
# ---------------------------------------------------------------------------
INFLUENCER_COMPLETION_WEIGHTS = {
    "avatar": 8,
    "bio": 10,
    "display_name": 5,
    "location": 5,
    "languages": 5,
    "content_themes": 10,
    "content_types_offered": 8,
    "pricing": 8,
    "social_networks": 18,
    "media_kit_images": 5,
    "collaboration_pitch": 5,
    "payment_method": 13,
}

# ---------------------------------------------------------------------------
# Review criteria (multi-axis — CDC §4.6 & §5.8)
# ---------------------------------------------------------------------------
REVIEW_CRITERIA_FOR_BRAND = [
    "brief_clarity", "responsiveness", "payment_timeliness", "relationship_quality",
]
REVIEW_CRITERIA_FOR_INFLUENCER = [
    "brief_respect", "content_quality", "responsiveness", "deadline_respect", "professionalism",
]

# ---------------------------------------------------------------------------
# Image rights options (CDC §10.4)
# ---------------------------------------------------------------------------
IMAGE_RIGHT_SUPPORTS = ["social_only", "paid_ads", "tv", "outdoor", "print", "all"]
