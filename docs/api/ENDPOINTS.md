# Référence des endpoints (générée)

> Générée depuis [`openapi.json`](openapi.json) (source : schémas zod du backend). Ne pas éditer à la main : `npm run openapi:export` puis régénérer.

`*` = champ obligatoire. Enveloppe succès `{ data, meta }`, erreur `{ error: { code, message, details? } }`. Rôle : « public » = aucun jeton requis ; un jeton valide est facultatif et n'élargit que certaines vues.

## `GET /api/health`

Health check.  
**Auth** : public

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `429`, `500`

## `GET /api/meta/methodology`

Scoring methodology (weights, formulas, versions).  
**Auth** : public

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `429`, `500`

## `GET /api/categories`

List categories.  
**Auth** : public

**Succès** : `200` — `data` : array<Category>

**Erreurs** : `400`, `429`, `500`

## `GET /api/apps`

List applications.  
**Auth** : public

**Query** : `page` (integer (défaut `1`) [1..10000]), `limit` (integer (défaut `20`) [1..100]), `category` (string), `status` (`PENDING \| ACTIVE \| INACTIVE \| REJECTED`), `sort` (`name \| newest \| activity \| growth \| economic \| community \| transparency \| confidence`), `order` (`asc \| desc`), `period` (Period), `q` (string)

**Succès** : `200` — `data` : array<AppSummary>

**Erreurs** : `400`, `429`, `500`

## `GET /api/apps/{slug}`

Application detail with score breakdown.  
**Auth** : public

**Paramètres de chemin** : `slug` (string \| string)

**Query** : `period` (Period)

**Succès** : `200` — `data` : AppDetail

**Erreurs** : `400`, `404`, `429`, `500`

## `GET /api/apps/{id}/history`

Score history.  
**Auth** : public

**Query** : `range` (HistoryRange), `period` (Period)

**Succès** : `200` — `data` : History

**Erreurs** : `400`, `404`, `429`, `500`

## `GET /api/compare`

Compare 2–4 applications side by side.  
**Auth** : public

**Query** : `apps`* (string), `period` (Period)

**Succès** : `200` — `data` : array<AppDetail>

**Erreurs** : `400`, `429`, `500`

## `GET /api/rankings/{type}`

Analytical ranking.  
**Auth** : public

**Paramètres de chemin** : `type` (RankingType)

**Query** : `period` (Period), `limit` (integer (défaut `50`) [1..100]), `minConfidence` (number [0..100])

**Succès** : `200` — `data` : Ranking

**Erreurs** : `400`, `404`, `429`, `500`

## `GET /api/discover`

Discover applications by intent.  
**Auth** : public

**Query** : `page` (integer (défaut `1`) [1..10000]), `limit` (integer (défaut `20`) [1..100]), `intent` (`buy \| work \| spend \| sell \| services \| ai \| games \| learn`), `category` (string), `sort` (`name \| newest \| activity \| growth \| economic \| community \| transparency \| confidence`), `minConfidence` (number [0..100]), `period` (Period)

**Succès** : `200` — `data` : array<AppSummary>

**Erreurs** : `400`, `429`, `500`

## `GET /api/apps/{id}/reviews`

Published reviews.  
**Auth** : public

**Query** : `page` (integer (défaut `1`) [1..10000]), `limit` (integer (défaut `20`) [1..100])

**Succès** : `200` — `data` : array<Review>

**Erreurs** : `400`, `404`, `429`, `500`

## `POST /api/apps/{id}/reviews`

Submit a review (moderated before publication).  
**Auth** : Bearer JWT requis — rôle **USER**

**Body JSON** : `rating`*: integer [1..5]; `review`*: string

**Succès** : `201` — `data` : Review

**Erreurs** : `400`, `401`, `403`, `404`, `409`, `413`, `429`, `500`

## `GET /api/me`

Current user.  
**Auth** : Bearer JWT requis — rôle **USER**

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `429`, `500`

## `GET /api/me/favorites`

My favorite apps.  
**Auth** : Bearer JWT requis — rôle **USER**

**Succès** : `200` — `data` : array<AppSummary>

**Erreurs** : `400`, `401`, `403`, `429`, `500`

## `POST /api/me/favorites/{appId}`

Add a favorite.  
**Auth** : Bearer JWT requis — rôle **USER**

**Paramètres de chemin** : `appId` (string)

**Succès** : `201` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `429`, `500`

## `DELETE /api/me/favorites/{appId}`

Remove a favorite.  
**Auth** : Bearer JWT requis — rôle **USER**

**Paramètres de chemin** : `appId` (string)

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `429`, `500`

