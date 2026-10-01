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
| Build command (migration incluse, offre Free) | `npm ci --include=dev && npm run db:generate && npm run db:migrate` |
| Migration | `npm run db:migrate` (= `prisma migrate deploy`, **sans reset**), exécutée à la fin du build avec `DATABASE_URL` de l'environnement Render |
| Start command | `npm run start` (= `tsx apps/api/src/server.ts`) |
| Health check | `/api/health` (alias `/health`) |
| Région | Render **Oregon** ; Neon : AWS US West 2 (Oregon) si proposée |
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

1. Il faut à terme l'**URL publique HTTPS exacte du frontend Lovable**. Comme l'API est déployée **avant** la publication du frontend (ordre retenu), elle a besoin d'une valeur valide dès le premier démarrage. **Valeur temporaire** (saisie uniquement dans le tableau de bord Render, jamais dans le dépôt) : `https://example.com` — domaine réservé par l'IANA, que personne ne peut utiliser comme site. Effet : l'API démarre, les appels `curl` fonctionnent, mais **aucun navigateur n'est autorisé** (comportement voulu jusqu'à l'étape de configuration définitive). Aucune URL fictive n'est fournie dans ce dépôt.
2. `CORS_ORIGINS=https://<domaine-du-frontend>` — scheme + hôte (+ port), sans chemin, sans `/` final, sans `*`. Plusieurs origines : séparées par des virgules (ex. aperçu et domaine publié).
3. Pour ajouter plus tard le domaine utilisé dans Pi Browser : ajoutez-le à la liste, puis redéployez manuellement (la variable est lue au démarrage).

## 5. Migrations (décision : option B, dans le build Render)

La base reçoit **uniquement** `npm run db:migrate`. La commande de pré-déploiement de Render est réservée aux offres payantes ([source](https://render.com/docs/blueprint-spec)) : sur l'offre Free, la migration est donc la dernière étape de la **build command** (déjà dans `render.yaml`) :

```
npm ci --include=dev && npm run db:generate && npm run db:migrate
```

- Elle lit `DATABASE_URL` dans l'environnement du service Render (la même variable que l'API).
- `migrate deploy` n'applique que les migrations en attente : idempotent, aucun reset, aucune suppression.
- Si la migration échoue, le **build échoue** et la version précédente (s'il y en a une) continue de servir ; les logs de build donnent l'erreur Prisma.
- À chaque déploiement manuel, la base est donc contactée (Neon se réveille ; `connect_timeout=15` lui laisse le temps).
- Premier déploiement : le build crée le schéma dans la base **vide** (une migration `20260929000000_init`).

Jamais, sur cette base : `npm run db:seed`, `npm run db:reset`, `prisma migrate reset`. Le seed et `db:reset` refusent d'ailleurs par défaut toute base non locale (garde `SEED_ALLOW_REMOTE_DATABASE`, voir `docs/database/README.md`) ; `prisma migrate reset` lancé directement n'est **pas** couvert par ce garde. Aucune donnée `[DEMO]` n'est chargée : l'API répondra avec des listes vides (décision 1A : valider d'abord la plomberie).

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

## 10. Décisions prises et points restants

**Décidé :** (1) base vide, aucun seed ; (2) migration dans la build command (option B) ; (3) `main` est la branche de déploiement ; (4) ordre : PostgreSQL → API → migration → health check → vérification publique → publication Lovable → `CORS_ORIGINS` définitif → connexion Lovable → tests de bout en bout ; (5) Render **Oregon**, Neon la région la plus proche d'Oregon.

**Restent à votre main :**
1. **Carte bancaire :** si Render ou Neon demande une carte ou une activation payante : **arrêt immédiat**, ne rien saisir, noter l'écran qui bloque.
2. **Valeur initiale de `CORS_ORIGINS`** : `https://example.com` (temporaire, §4), à remplacer par l'URL Lovable réelle à l'étape 8, suivie d'un déploiement manuel.
3. **À confirmer dans l'interface Render** (non vérifié hors ligne) : `NODE_VERSION=22` et `generateValue`.
4. **Prisma / pooler :** une chaîne directe est utilisée partout ; `directUrl` (schéma Prisma) reporté.

## Limites connues de l'offre gratuite

- Render Free : mise en veille après 15 min sans trafic, redémarrage d'environ 1 min.
- Neon Free : veille à 5 min d'inactivité, 0,5 Go, 100 h de calcul par mois.
- Une seule instance : le rate limiting en mémoire suffit ; au-delà, Redis deviendra nécessaire.
- Les vérifications faites en préparation : `migrate deploy` seul sur une base vide, puis démarrage en `NODE_ENV=production` avec `PORT=10000` : `/api/health`, `/health`, listes vides, 404 propre, OpenAPI. Les tests : voir le rapport de la phase 5A.
