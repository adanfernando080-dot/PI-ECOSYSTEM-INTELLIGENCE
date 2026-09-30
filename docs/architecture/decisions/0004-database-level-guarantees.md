# ADR-0004 — Garanties au niveau de la base de données

- Statut : accepté (V1)

## Contexte
Certaines règles sont trop importantes pour ne reposer que sur le code applicatif : historique non écrasable, provenance cohérente, bornes des scores.

## Décision
La migration initiale ajoute, en plus du schéma Prisma :

| Garantie | Mécanisme |
|---|---|
| `app_metrics`, `ranking_snapshots` append-only | trigger `BEFORE UPDATE` → exception |
| `UNAVAILABLE` ⇔ `value IS NULL` | `CHECK raw_metrics_provenance_value` |
| note 1–5 | `CHECK reviews_rating_range` |
| scores 0–100 | `CHECK app_metrics_score_range` |
| confiance d'attribution 0–1, trust 0–100, période non vide | `CHECK` |

## Conséquences
- Un bug applicatif ne peut pas corrompre l'historique ni enregistrer un « 0 » à la place d'une donnée manquante.
- `prisma migrate dev` ignore ces objets (non modélisables) : toute future migration doit les conserver.
- Vérifié sur PostgreSQL 16 : les trois garde-fous rejettent les écritures invalides.
