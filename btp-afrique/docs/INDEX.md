# Index de traçabilité — plateforme BTP (architecture v0.3)

> Point d'entrée pour naviguer entre **exigences → décisions → modèles → ADR → corpus → composants → roadmap → tests → décisions ouvertes**.
> La cohérence de ce fichier est vérifiée par `../tools/check_traceability.py` (voir §10).
> Identifiants de tests : `T-xxx-nn`, définis dans `ARCHITECTURE.md` §13.

## 1. Carte des documents

| Volet | Fichier | Contenu |
|---|---|---|
| Document principal | [`ARCHITECTURE.md`](ARCHITECTURE.md) | Vision d'architecture, décisions D1–D17, modèle, métré, prix, IA, packs, documents, sécurité, tests (§13), roadmap |
| Stratégie de corpus | [`DATASET-STRATEGY.md`](DATASET-STRATEGY.md) | Corpus A/B/C, taxonomie, scellement, évaluation par tranches, gouvernance |
| Décisions (ADR) | [`adr/README.md`](adr/README.md) | ADR‑0001 à 0008 rédigés ; 0009 à 0020 à rédiger |
| Audit | [`AUDIT-v0.2.md`](AUDIT-v0.2.md) | Contradictions, corrections, vérification d'étanchéité, chaîne de traçabilité, risques |
| Index | `INDEX.md` (ce fichier) | Navigation et matrice de couverture |

## 2. Exigences

Sources : « brief » = description initiale du produit ; « v0.2 » = correction moteur universel / packs ; « audit » = ajouts de l'audit de cohérence.

| ID | Exigence | Source | Jalon |
|---|---|---|---|
| REQ-01 | Fonctionnement **offline‑first** complet (projet, plan, calculs, documents) | brief §3 | M1 |
| REQ-02 | Import de plans PDF / JPG / PNG, calibration d'échelle | brief §4, §14 | M1 |
| REQ-03 | Compréhension de plan : murs, pièces, ouvertures, textes, cotes, niveaux, échelle, incohérences | brief §4 | M2 |
| REQ-04 | Modèle architectural structuré (bâtiments, niveaux, pièces, murs, ouvertures, surfaces, volumes) | brief §4 | M0 |
| REQ-05 | Métré **déterministe** et retraçable (unités, coefficients, pertes) | brief §5 | M0 |
| REQ-06 | Séparation stricte **quantités / prix** | brief §6 | M0 |
| REQ-07 | Moteur de prix local : zone, unité, devise, date, source, min/moyen/max, confiance | brief §6 | M0 |
| REQ-08 | Architecture multi‑pays sans reconstruire le logiciel (devises, taxes, langues, pratiques) | brief §7 | M0 |
| REQ-09 | Documents DQE / DPGF / devis, exports PDF et Excel | brief §9 | M0 |
| REQ-10 | Analyse du coût et scénarios (Éco / Standard / Premium), comparaison | brief §10 | V1 |
| REQ-11 | Transparence : détection, confiance, preuve, méthode, version des prix, corrections | brief §11 | M0 |
| REQ-12 | Rôle du professionnel : éléments structurels présentés comme estimation à valider | brief §12 | M0 |
| REQ-13 | Gestion de projets, versions, historique, comparaison de versions | brief §17.7 | M0 |
| REQ-14 | Sécurité et confidentialité des plans | brief §17.11 | M1 |
| REQ-15 | Évolution vers le cloud sans casser le fonctionnement local | brief §17.12 | V1 |
| REQ-16 | 2D / 3D liés au modèle structuré | brief §8 | V1 |
| REQ-17 | Assistant IA explicatif (réponses expliquées, sans calcul propre) | brief §4 | V1 |
| REQ-18 | **Moteur architectural universel** étanche vis‑à‑vis du contexte marché | v0.2 | M0 |
| REQ-19 | Corpus A/B/C, provenance, licences, découpage par source, scellement, évaluation par tranches | v0.2 | M2 |
| REQ-20 | IA sans raccourci « pays » ; domaine de validité ; confiance calibrée | v0.2 + audit | M2 |
| REQ-21 | **Traçabilité de bout en bout** plan → … → document | audit | M0 |
| REQ-22 | Deuxième marché (Sénégal) ajoutable **sans modifier le moteur** | audit | M0 |
| REQ-23 | Licences et essai de 5 jours vérifiables hors ligne | brief §15 | M3 |
| REQ-24 | Mises à jour de prix / packs / modèles, y compris hors réseau | brief §3 | M1 |
| REQ-25 | L'utilisateur garde la main : correction à chaque étape, acceptation explicite | brief §1, §10 | M1 |
| REQ-26 | Continuité conception → chiffrage : modification du plan ⇒ nouveau métré et coût | brief §8 | V1 |
| REQ-27 | Optimisation de coût proposée, jamais appliquée sans acceptation | brief §10 | V2 |
| REQ-28 | Fonctionnement sur matériel modeste et connectivité limitée | brief §1, §3 | M2 |

