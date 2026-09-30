# Contrat Frontend (Lovable) ↔ REST API — V1

Document de **préparation** : le frontend Lovable n'est pas encore modifié et ses mocks restent en place. Ce contrat fixe ce que le frontend devra consommer lors de la connexion.

Sources de vérité (toutes générées depuis les schémas zod du backend) :

- [`openapi.json`](openapi.json) — spec OpenAPI 3.1 (aussi servie par `GET /api/openapi.json`, UI sur `/api/docs`)
- [`ENDPOINTS.md`](ENDPOINTS.md) — référence de chaque endpoint : méthode, chemin, paramètres, query, body, statuts, rôle
- [`README.md`](README.md) — conventions et exemples `curl`

## 1. Configuration

### Variable d'environnement du frontend

| Variable | Rôle | Exemple (dev) | Production |
|---|---|---|---|
| **`VITE_API_BASE_URL`** | URL de base de l'API, **suffixe `/api` inclus, sans `/` final** | `http://localhost:3000/api` | `<API_PUBLIC_ORIGIN>/api` — **placeholder**, l'URL réelle de l'API déployée n'existe pas encore |

Règles : variable publique (préfixe `VITE_`, visible dans le bundle) → **aucun secret** dedans. Tous les appels se construisent comme `` `${import.meta.env.VITE_API_BASE_URL}/apps` ``. Non utilisée tant que Lovable n'est pas branché (les mocks restent actifs).

### Variable d'environnement du backend : `CORS_ORIGINS`

Liste blanche d'origines séparées par des virgules (schéma + hôte [+ port], sans chemin ni `/` final).

```
CORS_ORIGINS=http://localhost:5173,<LOVABLE_PREVIEW_OR_PUBLISHED_ORIGIN>
```

- `<LOVABLE_PREVIEW_OR_PUBLISHED_ORIGIN>` est un **placeholder** : l'URL finale du frontend n'est pas connue. Elle doit être ajoutée (aperçu et/ou publiée) avant le premier appel depuis Lovable ; jamais de `*`.
- Comportement vérifié (tests `http.test.ts` + essai réel) : origine autorisée → `Access-Control-Allow-Origin` = cette origine ; origine inconnue → aucun en-tête CORS (le navigateur bloque) ; preflight `OPTIONS` → 204.
- Méthodes : `GET, POST, PATCH, DELETE`. En-têtes de requête autorisés : `Content-Type`, `Authorization`. En-têtes de réponse lisibles par le navigateur : `RateLimit`, `RateLimit-Policy`, `Retry-After`.
- `/api/openapi.json` est aussi accessible depuis une origine autorisée.
- Pas de cookies : `credentials` inutile, l'authentification passe par `Authorization: Bearer <jwt>`.

## 2. Format des réponses

Succès : `{ "data": …, "meta": { "pagination"?: { page, limit, total, totalPages }, "containsDemoData": boolean, "demoNotice"?: string } }`

Erreur : `{ "error": { "code": string, "message": string, "details"?: [{ "path": "query.limit", "message": "…" }] } }`

Toujours tester `res.ok` puis lire `error.code` (stable) ; ne pas afficher `message` tel quel à l'utilisateur final.

| HTTP | `error.code` | Quand |
|---|---|---|
| 400 | `VALIDATION_ERROR` | query/param/body invalide, JSON mal formé. `details[].path` indique le champ (`query.*`, `params.*`, `body.*`). **Inclut un `:type` de classement inconnu** |
| 401 | `UNAUTHENTICATED` | jeton absent, invalide ou expiré |
| 403 | `FORBIDDEN` | rôle insuffisant ou app d'un autre développeur ; un développeur ne peut pas noter sa propre app |
| 404 | `NOT_FOUND` | app/ressource ou route inconnue |
| 409 | `CONFLICT` | avis déjà publié par cet utilisateur, slug déjà pris, revendication déjà faite/décidée, catégorie existante |
| 413 | `PAYLOAD_TOO_LARGE` | body > 100 kB |
| 429 | `RATE_LIMITED` | trop de requêtes (lire `Retry-After` / `RateLimit`) |
| 500 | `INTERNAL_ERROR` | erreur inattendue, aucun détail interne exposé |

**422 n'est pas utilisé** : toute erreur de validation est un **400**. Ne pas prévoir de branche 422.

## 3. Règles de données à respecter côté React

1. **`null` = indisponible, jamais 0.** Afficher « Données indisponibles » (et non `0`) pour un score `null` (`community`, `piEcosystemScore`, `stakedPi`, `averageRating`, `logoUrl`…). Ne pas appliquer `?? 0` ni `|| 0`. Dans les listes, un score `null` est trié en dernier par le serveur.
2. **Provenance visible.** `metrics.provenance` (nullable) résume l'origine des données :
   - `counts.OBSERVABLE` → Observable / Verified
   - `counts.DEVELOPER_REPORTED` → Developer-reported
   - `counts.ESTIMATED` → Estimated
   - `counts.UNAVAILABLE` → Unavailable

   Ce sont de vrais **comptes d'entrées** (0 = aucune entrée de ce type). `provenance.extrapolated.transactionCount|observableVolume` vaut `true` quand la valeur a été extrapolée depuis une couverture partielle (à afficher comme estimée), `null` si non évalué. Le détail par moteur reste dans `breakdown` (composants, `missing`, `coverage`, notes).
