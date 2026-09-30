# ADR-0009 — Package d'orchestration `@pi/metrics`

- Statut : accepté (V1)

## Contexte
Le pipeline (normalisation → mesures → scores → classements → anomalies) est utilisé par les workers, par le seed (90 jours d'historique) et par l'endpoint admin de recalcul.

## Décision
`packages/metrics` contient :
- une partie **pure** (`index.ts`) : `extractMeasures`, `computeSnapshot`, `computeRankings`, `detectAppAnomalies` ;
- une partie **persistance** (`@pi/metrics/persistence`) : chargement Prisma, écriture append-only, `runPipeline`.

Les workers ne sont que des lanceurs CLI. Le package dépend de `@prisma/client` (types) mais pas de `@pi/database`, ce qui évite un cycle avec le seed.

## Conséquences
- Le même code calcule l'historique du seed, les recalculs admin et le batch quotidien.
- Le pipeline complet est testé sans base sur le jeu DEMO.