## 3. Matrice Exigence → Architecture → ADR → Modèle → Test

« ADR à rédiger » = décision identifiée mais ADR non encore écrit (ne bloque pas la couverture, mais figure dans le registre). La colonne *Tests* ne doit **jamais** être vide : le script de vérification échoue sinon.

| Exigence | Architecture | ADR | Modèle / composants | Tests | Couverture |
|---|---|---|---|---|---|
| REQ-01 | §1.2, §2, §14 | ADR-0009 | Storage SQLite, PackStore, oplog | T-OFF-01, T-ENG-05 | planifiée M1 |
| REQ-02 | §6.1, §1.2 | ADR-0015 (à rédiger) | SourceDocument, PlanSheet, DrawingConventions | T-IMP-01 | planifiée M1 |
| REQ-03 | §6.1, §6.2 | ADR-0015 (à rédiger) | AiProposal, ModelArtifact | T-AI-01, T-AI-08, T-C-02 | planifiée M2 |
| REQ-04 | §3.2, §3.4 | ADR-0002 | ArchitecturalModel, Wall, Opening, Space | T-GEO-02, T-ENG-05, T-PUR-03 | planifiée M0 |
| REQ-05 | §4 | ADR-0002, ADR-0006, ADR-0012 | GeometricTakeoff, QuantitySet, Assembly | T-ENG-01, T-ENG-02, T-ENG-03, T-ENG-04, T-GEO-01, T-SYN-01, T-C-01 | planifiée M0 |
| REQ-06 | §5.1, §4.1 | ADR-0002, ADR-0002 | QuantityLine, EstimateLine | T-PRC-03, T-MKT-05 | planifiée M0 |
| REQ-07 | §5 | ADR-0008, ADR-0011 | PriceBook, PriceObservation, Zone | T-PRC-01, T-PRC-04, T-PRC-05 | planifiée M0 |
| REQ-08 | §9, §0.1 | ADR-0001, ADR-0004, ADR-0008 | MarketPack, MarketBinding, CostBuildUp | T-MKT-01, T-MKT-02, T-MKT-06, T-MKT-07, T-PRC-02 | planifiée M0 |
| REQ-09 | §10 | ADR-0008, ADR-0011 | DocumentModel, DocumentTemplate | T-DOC-01, T-DOC-02 | planifiée M0 |
| REQ-10 | §5.4, §8.2 | ADR-0002 | Estimate, MarketBinding, CostBuildUp | T-SCN-01 | planifiée V1 |
| REQ-11 | §3.3, §6.2, §10.4 | ADR-0005, ADR-0007, ADR-0014 (à rédiger) | origin/confidence/evidence/validation | T-AI-04, T-AI-07, T-DOC-02, T-TRC-01 | planifiée M0–M2 |
| REQ-12 | §4.7, §10.2 | — (à rédiger : ADR hors liste, voir OD-23) | Assembly paramétrique, annexe | T-DOC-04 | planifiée M0 |
| REQ-13 | §8 | ADR-0007, ADR-0009, ADR-0016 | oplog, révisions, Document | T-OPS-01, T-ENG-05, T-TRC-02 | planifiée M0 |
| REQ-14 | §11 | ADR-0017 | blobs chiffrés, consentement | T-SEC-01, T-SEC-03 | planifiée M1–M2 |
| REQ-15 | §14 | ADR-0009, ADR-0017 | oplog, HLC, SyncTransport | T-SYNC-01, T-OFF-01 | planifiée V1 |
| REQ-16 | §15 | — (V1) | ArchitecturalModel, vues | T-3D-01, T-MOD-01 | planifiée V1 |
| REQ-17 | §6.6 | ADR-0015 (à rédiger) | outils de l'assistant | T-AST-01 | planifiée V1 |
| REQ-18 | §0.1, §9.4 | ADR-0001, ADR-0002, ADR-0005, ADR-0019 | core-model, core-geometry, AssumptionSet | T-PUR-01, T-PUR-02, T-PUR-03, T-PUR-04, T-PUR-05, T-MKT-02 | planifiée M0 |
| REQ-19 | §6.4, `DATASET-STRATEGY.md` | ADR-0003 | datasets, ai-eval | T-AI-01, T-AI-02, T-DAT-01, T-DAT-02, T-DAT-03 | planifiée M2 |
| REQ-20 | §6.0, §6.2 | ADR-0003, ADR-0015 (à rédiger) | ModelArtifact, AiProposal | T-AI-03, T-AI-04, T-AI-05, T-AI-06 | planifiée M2 |
| REQ-21 | §4.5, §8.1, §10.4 | ADR-0006, ADR-0007, ADR-0016 | core-trace, ProvenanceManifest | T-TRC-01, T-TRC-02, T-TRC-03, T-DOC-03, T-ENG-03 | planifiée M0 |
| REQ-22 | §9.6 | ADR-0004, ADR-0008 | market-packs/sn, market-packs/test | T-MKT-01, T-MKT-03, T-MKT-04 | planifiée M0 |
| REQ-23 | §11.3 | ADR-0018 (à rédiger) | LicenseVerifier | T-SEC-02 | planifiée M3 |
| REQ-24 | §2.2, §11.5 | ADR-0004, ADR-0020 | PackStore, paquets signés | T-PKG-01, T-MKT-07 | planifiée M1 |
| REQ-25 | §3.3, §6.2 | ADR-0005 | AiProposal, ManualLine, QuantityAdjustment | T-AI-07, T-TRC-03, T-C-02 | planifiée M1 |
| REQ-26 | §4.6, §15 | — (V1) | recalcul incrémental, Command | T-MOD-01, T-ENG-04 | planifiée V1 |
| REQ-27 | §6.6 | — (V2) | moteur de scénarios | T-OPT-01 | planifiée V2 |
| REQ-28 | §2.4, §6.1 | ADR-0010 (à rédiger) | ONNX, modèles quantifiés | T-PERF-01 | planifiée M2 |

