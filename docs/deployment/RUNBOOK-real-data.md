# Runbook — mise en service contrôlée des données réelles (Neon + Render Free)

> **Statut : procédure à n'exécuter qu'après approbation explicite.** Ce document ne déclenche rien par lui-même. Commit applicatif de référence : `c325734` (branche `main`). Produit en **TEST / BÊTA** : ni approuvé ni validé par la Pi Core Team.

Complète [`README.md`](README.md) (déploiement) et [`../real-data/README.md`](../real-data/README.md) (outils d'amorçage et d'import). En cas de contradiction, **ce runbook prime** pour la mise en service.

## 0. Décisions retenues

| Sujet | Décision |
|---|---|
| Base | PostgreSQL managé **Neon**, API **Render Free** (région Oregon), branche de déploiement `main` |
| Premier administrateur | **Créé plus tard**, après l'implémentation de l'authentification Pi. **Ce runbook ne le crée pas.** |
| Catalogue | **Réel uniquement.** Aucun catalogue fictif, aucun seed `[DEMO]`. |
| Publication | Une application n'est publiée qu'**après vérification humaine** de ses informations (étape 8). |
| Métriques | Aucune donnée brute n'est créée : métriques **nulles ou absentes** (`null`), **jamais remplacées par zéro**. |
| Mot de passe Neon | **Rotation avant toute écriture distante** (étape 2). |
| Migration | Dans la build command Render (offre Free : pas de pré-déploiement), commande `npm run db:migrate`, **additive**. |

## 1. Opérations INTERDITES sans approbation explicite

Chaque point ci-dessous exige que vous écriviez, dans la conversation, une approbation nommant l'opération et la cible. Une approbation donnée pour une étape ne vaut pas pour une autre.

