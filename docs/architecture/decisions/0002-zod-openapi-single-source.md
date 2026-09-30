# ADR-0002 — zod comme source unique de validation et d'OpenAPI

- Statut : accepté (V1)

## Contexte
Il faut valider systématiquement params/query/body et documenter l'API en OpenAPI. Deux sources séparées finissent toujours par diverger.

## Décision
- Validation avec **zod** (API v4, import `zod/v4`, compatible zod ≥ 3.25).
- Le document **OpenAPI 3.1** est généré à partir des mêmes schémas (`z.toJSONSchema`) dans `apps/api/src/openapi/document.ts`, servi sur `/api/openapi.json`, UI sur `/api/docs`, exporté dans `docs/api/openapi.json` (`npm run openapi:export`).
- Les schémas de **réponse** (`schemas/responses.ts`) servent à la documentation ; un test de contrat vérifie que la sortie des présentateurs les respecte.

## Conséquences
- Toute évolution de validation est automatiquement documentée.
- Aucun générateur tiers (zod-to-openapi) n'est nécessaire.
