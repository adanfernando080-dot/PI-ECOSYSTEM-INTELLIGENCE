# ADR-0019 — Gouvernance de la taxonomie de construction neutre

- Statut : **Accepté pour M0** (`taxonomy/spec-taxonomy.json` v1.0.0 ; contrôles dans `tests/purity`, `tests/model`)
- Liens : ADR-0002, ADR-0012 · REQ-18

## Décision
1. **Identifiants stables, hiérarchiques, anglais, minuscules, pointés** (`masonry.block.hollow`). Un identifiant publié n'est **jamais renommé ni réutilisé** ; il peut être déprécié (`deprecatedBy`).
2. **Semver** : ajout de classe = **mineur** (compatible) ; retrait/renommage/changement de sens = **majeur**. Un pack déclare `requires.specTaxonomy` ; la validation refuse une version majeure incompatible.
3. **Neutralité** : une classe décrit une *solution constructive*, jamais un produit, une marque, une dimension commerciale ni un pays (vérifié par test : aucun nom de produit/marché dans le fichier).
4. **Processus d'ajout** : demande motivée (cas réel de plan ou de pack) → vérification de non‑recouvrement → revue par un binôme **ingénieur/architecte** + un **métreur** → mise à jour de la version → table de correspondance des jeux de données d'annotation (`DATASET-STRATEGY.md` §3). Qui valide au sein de l'équipe : OD‑17.
5. **Une classe manquante bloque le mapping, pas le moteur** : l'élément reste `unmapped_spec` jusqu'à ajout de la classe ou choix explicite de l'utilisateur.
6. **Usage** : le modèle et les finitions n'acceptent que des classes de la taxonomie ; l'IA de perception émet ces classes (jamais de produit).

## Conséquences
(+) Langage commun universel, packs comparables. (−) Goulot éditorial possible quand les marchés se multiplient ; prévoir un comité léger.
