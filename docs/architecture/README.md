# Architecture

## Pipeline logique

```
DATA SOURCES           integrations/pi (ports) — V1 : adaptateurs UNAVAILABLE ; seed DEMO
     ↓
DATA INGESTION         workers/blockchain-sync (placeholder) · POST /api/developers/apps/:id/metrics
     ↓
DATA VALIDATION        packages/validation → validateRawMetric (+ contraintes SQL)
     ↓
DATA NORMALIZATION     packages/validation → normalizeRawPoints (une valeur par métrique/jour, précédence de provenance)
     ↓
ANOMALY DETECTION      packages/validation/anomalies ← packages/metrics/anomalies ← workers/anomalies
     ↓
METRICS ENGINE         packages/metrics → extractMeasures / computeSnapshot
     ↓
SCORING ENGINE         packages/scoring (+ packages/confidence)
     ↓
RANKING ENGINE         packages/ranking ← packages/metrics/rankings ← workers/rankings
     ↓
REST API               apps/api
     ↓
Frontend Lovable
```

## Couches et dépendances

```
                  ┌──────────────── apps/api ────────────────┐
                  │ routes (Express) → route() adapter (zod) │
                  │        → services (use cases, RBAC)      │
                  │        → ports (interfaces)              │
                  │        ← repositories/prisma (adapters)  │
                  └──────────────────┬───────────────────────┘
                                     │
   workers/* ──► packages/metrics ───┼──► packages/scoring ─┐
                   │  (pur)          ├──► packages/confidence├──► packages/shared
                   │  persistence ───┼──► packages/ranking  ─┤
                   ▼                 └──► packages/validation┘
             packages/database (Prisma)          integrations/pi ──► packages/shared
```

Règles :

- **Les moteurs métier sont purs** (`scoring`, `confidence`, `ranking`, `validation`, `metrics` sans `./persistence`) : aucune I/O, testables sans base.
- **Seuls les repositories** (`apps/api/src/repositories`, `packages/metrics/src/persistence.ts`, seed) connaissent Prisma.
- **Les services de l'API** dépendent d'interfaces (`domain/ports.ts`) ; les tests utilisent une implémentation en mémoire alimentée par le vrai moteur.
- **Aucun moteur ne dépend de Pi** : `integrations/pi` produit des données normalisées (`NormalizedTransaction`, `NormalizedMetricPoint`). Changer d'API Pi = changer d'adaptateur.
- **Présentateurs** (`domain/presenters.ts`) : la forme JSON publique est découplée du schéma SQL.

## Flux d'une requête

1. `helmet`, `cors` (liste blanche), `express.json` (100 kB), rate limiting (global + écritures).
2. `authenticate` : JWT HS256 optionnel ; l'utilisateur **et son rôle sont relus en base**.
3. `route()` valide `params`, `query`, `body` avec zod, puis appelle le service.
4. Le service applique RBAC (`auth/policies.ts`) et la logique métier, via les ports.
5. Réponse `{ data, meta }` ; toute erreur → `{ error: { code, message } }` (`middleware/errors.ts`).

## Historique append-only

- `app_metrics` et `ranking_snapshots` : `INSERT` uniquement (trigger `reject_history_update`).
- Un recalcul ajoute des lignes ; les lectures prennent la plus récente (`createdAt`) par jour.
- Chaque ligne porte `scoringVersion` (méthodologie qui l'a produite).

## Décisions (ADR)

Voir [`decisions/`](decisions/) :

| ADR | Sujet |
|---|---|
| [0001](decisions/0001-monorepo-workspaces-tsx.md) | Monorepo npm workspaces, exécution TypeScript via tsx |
| [0002](decisions/0002-zod-openapi-single-source.md) | zod comme source unique validation + OpenAPI |
| [0003](decisions/0003-no-blockchain-indexer-v1.md) | Pas d'indexeur blockchain en V1 ; ports Pi « UNAVAILABLE » |
| [0004](decisions/0004-database-level-guarantees.md) | Garanties au niveau base (append-only, CHECK) |
| [0005](decisions/0005-missing-data-handling.md) | Traitement des données manquantes |
| [0006](decisions/0006-independent-confidence-engine.md) | Moteur de confiance indépendant |
| [0007](decisions/0007-auth-v1-hs256-roles-from-db.md) | Authentification V1 |
| [0008](decisions/0008-in-memory-sorting-v1.md) | Tri et pagination en mémoire pour `/apps` et `/discover` |
| [0009](decisions/0009-metrics-orchestration-package.md) | Package d'orchestration `@pi/metrics` |
| [0010](decisions/0010-neutral-vocabulary-no-overall-ranking.md) | Vocabulaire neutre, pas de classement global |
