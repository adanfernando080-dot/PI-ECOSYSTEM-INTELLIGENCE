# État réel du dépôt — ce qui est implémenté, partiel, ou seulement décrit

> Mis à jour : 2026-10-12, commit de départ `2bd5bd3`, branche `claude/ecstatic-lovelace-o3rdc0`.
> Règle : **un élément n'est « implémenté » que s'il existe dans `src/` et est couvert par un test qui passe.** Tout le reste est « décrit ».
> Vérifications rejouées ce jour : `tsc` OK · 150 tests sur 150 · `check_traceability.py` OK · `check-pack-isolation` OK · livrables `examples/house/` régénérés **identiques** (diff vide) · `engine.sourceHash` stable.

## Écarts relevés entre documentation et code

| # | Ce que la documentation dit | Réalité du code | Action |
|---|---|---|---|
| E1 | `ARCHITECTURE.md` §16 : monorepo `packages/core-*` | Un seul paquet : `src/core/<module>/`. Les frontières sont imposées par `tests/purity`, pas par le gestionnaire de paquets | §16 annoté « cible » ; structure réelle dans `README.md` |
| E2 | D2/D3, §2 : Tauri, SQLite local, oplog persistant | Aucun stockage SQLite ; persistance = bundle `.btpx` (dossier en M0) ; shell desktop non choisi | Traité aux étapes 4 (fichier) et 6 (shell) |
| E3 | §2.2 : « un test de CI exécute le scénario complet réseau coupé » | Non implémenté ; seule la pureté statique du noyau (aucune API réseau) est testée | T‑OFF‑01 reste ◐ |
| E4 | §4.4 : « langage d'expression restreint et sûr » | Aucun évaluateur d'expressions ; règles déclaratives structurées (ADR‑0012) | §4.4 corrigé |
| E5 | §4.6 : recalcul incrémental | ✅ **Corrigé (étape 2)** : `project/recompute.ts` (réutilisation par étape, équivalence démontrée par test de propriété) | fait |
| E6 | §5.5 : taux de change versionnés | Non implémenté (un PriceBook = une devise) | Hors périmètre actuel |
| E7 | §6 : pipeline d'analyse de plan | **Aucune IA, aucune vision, aucun OCR.** Seule la taxonomie existe | Contrats seulement (étape 5) |
| E8 | §8.4 : `.btpx` = archive | Résolu : fichier unique ZIP déterministe (`src/adapters/btpx.ts`, `tests/btpx`), sources de plans et journal inclus | Étape 4 ✅ |
| E9 | §10 : exports PDF et Excel | Résolu : PDF + XLSX (adaptateurs `src/adapters/export-*.ts`), vérifiables hors ligne ; limite : poppler n'extrait pas les pièces jointes pdf-lib (extraction testée via `readPdfAttachments`) | Étape 3 ✅ |
| E10 | §11 : chiffrement, licences | Rien d'implémenté | Hors périmètre actuel |
| E11 | §3.2 : `SourceDocument`, `PlanSheet`, `Location`, `AiProposal`, `ManualLine` | `ManualLine`/`QuantityAdjustment` ✅ **implémentés (étape 2)** ; `SourceDocument`, `PlanSheet`, `AiProposal` : contrats à l'étape 5 ; `Location` : non implémenté | partiel |
| E12 | §9.1 : `TaxRuleSet`, `ComplianceRuleSet`, `Supplier`, `LabourRate` distincts | Taxes = couches de `CostBuildUp` ; main‑d'œuvre = articles du catalogue ; pas de fournisseurs ni de règles de conformité | Assumé : à scinder quand un marché réel l'exigera |
| E13 | §5.2 : service `PriceObservation` | Seul le constructeur de statistiques existe (`pricing/stats.ts`), sans stockage | Assumé |
| E14 | §13 T‑MKT‑03 : « squelette Sénégal » | Pack Sénégal **complet** (synthétique) | INDEX §12 déjà à jour |
| E15 | §3.4 : pièce = cycle fermé de murs | Pièces **rectangulaires orthogonales** seulement ; sinon bloquées avec raison | Limite documentée |
| E16 | INDEX §3 : colonne « Couverture » = « planifiée » pour tout | Les états réels sont dans INDEX §12 | §12 fait foi |

