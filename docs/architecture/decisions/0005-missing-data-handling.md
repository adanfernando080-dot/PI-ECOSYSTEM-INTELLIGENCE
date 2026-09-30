# ADR-0005 — Traitement des données manquantes

- Statut : accepté (V1)

## Contexte
« Une donnée manquante ne doit pas automatiquement être interprétée comme zéro. »

## Décision
1. **Stockage** : valeur `NULL` + provenance `UNAVAILABLE` (contrainte SQL).
2. **Totaux de fenêtre** (`windowTotal`) :
   - jours **avant la première apparition** de l'app = zéros *connus* (l'app n'existait pas) ;
   - jours **sans donnée** = inconnus : le total est `taux journalier observé × jours de la fenêtre`, marqué `extrapolated` ;
   - si moins de **50 %** des jours sont connus → total `null`.
3. **Moteurs de score** : un composant `null` est exclu et les poids restants sont renormalisés ; la `coverage` est publiée. Sous un seuil de couverture (40–50 % selon le moteur), le score est `null`.
4. **Confiance** : la complétude (couverture des moteurs + couverture des jours) réduit le score de confiance.
5. **Tri/classements** : une valeur indisponible est triée en dernier ou exclue du classement, jamais classée avec 0.
6. **Community** : sans avis publié, le score est `null` (ni 0, ni la moyenne a priori).

## Conséquences
- Une panne de fournisseur baisse la confiance au lieu de faire chuter les scores.
- L'extrapolation est traçable (`details.measures.*Extrapolated`).
