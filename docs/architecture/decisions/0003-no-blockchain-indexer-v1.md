# ADR-0003 — Pas d'indexeur blockchain en V1 ; ports Pi « UNAVAILABLE »

- Statut : accepté (V1)

## Contexte
Le cahier des charges demande de ne pas commencer par un indexeur, de ne pas dépendre du Staking Data API, et de rendre le cœur indépendant des détails de Pi.

## Décision
- `integrations/pi` définit des **ports** : `PiPlatformClient`, `PiAuthProvider`, `BlockchainDataProvider`, `StakingDataProvider`, et des **types normalisés** (`NormalizedTransaction`, `NormalizedMetricPoint`).
- Chaque port renvoie `ProviderResult<T>` = `{ available: true, data } | { available: false, reason }`.
- En V1 tous les adaptateurs renvoient **`available: false`** : renvoyer `[]` ou `0` ferait croire à « aucune activité observée ».
- Règle d'attribution centralisée : `attributionFor()` (une transaction sous 0,5 de confiance n'est pas liée à une app).
- `workers/blockchain-sync` est un placeholder qui décrit les étapes futures.
- Les clés Pi (`PI_API_KEY`) ne sont lues que côté serveur et ne sont jamais sérialisées (test dédié).

## Conséquences
- Les données V1 proviennent du seed DEMO et des déclarations des développeurs.
- Ajouter un fournisseur réel = implémenter un port + l'enregistrer dans `createPiIntegration()`.
