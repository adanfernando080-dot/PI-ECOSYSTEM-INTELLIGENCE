# Développement

## Prérequis

- Node.js ≥ 20 (testé avec 22), npm ≥ 10
- Docker + Docker Compose (PostgreSQL 16, Redis 7) — ou un PostgreSQL local

## Installation

```bash
cp .env.example .env
npm install
npm run db:generate
```

> Déploiement cloud (bêta lecture seule) : voir [`docs/deployment/README.md`](../deployment/README.md) et [`render.yaml`](../../render.yaml).

## Variables d'environnement

| Variable | Obligatoire | Défaut | Rôle |
|---|---|---|---|
| `DATABASE_URL` | oui | — | chaîne PostgreSQL |
| `JWT_SECRET` | oui | — | ≥ 32 caractères, **serveur uniquement** |
| `JWT_ISSUER` | non | `pi-ecosystem-intelligence` | émetteur attendu |
| `NODE_ENV` | non | `development` | `development` / `test` / `production` |
| `PORT` | non | `3000` | |
| `LOG_LEVEL` | non | `info` | niveau pino |
| `CORS_ORIGINS` | **oui en production** | dev/test : `http://localhost:5173` ; production : aucun | origines autorisées (frontend Lovable), séparées par des virgules. En production : obligatoire, `https` uniquement, pas de `*`, pas de localhost, origine « nue » (sans chemin ni `/` final) ; sinon l'API refuse de démarrer |
| `REDIS_URL` | non | — | store du rate limiting (sinon mémoire) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `RATE_LIMIT_WRITE_MAX` | non | 60000 / 120 / 20 | |
| `PI_API_KEY`, `PI_API_BASE_URL` | non | — | réservés à l'intégration Pi (inutilisés en V1, jamais exposés) |

La configuration est validée au démarrage (`apps/api/src/config/env.ts`) : l'API refuse de démarrer si elle est invalide.

## Base de données

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
npm run db:migrate
npm run db:seed
```

Le seed génère 12 applications fictives (PiMarket, PiJobs, PiLearn, PiGames, PiServices, PiAI Hub, PiTravel, PiStore, PiTools, PiSocial, PiPay Tools, PiCreator), 180 jours de métriques brutes, des transactions, des avis, puis **exécute le vrai pipeline** sur 90 jours (4 périodes) → historique, classements et anomalies disponibles immédiatement. Scénarios inclus : pic d'activité (PiGames), signal de concentration + motif répétitif (PiPay Tools), rafale d'avis (PiServices), déclin (PiTravel), app récente (PiCreator), app sans avis et avec panne de données (PiTools), données uniquement déclarées (PiSocial).

## Lancer l'API

```bash
npm run dev          # watch
npm start
```

- Docs interactives : http://localhost:3000/api/docs
- Spec : http://localhost:3000/api/openapi.json (`npm run openapi:export` met à jour `docs/api/openapi.json`)

Jetons de développement (utilisateurs DEMO : `demo_admin`, `demo_dev_market`, `demo_dev_ai`, …, `demo_user_01` à `demo_user_60`) :

```bash
npm run -s token:dev -- demo_admin
```

## Workers

```bash
npm run worker:metrics   -- --date=2026-09-28   # défaut : dernier jour UTC complet
npm run worker:rankings  -- --date=2026-09-28
npm run worker:anomalies -- --date=2026-09-28
npm run pipeline                                # les trois à la suite
npm run worker:blockchain-sync                  # placeholder V1 : indique que la source est indisponible
```

À planifier quotidiennement (cron, scheduler de l'hébergeur, ou `docker compose --profile workers run --rm worker-metrics`). Tous les workers **ajoutent** des lignes, ils ne modifient jamais l'historique.

## Tests

```bash
npm run typecheck
npm test                    # = unit + integration
npm run test:unit           # moteurs, services, schémas, OpenAPI, HTTP (sans base)
DATABASE_URL=postgresql://pi:pi@localhost:5432/pi_ecosystem_test npm run test:integration
```

Les tests d'intégration **réinitialisent** la base (`prisma migrate reset`) puis lancent le seed : ils refusent une URL qui ne contient pas `test`.

| Suite | Contenu |
|---|---|
| `packages/scoring/tests` | Activity, Growth (anti-domination), Economic (pas de « revenue »), Community (bayésien), Transparency, Pi Ecosystem Score (poids, staking exclu) |
| `packages/confidence/tests` | niveaux, provenance, fraîcheur, cohérence, sources |
| `packages/ranking/tests` | ordre, exclusion des indisponibles, égalités, trending/rising/new, pas de classement global |
| `packages/validation/tests` | validation des métriques, normalisation multi-sources, anomalies (vocabulaire neutre), assainissement |
| `packages/metrics/tests` | totaux de fenêtre (extrapolation, jours avant lancement), mesures |
| `packages/database/tests` | jeu DEMO (déterminisme, marquage), pipeline complet sur le jeu DEMO |
| `integrations/pi/tests` | ports « UNAVAILABLE », clé jamais exposée, attribution |
| `apps/api/tests/*.test.ts` | JWT, RBAC, schémas, services (pagination, discovery, reviews, permissions…), route adapter, OpenAPI + contrat de réponse, HTTP (supertest) |
| `apps/api/tests/integration` | API complète sur PostgreSQL réel |

## Docker (pile complète)

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
docker compose -f infrastructure/docker/docker-compose.yml --profile tools run --rm migrate
docker compose -f infrastructure/docker/docker-compose.yml --profile tools run --rm seed
docker compose -f infrastructure/docker/docker-compose.yml up -d api
```

## Brancher le frontend Lovable

- Définir `CORS_ORIGINS` avec l'URL du frontend.
- Le frontend n'appelle que l'API (voir [docs/api](../api/README.md)) ; il doit afficher `isDemo` / `meta.demoNotice` quand ils sont présents et traiter `null` comme « indisponible ».
- Aucune clé serveur ne doit être placée dans le frontend.
