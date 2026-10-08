# ADR-0008 — Généricité des packs : zones, structure de coût, documents, identifiants légaux

- Statut : **Proposé** (v0.3, issu de l'audit)
- Liens : ADR-0001, ADR-0004 · `ARCHITECTURE.md` §5, §9, §10 · tests T‑PRC‑01/02, T‑DOC‑01, T‑MKT‑01/03

## Contexte
Le test « Bénin ↔ Sénégal » montre que trois conventions encore figées dans les mécaniques du moteur auraient exigé de le modifier :
1. **Hiérarchie géographique** codée pays → région → ville (cascade de prix) alors que les niveaux administratifs diffèrent d'un marché à l'autre.
2. **Structure de coût** (déboursé sec → frais → marge → coefficient) codée dans `core-pricing`, alors qu'elle reflète une pratique francophone ; d'autres marchés utilisent d'autres couches (sommes provisionnelles, prime cost, régie…).
3. **Types de documents et identifiants** (DQE/DPGF/devis ; RCCM/IFU) et **numérotation** codés dans `core-docs`.
S'y ajoutent un seuil de péremption des prix (« 90 jours ») codé en dur et des définitions de devises dans `core-units`.

## Décision
1. **`Zone`** : arbre typé défini par le pack (types de niveaux, noms, parenté). La cascade de prix remonte l'arbre ; sortir du périmètre du pack est interdit sans signalement.
2. **`CostBuildUp`** : séquence ordonnée de couches (`sum`, `percent`, `fixed`, `taxRuleSet`…) évaluée par un interpréteur générique ; taux fournis par paramètres de l'`Estimate` (valeurs par défaut du pack). `EstimateLine` conserve le montant **par couche**.
3. **`DocumentTemplate` / `LegalIdentifier` / `NumberingRule`** : types de documents, libellés et formats d'identifiants, règles de numérotation définis par le pack ; le core ne connaît que le `DocumentModel` neutre (sections, tableaux, totaux, mentions).
4. **`WorkBreakdown`** (lots/sections) défini par le pack.
5. **Paramètres de politique obligatoires** (ex. `staleAfterDays`) : la validation du pack échoue s'ils manquent ; aucun défaut dans le moteur (ADR‑0001 R7).
6. **Devises** : définitions (code, unités mineures, arrondi, parités) fournies par données ; `core-money` ne contient aucun code de devise.
7. **Langue** : traduction de l'interface = application ; glossaire et textes de documents = pack.
8. **Pack factice divergent** obligatoire en CI : il doit **différer** du Bénin sur chacune de ces dimensions, car le Sénégal (même devise, même langue) ne les teste pas.

## Conséquences
- (+) Ajouter un marché ne requiert aucune modification de `core-*`.
- (−) Le langage de déclaration des couches de coût et des règles fiscales doit être conçu avec soin (expressivité suffisante, évaluation sûre) ; surveiller la dérive vers un langage de programmation.

## Alternatives écartées
- Structures de coût/documents « configurables » par simples paramètres numériques : insuffisant pour des couches différentes.
- Plugins en code par marché : rompt « les packs sont des données signées ».
