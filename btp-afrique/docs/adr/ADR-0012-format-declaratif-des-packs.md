# ADR-0012 — Format déclaratif des packs : vocabulaire fermé « declarative-1 »

- Statut : **Accepté pour M0** (implémenté : `src/core/pack/*`, `tests/market`)
- Liens : ADR-0004, ADR-0008 · REQ-08, REQ-22

## Contexte
Le brief initial prévoyait un langage d'expressions « sûr » pour les règles. Pour M0, aucun besoin réel n'en justifie un : ouvrages, correspondances, déductions et structures de coût s'expriment par des **objets structurés**.

## Décision
1. Un pack est un **document JSON de données pures** (jamais de code), signé, avec `packSchemaVersion`, `requires.{engineApi, specTaxonomy, ruleLanguage}`.
2. Le moteur n'exécute qu'un **vocabulaire fermé `declarative-1`** : bases de métré (7), cibles de correspondance (8), natures de coût (4), types de couches (`sum`, `percent`, `fixed`), portées (`line`, `total`), effets (`add`, `tax`), modes de déduction (`net`, `gross`, `threshold`), modes d'arrondi, dispositions de document (`priced-lines`, `quote`).
3. **Tout élément hors vocabulaire est refusé à la validation** avec le message « exige une évolution du moteur (ADR) ». Un marché dont les besoins sortent du vocabulaire ne peut donc pas être « bricolé » : l'évolution du moteur est explicite, versionnée (`engineApi`), documentée par ADR, et vaut pour **tous** les marchés. Le garde‑fou CI `check-pack-isolation` impose ce passage par un ADR (`ENGINE-CHANGE: ADR-NNNN`).
4. **Pas de langage d'expressions libre en M0.** Critère pour en introduire un : deux marchés réels exigent des formules que le vocabulaire ne couvre pas sans prolifération de types. À ce moment, ADR dédié (évaluateur sûr, typé par dimensions, sans I/O).
5. **Fusion à l'héritage** : collections à clé (override/add/remove) ; objets `params`/`rounding` fusionnés champ à champ ; `currency`, `measurementMethod`, `costBuildUp` **remplacés** en bloc (l'ordre des couches est sémantique).
6. **Paramètres obligatoires** (`staleAfterDays`, `lowConfidenceBelow`) : aucun défaut dans le moteur. Les sous‑ouvrages ignorent `basis` (réservé aux ouvrages mappés).

## Conséquences
(+) Sûreté et auditabilité maximales ; ajout de marché sans code tant que le vocabulaire suffit. (−) Risque de prolifération du vocabulaire (OD‑21) : surveiller le nombre d'évolutions demandées par marché.
