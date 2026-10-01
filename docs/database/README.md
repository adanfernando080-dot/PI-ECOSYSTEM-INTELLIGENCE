# Base de données

PostgreSQL 16 · Prisma 6 · schéma : `packages/database/prisma/schema.prisma` · migrations : `packages/database/prisma/migrations/`.

## Modèles

| Table | Rôle | Points clés |
|---|---|---|
| `users` | comptes (`USER`, `DEVELOPER`, `ADMIN`) | `piUsername` unique |
| `developers` | profils développeur | `verificationStatus`, lien 1-1 optionnel vers `users` |
| `categories` | taxonomie partagée | `slug` unique ; non marquée DEMO |
| `apps` | applications | `status` (`PENDING`→`ACTIVE`/`INACTIVE`/`REJECTED`), `methodologyNote`, `tags`, `firstSeenAt`/`lastSeenAt` |
| `data_sources` | sources de données | `type` (`BLOCKCHAIN`, `PI_API`, `DEVELOPER`, `COMMUNITY`, `SYSTEM`), `trustLevel` 0–100 |
| `raw_metrics` | points bruts (souvent journaliers) | `metricType`, `value` **NULL si UNAVAILABLE**, `provenance`, `metadata` (ex. `attributionConfidence`) |
| `app_metrics` | **historique append-only** des scores | un row par (app, période, date de fin, calcul) ; `details` = décomposition ; `stakedPi` distinct ; `scoringVersion` |
| `transactions` | transactions observées | `appId` nullable, `attributionConfidence` 0–1, `attributionMethod` |
| `reviews` | avis | note 1–5, `status` (`PENDING`, `PUBLISHED`, `HIDDEN`), `signals` neutres, un avis par (app, user) |
| `ranking_snapshots` | **snapshots append-only** des classements | lot identifié par `computedAt` |
| `anomalies` | signaux statistiques | `status` (`NEW`, `INVESTIGATING`, `RESOLVED`, `DISMISSED`), `fingerprint` unique |
| `favorites` | favoris utilisateur | PK (userId, appId) |
| `app_claims` | revendications d'apps | `PENDING` → `APPROVED`/`REJECTED` |

`metricType` : `TRANSACTION_COUNT`, `TRANSACTION_VOLUME_PI`, `ACTIVE_ADDRESSES`, `ACTIVE_USERS`, `STAKED_PI` (collecté, **jamais scoré**).
`period` (`MetricPeriod`) : stocké `24h`, `7d`, `30d`, `90d`.

## Garanties au niveau base (migration `20260929000000_init`)

- Triggers `app_metrics_append_only` et `ranking_snapshots_append_only` : tout `UPDATE` lève une exception.
- `CHECK` : provenance ⇔ valeur, note 1–5, scores 0–100, trust 0–100, attribution 0–1, `periodEnd > periodStart`.

Voir [ADR-0004](../architecture/decisions/0004-database-level-guarantees.md). Vérifié sur PostgreSQL 16 (migration appliquée, chaque garde-fou rejette l'écriture invalide, le jeu DEMO complet — 7 152 points bruts, 4 320 lignes d'historique, 289 lignes de classement, 5 anomalies — s'insère sans violation).

## Données DEMO

- Toutes les lignes insérées par le seed ont `isDemo = true` (apps, users, developers, sources, raw_metrics, transactions, reviews, app_metrics, snapshots, anomalies).
- Sources nommées `DEMO · …`, URLs en `.demo.invalid`, hash de transactions préfixés `demo_`, descriptions préfixées `[DEMO]`.
- Relancer le seed supprime d'abord les lignes `isDemo = true` ; les données réelles ne sont jamais touchées.
- **Garde de sécurité** (`packages/database/src/seed/guard.ts`, évalué avant toute connexion, aussi appelé par `db:reset` *avant* l'effacement) :
  - base **locale** (`localhost`, `127.0.0.0/8`, `::1`, socket unix) : autorisée sans réglage ;
  - base **distante** (tout autre hôte, y compris via les paramètres `host=` / `hostaddr=` de l'URL) : **refusée par défaut**, quel que soit `NODE_ENV` ; elle n'est autorisée que si `SEED_ALLOW_REMOTE_DATABASE` vaut **exactement le nom d'hôte** de la base visée (une valeur générique comme `true` est refusée) ;
  - `NODE_ENV=production` exige en plus `SEED_ALLOW_PRODUCTION=true` ;
  - les messages d'erreur n'affichent que le nom d'hôte, jamais l'URL, l'utilisateur ni le mot de passe.

## Commandes

```bash
npm run db:generate      # client Prisma
npm run db:migrate       # prisma migrate deploy
npm run db:migrate:dev   # nouvelle migration en développement (conserver triggers / CHECK !)
npm run db:seed          # jeu DEMO + 90 jours d'historique calculé par le vrai moteur
npm run db:reset         # reset complet + seed (développement uniquement ; le garde du seed s'exécute AVANT l'effacement)
```

## Évolutions prévues

- Vue matérialisée `latest_app_metrics` pour trier/paginer en SQL ([ADR-0008](../architecture/decisions/0008-in-memory-sorting-v1.md)).
- Partitionnement de `raw_metrics` / `transactions` par mois quand l'ingestion réelle démarrera.
