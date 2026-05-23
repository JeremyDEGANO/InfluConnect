# Feature Backlog Prioritized (Market Benchmark)

Date: 2026-05-13
Scope: InfluConnect roadmap vs market expectations (brands/agencies/influencers)

Scoring scale:
- 10 = Critique (revenue/conversion or trust blocker)
- 7-9 = Important (strong impact, near-term)
- 4-6 = Nice to have (differentiation/comfort)

## Prioritized Features

| Feature | Score | Why | For who | How (MVP) |
|---|---:|---|---|---|
| Marketplace de campagnes ouvertes | 10 | Accelere matching et activation influenceurs | Marques, Influenceurs | Campagnes publiques + candidature + tri/scoring |
| Base de profils large (progressive) | 9 | Effet catalogue immediate pour les marques | Marques, Agences | Connecteurs API autorises + enrichissement progressif |
| Detection fake followers | 9 | Repond a l'objection #1 des marques | Marques, Agences | Score fiabilite audience par profil + alertes |
| Brand Safety | 8.5 | Reduit risque reputationnel | Marques, Agences | Regles de risque + alertes avant collaboration |
| Lookalike influencers | 8 | Gain de temps important | Marques, Agences | Bouton profil similaire (niche/audience/perf) |
| Historique partenariats influenceur | 8 | Evite conflits d'interet | Marques, Agences | Timeline collaborations + tags concurrence |
| IA assistant "Buddy" | 8 | Aide decision, accelere ops | Marques, Agences, CSM | Copilot: shortlist, resume, recommandation budget |
| Module UGC | 8 | Segment en forte croissance | Marques, Agences | Type campagne UGC + droits d'usage |
| Paiement carte cadeau Amazon | 7.5 | Elargit base createurs | Influenceurs, Marques | Wallet + mode payout gift card |
| Inscription sans micro-entreprise | 7.5 | Frein onboarding influenceur leve | Influenceurs | Systeme points/credits puis conversion payout |
| Onboarding humain expert | 7.5 | Ameliore conversion comptes premium | Marques, Agences | Playbook CSM + call onboarding |
| App mobile native (ou PWA d'abord) | 7 | Usage mobile-first createurs | Influenceurs | PWA + push, puis React Native |
| Extension Chrome/Firefox | 6.5 | UX prospection tres appreciee | Marques, Agences | Overlay stats + import profil |
| EMV automatique | 6.5 | KPI marketing demande | Marques, Agences | Calcul EMV standardise + transparence hypotheses |
| Mur Ambassadeurs | 6.5 | Fidelisation / LTV | Marques | Espace ambassadeurs + missions recurrentes |
| Programmation de contenus | 6 | Execution plus fluide | Marques, Agences, Influenceurs | Calendrier partage + deadlines + relances |
| Position concurrentielle | 5.5 | Insight utile mais data-heavy | Marques, Agences | Benchmarks secteur anonymises |
| Export Google Slides | 5.5 | Confort reporting agence | Agences, Marques | Export template Slides API |
| Reporting video auto | 4.5 | Differenciation marketing | Agences, CSM | Recap video KPI/creas auto |
| Module avis consommateurs | 4.5 | Adjacent utile | Marques | Workflow review avec moderation |
| Couverture 61 pays / multilanguage | 4 | Important plus tard | Enterprise | FR/EN d'abord, expansion par vagues |
| Webinars & formation continue | 7 | SEO + autorite + activation | Tous | Calendrier webinars + contenus experts |
| Track record campagnes (preuve sociale) | 9 (quand prouve) | Levier confiance majeur | Marques, Agences | Case studies chiffres + logos clients |
| Label type LUMICC | 6 | Credibilite grand compte | Grandes marques | Charte + audit + communication compliance |

## Recommended Delivery Waves

### Wave 1 (0-3 months)
- Marketplace ouverte
- Fake followers
- Brand safety
- Lookalike
- Historique partenariats
- Pricing/packaging clair marques/agences

### Wave 2 (3-6 months)
- IA Buddy v1
- Module UGC
- Onboarding humain
- Mobile PWA + push
- Payouts etendus (incl. gift card si legal/compliance valide)

### Wave 3 (6-12 months)
- Extension navigateur
- EMV avance
- Export Slides
- Mur Ambassadeurs
- Benchmarks concurrence

## Notes & Guardrails
- Eviter tout scraping non conforme; privilegier API officielles et sources autorisees.
- Verifier les impacts legaux (RGPD, droit du travail/fiscalite, payouts).
- Lier chaque feature a des KPI (conversion, activation, retention, ARPA, CAC payback).




Plateforme 1 — Instagram (Meta) — le plus important et le plus difficileC'est la plateforme la plus complexe à intégrer mais la plus stratégique (60-70 % des partenariats influence en France).Ce dont tu as besoin :D'abord, créer un compte Meta for Developers (developers.facebook.com) et créer une "App" de type "Business". Ensuite, il faut comprendre qu'Instagram propose deux APIs distinctes depuis 2024 :
Instagram Graph API (l'historique, recommandée pour business) — fonctionne uniquement avec des comptes "Creator" ou "Business" liés à une Page Facebook
Instagram API with Instagram Login (nouvelle API 2024) — fonctionne avec n'importe quel compte Creator OU Business, sans nécessiter de Page Facebook
Pour InfluConnect, prends la deuxième : elle simplifie énormément le parcours influenceur (la plupart des créateurs n'ont pas de Page Facebook associée).Permissions à demander (scopes) :

instagram_business_basic — profil et métadonnées
instagram_business_manage_insights — stats détaillées (impressions, reach, engagement)
instagram_business_content_publish — facultatif, pour publier au nom de l'influenceur
Ce que tu récupères :

Nombre de followers, suivi, posts
Stats par post : likes, commentaires, partages, sauvegardes, reach, impressions
Stats compte : impressions cumulées, profile views, website clicks
Démographie audience : âge, sexe, pays, villes (uniquement si >100 followers)
Top stories : vues, exits, taps forward/back
Limites importantes :

200 appels par utilisateur par heure
Token longue durée : 60 jours, renouvelable
Insights audience uniquement si compte Business/Creator avec >100 followers
L'app doit passer une App Review Meta qui prend 2 à 6 semaines pour les permissions sensibles
Coût : 0 € — gratuit, mais comptez 3-5 jours de dev pour le flow complet + démarche review longue.Plateforme 2 — TikTok — moyennement difficileTikTok a fortement amélioré ses APIs en 2024-2025 et c'est devenu beaucoup plus accessible.Ce dont tu as besoin :Créer un compte sur developers.tiktok.com et créer une "App". Tu as ensuite deux APIs principales à utiliser :
Login Kit — pour l'OAuth et l'identité
Display API — pour récupérer les vidéos publiques
Research API — pour les stats avancées (nécessite approbation)
Permissions à demander :

user.info.basic — profil de base
user.info.profile — bio, avatar, follower count
user.info.stats — stats du compte (follower count, video count, likes count)
video.list — liste des vidéos publiées
video.insights — stats par vidéo (uniquement avec Research API)
Ce que tu récupères via Display API (standard) :

Followers, following, likes totaux
Liste des vidéos avec : view count, like count, comment count, share count
Cover image, durée, caption
Ce que tu récupères via Research API (avancé) :

Métriques d'engagement détaillées par vidéo
Démographie audience (avec approbation)
Performances historiques
Limites :

100 requêtes/min en standard, 1 000/min en Business
Token : 24h, refresh token valide 1 an
L'accès à la Research API nécessite une justification d'usage et peut prendre 4-8 semaines d'approbation
Coût : 0 € — gratuit. Comptez 3-4 jours de dev.Plateforme 3 — YouTube — le plus simpleYouTube est le plus mature et le plus stable des trois — Google l'a depuis 2007.Ce dont tu as besoin :Créer un projet sur Google Cloud Console, activer la YouTube Data API v3, et configurer OAuth 2.0. C'est documenté de manière exemplaire.Permissions à demander :

https://www.googleapis.com/auth/youtube.readonly — lecture du compte et des vidéos
https://www.googleapis.com/auth/yt-analytics.readonly — accès aux analytics
Ce que tu récupères :

Channel stats : subscriber count, view count, video count, hidden subscriber count
Liste des vidéos avec : view count, like count, comment count, duration, published date
Analytics détaillés : views per day, retention, demographics audience (âge, sexe, pays)
Sources de trafic, mots-clés de recherche
Watch time, retention curves
Limites :

Quota par défaut : 10 000 unités/jour (chaque endpoint coûte 1-100 unités)
Augmentable sur demande (justifiée) jusqu'à 1M+ unités
Token : 1h, refresh token persistant
Coût : 0 € — totalement gratuit. Comptez 2-3 jours de dev. Commence par YouTube car c'est le plus simple et tu apprends les principes d'OAuth.




Analyse influenceurs (stats ....)