1. Tout `db:seed`, `db:reset`, `prisma migrate reset`, ou `prisma migrate resolve` / `prisma db push` / `prisma migrate dev`, **quelle que soit la base**.
2. Toute écriture dans Neon hors de ce runbook : `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER` saisis dans le SQL Editor (sauf le retour arrière documenté en §11, avec approbation).
3. `db:bootstrap` avec `--admin-pi-username` ou `--confirm-admin` (création d'un administrateur) : **reporté après l'authentification Pi**.
4. `catalogue:import --apply` sans simulation préalable, sans fiche de vérification signée selon `FICHE-VERIFICATION.md` (§8.2), sans approbation d'import distincte (§8.4) ou avec un fichier non relu.
5. Tout import d'un catalogue fictif ou non sourcé ; toute valeur chiffrée (métriques, scores, transactions, staking) saisie à la main dans la base.
6. Les workers (`worker:metrics`, `worker:rankings`, `worker:anomalies`, `worker:blockchain-sync`, `pipeline`) sur la base distante.
7. `--allow-demo-data-present` sur une base distante, ou toute option de contournement d'un garde.
8. Modifier `render.yaml`, une variable d'environnement Render, ou déclencher un déploiement en dehors de l'étape où le runbook le prévoit.
9. Coller `DATABASE_URL`, un mot de passe ou un jeton dans le dépôt, un ticket, un fichier ou la conversation.
10. Fusionner dans `main`, créer ou supprimer une branche Neon autre que celle de l'étape 3, supprimer un service Render, créer un abonnement payant ou saisir une carte bancaire.

**Règle d'arrêt :** à la moindre différence entre le résultat attendu et le résultat obtenu, **ne continuez pas** : notez-le dans le journal (§3) et revenez me voir.

## 2. Compatibilité Windows : Git Bash ou WSL (pas PowerShell, pas cmd)

Toutes les commandes sont du **bash** et n'utilisent que `git`, `node`, `npm`, `curl`, `tr`, `grep` et `sed`, présents dans Git Bash comme dans WSL. Aucune ne dépend de `psql`, `jq`, `python`, `openssl`, `shred` ou `pgrep` (qui manquent sur Windows). Les contrôles de base passent par le **SQL Editor de Neon**, pas par un client local.

| Point | Consigne |
|---|---|
| Interpréteur | Ouvrir **Git Bash** ou un terminal **WSL** (Ubuntu). **Ne pas** utiliser PowerShell ni cmd (la syntaxe `VAR=valeur commande` n'y existe pas). |
| Un seul environnement | Cloner, installer (`npm ci`) et exécuter **dans le même** : Git Bash **ou** WSL. Ne pas mélanger (binaires natifs différents). Sous WSL, cloner dans `~/` (système de fichiers Linux), pas sous `/mnt/c`. |
| Fins de ligne | Avant le clonage : `git config --global core.autocrlf input`. Les fichiers doivent rester en LF (les migrations Prisma sont comparées à leur somme de contrôle). |
| Node | **Node 22** (≥ 20) installé dans l'environnement choisi : `node -v`. |
| Saisie du secret | `read -rs` n'affiche rien : c'est normal. Coller avec **Maj+Inser** (le Ctrl+V ne colle pas toujours dans Git Bash), ou clic droit → Coller, puis Entrée. |
| Chemins | Utiliser des chemins **relatifs** dans le dossier du dépôt (`./catalogue.real.json`). Éviter un argument commençant par `/` (Git Bash le convertit en chemin Windows). |
| Guillemets | Les extraits `node -e '…'` sont entourés de **guillemets simples** : ne pas les remplacer par des doubles. |
| `curl` | Mettre les URL entre guillemets doubles (elles contiennent `?` et `&`). |
| Variables | Elles ne vivent que dans la fenêtre de terminal courante. **Fermer le terminal** à la fin : `unset` n'est qu'une seconde sécurité. |

## 3. Prérequis (Go / No-Go) et journal de bord

**Aucune écriture tant que toutes les cases ne sont pas cochées.**

- [ ] Vous avez accès au **tableau de bord Neon** et au **tableau de bord Render** avec votre compte.
- [ ] Vous disposez d'un poste avec Git Bash ou WSL, Git, Node 22, et un accès réseau à Neon (§2).
- [ ] Vous avez lu §1 (opérations interdites) et §11 (retours arrière).
- [ ] Vous avez **un créneau sans utilisateur** : le frontend n'est pas encore connecté, et l'API sera brièvement dégradée à l'étape 2.
- [ ] Le **catalogue réel** n'est requis qu'à l'étape 8 : les étapes 1 à 7 peuvent être faites sans lui (catégories seulement).

Tenez un journal (fichier hors dépôt, **sans aucun secret**). Gabarit :

```
Date/heure (UTC) | Étape | Action | Résultat attendu | Résultat obtenu | OK ?
```

## Étape 1 — Identifier la base Neon sans ambiguïté (lecture seule)

Risque central : il existe plusieurs bases pouvant porter le même nom (la base de développement locale s'appelle aussi `pi_ecosystem`, et la base créée par défaut sur Neon s'appelle `neondb`). Il faut une **triple concordance** : hôte, nom de base, date de la migration initiale.

**[NEON]** — console, projet de l'API :
1. Noter : nom du **projet**, nom de la **branche** (en principe `main`/`production`), nom de la **base de données**, **région**, identifiant du point de terminaison (l'hôte commence par `ep-…`).
2. **Connect** : choisir cette branche et cette base, désactiver « Connection pooling » : l'hôte **ne doit pas** contenir `-pooler`. Noter l'hôte (il n'est pas secret ; le mot de passe l'est).

**[RENDER]** — service `pi-ecosystem-intelligence-api` → **Environment** → `DATABASE_URL` : révéler la valeur **sur votre écran seulement** et lire l'**hôte** et le **nom de base** (sans les recopier ailleurs). Ils doivent être identiques à ceux de Neon. Noter aussi la **date du premier déploiement réussi** (Events) et le commit actuellement déployé.

**[NEON]** — SQL Editor sur cette branche et cette base (lecture seule) :

```sql
SELECT current_database() AS base, current_user AS role, version() AS version;
SELECT migration_name, started_at, finished_at, applied_steps_count
  FROM _prisma_migrations ORDER BY migration_name;
SELECT (SELECT count(*) FROM apps)        AS apps,
       (SELECT count(*) FROM categories)  AS categories,
       (SELECT count(*) FROM users)       AS users,
       (SELECT count(*) FROM raw_metrics) AS raw_metrics,
       (SELECT count(*) FROM app_metrics) AS app_metrics;
SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema = 'public';
```

**Attendu :**
- `base` = le nom relevé ci-dessus ;
- **une seule** migration : `20260929000000_init`, `finished_at` renseigné, **à la date du premier déploiement Render** (c'est ce qui prouve que cette base est bien celle de l'API) ;
- `apps`, `categories`, `users`, `raw_metrics`, `app_metrics` = **0** ;
- `tables` = **14** (13 tables de l'application + `_prisma_migrations`).

**STOP si :** l'hôte ou la base diffère entre Neon et Render ; l'hôte contient `-pooler` ; il y a plus d'une migration ou des lignes de données ; la date de la migration ne correspond pas au premier déploiement.

## Étape 2 — Rotation du mot de passe Neon et mise à jour de Render

La chaîne de connexion a été exposée dans une conversation : elle est à considérer comme compromise. **Cette étape précède toute écriture distante.**

**[NEON]**
1. Rôle propriétaire de la base → **Reset password** (libellé à confirmer). Copier la **nouvelle** chaîne **directe** (`Connect`, pooling désactivé), avec `?sslmode=require&connect_timeout=15` (si la chaîne contient déjà `?sslmode=require`, ajouter `&connect_timeout=15`). La garder uniquement dans un gestionnaire de mots de passe.
2. Si **d'autres branches** existent déjà dans le projet, vérifier leur propre mot de passe (la réinitialisation peut ne s'appliquer qu'à la branche choisie).
3. **L'ancien mot de passe ne fonctionne plus** : l'API sera dégradée (`/api/health` répond 200 avec `"database": false`, `/api/apps` répond 500) **jusqu'à l'étape 4**. C'est attendu.

**Ne mettez pas Render à jour tout de suite** : la sauvegarde (étape 3) doit exister avant que Render puisse déclencher une migration.

## Étape 3 — Sauvegarde avant migration (Neon)

**[NEON]** créer une **branche** de la branche principale (copie instantanée, offre Free : 10 branches par projet) :
- nom : `backup-before-real-data-AAAAMMJJ` ; **état courant** (pas de point dans le passé) ;
- **créée après la rotation** de l'étape 2 : elle hérite ainsi du nouveau mot de passe (créée avant, elle conserverait l'ancien, exposé).

**Vérifications de sauvegarde (obligatoires avant l'étape 4) :**
1. La branche de sauvegarde apparaît dans la liste, avec son **heure de création** (la noter) et son **parent** = la branche principale.
2. SQL Editor **sur la branche de sauvegarde** : rejouer les requêtes de l'étape 1 → mêmes résultats (une migration `init`, tout à 0, 14 tables).
3. Noter l'**hôte de la branche de sauvegarde** (différent de celui de la branche principale) : il sert à la restauration (§11).
4. Ne **rien modifier** dans cette branche : lecture seule. Ne pas la supprimer avant la fin de la mise en service et votre validation.

**STOP si** la branche n'existe pas, n'est pas lisible, ou ses résultats diffèrent de ceux de l'étape 1.

## Étape 4 — Mettre à jour `DATABASE_URL` sur Render

**[RENDER]** → service → **Environment** :
1. Remplacer `DATABASE_URL` par la **nouvelle** chaîne directe (étape 2). Ne rien changer d'autre.
2. Selon l'interface, une option « enregistrer sans déployer » peut exister. **Sinon, l'enregistrement déclenche un déploiement** : acceptable ici, la sauvegarde existe (étape 3) et le déploiement applique la migration prévue à l'étape 5 (le résultat se lit alors dans les logs de cette étape).
3. Vérifier `CORS_ORIGINS` (valeur temporaire `https://example.com` tant que le frontend n'est pas publié ; ne pas la modifier ici).

## Étape 5 — Migration additive et contrôles

La migration `20261002000000_app_addresses` **crée seulement** : 2 types (`AddressSource`, `AddressVerificationStatus`), la table `app_addresses`, 2 index, 1 clé étrangère vers `apps` et 3 contraintes `CHECK`. Elle ne modifie, ne supprime ni ne copie aucune table, colonne ou ligne existante.

**[GITHUB]** (avant de déployer) : `main` doit correspondre au commit applicatif attendu. Depuis votre clone local (§6) :
```bash
git fetch origin && git rev-parse --short origin/main        # c325734 (ou un commit ultérieur)
git diff --name-only c325734 origin/main | grep -v '^docs/'  # si main a avancé : doit n'afficher RIEN (documentation seule)
```

**[RENDER]** si l'étape 4 n'a pas déjà déployé : **Manual Deploy** → *Deploy latest commit* sur `main`. Vérifier à l'écran que le **commit affiché** est celui attendu, plan **Free**.

**Contrôles dans les logs de build :**
- `npm ci --include=dev` termine sans erreur ;
- `Applying migration \`20261002000000_app_addresses\`` puis `All migrations have been successfully applied` ;
- le service passe à « Live ».

**[LOCAL]** santé de l'API (jusqu'à environ 1 minute au réveil) :
```bash
curl -s "https://<service>/api/health"
```
Attendu : `{"data":{"status":"ok","database":true},"meta":{}}`.

**[NEON]** SQL Editor, branche principale (lecture seule) :
```sql
SELECT migration_name, finished_at IS NOT NULL AS ok FROM _prisma_migrations ORDER BY 1;
SELECT typname FROM pg_type WHERE typname IN ('AddressSource', 'AddressVerificationStatus') ORDER BY 1;
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'public.app_addresses'::regclass ORDER BY 1;
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'app_addresses' ORDER BY 1;
SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema = 'public';
SELECT (SELECT count(*) FROM app_addresses) AS adresses,
       (SELECT count(*) FROM apps) AS apps, (SELECT count(*) FROM categories) AS categories,
       (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM raw_metrics) AS raw_metrics;
```
**Attendu :**
- 2 migrations (`init`, `app_addresses`), toutes deux `ok = true` ;
- 2 types ;
- 5 contraintes : `app_addresses_address_format_chk` (c), `app_addresses_appId_fkey` (f), `app_addresses_pkey` (p), `app_addresses_provenance_chk` (c), `app_addresses_verified_requires_proof_chk` (c) ;
- 3 index : `app_addresses_address_idx`, `app_addresses_appId_address_key`, `app_addresses_pkey` ;
- `tables` = **15** (14 + `app_addresses`) ;
- tout à **0** (existant inchangé, table nouvelle vide).

**STOP si** le build échoue (voir §11), si une migration n'est pas terminée, ou si une table existante a changé de contenu. Un échec dû au réveil de Neon peut se rejouer **une fois** ; au-delà, arrêtez.

## Étape 6 — Préparer le poste et la session (aucune écriture)

**[LOCAL]** Git Bash ou WSL (§2) :
```bash
git config --global core.autocrlf input
git clone https://github.com/adanfernando080-dot/PI-ECOSYSTEM-INTELLIGENCE.git
cd PI-ECOSYSTEM-INTELLIGENCE
git checkout main && git pull --ff-only
git rev-parse --short HEAD          # c325734 (ou documentation seule : cf. étape 5)
git status --short                  # doit être vide
test -f .env && echo "ATTENTION : .env présent" || echo ".env absent (bien)"
node -v                             # v22.x
npm ci --include=dev                # npm ci, pas npm install (bug npm connu avec Vitest 4)
npm run db:generate
```
`npm ci` ne doit afficher aucune erreur. Un `.env` éventuel (il pointe en principe vers la base locale) ne gêne pas tant que la variable exportée plus bas l'emporte, mais **mieux vaut le renommer** : `mv .env .env.local-sauvegarde`.

**Ouvrir la session de mise en service** (le secret n'est jamais affiché ni écrit) :
```bash
unset BOOTSTRAP_ADMIN_PI_USERNAME                       # ne doit JAMAIS être défini ici
read -rs -p "DATABASE_URL Neon (directe, NOUVEAU mot de passe) : " DATABASE_URL; echo
export DATABASE_URL
HOST=$(node -e 'console.log(new URL(process.env.DATABASE_URL).hostname)' | tr -d '\r')
DBNAME=$(node -e 'console.log(decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)))' | tr -d '\r')
echo "hôte  : $HOST"
echo "base  : $DBNAME"
case "$HOST" in
  *-pooler*)  echo "STOP : hôte poolé, utiliser la chaîne directe" ;;
  *.neon.tech) echo "hôte Neon plausible" ;;
  *)          echo "STOP : hôte inattendu" ;;
esac
```
**Contrôle d'identité :** l'**hôte** et la **base** affichés doivent être **exactement** ceux relevés à l'étape 1 (Neon **et** Render). Sinon : `unset DATABASE_URL HOST DBNAME`, fermez le terminal et arrêtez.

## Étape 7 — Bootstrap des catégories uniquement

Aucun administrateur n'est créé : **ne passez ni `--admin-pi-username` ni `--confirm-admin`**.

**[LOCAL → NEON]** simulation (lecture seule) :
```bash
npm run db:bootstrap
```
**Attendu (exactement) :**
```
[bootstrap] DRY RUN — target: unverified (guard would refuse --apply)
[bootstrap] categories: 12 to create, 0 already present
            + marketplace … (12 lignes)
[bootstrap] administrator: none to create
[bootstrap] warning: no administrator exists yet: …        ← normal
[bootstrap] dry run only: nothing was written. …
```
(sans `DB_ALLOW_REMOTE_WRITE`, le message « target » signale que l'écriture serait refusée : c'est le garde, voulu).

Si, et seulement si, tout est conforme **et que vous avez approuvé l'écriture** :
```bash
DB_ALLOW_REMOTE_WRITE="$HOST" npm run db:bootstrap -- --apply
```
**Attendu :** `target: remote database (<votre hôte>)` puis `done: 12 categories created, administrator created: no`.
Relancer la même commande doit répondre `nothing to do (already up to date)` (idempotence).

**[NEON]** :
```sql
SELECT count(*) AS categories FROM categories;                     -- 12
SELECT slug FROM categories ORDER BY slug;
SELECT count(*) AS users FROM users;                                -- 0 (aucun administrateur)
SELECT count(*) FROM categories WHERE description IS NULL;          -- 0
```

**Risques :** si `DB_ALLOW_REMOTE_WRITE` ne correspond pas **exactement** à l'hôte, la commande refuse sans se connecter (sans effet). Aucune donnée existante n'est modifiée.

## Étape 8 — Catalogue réel : préparation, vérification humaine, validation, import

> Sans catalogue vérifié, **arrêtez-vous à l'étape 7** : les catégories seules sont une mise en service valide.

> **Répartition des responsabilités.** Ce runbook décrit l'**exécution technique** et les opérations de mise en service qu'il couvre. Les règles de **vérification humaine** (rôles, Vérificateur distinct du Rédacteur, repli exceptionnel, relecture à froid, approbations) sont définies par [`../real-data/CATALOGUE-GUIDE.md`](../real-data/CATALOGUE-GUIDE.md) et la fiche de référence [`../real-data/FICHE-VERIFICATION.md`](../real-data/FICHE-VERIFICATION.md). Cette précision sépare des responsabilités ; elle ne crée pas de hiérarchie générale entre les documents.

### 8.1 Préparer le fichier (hors dépôt)

1. Copier le gabarit vide : `cp docs/real-data/catalogue.template.json ./catalogue.real.json` (fichier **non versionné**, à garder hors de Git).
2. Y ajouter **uniquement** des informations réelles et sourcées, en respectant le format de [`../real-data/README.md`](../real-data/README.md). Rien d'inventé : ni description « type », ni adresse devinée, ni chiffre (les clés `metrics`, `score`, `stakedPi`, `transactions`… sont refusées).
3. Adresses : `sourceNote` **obligatoire** (où elle a été trouvée). Ne les marquer `verified` que si la méthode, la preuve et la date existent réellement ; sinon elles restent **déclarées** (par défaut).
4. `status` : mettre `"ACTIVE"` **uniquement** pour une application dont la fiche de vérification (8.2) est signée. Une application non vérifiée **ne figure pas dans le fichier**. (Le statut d'une application existante ne peut plus être modifié par l'import ; sans authentification admin, il ne pourrait l'être que par SQL, sur approbation.) **N'utilisez pas `INACTIVE` pour « cacher »** : une application `INACTIVE` reste visible publiquement par son slug (vérifié dans le code de l'API) ; seule `PENDING` est invisible au public.

### 8.2 Vérification humaine (obligatoire, avant tout `--apply`)

Ce runbook **ne définit pas** la procédure de vérification humaine et ne maintient pas de fiche propre : les règles figurent dans [`../real-data/CATALOGUE-GUIDE.md`](../real-data/CATALOGUE-GUIDE.md) (§ 1 règle 4, § 2, § 2 bis, § 12) et la **fiche unique de référence** est [`../real-data/FICHE-VERIFICATION.md`](../real-data/FICHE-VERIFICATION.md). Pour **chaque** application du fichier :

1. la fiche `FICHE-VERIFICATION.md` est remplie et signée selon le guide : dans le processus normal par un **Vérificateur distinct du rédacteur du fichier** ; le **repli** n'est utilisable que dans les conditions du guide (§ 2 bis : situation exceptionnelle et temporaire, délai d'au moins 24 h, relecture à froid, traçabilité, approbations requises) ;
2. cette fiche est conservée **hors dépôt** ;
3. une application dont un contrôle échoue **sort du fichier**.

### 8.3 Validation technique (simulation, lecture seule)

**[LOCAL → NEON]**
```bash
npm run catalogue:import -- --file=./catalogue.real.json
```
**Attendu :**
- `file is valid: N application(s)` (N = nombre d'applications de la fiche) ;
- `applications: N to create, 0 unchanged` ; `addresses: …` conforme à la fiche (déclarées / vérifiées) ;
- **aucune** ligne `ERROR` ni `conflict` ; `dry run only: nothing was written`.

Si le fichier est invalide, la commande **s'arrête avant de contacter la base** et liste **toutes** les erreurs. Une erreur `demo row(s)` signifie que la base contient du démo : **stop**.

### 8.4 Import (après approbation d'import explicite et fiche signée)

> **L'approbation d'import n'est pas l'approbation de publication.** L'approbation de publication (signature du chef de projet sur la fiche, guide § 2 étape 5) ne vaut pas autorisation d'import. L'autorisation d'import est une **confirmation écrite distincte et traçable** qui identifie au minimum l'opération autorisée, la cible concernée et l'empreinte SHA-256 de `catalogue.real.json` ; elle est associée à la fiche signée. Son support exact et sa portée : **À CONFIRMER PAR LE RESPONSABLE DU PROJET**. Cette exigence s'ajoute à la règle du § 1 (approbation nommant l'opération et la cible) et ne la remplace pas.

```bash
DB_ALLOW_REMOTE_WRITE="$HOST" npm run catalogue:import -- --file=./catalogue.real.json --apply
npm run catalogue:import -- --file=./catalogue.real.json     # contrôle : « 0 to create, N unchanged »
```
**Attendu :** `done: N application(s) created, M address(es) added, 0 marked verified` (ou le nombre d'adresses vérifiées prévu), puis `0 to create, N unchanged`. L'import est **transactionnel** : une erreur n'écrit rien.

**[NEON]** :
```sql
SELECT slug, status, "isDemo", "developerId" IS NULL AS non_revendiquee FROM apps ORDER BY slug;
SELECT a.slug, x."verificationStatus", x.source, left(x.address, 6) || '…' AS adresse
  FROM app_addresses x JOIN apps a ON a.id = x."appId" ORDER BY 1, 3;
SELECT count(*) FILTER (WHERE "isDemo") AS apps_demo FROM apps;                       -- 0
SELECT (SELECT count(*) FROM raw_metrics) AS raw_metrics,
       (SELECT count(*) FROM app_metrics) AS app_metrics,
       (SELECT count(*) FROM ranking_snapshots) AS rankings,
       (SELECT count(*) FROM anomalies) AS anomalies,
       (SELECT count(*) FROM transactions) AS transactions;                            -- 0 partout
SELECT count(*) AS admins FROM users WHERE role = 'ADMIN';                             -- 0
```
**Attendu :** N applications, `isDemo = false`, non revendiquées, statut conforme à la fiche ; **aucune** ligne dans `raw_metrics`, `app_metrics`, `ranking_snapshots`, `anomalies`, `transactions` ; aucun administrateur.

## Étape 9 — Vérifications de l'API après déploiement

Remplacer `<service>` par l'URL Render (premier appel : jusqu'à ~1 minute au réveil).

```bash
curl -s "https://<service>/api/health"             # database:true
curl -s "https://<service>/health"                 # alias, même réponse
curl -s "https://<service>/api/categories" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("catégories:",j.data.length)})'
curl -s "https://<service>/api/apps?limit=100" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);const a=r.data;console.log("apps:",a.length,"| containsDemoData:",r.meta.containsDemoData,"| avec métriques:",a.filter(x=>x.metrics!==null).length)})'
curl -s "https://<service>/api/apps/<slug>"        # une fiche : metrics doit valoir null
curl -s "https://<service>/api/rankings/activity"  # entries: [] et computedAt: null
curl -s -o /dev/null -w "%{http_code}\n" "https://<service>/api/apps/slug-inexistant"   # 404
curl -s -o /dev/null -w "%{http_code}\n" "https://<service>/api/apps?status=PENDING"    # 403 (réservé à l'admin)
```
**Attendu :**
- catégories : **12** ; apps : **N** (uniquement les `ACTIVE`) ; `containsDemoData: false` ; **avec métriques : 0** ;
- fiche : `"metrics": null`, **aucun** score égal à 0 ; classements vides ; 404 propre pour un slug inconnu ;
- `GET /api/apps?status=PENDING` sans jeton répond **403** ; une application `PENDING` (s'il en existe) répond **404** par son slug : les applications non publiées ne sont jamais exposées.

**STOP si** un score, un compte ou un classement apparaît avec une valeur (`0` compris) : il n'existe aucune donnée brute, une valeur chiffrée serait une anomalie à signaler.

**Côté interface :** tant que Lovable utilise ses données fictives, ces données réelles ne sont **pas visibles** des utilisateurs. À la connexion, l'interface devra afficher « Données indisponibles » pour `metrics: null` (jamais `0`).

## Étape 10 — Clôture

**[LOCAL]** `unset DATABASE_URL HOST DBNAME` et **fermer le terminal**. Remettre `.env` en place si vous l'aviez renommé. **[NEON]** conserver la branche de sauvegarde jusqu'à votre validation finale, puis décider de sa suppression (opération §1.10 : approbation requise). **[GITHUB]** aucune opération. Archiver le journal et les fiches de vérification hors dépôt.

## 11. Retours arrière

### 11.1 Rollback **applicatif** (Render) — ne modifie pas la base

| Situation | Action |
|---|---|
| Déploiement défaillant (l'API ne démarre pas, health KO) | Render → **Events/Deploys** → dernier déploiement sain → **Rollback** (si disponible sur l'offre Free), sinon **Manual Deploy** d'un commit antérieur. |
| Erreur de configuration (`CORS_ORIGINS`, `JWT_SECRET`, `DATABASE_URL`) | Les logs nomment la variable fautive : corriger, puis déploiement manuel. |
| Arrêt d'urgence | Service → **Suspend**. |

**Important :**
- un rollback Render **ne défait pas** la migration : la table `app_addresses` est additive et **inoffensive pour l'ancien code** (qui l'ignore) ;
- **ne restaurez pas l'ancienne valeur de `DATABASE_URL`** : l'ancien mot de passe est désactivé (étape 2).

### 11.2 Restauration de **base** (Neon) — modifie ou remplace les données

| Situation | Action | Écrit ? |
|---|---|---|
| Migration échouée à mi-parcours, état douteux (`_prisma_migrations` sans `finished_at`) | **Ne pas** relancer ni « résoudre » à la main. Restaurer depuis la branche de sauvegarde : pointer `DATABASE_URL` (Render) sur l'**hôte de la branche de sauvegarde** (étape 3), ou utiliser la fonction de restauration de Neon (libellé à confirmer). L'hôte changeant, l'hôte de `DB_ALLOW_REMOTE_WRITE` change aussi. | Neon + Render |
| Retirer la migration, **uniquement avant tout import**, après sauvegarde, avec approbation | `DROP TABLE app_addresses; DROP TYPE "AddressVerificationStatus"; DROP TYPE "AddressSource"; DELETE FROM _prisma_migrations WHERE migration_name = '20261002000000_app_addresses';` | Neon, **destructif** |
| Masquer des applications importées (**à préférer** à la suppression) | `UPDATE apps SET status = 'PENDING' WHERE slug IN ('…');` — `PENDING` n'apparaît ni dans les listes ni par slug (404, vérifié dans le code) ; **pas `INACTIVE`**, qui reste visible par slug. Contrôler ensuite par `curl` sans jeton. | Neon |
| Supprimer des applications importées | `DELETE FROM apps WHERE slug IN ('…') AND "developerId" IS NULL;` (supprime aussi leurs adresses par cascade ; aucune métrique n'existe à ce stade) | Neon, **destructif** |
| Retirer les catégories créées | `DELETE FROM categories WHERE slug IN (…);` **uniquement** si aucune application ne les utilise | Neon, **destructif** |
| Secret exposé de nouveau | Refaire l'étape 2 (nouveau mot de passe) puis mettre à jour Render | Neon + Render |

**Aucun outil de retrait n'existe dans le dépôt** (l'import ne supprime ni ne modifie rien) : toute suppression est du **SQL manuel**, à ne lancer qu'avec approbation explicite, après avoir relu la requête et son `WHERE`.

**Distinction à retenir :** le rollback applicatif remet l'ancien **code** ; la restauration de base remet d'anciennes **données**. Une application retirée, un administrateur ou un catalogue importé ne se corrigent **jamais** par un rollback Render.

## Annexe — Résumé de l'ordre exact

| # | Où | Opération | Écrit ? | Prérequis |
|---|---|---|---|---|
| 1 | Neon / Render | Identifier la base (triple concordance) | non | Go/No-Go (§3) |
| 2 | Neon | Rotation du mot de passe | oui (rôle) | étape 1 OK |
| 3 | Neon | Branche de sauvegarde + vérifications | oui (branche) | étape 2 |
| 4 | Render | Mise à jour de `DATABASE_URL` | oui (variable) | étape 3 OK |
| 5 | Render + Neon | Migration additive + contrôles | oui (schéma) | étape 4 |
| 6 | Local | Poste, session, contrôle d'identité | non | étape 5 OK |
| 7 | Local → Neon | Bootstrap : catégories uniquement | oui | étape 6 |
| 8 | Local → Neon | Catalogue : fiche humaine, simulation, import | oui | fiche signée, approbation |
| 9 | Local | Vérifications de l'API | non | étapes 5, 7, 8 |
| 10 | Local | Clôture | non | — |
