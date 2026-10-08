# ADR-0003 — Stratégie de corpus A / B / C, disjonction et scellement

- Statut : **Proposé** (révisé v0.3 après audit)
- Remplace : « jeu étalon de 30–50 plans béninois »
- Liens : ADR-0001 · `DATASET-STRATEGY.md` · `ARCHITECTURE.md` §6

## Contexte
Un moteur de compréhension de plans doit généraliser à des conventions, qualités et origines variées. Valider la **perception** (corpus A/B) et valider le **produit** (métré, chiffrage ; corpus C) sont deux questions distinctes.

## Décision
1. **Trois corpus** : **A** général, **B** africain, **C** validation locale (un par marché : C‑BJ d'abord, C‑SN ensuite).
2. **Disjonction** : chaque plan appartient à **un seul** corpus, selon sa provenance. B = plans d'origine africaine curés pour le contexte africain ; A = plans du reste du monde et sources mondiales sans origine africaine identifiée + synthétiques ; C = projets réels d'un marché avec vérité terrain professionnelle. *(v0.2 listait « Afrique » dans A : recouvrement supprimé.)* Aucun plan de C n'est dans B ni dans A.
3. **Le pays est une métadonnée d'évaluation**, pas une entrée de modèle (ADR‑0001 R4) ; des tests **anti‑raccourci** (leave‑one‑region‑out, ablation du cartouche/texte) le vérifient.
4. **Un seul modèle universel par tâche** ; adaptateurs régionaux seulement si les métriques par tranche et le volume le justifient (nouvel ADR).
5. **Scellement** : A‑test, B‑test (15–20 %, tiré par source) et C entier ne servent jamais à l'entraînement ni au réglage. Découpage **par source** (cabinet > projet > plan > page ; pour le synthétique : famille de gabarit/graine du générateur), dédoublonnage inter‑corpus.
6. **Propagation du scellé** : tout dérivé d'une donnée scellée (corrections, annotations, sorties de modèle, caches) hérite du scellé. Les corrections de **production** (consenties) forment un flux « P » **exclu de tous les tests**. Séparation **technique** : les tests scellés vivent dans un stockage privé à accès contrôlé ; le pipeline d'entraînement n'y a aucun droit (T‑DAT‑03). Le dépôt de code ne contient que pointeurs et empreintes.
7. **Évaluation par tranches** (région × source × complexité × qualité) avec **effectifs et intervalles de confiance** (pas de verdict par tranche sous un effectif minimal), **calibration** par tranche, **non‑régression par tranche** et **porte de disponibilité** par marché. Les seuils chiffrés sont fixés après la mesure de base de la phase P0 (décision ouverte OD‑11).
8. **Taxonomie d'annotation unique et versionnée** ; jeux externes rattachés via tables de correspondance versionnées.
9. **Registre de provenance** par plan : source, licence, consentement, restrictions, retrait ; **registre de licences** pour les poids de départ et les dépendances logicielles ; chaque `ModelArtifact` enregistre sa version de dataset, ses métriques par tranche, sa calibration et son **domaine de validité**.
10. **Plans synthétiques** autorisés pour l'entraînement et le test du métré géométrique (vérité analytique, doublement vérifiée), **interdits** dans les tests de perception.
11. **Risque résiduel assumé** : un même bâtiment redessiné par plusieurs cabinets peut échapper au dédoublonnage ; documenté dans les rapports.

## Conséquences
- (+) Le Bénin valide le produit sans borner le moteur ; chaque marché ajoute un C.
- (+) Les défauts de perception et de règles locales se diagnostiquent séparément.
- (−) Infrastructure de données dès le départ (registre, accès séparés, outils d'annotation).
- (−) Corpus B dépendant de partenariats et de contrats (droit d'auteur).

## Alternatives écartées
- Corpus unique béninois : biais et plafond de généralisation.
- Jeux publics seuls : licences potentiellement non commerciales, biais géographique, aucune vérité de métré.
- Fixtures de corpus C dans le dépôt de code : contredit le scellement et la confidentialité.
