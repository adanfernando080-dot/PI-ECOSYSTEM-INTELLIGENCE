# ADR-0001 — Monorepo npm workspaces, exécution via tsx

- Statut : accepté (V1)
- Date : 2026-09-29

## Contexte
Le cahier des charges impose une séparation nette (API, domaine, persistance, intégrations, workers, scoring, validation) et une structure `apps/ packages/ workers/`.

## Décision
- Monorepo **npm workspaces** : chaque module est un package `@pi/*` avec son `package.json`.
- Les packages exposent directement leurs sources TypeScript (`main: src/index.ts`) ; l'exécution passe par **tsx** (API, workers, seed, scripts). Pas d'étape de build en V1.
- Un seul `tsconfig.json` strict (`strict`, `noUncheckedIndexedAccess`) ; `npm run typecheck` vérifie tout le dépôt.

## Conséquences
- Démarrage simple, pas de désynchronisation `dist/` ↔ `src/`.
- En production, tsx compile à la volée au démarrage (coût de quelques centaines de ms). Si nécessaire plus tard : bundler (tsup/esbuild) par application, sans changer les packages.
