# Déploiement bêta (lecture seule) — guide pas à pas

> **Statut : préparation uniquement.** Rien n'est déployé, aucun compte n'est créé par ce dépôt. Ce guide décrit ce que **vous** ferez, étape par étape, lorsque vous donnerez le feu vert. Le déploiement est un produit **TEST / BÊTA** : il n'est ni approuvé ni validé par la Pi Core Team.

Architecture provisoire (portable : tout se fait par variables d'environnement) :

```
Pi Browser → Frontend Lovable (HTTPS) → API Render (HTTPS) → PostgreSQL Neon
```

Fichiers de référence : [`render.yaml`](../../render.yaml) (Blueprint), [`.env.example`](../../.env.example) (variables), [`docs/api/FRONTEND_CONTRACT.md`](../api/FRONTEND_CONTRACT.md) (contrat Lovable).

## 0. Configuration finale (résumé)

| Élément | Valeur |
|---|---|
| Node | ≥ 20 (testé en 22) — `NODE_VERSION=22` dans le Blueprint |
| Build command | `npm ci --include=dev && npm run db:generate` |
| Migration | `npm run db:migrate` (= `prisma migrate deploy`, **sans reset**) |
| Start command | `npm run start` (= `tsx apps/api/src/server.ts`) |
| Health check | `/api/health` (alias `/health`) |
| Port | fourni par l'hébergeur via `PORT` (lu par le code, ne pas le définir) |

`--include=dev` est indispensable : `tsx` (exécution du TypeScript) et `prisma` sont des devDependencies, et `NODE_ENV=production` les omettrait sinon. Il n'y a **pas de script `build`** (aucune compilation).

### Variables d'environnement à renseigner

| Variable | Où | Obligatoire | Valeur |
|---|---|---|---|
| `NODE_ENV` | Blueprint | oui | `production` |
| `DATABASE_URL` | saisie manuelle (secret) | oui | chaîne PostgreSQL **directe** Neon + `?sslmode=require&connect_timeout=15` |
| `JWT_SECRET` | généré par Render (`generateValue`) | oui | ≥ 32 caractères, serveur uniquement |
| `CORS_ORIGINS` | saisie manuelle | **oui en production** | origine HTTPS exacte du frontend (liste séparée par des virgules) |

Rien d'autre n'est nécessaire (pas de `API_BASE_URL`, `FRONTEND_URL`, Redis, `PORT`). Les autres variables du code ont des valeurs par défaut (`LOG_LEVEL`, `RATE_LIMIT_*`, `JWT_ISSUER`).

L'API **refuse de démarrer** en production si : `CORS_ORIGINS` est absent, contient `*`, une origine non `https`, `localhost`, ou une origine avec chemin / `/` final ; ou si `JWT_SECRET` contient encore le texte d'exemple `change-me…`. Le message de l'erreur dans les logs dit exactement quoi corriger.

## 1. Créer la base PostgreSQL (Neon)

1. Créez un compte Neon (offre Free ; d'après la documentation Neon, aucune carte bancaire n'est requise — à confirmer à l'inscription).
2. Créez un projet : nom libre, version PostgreSQL ≥ 15 (le projet est testé en 16), **région proche de celle du service Render** (même continent, pour limiter la latence).
3. Notez les limites de l'offre gratuite ([Neon plans](https://neon.com/docs/introduction/plans)) : 0,5 Go de stockage par projet, 100 heures de calcul par mois, et mise en veille automatique après 5 minutes d'inactivité (non désactivable).

## 2. Récupérer `DATABASE_URL`

1. Dans Neon : **Connect** → choisissez la base et le rôle → **désactivez « Connection pooling »** pour obtenir la chaîne **directe** (le nom d'hôte ne contient pas `-pooler`).
   D'après la documentation Neon/Prisma (consultée via une recherche web ; page non ouverte directement, à confirmer), Prisma Migrate ne fonctionne pas via le pooler PgBouncer de Neon. Pour la bêta, la même chaîne directe sert à l'API et aux migrations (une seule instance : la limite de connexions n'est pas un problème).
2. Format attendu :
   `postgresql://<user>:<password>@<host>/<database>?sslmode=require&connect_timeout=15`
   `connect_timeout=15` laisse le temps à Neon de se réveiller après une mise en veille.
3. **Ne collez jamais cette chaîne dans le dépôt, un ticket, ni une conversation.** Elle ne va que dans le tableau de bord de l'hébergeur (champ secret) ou dans votre terminal.

## 3. Créer `JWT_SECRET`

- Par défaut, le Blueprint demande à Render de le **générer** (`generateValue: true`) : rien à faire.
- Sinon, manuellement : `openssl rand -base64 48`. Ne le réutilisez nulle part ailleurs et ne l'exposez jamais au frontend.
- Changer cette valeur invalide les jetons déjà émis (sans effet aujourd'hui : aucun endpoint public n'en émet).

## 4. Configurer CORS

1. Il faut l'**URL publique HTTPS exacte du frontend Lovable** (publiez d'abord le frontend, même avec ses données fictives, pour la connaître). Aucune URL fictive n'est fournie dans ce dépôt.
2. `CORS_ORIGINS=https://<domaine-du-frontend>` — scheme + hôte (+ port), sans chemin, sans `/` final, sans `*`. Plusieurs origines : séparées par des virgules (ex. aperçu et domaine publié).
3. Pour ajouter plus tard le domaine utilisé dans Pi Browser : ajoutez-le à la liste, puis redéployez manuellement (la variable est lue au démarrage).

## 5. Appliquer les migrations (jamais de seed, jamais de reset)

La base reçoit **uniquement** `npm run db:migrate`. L'option « pre-deploy command » de Render est réservée aux offres payantes ([source](https://render.com/docs/blueprint-spec)), donc elle n'est pas utilisée. **Choisissez une des options (point à décider, voir §10) :**

- **Option A — depuis votre poste** (recommandée si vous avez un terminal) :
  ```bash
  git clone <repo> && cd <repo> && git checkout <branche>
  npm ci --include=dev
  DATABASE_URL='<chaîne directe Neon>' npm run db:migrate
  ```
  Résultat attendu : `All migrations have been successfully applied.`
- **Option B — dans le build Render** : remplacer la build command par
  `npm ci --include=dev && npm run db:generate && npm run db:migrate`.
  Idempotent (`migrate deploy` n'applique que les migrations en attente) et sans reset ; en contrepartie, chaque déploiement touche la base, et un échec de migration fait échouer le build (l'ancienne version reste en ligne). Cela s'écarte de la build command demandée : à valider.
- **Option C — depuis une session Claude Code** : possible, mais il faudrait me transmettre `DATABASE_URL` (un secret). À éviter ; si vous le faites, changez le mot de passe Neon ensuite.

Jamais, sur cette base : `npm run db:seed`, `npm run db:reset`, `prisma migrate reset`.

## 6. Créer le Web Service (Blueprint Render)

1. Créez un compte Render. L'offre Free est décrite ici : [Deploy for Free](https://render.com/docs/free). **Si Render demande une carte bancaire à un moment, arrêtez-vous et ne la saisissez pas sans décision explicite.**
2. Le Blueprint est lu depuis une branche : **`main` ne contient actuellement pas le backend** (voir §10). Il faut d'abord fusionner la branche de travail dans `main`, ou pointer Render sur cette branche.
3. Render → **New → Blueprint** → choisissez le dépôt et la branche → Render lit `render.yaml`.
4. Il vous demande les valeurs `sync: false` : collez `DATABASE_URL` et `CORS_ORIGINS`. `JWT_SECRET` est généré, `NODE_ENV` est déjà fixé.
5. Vérifiez à l'écran : plan **Free**, aucun coût affiché, build command et start command conformes au §0. Choisissez la région (la même zone que Neon).
6. Lancez le premier déploiement (`autoDeploy: false` : les déploiements suivants sont manuels, via **Manual Deploy**).

## 7. Vérifier `/api/health` et le reste

Remplacez `<service>` par l'URL fournie par Render (`https://….onrender.com`). **Après 15 minutes sans trafic, un service gratuit s'endort ; le premier appel peut prendre environ une minute** ([source](https://render.com/docs/free)). Neon peut aussi se réveiller (quelques secondes).

```bash
curl -s https://<service>/api/health          # {"data":{"status":"ok","database":true},"meta":{}}
curl -s https://<service>/health              # même réponse (alias)
curl -s "https://<service>/api/apps?limit=1"  # 200 (liste vide tant que la base ne contient pas de données)
curl -s https://<service>/api/openapi.json | head -c 200
# CORS : l'origine autorisée doit être renvoyée, une autre non
curl -s -D - -o /dev/null https://<service>/api/apps -H 'Origin: https://<domaine-du-frontend>' | grep -i access-control-allow-origin
```

`"database": false` signifie que l'API répond mais ne joint pas la base (vérifiez `DATABASE_URL`, `sslmode`, réveil de Neon). Un 200 « degraded » ne déclenche pas de redémarrage : le health check sert à la disponibilité du processus.

## 8. Brancher le frontend (plus tard, hors de cette phase)

Dans Lovable : `VITE_API_BASE_URL=https://<service>/api` (voir [FRONTEND_CONTRACT.md](../api/FRONTEND_CONTRACT.md)). Prévoir côté interface un état de chargement et un nouvel essai pour le premier appel après mise en veille.

## 9. Procédure de retour arrière

| Situation | Action |
|---|---|
| Un déploiement casse l'API | Render → service → **Events / Deploys** → choisissez le dernier déploiement sain → **Rollback** (ou **Manual Deploy** sur un commit précédent). `autoDeploy: false` évite qu'un push redéploie sans votre ordre. |
| L'API ne démarre pas (config) | Lisez les logs : l'erreur de validation nomme la variable fautive (`CORS_ORIGINS`, `JWT_SECRET`, `DATABASE_URL`). Corrigez la variable → redéployez. En principe, l'ancienne version reste servie tant que le nouveau déploiement n'a pas passé le health check (à vérifier sur votre service). |
| Mauvais `CORS_ORIGINS` (le navigateur bloque) | Corrigez la variable (origine exacte, https, sans `/` final) → déploiement manuel. |
| Une migration pose problème | Les migrations sont **en avant seulement** (pas de « down »). **Avant** toute nouvelle migration sur une base contenant des données : créez une **branche Neon** (copie instantanée, offre Free : 10 branches par projet), puis appliquez la migration. En cas d'échec : pointez `DATABASE_URL` sur la branche saine (ou restaurez-la) et faites un rollback applicatif. Sur la toute première migration (base vide) : supprimez et recréez le projet Neon. |
| Arrêt d'urgence | Render → service → **Suspend**. Le frontend affichera des erreurs réseau (il doit les gérer). |
| Secret exposé | Neon : réinitialisez le mot de passe du rôle → mettez à jour `DATABASE_URL` → redéployez. `JWT_SECRET` : régénérez la variable → redéployez. |

Interdits permanents sur la base bêta/production : `db:seed`, `db:reset`, `prisma migrate reset`.

## 10. Points à décider avant le feu vert

1. **Base vide.** Avec uniquement `db:migrate`, l'API répond mais sans données : catégories, apps et classements sont vides (testé : listes vides, `computedAt: null`). Le seed contient des données **fictives** (`[DEMO]`) et est bloqué en production par défaut. Options : **(a)** déployer vide pour valider la plomberie (recommandé pour un premier essai) ; **(b)** peupler une base de **bêta** avec les données de démonstration, clairement étiquetées (`containsDemoData`) — cela contredit la règle « pas de seed en production » et suppose votre accord explicite ; **(c)** attendre le vrai data engine (phase 9).
2. **Migration :** option A, B ou C (§5).
3. **Branche du Blueprint :** `main` n'a que l'upload initial ; le backend est sur `claude/gifted-thompson-87ag3n`. Fusion dans `main` (via une pull request, que je ne crée que si vous le demandez) ou choix de la branche dans Render.
4. **Ordre :** publier le frontend Lovable d'abord (pour connaître l'URL → `CORS_ORIGINS`), puis déployer l'API.
5. **Région** Render/Neon (latence entre les deux).
6. **Carte bancaire :** à l'inscription Render, vérifier si un moyen de paiement est exigé pour l'offre Free ; sinon, choisir une autre plateforme ou valider explicitement.
7. **À confirmer dans l'interface Render** (non vérifié hors ligne, la documentation Render n'étant pas accessible depuis l'environnement de préparation) : la prise en compte de `NODE_VERSION=22` et `generateValue`. Render valide le Blueprint à sa création et signale toute erreur de syntaxe.
8. **Prisma / pooler :** une chaîne directe est utilisée partout. Séparer connexion poolée (runtime) et directe (migrations) via `directUrl` exigerait de modifier le schéma Prisma : report à plus tard.

## Limites connues de l'offre gratuite

- Render Free : mise en veille après 15 min sans trafic, redémarrage d'environ 1 min.
- Neon Free : veille à 5 min d'inactivité, 0,5 Go, 100 h de calcul par mois.
- Une seule instance : le rate limiting en mémoire suffit ; au-delà, Redis deviendra nécessaire.
- Les vérifications faites en préparation : `migrate deploy` seul sur une base vide, puis démarrage en `NODE_ENV=production` avec `PORT=10000` : `/api/health`, `/health`, listes vides, 404 propre, OpenAPI. Les tests : voir le rapport de la phase 5A.
