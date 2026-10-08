# ADR-0003 — Stratégie de corpus A / B / C et scellement des tests

- Statut : **Proposé** (v0.2)
- Remplace : « jeu étalon de 30–50 plans béninois »
- Liens : ADR-0001 · `DATASET-STRATEGY.md` · `ARCHITECTURE.md` §6

## Contexte
Un moteur de compréhension de plans doit généraliser à des conventions, qualités et origines variées. S'entraîner et se valider sur un seul pays enfermerait le moteur ; s'appuyer uniquement sur des jeux publics (surtout européens/asiatiques) laisserait des angles morts africains ; et la validation du **produit** (métré, chiffrage) exige des projets réels avec une vérité terrain professionnelle.

## Décision
1. **Trois corpus** : **A** général (compréhension générale), **B** africain (robustesse aux pratiques et représentations africaines), **C** local de validation (un par marché : C‑BJ d'abord).
2. **Le pays est une métadonnée d'évaluation**, pas une entrée de modèle (cf. ADR‑0001 R4).
3. **Un seul modèle universel par tâche** ; adaptateurs régionaux seulement si les métriques par tranche et le volume le justifient (nouvel ADR).
4. **Scellement** : A‑test, B‑test (15–20 %, tiré par source) et C entier ne servent jamais à l'entraînement ni au réglage. Découpage **par source** (projet/cabinet/gabarit), dédoublonnage inter‑corpus.
5. **Évaluation par tranches** (région × type de source × complexité × qualité) avec **non‑régression par tranche** et **porte de disponibilité** par marché.
6. **Taxonomie d'annotation unique et versionnée** ; jeux externes rattachés via tables de correspondance versionnées.
7. **Registre de provenance** par plan (licence, consentement, restrictions, retrait) ; chaque `ModelArtifact` enregistre sa version de dataset, ses métriques par tranche et son **domaine de validité**.
8. **Plans synthétiques** autorisés pour l'entraînement et le test du métré géométrique (vérité analytique), **interdits** dans les tests de perception.

## Conséquences
- (+) Le Bénin valide le produit sans borner le moteur ; chaque nouveau pays ajoute un C, pas un nouveau moteur.
- (+) Les défauts de perception et les défauts de règles locales sont diagnostiqués séparément.
- (−) Coût d'infrastructure de données (registre, outils d'annotation, versionnement) dès le départ.
- (−) Constitution du corpus B : dépend de partenariats et de contrats (droit d'auteur sur les plans).

## Alternatives écartées
- Corpus unique béninois : biais et plafond de généralisation.
- Entraînement sur jeux publics seuls : licences potentiellement non commerciales, biais géographique, aucune vérité de métré.
