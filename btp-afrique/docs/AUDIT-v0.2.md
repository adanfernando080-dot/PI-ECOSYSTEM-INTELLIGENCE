# Audit de cohérence de l'architecture v0.2 (résultats, corrections → v0.3)

> Portée : `ARCHITECTURE.md` (relu intégralement), `DATASET-STRATEGY.md`, `adr/ADR-0001` à `0004`, `adr/README.md`.
> Nature : audit **documentaire** (aucun code n'existe encore). Le script `../tools/check_traceability.py` vérifie la structure (exigences ↔ tests ↔ ADR), pas la justesse sémantique ; celle-ci repose sur la relecture ci‑dessous.
> Navigation : [`INDEX.md`](INDEX.md).

## 1. Synthèse

- **35 constats** : 14 critiques (rupture d'étanchéité ou contradiction), 16 moyens, 5 mineurs.
- **34 corrigés** dans la v0.3 ; 1 reste ouvert (nom du produit, cosmétique : A-35).
- 3 points auraient exigé une modification du moteur pour ajouter le Sénégal (niveaux administratifs figés, structure de coût figée, types de documents/identifiants légaux figés) : **corrigés**.
- 4 nouveaux ADR (0005 à 0008), 3 nouvelles décisions (D15 à D17), 10 tests ajoutés au catalogue (59 au total), 28 exigences toutes couvertes par au moins un test défini.
- Aucun test n'est encore **implémenté** : « couvert » signifie « défini et planifié ».

## 2. Constats et corrections

Sévérité : **C** critique · **M** moyenne · **m** mineure.

| ID | Sév. | Constat (v0.2) | Correction (v0.3) | Où |
|---|:--:|---|---|---|
| A-01 | C | Le modèle architectural référençait un pack (`defaultedBy: pack.bj/…`) et matérialisait des défauts du pack comme `default_rule` → modèle dépendant d'un marché, rejeu multi‑packs impossible | `AssumptionSet` explicite, le pack *propose*, l'utilisateur *confirme* ; plus aucune référence de pack dans le modèle | ADR-0005, ARCH §3.3/3.5/3.7 |
| A-02 | C | La trace mêlait étages 1 et 2, citait des codes lisibles (`wall:M-023`) et une version `BJ-gros-oeuvre@…` | Trace à deux niveaux liés par `GeoQuantity.id`, références `{id, rev, hash}` | ARCH §4.5, ADR-0007 |
| A-03 | C | `Assembly.measure: wall.netArea` contredisait la `MeasurementMethod` (qui choisit brute/nette) | `measureBasis` côté assemblage, choix brute/nette côté méthode | ARCH §4.2/4.3, ADR-0002 |
| A-04 | C | Cascade de prix figée « ville → région → pays » | Arbre de zones typé défini par le pack | ARCH §5.3, §9.1, ADR-0008 |
| A-05 | C | Structure de coût (déboursé → frais → marge → coefficient) codée dans `core-pricing` | `CostBuildUp` déclaré par le pack | ARCH §5.4, ADR-0008 |
| A-06 | C | Types de documents (DQE/DPGF/devis) et identifiants (RCCM/IFU) dans `core-docs` | Core = `DocumentModel` neutre ; types, identifiants légaux, numérotation = pack | ARCH §10, ADR-0008 |
| A-07 | C | Seuil « 90 jours » de péremption codé dans le moteur | `staleAfterDays` obligatoire dans le pack (validation échoue sinon) | ARCH §5.3, ADR-0001 R7 |
| A-08 | C | `core-units` incluait « devises » alors que R3 interdit les codes de devise dans le moteur | `core-money` sans code de devise ; définitions par données | ARCH §16, ADR-0008 |
| A-09 | C | « Bit à bit » promis mais flottants et trigonométrie non déterministes entre plateformes | Virgule fixe, décimal, pas de trigonométrie flottante, version du moteur dans les traces | ADR-0006, ARCH §3.1/3.4, T-ENG-03 |
| A-10 | C | R1 (ADR-0001) ne couvrait pas `core-measure`, `core-pricing`, `core-docs` qui exécutent des données de pack | R1 étendue à tous `core-*` et `ai-*` ; R8 (aucune modification du moteur à l'ajout d'un pack) | ADR-0001 |
| A-11 | C | Deux mécanismes contradictoires : propositions IA hors modèle vs état `unreviewed` dans le modèle | Machine d'états unique : `accepted`/`edited`/`batch_accepted`/`rejected` ; `unreviewed` supprimé | ARCH §3.3, §6.2, ADR-0005 |
| A-12 | C | `fixtures/golden` (corpus C) dans le dépôt de code : contredit scellement, confidentialité et droits d'auteur | Pointeurs + empreintes seulement ; stockage privé, accès séparé de l'entraînement | ARCH §16, ADR-0003, T-DAT-03 |
| A-13 | C | Recouvrement A/B : « Afrique » listé dans A | Règle de disjonction par provenance | DATASET §2, ADR-0003 |
| A-14 | C | Packs et prix non embarqués : un projet partagé n'est pas rejouable ni vérifiable | `.btpx` et documents embarquent packs résolus et PriceBook | ARCH §8.4, ADR-0007 |
| A-15 | M | Trous de traçabilité G1–G11 (plan sans révision, règle sans hash, mapping non enregistré, prix sans entrée, binding mutable, pas de manifeste…) | Voir §6 | ADR-0007 |
| A-16 | M | Ajustements et lignes manuelles non modélisés : quantité sans origine possible | `ManualLine`, `QuantityAdjustment` avec justification | ARCH §3.2, ADR-0007, T-TRC-03 |
| A-17 | M | Confiance non calibrée ; propagation vers les quantités non définie | Score calibré par tranche ; plancher de confiance propagé | ARCH §3.3/6.2, T-AI-04 |
| A-18 | M | Raccourci implicite « pays » (langue, cartouche, style) non traité | Têtes séparées, masquage, leave‑one‑region‑out, ablation | ARCH §6.0, DATASET §5, T-AI-03 |
| A-19 | M | Détection hors domaine citée sans méthode ni test | Exigences de méthode, test dédié, méthode à choisir en M2 | ARCH §6.0, DATASET §6, T-AI-05 |
| A-20 | M | Le test Bénin ↔ Sénégal ne teste ni la devise ni la langue (identiques) | Pack factice **divergent** maintenu ; squelette Sénégal dès M0 | ARCH §9.4/9.6, T-MKT-01/03 |
| A-21 | M | Assemblages plats alors que le DPGF exige des sous‑détails | Composant `assembly` (sous‑ouvrage), cycles interdits | ARCH §4.3 |
| A-22 | M | MVP « OCR multilingue » incompatible avec « français au MVP » | Langues déclarées dans le domaine de validité (FR, EN au MVP) | ARCH §1.2/6.1 |
| A-23 | M | Cadre légal béninois cité dans une section générique de confidentialité | Registre de juridictions ; chaque marché ajoute une entrée | ARCH §11.4 |
| A-24 | M | Héritage de packs sans sémantique (fusion, conflits, losange) | Parent unique, override/add/remove, pack résolu haché | ADR-0004, T-MKT-06 |
| A-25 | M | Propriétaire de `PriceObservation` indéfini (pack ? moteur ?) | Service de données de prix ; seuls les PriceBook sont signés | ARCH §5.2 |
| A-26 | M | Seuils de métriques, effectifs minimaux et intervalles non définis | Effectifs et IC obligatoires ; seuils chiffrés après P0 (OD-11) | DATASET §5 |
| A-27 | M | Fuite du scellé possible via corrections produit ou dérivés | Propagation du scellé, flux P séparé | DATASET §4, ADR-0003 |
| A-28 | M | Licences des poids pré‑entraînés, des dépendances et droit d'entraîner non traités | Registre de licences ; liste de contrôle contractuelle ; revue juridique | DATASET §7, OD-18/19 |
| A-29 | M | Aucun test pour 10 comportements décrits (import, contrôles de cohérence, confiance de prix, structure, oplog, packages, scénarios, sync, assistant, performance) | 10 tests ajoutés | ARCH §13 |
| A-30 | M | Hauteurs/valeurs « par défaut » encore citées côté moteur (§3.4, §0.1) | Reformulées : hypothèses explicites | ARCH §0.1, §3.4 |
| A-31 | m | Références obsolètes : Scénarios (§1.3), `layers` (§15), §9.3 (risques), D1–D14, Q9 | Mises à jour | ARCH |
| A-32 | m | XOF / FCFA dans le moteur (principes numériques, devises, polices) | Neutralisés ; XOF uniquement dans les sections marché | ARCH §2.4, §3.1, §5.5 |
| A-33 | m | Périmètre de R4 ambigu (assistant cloud vs modèles de perception) | R4 limitée aux modèles de perception ; assistant dans un MarketBinding | ADR-0001, ARCH §6.0/6.6 |
| A-34 | m | Résidence des données du cloud non traitée | OD-14 | ARCH §11.4 |
| A-35 | m | Nom `btp-afrique` / `btp-platform` en tension avec le positionnement mondial | **Ouvert** (OD-16, cosmétique) | INDEX |

## 3. Vérification de l'étanchéité

### 3.1 Le moteur universel ne doit pas dépendre de… (après corrections)

| Élément | Verdict | Preuve / garde‑fou |
|---|:--:|---|
| Pays | ✅ | R2/R3 ; `Location` descriptive jamais transmise aux modèles ; arbre de zones dans le pack |
| Devise | ✅ | `core-money` sans code de devise ; définitions par données (A-08) |
| Prix | ✅ | Quantités ≠ prix ; `PriceObservation` hors moteur (A-25) |
| Fournisseur | ✅ | `Supplier` dans le pack |
| Fiscalité | ✅ | `TaxRuleSet` du pack ; couche `taxRuleSet` du `CostBuildUp` |
| Catalogue local | ✅ | `SpecMapping` ; modèle en classes neutres (A-01) |
| Normes nationales | ✅ | `ComplianceRuleSet` du pack (V1) |
| Pratiques locales | ✅ | `Assembly`, `MeasurementMethod`, hypothèses confirmées (A-01/03/05) |
| Types de documents, identifiants, numérotation | ✅ | `DocumentTemplate`, `LegalIdentifier`, `NumberingRule` (A-06) |
| Seuils de marché | ✅ | paramètres obligatoires du pack (A-07) |
| Langue | ✅ | UI = application ; glossaire/documents = pack |
| Géométrie : plateforme | ✅ | virgule fixe, décimal (A-09) |

Garde‑fous automatisés : T‑PUR‑01 à 05, T‑MKT‑02, T‑MKT‑04.

### 3.2 Le pack doit pouvoir fournir…

| Élément demandé | Fourni par | Réf. |
|---|---|---|
| Catalogue | `Catalogue*` | ARCH §9.1 |
| Traduction spécifications neutres → ouvrages | `SpecMapping`, `Assembly` | ADR-0002 |
| Prix | `PriceBook` (+ service de données de prix en amont) | ARCH §5 |
| Main‑d'œuvre | `LabourRate` | ARCH §9.1 |
| Taxes | `TaxRuleSet` | ARCH §9.1 |
| Paramètres | `params` du `MarketBinding`, valeurs proposées du pack | ARCH §5.4 |
| Règles locales | `ComplianceRuleSet`, `MeasurementMethod` | ARCH §9.1 |
| Unités commerciales | section dédiée du pack | ARCH §9.1 |
| Modèles de documents | `DocumentTemplate` | ARCH §10 |
| Autres | zones, devise, `CostBuildUp`, `WorkBreakdown`, identifiants légaux, numérotation, langues | ADR-0008 |

### 3.3 `MarketBinding` comme mécanisme explicite
Révision **immuable** (`packResolvedHash`, zone, `priceBookHash`, `params`), seul point où projet et marché se rencontrent, référencé par chaque `QuantitySet`, `Estimate` et document. Le moteur fonctionne sans (R6, T‑PUR‑04).

### 3.4 Revue des occurrences « marché » restantes dans `ARCHITECTURE.md`
Recherche des termes Bénin / béninois / BJ / XOF / FCFA / Cotonou / RCCM / IFU / TVA / DQE / DPGF / 90 jours / pays / ville / région. Occurrences restantes **légitimes** : exemples étiquetés « pack Bénin » (§1.2, §9.5, §10.2, §12), diagrammes de chiffrage multi‑marchés (§0.1, §9.3), scénarios de test (§9.6), exemples chiffrés (« 120 000 XOF », §8.2) marqués illustratifs. Aucune occurrence restante dans le modèle (§3), le métré étage 1 (§4.1–4.2), les schémas ou les contrats IA (§6.2).

## 4. Test avec deux marchés (Bénin, Sénégal)

Voir `ARCHITECTURE.md` §9.6. Verdict : **ajout possible sans modification du moteur après corrections** ; la paire Bénin/Sénégal teste zones, catalogue, prix, pratiques, fournisseurs, paramètres, documents, mais **pas** devise, langue ni unités (partagées) → le pack factice divergent reste obligatoire en CI dès M0 (T‑MKT‑01), et le squelette Sénégal (T‑MKT‑03/04) vérifie le contrat de pack et l'absence de modification du moteur.

## 5. Audit du corpus

| Point | État v0.3 | Réf. |
|---|---|---|
| A = compréhension générale | ✅ (sans plans africains, disjonction) | DATASET §2 |
| B = robustesse africaine | ✅ | DATASET §2 |
| C = validation locale par marché, jamais d'entraînement | ✅ | DATASET §2, §4 |
| Provenance | ✅ registre par plan, champs `sourceId`, `license`, `consentScope`, `sealed` | DATASET §3, §7 |
| Licences | ✅ registre (jeux, poids de modèles, dépendances), CI bloquante | DATASET §7, T‑DAT‑02 |
| Droits d'utilisation / contrats | ⚠️ liste de contrôle fournie ; **cadre type et revue juridique à faire** | DATASET §7, OD‑10/19 |
| Séparation train/val/test | ✅ | DATASET §4 |
| Découpage par source | ✅ hiérarchie cabinet > projet > plan > page ; synthétique par famille de gabarit | DATASET §4 |
| Prévention des fuites | ✅ dédoublonnage inter‑corpus, propagation du scellé, flux P, accès séparé ; risque résiduel (redessin) assumé | DATASET §4, T‑DAT‑01/03 |
| Métriques par région/source/complexité/qualité | ✅ avec effectifs et intervalles ; seuils après P0 | DATASET §5 |
| Domaine de validité | ✅ déclaré par modèle ; méthode de détection à choisir (OD‑22) | DATASET §6 |

## 6. Audit de l'IA

**Raccourci « pays »** : (1) aucune entrée pays/marché/`Location` (R4, T‑AI‑06) ; (2) mais le texte, l'écriture, le cartouche et le style sont des *indices implicites* → têtes séparées, masquage, leave‑one‑region‑out, ablation, rapports de dimensions par région (T‑AI‑03) ; (3) dimensions toujours mesurées, jamais déduites d'un a priori régional.
**Contexte marché** : n'intervient qu'à l'étage 2 et au chiffrage (spécification → ouvrage, prix, paramètres).
**Chaîne de confiance** : détection → preuve (bbox, source hash, détecteur, version de modèle) → score **calibré** → contrôles de cohérence → proposition `pending` hors modèle → décision humaine → élément du modèle (`origin`, `validation`) → plancher de confiance propagé aux `GeoQuantity` puis `QuantityLine`. Tests : T‑AI‑04, T‑AI‑07, T‑AI‑08, T‑TRC‑01.

## 7. Audit de traçabilité (plan → … → document)

| Maillon | v0.2 | v0.3 |
|---|---|---|
| Plan / version | hash du document, pas de notion de révision (G1) | `supersedes`, `PlanRevision`, `sourceHash` dans les preuves |
| → objet architectural | `evidence.sheetId` seulement | + `sourceHash`, `modelRev` |
| → règle | numéro de version (G3) | `ruleHash` |
| → paramètres | implicites (G3) | valeurs inscrites dans la trace |
| → calcul | trace unique mélangeant étages (G4) | deux traces liées, `engine.version/hash` (G10) |
| → résultat | code lisible (G2) | `GeoQuantity.id`, `QuantityLine` avec références |
| → ouvrage / catalogue | `item` seul (G5) | `mapping`, `method`, `assembly` (hash + params) |
| → prix | niveau de cascade seulement (G6) | `priceEntryId`, `priceBookHash`, couches de `CostBuildUp` |
| → MarketBinding | mutable, sans empreinte (G7) | révision immuable, `packResolvedHash` |
| → document final | liste de versions, sans manifeste (G8) | `ProvenanceManifest` obligatoire + `verify` hors ligne |
| Transverse | ajustements manuels non modélisés (G9) ; paquets non embarqués (G11) | `ManualLine`/`QuantityAdjustment` ; paquets embarqués |

Trous restants : aucun connu au niveau de la conception ; la preuve se fera par T‑TRC‑01/02 dès M0.

## 8. Nouvelles dépendances introduites par la v0.3

| Dépendance | Nature | Conséquence |
|---|---|---|
| `AssumptionSet` entre modèle et étage 1 | donnée projet | étape de confirmation à la création du projet |
| Arithmétique décimale + sérialisation canonique | technique | coût de performance à mesurer (T‑PERF‑01) |
| `core-pack`, `core-trace`, `core-money` | composants | trois paquets de plus à maintenir |
| Interpréteur de `CostBuildUp` / `TaxRuleSet` | langage de déclaration | risque de dérive vers un langage de programmation (OD‑21) |
| Stockage privé séparé pour corpus scellés | infrastructure/sécurité | coût et processus d'accès (T‑DAT‑03) |
| Service de données de prix | service (local + cloud) | à concevoir ; propriétaire des `PriceObservation` |
| Registre de juridictions | gouvernance | revue juridique par pays |
| Paquets embarqués dans `.btpx` | stockage | poids des projets (OD‑20) |

## 9. Risques

**Techniques** : reconnaissance de plans raster réels (élevé) ; déterminisme décimal et performance ; expressivité du langage de packs ; détection hors domaine ; calibration sur peu de données ; dérive de la taxonomie neutre.
**Juridiques** : droit d'auteur sur les plans et droit d'entraîner (varie selon les juridictions) ; contrats de contribution ; protection des données personnelles par juridiction (Bénin, Sénégal : cadres respectifs **à faire confirmer par un juriste local** — non vérifiés ici) ; responsabilité professionnelle sur les estimations structurelles (OD‑23) ; licences des poids pré‑entraînés et des dépendances ; numérotation légale des devis.
**Données** : biais géographique/graphique du corpus A ; coût et dépendance du corpus B ; effectifs trop faibles de C pour des verdicts par tranche ; fuite du scellé ; qualité et fraîcheur des prix (pas de base publique structurée supposée) ; consentement et retrait.

## 10. Prêt pour l'implémentation du noyau / à décider

**Prêt (M0, sans interface)** : modèle architectural neutre et `AssumptionSet` ; représentation numérique (ADR‑0006, paramètres à confirmer par prototype) ; géométrie étage 1 + générateur de projets synthétiques ; évaluateur d'expressions ; métré étage 2 ; `core-pack` (validation, signature, héritage, hash) ; pack factice divergent + squelette Sénégal ; `ProvenanceManifest` et `verify` ; rendu de `DocumentModel` ; CI d'étanchéité (T‑PUR, T‑MKT).
**À décider avant ou pendant M0** : OD‑01 (équipe), OD‑02/03 (accès corpus C‑BJ et sources de prix), OD‑12 (confirmation numérique par prototype), OD‑17/18/20/21 (gouvernance taxonomie, licences, rétention, langage de packs), OD‑23 (formulation de la responsabilité professionnelle).
**À décider plus tard** : OD‑07, 08, 10, 13, 14, 19 (licence, IA cloud, contrats, numérotation, hébergement, droit d'entraîner), OD‑11, 22 (seuils et détection hors domaine après P0/M2), OD‑04 (Android), OD‑16 (nom).

## 11. Limites de l'audit

- Audit documentaire : il n'a pas pu détecter les défauts qui n'apparaissent qu'à l'implémentation (performance du décimal, expressivité du langage de packs).
- Les affirmations juridiques et réglementaires (Bénin, Sénégal) ne sont pas vérifiées ; elles sont signalées comme à valider par des juristes locaux.
- Le script de traçabilité contrôle la structure (références, présence de tests) mais pas l'adéquation d'un test à son exigence.