*Statut de couverture* : « planifiée » = test **défini** (§13 d'`ARCHITECTURE.md`) mais **pas encore implémenté** (aucun code n'existe). Le contrôle automatique garantit l'absence d'exigence « seulement décrite ».

## 4. Décisions D1–D17 → où elles vivent

| Décision | Sujet | ADR / section |
|---|---|---|
| D1–D4 | Noyau TS pur, desktop d'abord, SQLite local, oplog | §2, ADR-0009/0010 (à rédiger) |
| D5–D6 | Quantités ≠ prix, deux étages, métré déterministe | ADR-0002, ADR-0002, §4 |
| D7 | IA = propositions | ADR-0005, ADR-0015 (à rédiger), §6.2 |
| D8 | Packs marché | ADR-0004, ADR-0008, §9 |
| D9 | LLM = outils | §6.6 |
| D10 | Essentiel hors ligne, IA locale/cloud optionnelle, consentement | §11.4, ADR-0017 |
| D11 | Modèle géométrique unique | §3, §15 |
| D12 | Valeur sans IA d'abord | §17 |
| D13 | Moteur universel | ADR-0001 |
| D14 | Corpus A/B/C | ADR-0003 |
| D15 | Aucune valeur par défaut implicite | ADR-0005 |
| D16 | Déterminisme numérique | ADR-0006 |
| D17 | Traçabilité de bout en bout | ADR-0007 |

## 5. Composants (cible `btp-platform/`, `ARCHITECTURE.md` §16)