3. **Data Confidence séparé des scores.** Les scores sont dans `metrics.scores.*` ; la confiance est dans `metrics.confidence { score, level }` (jamais dans `scores`). Afficher les deux séparément ; ne jamais les combiner côté client.
4. **Staking séparé.** `metrics.staking { stakedPi, includedInScores: false }` : affichage distinct, exclu de tout score en V1.
5. **Vocabulaire neutre.** `scores.observableEconomicActivity` = activité économique *observable*, pas un revenu. `piEcosystemScore` est un indicateur analytique, pas un verdict. Il n'existe pas de classement global « meilleures apps » : un classement = une dimension (`activity, growth, economic, community, transparency, trending, rising, new`). Une anomalie est un **signal statistique**, pas une accusation de fraude.
6. **Données de démonstration.** `meta.containsDemoData` / `isDemo` : afficher un bandeau/badge « Données de démonstration » (`meta.demoNotice` fournit le texte).
7. `:id` accepte l'**UUID ou le slug** (`/apps/pimarket/history` fonctionne). Dates en ISO 8601 UTC (`string`).
8. Les réponses sont en camelCase ; les énumérations sont en MAJUSCULES (`status`, `provenance`, `confidence.level`) sauf `period`/`range` (`24h|7d|30d|90d`).

## 4. Endpoints prévus pour la connexion (vérifiés)

| Page / besoin frontend | Appel | Auth |
|---|---|---|
| Recherche, liste, filtres | `GET /api/apps?q=&category=&sort=&order=&period=&page=&limit=` | public |
| Profil d'une app | `GET /api/apps/:slug?period=` | public |
| Évolution | `GET /api/apps/:id/history?range=&period=` | public |
| Classements | `GET /api/rankings/:type?period=&limit=&minConfidence=` | public |
| Découverte par besoin | `GET /api/discover?intent=&category=&sort=&minConfidence=&period=&page=&limit=` | public |
| Comparaison (2–4 apps) | `GET /api/compare?apps=slug1,slug2&period=` | public |
| Catégories | `GET /api/categories` | public |
| Méthodologie (poids, formules) | `GET /api/meta/methodology` | public |
| Lire les avis | `GET /api/apps/:id/reviews?page=&limit=` (avis publiés uniquement) | public |
| Laisser un avis | `POST /api/apps/:id/reviews` `{ rating 1–5, review 10–2000 car. }` → `201`, statut `PENDING` (modéré avant publication) | USER |
| Utilisateur / favoris | `GET /api/me`, `GET|POST|DELETE /api/me/favorites[/:appId]` | USER |
| Espace développeur | `GET|POST /api/developers/apps`, `PATCH /api/developers/apps/:id`, `POST /api/developers/apps/:id/claim`, `POST /api/developers/apps/:id/metrics` | DEVELOPER |
| Administration | `/api/admin/*` (apps/status, categories, reviews, anomalies, claims, recalculate) | ADMIN |

Détail complet de chaque endpoint : [`ENDPOINTS.md`](ENDPOINTS.md).

## 5. Authentification (provisoire)

- En V1 le backend accepte un JWT HS256 (`Authorization: Bearer …`) émis par un serveur de confiance ; le rôle (USER / DEVELOPER / ADMIN) est relu en base à chaque requête.
- **L'authentification Pi réelle n'est pas branchée** : elle fera l'objet d'une étape séparée après validation de ce contrat. Le frontend ne doit **pas** embarquer `JWT_SECRET`. Les endpoints publics fonctionnent sans jeton ; en attendant, les jetons de développement se génèrent en local avec `npm run -s token:dev -- <piUsername>` (utilisateurs DEMO).

## 6. Générer les types TypeScript du frontend (recommandé)

```bash
npx openapi-typescript http://localhost:3000/api/openapi.json -o src/api/schema.d.ts
# ou, hors ligne, depuis la copie statique : docs/api/openapi.json
```

Le client peut ensuite typer `fetch` avec ces types, y compris `MetricSnapshot`, `ProvenanceSummary`, `ErrorEnvelope`.

## 7. Points connus (non bloquants)

- Les réponses de `/api/me`, des favoris et des endpoints admin ne sont pas encore décrites par un schéma de réponse dans OpenAPI (seules les requêtes, statuts et rôles le sont) ; leur forme est documentée dans `README.md` et stable.
- `GET /api/apps?status=PENDING|REJECTED` est réservé à ADMIN.
- Passage à l'échelle : le tri se fait en mémoire en V1 (ADR-0008).
