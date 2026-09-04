# Mise en production — procédure sûre

Objectif : déployer sans rien casser, et pouvoir revenir en arrière en quelques
minutes si ça tourne mal.

Trois choses rendent ce déploiement plus risqué qu'un déploiement habituel :

1. **13 migrations** non déployées (0034 → 0046), dont **3 migrations de données**
   qui modifient des lignes existantes.
2. **Deux d'entre elles sont irréversibles** (0044 et 0046) : leur fonction de
   retour arrière est volontairement vide, car l'information d'origine est perdue.
3. **Un nouveau service** (`scheduler`) s'ajoute au `docker-compose.prod.yml`.

---

## 1. Sauvegarder (non négociable)

Avant tout, sur le serveur :

```bash
cd /chemin/vers/InfluConnect

# Dump de la base, horodaté
docker compose -p InfluConnect -f docker-compose.prod.yml exec -T db \
    pg_dump -U influconnect influconnect | gzip > ~/backup-influconnect-$(date +%F-%H%M).sql.gz

# Vérifier que le fichier n'est pas vide
ls -lh ~/backup-influconnect-*.sql.gz
```

Notez aussi le commit actuellement déployé, c'est votre point de retour :

```bash
git rev-parse --short HEAD    # notez cette valeur, ex. 076f23a
```

---

## 2. Vérifier ce qui va être migré

Toujours sur le serveur, **avant** de déployer :

```bash
docker compose -p InfluConnect -f docker-compose.prod.yml exec -T backend \
    python manage.py showmigrations api | tail -20
```

Vous devez voir des `[ ]` en attente. Comptez-les : ce sont celles qui vont
s'appliquer.

Puis regardez combien de comptes sont concernés par les migrations de données :

```bash
docker compose -p InfluConnect -f docker-compose.prod.yml exec -T backend \
    python manage.py shell -c "
from api.models import User, BrandProfile
print('utilisateurs :', User.objects.count())
print('  en anglais :', User.objects.filter(language_preference='en').count())
print('marques      :', BrandProfile.objects.count())
"
```

Retenez ces chiffres, ils servent au contrôle d'après-déploiement.

---

## 3. Ce que font les migrations de données

| Migration | Effet sur les données existantes | Réversible |
|---|---|---|
| `0044_existing_users_french` | Tous les comptes `language_preference='en'` passent à `'fr'` | **Non** |
| `0046_verify_existing_accounts` | Tous les comptes existants sont marqués `email_verified=True` | **Non** |
| `0036_user_auth_version` | Ajoute un compteur à 0 (déconnecte personne) | Oui |

Pourquoi c'est acceptable : personne n'avait pu **choisir** l'anglais (l'API
d'inscription n'exposait pas le champ), et marquer les comptes existants comme
vérifiés évite de bloquer rétroactivement des utilisateurs actifs. Mais si vous
revenez en arrière sur le code, **ces deux changements resteront** — d'où le dump.

---

## 4. Déployer

```bash
git pull origin main

docker compose -p InfluConnect -f docker-compose.prod.yml --env-file .env.prod \
    up -d --build
```

Le service `backend` lance `migrate --noinput` au démarrage : les migrations
partent toutes seules. Suivez-les en direct :

```bash
docker compose -p InfluConnect -f docker-compose.prod.yml logs -f backend
```

Attendez de voir `Applying api.0046_verify_existing_accounts... OK` puis le
démarrage de gunicorn.

---

## 5. Contrôler que tout va bien

```bash
# a) Tous les conteneurs tournent, scheduler compris
docker compose -p InfluConnect -f docker-compose.prod.yml ps

# b) Plus aucune migration en attente
docker compose -p InfluConnect -f docker-compose.prod.yml exec -T backend \
    python manage.py showmigrations api | grep -c "\[ \]"     # doit afficher 0

# c) Les données ont bien basculé
docker compose -p InfluConnect -f docker-compose.prod.yml exec -T backend \
    python manage.py shell -c "
from api.models import User
print('en français :', User.objects.filter(language_preference='fr').count())
print('email vérifié :', User.objects.filter(email_verified=True).count())
"

# d) Le scheduler est vivant (nouveau service)
docker compose -p InfluConnect -f docker-compose.prod.yml logs scheduler | tail -5
# attendu : "Scheduler started (tick=300s, stats at 04h local)."
```

Puis, dans un navigateur, les quatre parcours qui ont le plus changé :

- **Inscription** d'une marque de test → doit finir en succès, pas en 500
- **Marketplace** → des influenceurs doivent s'afficher
- **Profil marque** → l'autocomplétion d'adresse doit proposer des résultats
- **Email de confirmation** → doit arriver, en français, avec un bandeau bleu
  (pas blanc)

---

## 6. Si ça casse — retour arrière

**Cas 1 : le code pose problème, la base est saine.** Le plus fréquent.

```bash
git checkout <commit-noté-à-l-étape-1>
docker compose -p InfluConnect -f docker-compose.prod.yml --env-file .env.prod \
    up -d --build
```

Attention : les colonnes ajoutées restent en base. Ce n'est pas un problème,
l'ancien code les ignore.

**Cas 2 : la base est corrompue.** Restauration complète du dump :

```bash
docker compose -p InfluConnect -f docker-compose.prod.yml stop backend scheduler frontend

gunzip -c ~/backup-influconnect-AAAA-MM-JJ-HHMM.sql.gz | \
docker compose -p InfluConnect -f docker-compose.prod.yml exec -T db \
    psql -U influconnect -d influconnect

git checkout <commit-noté-à-l-étape-1>
docker compose -p InfluConnect -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

---

## 7. Points d'attention après déploiement

**Accès réseau sortant.** L'autocomplétion d'adresse appelle deux services
externes depuis le backend :

- `https://api-adresse.data.gouv.fr` (France)
- `https://photon.komoot.io` (international)

Si votre pare-feu bloque le trafic sortant, l'autocomplétion ne renverra rien.
Ce n'est **pas bloquant** : le champ reste saisissable à la main, et l'API
répond `200` avec une liste vide. À tester :

```bash
docker compose -p InfluConnect -f docker-compose.prod.yml exec -T backend \
    python manage.py shell -c "
from api.services import address_lookup
print(len(address_lookup.search('3 rue de la paix', 'FR')), 'résultats')
"
```

**Envoi d'emails.** La confirmation d'adresse part maintenant à chaque
inscription. Si le SMTP est mal configuré, l'inscription fonctionne quand même
(l'envoi est encapsulé), mais personne ne pourra confirmer son adresse — donc
aucune marque ne pourra soumettre son dossier et aucun influenceur n'apparaîtra
en marketplace. **Vérifiez que les emails partent** avant d'ouvrir aux
utilisateurs.

**La visite guidée repasse en `v4`** : elle se rejouera une fois pour tous les
utilisateurs existants. C'est voulu (les étapes ont changé), mais attendez-vous
à la question.

---

## 8. Recommandation

Ce lot est gros (113 fichiers, 13 migrations). Si vous pouvez, déployez d'abord
sur un environnement de préproduction avec une **copie du dump de production** —
c'est le seul moyen de voir comment les migrations de données se comportent sur
vos vraies lignes avant de toucher la prod.

À défaut, déployez à une heure creuse, avec le dump sous la main et les logs
ouverts.