| Composant | Côté | Rôle | Jalon | Ne doit pas importer |
|---|---|---|---|---|
| core-model | moteur | modèle architectural neutre, invariants | M0 | market-packs, ai-* |
| core-geometry | moteur | étage 1 (GeometricTakeoff) | M0 | market-packs |
| core-units | moteur | unités, décimal | M0 | market-packs |
| core-money | moteur | arithmétique monétaire (devises = données) | M0 | market-packs |
| core-measure | moteur (exécute données de pack) | étage 2, évaluateur, traces | M0 | market-packs |
| core-pricing | moteur (exécute données de pack) | cascade de zones, CostBuildUp, estimations | M0 | market-packs |
| core-pack | moteur | chargement, signature, héritage, hash de packs | M0 | market-packs (contenu) |
| core-docs | moteur | DocumentModel neutre | M0 | market-packs |
| core-trace | moteur | ProvenanceManifest, verify | M0 | market-packs |
| core-ops | moteur | oplog, commandes, versions | M0 | market-packs |
| ai-contracts / ai-pipeline / ai-eval | moteur IA | perception, évaluation par tranches | M1–M2 | market-packs, pays |
| datasets | outillage | taxonomie, registre de provenance (données hors dépôt) | M0 | — |
| market-packs (base.xof, bj, sn, test) | **marché** | données signées | M0 | — (jamais importé par le moteur) |
| render-pdf / render-xlsx | adaptateur | rendu | M0 | — |
| storage-sqlite / sync-protocol | adaptateur | persistance, sync | M0 / V1 | — |
| apps/desktop | assemblage | UI + assemblage moteur + packs | M1 | — |

## 6. Corpus ↔ usages

| Corpus | Rôle | Entraînement | Validation | Test | Scellé |
|---|---|:--:|:--:|:--:|:--:|
| A général | compréhension générale | ✅ | ✅ | A‑test | A‑test |
| B africain | robustesse africaine | ✅ | ✅ | B‑test (15–20 %) | B‑test |
| C local (C‑BJ, C‑SN…) | validation produit par marché | ❌ | ❌ | ✅ (entier) | ✅ |
| P production (corrections consenties) | amélioration continue | ✅ (consentement) | — | ❌ jamais | — |
| Synthétique | volume, robustesse, vérité analytique du métré | ✅ | ✅ | métré géométrique seulement | — |

Détail : `DATASET-STRATEGY.md` ; ADR‑0003.

## 7. Registre des décisions ouvertes

Légende : **Vous** = arbitrage du porteur du projet (impact produit, coût, sécurité ou conformité) ; **Défaut** = décidé par défaut, révisable ; **Tech** = tranchée par l'équipe technique à la date indiquée.