## `GET /api/developers/apps`

My applications.  
**Auth** : Bearer JWT requis — rôle **DEVELOPER**

**Succès** : `200` — `data` : array<AppSummary>

**Erreurs** : `400`, `401`, `403`, `429`, `500`

## `POST /api/developers/apps`

Register an application (PENDING until validated).  
**Auth** : Bearer JWT requis — rôle **DEVELOPER**

**Body JSON** : `name`*: string; `slug`: string; `description`: string \| null; `categorySlug`: string \| null; `url`: string \| null; `logoUrl`: string \| null; `methodologyNote`: string \| null; `tags`: array<string>

**Succès** : `201` — `data` : AppSummary

**Erreurs** : `400`, `401`, `403`, `409`, `413`, `429`, `500`

## `PATCH /api/developers/apps/{id}`

Update my application.  
**Auth** : Bearer JWT requis — rôle **DEVELOPER**

**Body JSON** : `name`: string; `description`: string \| null; `categorySlug`: string \| null; `url`: string \| null; `logoUrl`: string \| null; `methodologyNote`: string \| null; `tags`: array<string>

**Succès** : `200` — `data` : AppSummary

**Erreurs** : `400`, `401`, `403`, `404`, `413`, `429`, `500`

## `POST /api/developers/apps/{id}/claim`

Claim an existing application.  
**Auth** : Bearer JWT requis — rôle **DEVELOPER**

**Body JSON** : `evidence`*: string

**Succès** : `202` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `409`, `413`, `429`, `500`

## `POST /api/developers/apps/{id}/metrics`

Declare metrics (stored as DEVELOPER_REPORTED).  
**Auth** : Bearer JWT requis — rôle **DEVELOPER**

**Body JSON** : `metrics`*: array<DeclaredMetric>

**Succès** : `201` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `413`, `429`, `500`

## `PATCH /api/admin/apps/{id}/status`

Validate / change app status.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Body JSON** : `status`*: `PENDING \| ACTIVE \| INACTIVE \| REJECTED`

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `413`, `429`, `500`

## `POST /api/admin/categories`

Create category.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Body JSON** : `name`*: string; `slug`*: string; `description`: string \| null

**Succès** : `201` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `409`, `413`, `429`, `500`

## `PATCH /api/admin/categories/{id}`

Update category.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Body JSON** : `name`: string; `slug`: string; `description`: string \| null

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `409`, `413`, `429`, `500`

## `GET /api/admin/reviews`

Reviews to moderate.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Query** : `page` (integer (défaut `1`) [1..10000]), `limit` (integer (défaut `20`) [1..100]), `status` (`PENDING \| PUBLISHED \| HIDDEN`)

**Succès** : `200` — `data` : array<—>

**Erreurs** : `400`, `401`, `403`, `429`, `500`

## `PATCH /api/admin/reviews/{id}`

Moderate a review.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Body JSON** : `status`*: `PENDING \| PUBLISHED \| HIDDEN`; `moderationNote`: string \| null

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `413`, `429`, `500`

## `GET /api/admin/anomalies`

Statistical anomaly signals.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Query** : `page` (integer (défaut `1`) [1..10000]), `limit` (integer (défaut `20`) [1..100]), `status` (`NEW \| INVESTIGATING \| RESOLVED \| DISMISSED`), `appId` (string)

**Succès** : `200` — `data` : array<—>

**Erreurs** : `400`, `401`, `403`, `429`, `500`

## `PATCH /api/admin/anomalies/{id}`

Update anomaly status.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Body JSON** : `status`*: `NEW \| INVESTIGATING \| RESOLVED \| DISMISSED`

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `413`, `429`, `500`

## `GET /api/admin/claims`

App ownership claims.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Query** : `page` (integer (défaut `1`) [1..10000]), `limit` (integer (défaut `20`) [1..100]), `status` (`PENDING \| APPROVED \| REJECTED`)

**Succès** : `200` — `data` : array<—>

**Erreurs** : `400`, `401`, `403`, `429`, `500`

## `PATCH /api/admin/claims/{id}`

Approve / reject a claim.  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Body JSON** : `status`*: `APPROVED \| REJECTED`

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `404`, `409`, `413`, `429`, `500`

## `POST /api/admin/recalculate`

Recompute metrics, rankings and anomalies (append-only).  
**Auth** : Bearer JWT requis — rôle **ADMIN**

**Body JSON** : `date`: string

**Succès** : `200` — `data` : objet (voir README)

**Erreurs** : `400`, `401`, `403`, `413`, `429`, `500`