## Ce qui est réellement opérationnel (noyau ; voir la mise à jour en bas pour l'interface)
Décimal exact · unités · modèle neutre validé (schéma fermé, taxonomie) · hypothèses explicites · métré géométrique avec traces · métré commercial par pack (correspondances, méthode de mesurage, ouvrages récursifs, articles à commander) · `MarketBinding` immuable · prix (cascade de zones, péremption, confiance) · structure de coût déclarative · DQE et devis (modèle de document + rendu Markdown) · manifeste de provenance · chaîne de traçabilité et explications · oplog (3 opérations) · bundle (dossier) vérifiable hors ligne · packs signés (clé de test) · garde‑fous d'étanchéité.

## Mise à jour 2026-10-12 (étapes 3 à 7 du plan « vers un produit utilisable »)
- **Exports** PDF/XLSX ✅ ; **`.btpx` fichier unique** ✅ ; **ADR-0010** (Electron recommandé derrière `HostApi`, à confirmer) ; **contrats IA + porte de validation** ✅ (ADR-0015) — **aucun détecteur, aucun OCR n'existe** ; **interface minimale** `apps/desktop` ✅ (création/ouverture/enregistrement, modèle, hypothèses, métré, prix, chiffrage, lignes manuelles/ajustements, DQE/devis, exports, changement de marché, historique/annulation), validée par `npm run e2e` (Chromium, 46 vérifications).
- Défauts du noyau trouvés par l'interface et corrigés : (1) l'annulation de `setOpeningSize` ne restituait pas la provenance exacte (origine/validation) → l'inverse porte désormais les attributs exacts ; (2) le recalcul à froid d'un projet dont le marché a été changé différait (révision de liaison) → l'historique des liaisons est enregistré dans `project.json` (`bindingHistory`) ; (3) le sélecteur de marché proposait un pack parent (base commune) et une zone sans prix → packs parents exclus, zone la plus fine par défaut.
- Limites assumées de l'interface : pas d'édition graphique du plan ; pas d'import de géométrie depuis un plan ; un document émis est invalidé par toute modification (à régénérer) ; hôte Electron non écrit ; aucune validation par un professionnel du BTP.

## Mise à jour — étape 8 (application de bureau Electron)
- ✅ `apps/desktop/electron` (main/preload/CSP/fichiers), contrat IPC fermé, `electronHost`, paquet Linux (`desktop:pack`) et **installateur Windows NSIS x64** (`desktop:dist:win`, 65 Mo, construit sous Linux avec Wine).
- ✅ Vérifié ici : `tests/desktop` (8), `desktop:e2e` en mode dev et empaqueté (31 vérifications chacun, Electron réel sous Xvfb), `desktop:verify-win` (17 vérifications statiques).
- ⚠ **Non vérifié** : installation et exécution sur Windows réel ; signature de code ; icône ; coupure réseau physique.
- Éditeur 2D : ADR-0021 (proposition) + `editor/links.ts` (liens entité → quantités → lignes, testé). Aucun éditeur graphique, aucune reconnaissance IA.
- Dépendances d'exécution (react, pdf-lib, exceljs) déplacées en `devDependencies` : elles sont empaquetées dans les bundles (asar sans `node_modules`).

## Mise à jour — étapes 9 à 10 (validation Windows documentée, historique, éditeur 2D)
- ✅ `docs/WINDOWS-VALIDATION.md` (procédure + fiche de résultats, **non exécutée**), `npm run desktop:release-manifest` (empreintes, commit, signature absente).
- ✅ Noyau : `history.ts` (groupes atomiques, annuler/rétablir exacts), `commands.ts`, `checks.ts`, nouvelles opérations (`setWallProps`, `addSpace`, `removeSpace`, `setSpace`), inverses avec position (restitution exacte). Historique persistant dans `.btpx` (rétro-compatible : anciens fichiers sans `history` s'ouvrent sans pile).
- ✅ Éditeur 2D (onglet « Plan (éditeur) ») : voir ADR-0021 § « État d'implémentation ».
- Limites : pas de plan importé dans l'éditeur ; pièces rectangulaires ; ouvertures sans position ; un seul niveau ; brouillon non persistant ; aucune reconnaissance IA ; aucune conception structurelle ni ferraillage.