| ID | Décision | Qui | Avant | Statut |
|---|---|---|---|---|
| OD-01 | Équipe et compétences (TS / Rust / ML) | Vous | M0 | **Ouvert** |
| OD-02 | Accès aux corpus (A : licences ; B : partenaires africains ; C‑BJ : plans réels + métreur partenaire) | Vous | M0 (C‑BJ n°1), M2 (B) | **Ouvert** |
| OD-03 | Sources de prix pour le pack Bénin (fournisseurs, devis, factures) | Vous | M0 | **Ouvert** |
| OD-04 | Plateformes : Windows seul ou Android dès le MVP | Vous | M1 | Défaut : Windows seul |
| OD-05 | Typologies du MVP | — | M0 | Défaut : villas / maisons R+0–R+1, murs orthogonaux |
| OD-06 | Langues : interface FR ; OCR FR + EN | — | M1 | Défaut |
| OD-07 | Activation de licence (compte vs clé hors ligne) | Vous | M3 | Défaut : jeton signé émis à l'activation (une connexion) |
| OD-08 | IA locale vs cloud | — | M2 | **Tranché (ADR-0017)** : aucune obligation d'IA 100 % locale ; choix par benchmark en M2 ; consentement explicite pour tout envoi de plan |
| OD-09 | Second marché | — | — | **Tranché : Sénégal** ; partenaire pour C‑SN : Vous (V1) |
| OD-10 | Cadre contractuel de collecte / annotation de plans de tiers | Vous + juriste | avant collecte B | **Ouvert** |
| OD-11 | Seuils chiffrés (non‑régression, porte de disponibilité, effectif minimal) | Tech | après P0 | Ouvert (différé) |
| OD-12 | Résolution fixe (0,1 mm) et précision décimale | Tech | prototype M0 | Défaut (ADR-0006) |
| OD-13 | Numérotation légale des devis par marché (continuité hors ligne) | Vous + expert local | M3 | **Ouvert** |
| OD-14 | Région d'hébergement cloud et juridiction | Vous + juriste | V1 | **Ouvert** |
| OD-15 | Sémantique d'héritage des packs | — | — | **Tranché** (ADR-0004 : parent unique) |
| OD-16 | Nom du produit / du dossier (`btp-afrique` vs positionnement mondial) | Vous | avant publication | **Ouvert** (cosmétique) |
| OD-17 | Gouvernance de la taxonomie neutre (qui valide les classes) | Tech | M0 | Ouvert (ADR-0019) |
| OD-18 | Registre de licences (code, poids de modèles, jeux publics) | Tech | M0 | À instituer |
| OD-19 | Droit d'entraîner sur des plans protégés, par juridiction | Vous + juriste | avant M2 | **Ouvert** |
| OD-20 | Rétention des paquets embarqués dans `.btpx` (taille, durée) | Tech | M0 | Défaut : embarquer pack résolu + PriceBook utilisés |
| OD-21 | Langage de déclaration des packs (CostBuildUp, TaxRuleSet) : expressivité vs sûreté | Tech | M0 (ADR-0012) | Ouvert |
| OD-22 | Méthode de détection hors domaine | Tech | M2 | Ouvert |
| OD-24 | Gestion des clés de publication des packs commerciaux (génération, stockage, rotation) | Vous | avant 1er pack commercial | **Ouvert** |
| OD-23 | ADR sur la responsabilité professionnelle (estimations structurelles : formulation, mentions, limites) | Vous + juriste | M0 | **Ouvert** |

## 8. Roadmap ↔ exigences ↔ tests

| Jalon | Exigences livrées | Tests qui doivent passer |
|---|---|---|
| M0 | REQ-04, 05, 06, 07, 08, 09, 11 (partiel), 12, 13, 18, 21, 22 | T-ENG-*, T-GEO-*, T-SYN-01, T-PUR-*, T-MKT-*, T-PRC-*, T-DOC-*, T-TRC-*, T-OPS-01, T-C-01 (n°1) |
| M1 | REQ-01, 02, 14 (partiel), 24, 25 | T-OFF-01, T-IMP-01, T-SEC-01, T-PKG-01, T-AI-07 |
| M2 | REQ-03, 19, 20, 28 | T-AI-*, T-DAT-*, T-SEC-03, T-C-02, T-PERF-01 |
| M3 | REQ-23, validation C‑BJ complète | T-SEC-02, T-C-01 (complet) |
| V1 | REQ-10, 15, 16, 17, 26 | T-SCN-01, T-SYNC-01, T-3D-01, T-MOD-01, T-AST-01 |
| V2 | REQ-27 | T-OPT-01 |

## 9. Où trouver quoi (recherche rapide)

| Je cherche… | Aller à |
|---|---|
| La frontière moteur / marché | `ARCHITECTURE.md` §0.1, §9.4 ; ADR-0001 |
| Le test Bénin ↔ Sénégal | `ARCHITECTURE.md` §9.6 ; ADR-0004, ADR-0008 |
| La chaîne de traçabilité | `ARCHITECTURE.md` §4.5, §10.4 ; ADR-0007 |
| Les hypothèses / valeurs par défaut | `ARCHITECTURE.md` §3.7 ; ADR-0005 |
| La stratégie de corpus et le scellement | `DATASET-STRATEGY.md` ; ADR-0003 |
| Le catalogue de tests | `ARCHITECTURE.md` §13 |
| Les risques | `ARCHITECTURE.md` §18 ; `AUDIT-v0.2.md` §7 |

## 10. Vérification automatique

