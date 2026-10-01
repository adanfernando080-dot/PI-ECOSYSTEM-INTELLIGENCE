# API REST — V1

Base : `/api` — **tous les endpoints métier sont préfixés par `/api`** (seule exception : l'alias `GET /health`) · Format : JSON · Spec : **OpenAPI 3.1** sur `GET /api/openapi.json` (copie statique : [`openapi.json`](openapi.json)) · UI : `GET /api/docs`.

> **Connexion du frontend Lovable** : voir [`FRONTEND_CONTRACT.md`](FRONTEND_CONTRACT.md) (variables `VITE_API_BASE_URL` / `CORS_ORIGINS`, erreurs, provenance) et la référence générée [`ENDPOINTS.md`](ENDPOINTS.md).

## Conventions

Succès :
```json
{ "data": ..., "meta": { "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }, "containsDemoData": true, "demoNotice": "…" } }
```
Erreur :
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid query", "details": [{ "path": "query.limit", "message": "…" }] } }
```

| Code | HTTP |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHENTICATED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 (aucun détail interne exposé) |

- Une valeur **`null`** signifie « indisponible », jamais 0.
- `meta.containsDemoData: true` dès qu'une réponse contient des données fictives ; chaque app porte aussi `isDemo`.
- `:id` accepte l'UUID **ou** le slug de l'app.
- Authentification : `Authorization: Bearer <jwt>` (voir [ADR-0007](../architecture/decisions/0007-auth-v1-hs256-roles-from-db.md)).

## Endpoints publics

| Méthode | Chemin | Paramètres |
|---|---|---|
| GET | `/api/health` | — (endpoint principal ; alias `GET /health` pour les hébergeurs, même réponse `{ status, database }`, sans donnée sensible) |
| GET | `/api/meta/methodology` | — (poids et formules) |
| GET | `/api/categories` | — |
| GET | `/api/apps` | `category`, `status` (ACTIVE/INACTIVE ; PENDING/REJECTED = ADMIN), `sort` (name, newest, activity, growth, economic, community, transparency, confidence), `order`, `period` (24h/7d/**30d**/90d), `q`, `page`, `limit` (≤ 100) |
| GET | `/api/apps/:slug` | `period` — détail + `breakdown` (composants, couverture, notes par moteur) + `reviewSummary` |
| GET | `/api/apps/:id/history` | `range` (7d/**30d**/90d), `period` (fenêtre du score, défaut **7d**) |
| GET | `/api/compare` | `apps=slug1,slug2[,…]` (2 à 4), `period` |
| GET | `/api/rankings/:type` | `type` ∈ activity, growth, economic, community, transparency, trending, rising, new · `period` (24h/**7d**/30d/90d) · `limit` · `minConfidence` |
| GET | `/api/discover` | `intent` ∈ buy, work, spend, sell, services, ai, games, learn · `category` · `sort` (défaut activity) · `minConfidence` · `period` · `page` · `limit` |
| GET | `/api/apps/:id/reviews` | `page`, `limit` — avis **publiés** uniquement |

Correspondance intents → catégories (`packages/shared/src/intents.ts`) : buy/sell → marketplace, shopping · spend → shopping, travel, payments · work → jobs, services · services → services · ai → ai · games → games · learn → education.

## Endpoints authentifiés

| Méthode | Chemin | Rôle | Notes |
|---|---|---|---|
| POST | `/api/apps/:id/reviews` | USER | `{ rating: 1–5, review: 10–2000 car. }` ; HTML retiré ; statut **PENDING** ; 1 avis par app et par utilisateur ; 10 avis / 24 h ; un développeur ne peut pas noter sa propre app |
| GET | `/api/me` | USER | |
| GET / POST / DELETE | `/api/me/favorites[/:appId]` | USER | |
| GET | `/api/developers/apps` | DEVELOPER | ses apps uniquement |
| POST | `/api/developers/apps` | DEVELOPER | crée une app **PENDING** (slug dérivé du nom si absent) |
| PATCH | `/api/developers/apps/:id` | DEVELOPER (propriétaire) | |
| POST | `/api/developers/apps/:id/claim` | DEVELOPER | revendication, validée par un admin |
| POST | `/api/developers/apps/:id/metrics` | DEVELOPER (propriétaire) | `{ metrics: [{ metricType, value \| null, periodStart, periodEnd, note? }] }` → stockées **DEVELOPER_REPORTED** (ou UNAVAILABLE si `null`) |
| PATCH | `/api/admin/apps/:id/status` | ADMIN | valider / refuser / désactiver |
| POST / PATCH | `/api/admin/categories[/:id]` | ADMIN | |
| GET / PATCH | `/api/admin/reviews[/:id]` | ADMIN | modération (`status`, `moderationNote`) |
| GET / PATCH | `/api/admin/anomalies[/:id]` | ADMIN | signaux statistiques et leur statut |
| GET / PATCH | `/api/admin/claims[/:id]` | ADMIN | approbation → l'app est liée au développeur |
| POST | `/api/admin/recalculate` | ADMIN | `{ date?: "YYYY-MM-DD" }` → métriques + classements + anomalies (ajout, jamais d'écrasement) |

## Exemples

```bash
curl 'http://localhost:3000/api/apps?sort=activity&limit=5'
curl 'http://localhost:3000/api/apps/pimarket'
curl 'http://localhost:3000/api/apps/pimarket/history?range=30d&period=7d'
curl 'http://localhost:3000/api/rankings/growth?period=30d&minConfidence=75'
curl 'http://localhost:3000/api/discover?intent=buy&sort=confidence'

TOKEN=$(npm run -s token:dev -- demo_user_01)
curl -X POST http://localhost:3000/api/apps/pijobs/reviews \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"rating":4,"review":"Clear missions and quick payments."}'
```

## Sécurité

- Validation serveur de tous les params, query et bodies (zod) ; query parser « simple » (pas d'objets imbriqués) ; body JSON ≤ 100 kB.
- `helmet` (en-têtes de sécurité), CORS en liste blanche (`CORS_ORIGINS`, obligatoire et strictement validé en production : https, sans `*`, sans localhost), `x-powered-by` désactivé.
- Timeouts Node : `keepAliveTimeout` 65 s, `headersTimeout` 66 s (supérieurs au délai d'inactivité d'un répartiteur de charge standard).
- Rate limiting global (`RATE_LIMIT_MAX`/fenêtre) et plus strict sur les écritures (`RATE_LIMIT_WRITE_MAX`) ; Redis si `REDIS_URL` est défini (obligatoire en multi-instance).
- RBAC + contrôle de propriété dans les services ; rôle relu en base à chaque requête.
- Logs JSON (pino) avec masquage de `authorization`, cookies, `token`, `secret`, `apiKey`.
- Les secrets (`JWT_SECRET`, `PI_API_KEY`) ne quittent jamais le serveur.
