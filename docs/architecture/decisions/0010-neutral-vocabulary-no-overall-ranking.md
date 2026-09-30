# ADR-0010 — Vocabulaire neutre, pas de classement global

- Statut : accepté (V1)

## Décision
- Le **Pi Ecosystem Score** est calculé et historisé (`overallScore`), exposé comme `piEcosystemScore` avec la mention « indicateur analytique composite, pas un verdict ».
- **Aucun classement** n'est construit sur ce score ; les types de classements sont limités à : activity, growth, economic, community, transparency, trending, rising, new.
- Aucun champ ni endpoint `best_app`, `best_apps`, `winner` ; `sort=best` est rejeté par la validation.
- Les explications d'anomalies utilisent « unusual activity », « concentration signal », etc., et rappellent qu'il ne s'agit pas d'une conclusion. `findVerdictTerms()` (fraud / scam / fake) est vérifié dans les tests des moteurs et des sorties publiques.
- `/api/compare` affiche les indicateurs côte à côte sans désigner d'application préférable.