```
python3 -I btp-afrique/tools/check_traceability.py
```
Contrôles : chaque exigence a ≥ 1 test défini ; tout test cité existe dans `ARCHITECTURE.md` §13 ; tout test défini est cité par ≥ 1 exigence (sinon avertissement d'orphelin) ; tout ADR cité existe ou est listé « à rédiger » dans `adr/README.md` ; tous les liens de fichiers de ce document existent ; chaque décision ouverte a un statut.

## 11. Historique

| Version | Date | Contenu |
|---|---|---|
| v0.1 | 2026-10-08 | Architecture de référence initiale |
| v0.2 | 2026-10-08 | Moteur universel + packs marché + corpus A/B/C ; ADR‑0001 à 0004 |
| v0.3 | 2026-10-08 | Audit de cohérence ; D15–D17 ; ADR‑0005 à 0008 ; catalogue de tests §13 ; `INDEX.md`, `AUDIT-v0.2.md` |
| M0 | 2026-10-10 | Noyau exécutable (`btp-afrique/src`, 150 tests) ; ADR-0009, 0011, 0012, 0016, 0017, 0019, 0020 ; politique IA précisée |

## 12. État d'implémentation M0 des tests (honnête)

✅ = implémenté et passant · ◐ = partiel (limite indiquée) · ✖ = non implémenté (jalon ultérieur ou hors M0).

| Test | État | Où / limite |
|---|:--:|---|
| T-ENG-01 | ◐ | `tests/units` — unités/décimal ; pas de langage d'expressions (ADR-0012) |
| T-ENG-02 | ✅ | `tests/units`, `tests/pricing` |
| T-ENG-03 | ◐ | inter-processus Node (`tests/reproducibility`) ; Windows/macOS/WASM à ajouter en CI |
| T-ENG-04 | ✖ | pas de recalcul incrémental en M0 (recalcul complet, déterministe) |
| T-ENG-05 | ◐ | sérialisation canonique ✅ (modèle, bundle) ; migrations de schéma ✖ |
| T-GEO-01, T-GEO-02 | ◐ | `tests/geometry` ; limites : pièces rectangulaires orthogonales, murs à épaisseur uniforme par côté |
| T-SYN-01 | ◐ | calcul analytique indépendant d'une maison (`tests/support/analytic-house.ts`) ; pas encore de générateur de projets |
| T-PUR-01 … T-PUR-05 | ✅ | `tests/purity`, `tests/assumptions`, `tests/model` |
| T-MKT-01, 02, 04, 05, 06, 07 | ✅ | `tests/market` |
| T-MKT-03 | ◐ | pack Sénégal **complet synthétique** (au-delà du squelette prévu) |
| T-PRC-01, 02, 03, 05 | ✅ | `tests/pricing` |
| T-PRC-04 | ◐ | pas de conversion de devise en M0 (un `PriceBook` = une devise) ; le document porte devise et unités mineures |
| T-DOC-01 | ◐ | DocumentModel + rendu Markdown ; PDF et XLSX ✖ |
| T-DOC-02, T-DOC-03 | ✅ | `tests/documents`, `tests/trace`, `tests/reproducibility` |
| T-DOC-04 | ◐ | avis « estimation paramétrique » ✅ ; contenu métier de l'estimation structurelle à valider |
| T-TRC-01, T-TRC-02 | ✅ | `tests/trace`, `tests/golden`, `tests/reproducibility` |
| T-TRC-03 | ✖ | `ManualLine` / `QuantityAdjustment` non implémentés en M0 |
| T-OPS-01 | ◐ | rejeu, annulation, comparaison ✅ ; révisions nommées ✖ |
| T-C-01 | ◐ | référence = calcul à la main sur données synthétiques, **pas** un métré de professionnel |
| T-OFF-01 | ◐ | noyau sans API réseau (vérifié statiquement) ; scénario réseau coupé avec l'application ✖ |
| T-SEC-*, T-IMP-01, T-PKG-01, T-AI-*, T-DAT-*, T-PERF-01, T-SCN-01, T-SYNC-01, T-AST-01, T-MOD-01, T-OPT-01, T-3D-01, T-C-02 | ✖ | jalons M1 et suivants |

