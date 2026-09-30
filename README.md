# Pi Ecosystem Intelligence — Backend V1

> **Discover. Analyze. Compare.** Plateforme indépendante d'analyse, de comparaison et de découverte de l'écosystème Pi.

Ce dépôt contient la fondation backend V1 : API REST, base PostgreSQL, moteurs métier (scoring, confiance, classements, anomalies), données de démonstration et documentation. Le frontend (Lovable) consomme uniquement l'API ; il ne connaît pas la base de données.

## Principes non négociables

| Principe | Où c'est appliqué |
|---|---|
| Chaque donnée a une **provenance** (`OBSERVABLE`, `DEVELOPER_REPORTED`, `ESTIMATED`, `UNAVAILABLE`) | enum Prisma + contrainte SQL `raw_metrics_provenance_value` |
| Une donnée manquante **n'est jamais 0** | `null` partout, poids redistribués, extrapolation à partir des jours observés, confiance réduite |
| Le volume de transactions **n'est pas un revenu** | `ObservableEconomicActivity` (`label: observable_economic_activity`) |
| Une anomalie **n'est pas une preuve de fraude** | vocabulaire neutre, test automatique `findVerdictTerms` |
| Le **staking** est une métrique distincte, hors score V1 | `OverallInput` n'a pas de champ staking ; `staking.includedInScores: false` |
| **Neutralité** : pas de « meilleure app » | aucun classement global, aucun champ `best_app`/`winner` |
| L'historique n'est **jamais écrasé** | triggers PostgreSQL append-only sur `app_metrics` et `ranking_snapshots` |
| Les données de démo sont **explicitement DEMO** | `isDemo = true` sur chaque ligne, `meta.containsDemoData` dans chaque réponse |

## Démarrage rapide

```bash
cp .env.example .env                      # puis définir JWT_SECRET (≥ 32 caractères)
npm install
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
npm run db:generate && npm run db:migrate
npm run db:seed                           # 12 apps DEMO + 90 jours d'historique calculé
npm run dev                               # http://localhost:3000/api/docs
npm test                                  # tests unitaires
npm run test:integration                  # tests d'intégration (base de test)
```

Guide complet : [`docs/development/README.md`](docs/development/README.md).

## Structure

```
apps/api/                 API REST Express (routes → services → ports ← repositories Prisma)
packages/shared/          vocabulaire, périodes, maths, enveloppe API, erreurs
packages/database/        schéma Prisma, migrations, client, seed DEMO
packages/scoring/         Activity, Growth, ObservableEconomicActivity, Community, Transparency, Pi Ecosystem Score
packages/confidence/      moteur de confiance des données (indépendant)
packages/ranking/         moteur de classements analytiques
packages/validation/      validation/normalisation des données, moteur d'anomalies, assainissement des avis
packages/metrics/         orchestration du pipeline (pur) + persistance Prisma (append-only)
integrations/pi/          ports Pi (Platform API, auth, blockchain, staking) + adaptateurs V1 « UNAVAILABLE »
workers/                  metrics, rankings, anomalies, blockchain-sync (placeholder)
infrastructure/docker/    Dockerfile, docker-compose
docs/                     architecture (+ ADR), api (+ openapi.json), scoring, database, development
```

## Documentation

- Architecture et décisions : [`docs/architecture`](docs/architecture/README.md)
- API et OpenAPI : [`docs/api`](docs/api/README.md) — spec servie sur `/api/openapi.json`, UI sur `/api/docs`
- Méthodologie de scoring : [`docs/scoring`](docs/scoring/README.md) — aussi servie sur `/api/meta/methodology`
- Base de données : [`docs/database`](docs/database/README.md)
- Développement : [`docs/development`](docs/development/README.md)
