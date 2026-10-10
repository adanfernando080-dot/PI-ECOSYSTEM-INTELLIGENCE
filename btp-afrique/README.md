# Plateforme BTP — noyau exécutable M0 (sans interface)

> ⚠ **Toutes les données de ce dossier sont SYNTHÉTIQUES** (`synthetic/test`) : plans, quantités, prix, taux, taxes, consommations, noms de zones. Elles ne reflètent **aucune réalité de marché** et ne doivent jamais être utilisées comme prix ou quantités réels. Tout document produit porte une bannière qui le rappelle.

Prouve que le cœur métier — modèle architectural neutre, hypothèses, métré géométrique universel, métré commercial par pack, `MarketBinding`, prix, DQE, devis, traçabilité — fonctionne **indépendamment de toute interface**. Zéro dépendance d'exécution (décimal exact et SHA‑256 écrits en TypeScript pur).

## Démarrage
```bash
npm install --legacy-peer-deps   # outils de dev uniquement (TypeScript, Vitest, tsx)
npm test                         # 150 tests
npm run typecheck
npm run demo                     # chiffre l'habitation avec 3 packs ; écrit out/ (voir examples/house/)
npm run check-docs               # cohérence exigences ↔ tests ↔ ADR (docs/INDEX.md)
```

## Flux de référence
```
Modèle architectural (neutre) ─► AssumptionSet ─► MÉTRÉ GÉOMÉTRIQUE (étage 1, universel, GeoQuantity + trace)
   ─► spécification neutre (taxonomie) ─► [MarketBinding = pack résolu + zone + paramètres] ─► MÉTRÉ COMMERCIAL (étage 2, pack)
   ─► ouvrages + besoins en articles ─► catalogue ─► prix (PriceBook, cascade de zones) ─► structure de coût (pack) ─► DQE / devis ─► manifeste de provenance
```

## Arborescence
```
src/core/            MOTEUR UNIVERSEL — pur : aucun import hors du moteur, aucune API réseau/horloge/aléa/flottant (vérifié par tests/purity)
  units/             Dec (BigInt exact), unités et conversions
  model/             modèle architectural neutre + validation (schéma fermé, taxonomie)
  assumptions/       AssumptionSet : aucune valeur par défaut implicite (ADR-0005)
  geometry/          ÉTAGE 1 : règles versionnées + takeoff (GeoQuantity avec trace)
  pack/              types, résolution (parent unique), validation (vocabulaire fermé), MarketBinding
  measure/           ÉTAGE 2 : correspondances, méthode de mesurage, ouvrages récursifs, besoins en articles
  pricing/           résolution de prix, statistiques/confiance, structure de coût, dates pures
  docs/              DocumentModel neutre + manifeste de provenance
  trace/             sha256, JSON canonique, chaîne de traçabilité, explications déterministes
  ops/               journal d'opérations, révisions, annulation
  project/           pipeline, run, bundle .btpx
src/adapters/        Node : fs, signature Ed25519 (clé de TEST), chargement des packs, rendu Markdown
src/cli.ts           démonstration en ligne de commande
market-packs/        DONNÉES : base-xof, bj, sn, test-divergent (signés, générés par tools/gen-packs.ts)
taxonomy/            taxonomie neutre de spécification v1.0.0
fixtures/synthetic/  cellule golden (1 pièce, 4 murs, 1 porte) et petite habitation (3 pièces, 10 murs, 7 ouvertures, dalle, toiture)
tests/               150 tests (16 fichiers) ; golden épinglés dans tests/golden/hashes.json
tools/               gen-packs, check-pack-isolation (garde-fou CI), check_traceability.py (docs)
examples/house/      livrables générés (DQE, devis, explications, chaîne de traçabilité, bundle) pour les 3 marchés
docs/                ARCHITECTURE, DATASET-STRATEGY, ADR (0001–0020), AUDIT, INDEX
```

## Garantie de reproductibilité (ADR-0006, addendum)
- **R1 exacte** : tout le cœur déterministe ⇒ mêmes entrées, **même SHA‑256** (inter‑processus vérifié ; autres plateformes à ajouter en CI).
- **R2 contenu** : les rendus affichent exactement les chiffres du `DocumentModel` ; les octets d'un futur PDF pourront différer.
- **R3 enregistrée** : les sorties d'IA ne sont pas rejouables ; la garantie commence au modèle accepté.

## Limites connues (M0)
Pièces rectangulaires orthogonales à épaisseur uniforme par côté ; longueur de mur mesurée à l'axe ; pas de recalcul incrémental ; pas de conversion de devise ; pas de PDF/XLSX (Markdown seulement) ; pas de `ManualLine` ; pas d'IA ; pas de chiffrement ni de plans sources ; bundle = dossier (pas encore ZIP) ; migrations de schéma non testées. Détail et état de chaque test : `docs/INDEX.md` §12.
