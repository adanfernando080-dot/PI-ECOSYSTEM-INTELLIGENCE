# ADR-0008 — Tri et pagination en mémoire pour `/apps` et `/discover`

- Statut : accepté (V1)

## Contexte
Le tri par score requiert de joindre la dernière ligne `app_metrics` par app (historique append-only).

## Décision
En V1, les apps filtrées sont chargées, leurs dernières métriques récupérées en une requête (`DISTINCT` sur `appId`), puis triées et paginées en mémoire. Les valeurs indisponibles sont toujours triées en dernier.

## Conséquences
- Simple et correct jusqu'à quelques milliers d'applications.
- Au-delà : vue matérialisée `latest_app_metrics` rafraîchie par le worker metrics, puis tri/pagination SQL — sans changer le contrat d'API.
