# ADR-0006 — Moteur de confiance indépendant

- Statut : accepté (V1)

## Décision
La confiance vit dans son propre package `@pi/confidence`, sans dépendance vers `@pi/scoring`. Elle décrit la **qualité des données** (provenance, fraîcheur, complétude, cohérence, sources concordantes), pas la qualité de l'application. Elle entre à 10 % dans le Pi Ecosystem Score et sert de filtre (`minConfidence`) dans les classements et la découverte.

## Conséquences
- Le moteur peut évoluer (nouveaux signaux de qualité) sans toucher aux scores.
- `CONFIDENCE_VERSION` est stocké avec chaque ligne de métriques (`scoringVersion = scoring-vX+confidence-vY`).
