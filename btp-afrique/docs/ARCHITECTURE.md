# Plateforme BTP panafricaine — Architecture de référence (v0.1)

> Statut : proposition à valider. Aucun code n'est écrit. Ce document fixe les fondations, les frontières
> (déterministe / IA locale / IA cloud) et le découpage MVP → V3.
> Les valeurs métier (taxes, coefficients, prix) citées en exemple sont **illustratives** et doivent être
> validées par des professionnels béninois avant d'entrer dans une base de production.

---

## 0. Synthèse en 12 décisions

| # | Décision | Pourquoi |
|---|---|---|
| D1 | **Noyau métier pur en TypeScript** (modèle, métré, prix, documents), sans I/O, exécutable partout (desktop, web, serveur, worker) | Un seul moteur de calcul, identique en local et dans le cloud : mêmes résultats, testables |
| D2 | **Application desktop Windows en premier** (Tauri + UI web), PWA/Android ensuite | Parc matériel des professionnels = laptops Windows ; accès fichier/GPU local ; offline réel |
| D3 | **SQLite local = source de vérité** ; le cloud est un réplica optionnel | Offline-first sans compromis ; le cloud ne casse jamais le local |
| D4 | **Toute écriture = opération dans un journal (oplog)** horodaté (HLC) | Historique, undo, versions, synchronisation et audit viennent du même mécanisme |
| D5 | **Quantités ≠ Prix** : le métré référence des *codes catalogue*, jamais un montant | Exigence centrale ; permet scénarios, mises à jour de prix, multi-pays |
| D6 | **Métré = règles déclaratives versionnées + évaluateur sûr + arbre de trace** | Traçabilité de chaque chiffre, aucun calcul confié à une IA |
| D7 | **L'IA ne produit que des « propositions »** (avec confiance et preuve visuelle) ; seul l'humain les promeut en modèle validé | Transparence, responsabilité professionnelle |
| D8 | **Les « packs marché » sont des données signées, pas du code** (pays, devise, taxes, catalogues, gabarits, langues) | Extension multi-pays sans recompiler |
| D9 | **Un LLM n'appelle que des outils** (moteurs déterministes) et n'écrit aucun nombre de sa propre initiative | L'assistant explique, il ne calcule pas |
| D10 | **Plans chiffrés localement par défaut ; envoi cloud = opt-in explicite par projet** | Confidentialité des plans |
| D11 | **Modèle géométrique unique** (2D/3D/IFC = vues et exports du même modèle) | Continuité conception → chiffrage |
| D12 | **Le premier jalon livre de la valeur sans IA** (plan calibré + traçage assisté → métré → DQE → devis) ; l'IA arrive comme accélérateur mesurable | Le plus gros risque du projet est la reconnaissance de plans réels (voir §6.4) |

---

## 1. Périmètre : maintenant / MVP / plus tard

### 1.1 À poser MAINTENANT (fondations, avant toute interface)

Ce sont les éléments coûteux ou impossibles à corriger après coup :

1. Modèle de données (schémas, identifiants, provenance, unités, devises) — §3
2. Oplog + versions de projet + format de fichier projet — §2, §8
3. Séparation Quantités / Prix + schéma du catalogue et des packs marché — §4, §5, §9
4. Format de règles de métré + moteur d'évaluation + format de trace — §4
5. Cadre de test : « projets étalons » béninois avec métré de référence fait par un professionnel — §13
6. Schéma des « propositions IA » (confiance, preuve, statut) — §6.2
7. Modèle de sécurité (chiffrement local, licence offline, consentement cloud) — §11
8. Contrats d'interface (ports) pour stockage, IA, sync, rendu de documents — §2.3

### 1.2 MVP — chaîne PLAN → MÉTRÉ → PRIX BÉNIN → DQE → DEVIS (offline)

| Domaine | Inclus au MVP |
|---|---|
| Projet | création, historique de versions, restauration, export/import de fichier projet |
| Import | PDF (vectoriel et raster), JPG, PNG ; calibration d'échelle (manuelle + détection assistée) |
| Modèle | niveaux, murs, pièces, ouvertures (portes/fenêtres), dalles/toiture en **surface et pente simples** |
| Édition | correction manuelle du modèle sur le plan (outils de traçage/ajustement 2D minimaux) |
| IA locale | OCR + détection de cotes/échelle/titres, **propositions** de murs/pièces/ouvertures, contrôle de cohérence |
| Métré | lots gros-œuvre, maçonnerie, enduits, revêtements, peinture, menuiseries, couverture (liste exacte §12) |
| Prix | catalogue Bénin v0, XOF, prix par ville/région avec date, source, confiance ; saisie/override utilisateur |
| Documents | DQE (PDF + Excel), devis (PDF), fiche de traçabilité du métré |
| Offline | 100 % des étapes ci-dessus ; mise à jour de catalogue par fichier ou réseau quand disponible |
| Sécurité | chiffrement local, licence + essai 5 jours vérifiables hors ligne |

**Explicitement hors MVP** : éditeur 2D complet, 3D, DPGF avancé (sous-détails), scénarios, fournisseurs,
multi-pays actif, assistant conversationnel, structure/ferraillage, sync cloud multi-appareils.

### 1.3 À PRÉVOIR architecturalement, à développer plus tard

| Fonction | Ce qu'on prépare dès maintenant | Livraison |
|---|---|---|
| Éditeur 2D complet | modèle géométrique + commandes d'édition (undo/redo) | V1 |
| 3D | extrusion depuis le modèle, champs d'élévation/épaisseur/couches déjà dans le schéma | V1 |
| DPGF + sous-détails | compositions d'ouvrages hiérarchiques déjà dans le schéma | V1 |
| Scénarios | `Estimate` = (version de métré, version de prix, paramètres) → N estimations par projet | V1 |
| Multi-pays / devises | packs marché, taux de change versionnés, table de taxes | V1 |
| Assistant IA | couche d'outils (§6.6) | V1 |
| Sync cloud, multi-appareils | oplog + HLC + identifiants UUIDv7 | V1 |
| Génération de plans, optimisation auto | moteur de scénarios + contraintes | V2 |
| BIM/IFC, API publique, marketplace, collaboration | mapping IFC, auth/ACL au niveau entité, API = ports existants | V3 |

---

## 2. Architecture offline-first

### 2.1 Vue d'ensemble

```
┌──────────────────────────── APPAREIL (source de vérité) ─────────────────────────────┐
│  UI (web, dans Tauri)                                                                │
│     │ commandes / requêtes                                                           │
│  ┌──▼────────────────────────── APPLICATION (use-cases) ────────────────────────┐    │
│  │  Projets · Import · Validation IA · Métré · Chiffrage · Documents · Sync      │    │
│  └──┬──────────────┬───────────────┬─────────────────┬────────────────┬─────────┘    │
│     │              │               │                 │                │               │
│  ┌──▼────┐   ┌─────▼─────┐   ┌─────▼──────┐   ┌──────▼──────┐   ┌─────▼──────┐        │
│  │ CORE  │   │ Ports :   │   │ Ports :    │   │ Ports :     │   │ Ports :    │        │
│  │ pur   │   │ Storage   │   │ AI         │   │ Render      │   │ Sync       │        │
│  │ (D1)  │   │ SQLite    │   │ ONNX local │   │ PDF/Excel   │   │ HTTP (opt) │        │
│  └───────┘   │ + fichiers│   │ + cloud(opt)│  │ local       │   └─────┬──────┘        │
│              └───────────┘   └────────────┘   └─────────────┘         │               │
└────────────────────────────────────────────────────────────────────────┼──────────────┘
                                                                         │ (quand réseau + consentement)
                                              ┌──────────────────────────▼──────────────┐
                                              │ CLOUD : Postgres + objets chiffrés       │
                                              │ catalogues/packs signés · IA cloud       │
                                              │ licences · sync · API                    │
                                              └──────────────────────────────────────────┘
```

### 2.2 Règles d'or offline

1. **Aucune fonction du MVP ne requiert le réseau.** Un test de CI exécute le scénario complet avec le réseau coupé.
2. **Le cloud est un client comme un autre** du même protocole (le serveur est un réplica).
3. **Dégradation gracieuse** : chaque fonction cloud a un repli local (ex. IA cloud indisponible → proposition locale + signalement « confiance réduite »).
4. **Mises à jour = paquets signés** (catalogues de prix, packs marché, modèles IA, règles de métré) : téléchargeables par réseau *ou* importables depuis une clé USB / un transfert Bluetooth/WhatsApp-fichier. Vérification de signature locale (Ed25519). Important pour les zones à faible connectivité.
5. **Jamais de dépendance à une horloge réseau** : voir licence offline §11.3.

### 2.3 Ports et adaptateurs (garantit « cloud sans casser le local »)

| Port | Adaptateur MVP | Adaptateurs futurs |
|---|---|---|
| `Storage` | SQLite (WAL) + dossier de blobs adressés par hash | idem côté serveur : Postgres + S3 |
| `AiVision` / `AiOcr` | ONNX Runtime local | service cloud (même contrat) |
| `AiAssistant` | — | LLM local quantifié ; LLM cloud |
| `DocumentRenderer` | PDF + XLSX locaux | idem |
| `SyncTransport` | désactivé | HTTPS + oplog |
| `Clock`, `Ids` | horloge locale (HLC), UUIDv7 | — |
| `LicenseVerifier` | jeton signé local | — |

Le **core** ne connaît aucun adaptateur : il reçoit des données et rend des données.

### 2.4 Choix technologiques (et alternatives honnêtes)

| Couche | Choix proposé | Alternative | Remarque |
|---|---|---|---|
| Shell desktop | **Tauri** (Rust + WebView) | Electron | Tauri : installeur ~10 Mo, RAM faible (important sur PC modestes). Electron : plus mûr, plus lourd. Décision réversible car le core est du TS pur |
| UI | TypeScript + React | — | 2D : canvas/WebGL (PixiJS ou Konva) ; 3D : three.js |
| Core | TypeScript, `decimal.js` pour les quantités | Rust → WASM | TS d'abord (vitesse de développement, partage web/serveur). Rust/WASM seulement si un goulot de performance est mesuré |
| Base locale | **SQLite** (+ SQLCipher ou chiffrement applicatif) | IndexedDB (PWA) | Un adaptateur IndexedDB/OPFS-SQLite sera nécessaire pour la PWA |
| Inférence IA | **ONNX Runtime** (CPU, DirectML/GPU si présent) | llama.cpp pour LLM local | Modèles quantifiés int8 ; aucune dépendance CUDA |
| PDF | pdfium/pdf.js (lecture) ; génération via pdf-lib/pdfmake | Typst | Polices embarquées (accents, FCFA) |
| Excel | exceljs | — | formules Excel réelles optionnelles |
| Cloud (V1) | Postgres, stockage objet, workers de jobs | — | Aucun besoin avant V1 |

**Matériel minimal cible à valider avec des utilisateurs réels** : 8 Go RAM, CPU 4 cœurs sans GPU, Windows 10/11. Tout le pipeline IA du MVP doit tourner sur CPU en un temps acceptable (objectif : < 60 s par page A3 courante) ; sinon traitement en tâche de fond avec progression.

---

## 3. Modèle de données architectural

### 3.1 Principes transversaux

- **Identifiants** : UUIDv7 (triables, générables hors ligne sans collision).
- **Unités** : géométrie en **mètres (m)** en interne, toujours. Les unités d'affichage sont une préférence. Aucun nombre sans unité dans les schémas (`{ value, unit }` ou colonne nommée avec unité).
- **Nombres** : quantités en décimal exact (pas de `float` pour les sommes). Argent en **entier de plus petite unité** (XOF n'a pas de subdivision ; d'autres devises en ont : champ `minorUnits` par devise).
- **Provenance de chaque attribut significatif** (voir 3.3).
- **Immuabilité par version** : on ne modifie pas une version publiée ; on en crée une nouvelle (§8).
- **Données tenant** : tout objet porte `projectId`, `createdAt`, `createdBy`, `schemaVersion`.

### 3.2 Hiérarchie

```
Workspace (organisation)
 └─ Project
     ├─ Site (pays, ville, adresse, altitude/zone, accès chantier)       → pilote prix, taxes, packs
     ├─ SourceDocument[] (PDF/JPG/PNG, hash, pages)                        → blobs immuables
     │    └─ PlanSheet[] (page, échelle, calibration, niveau associé)
     ├─ ArchitecturalModel (versionnée)
     │    └─ Building[]
     │         └─ Level[]  (élévation, hauteur sous plafond)
     │              ├─ Wall[]       (axe, épaisseur, hauteur, couches/matériaux, rôle: porteur/cloison…)
     │              ├─ Opening[]    (type, dimensions, allège, linteau, hôte: wallId)
     │              ├─ Space[]      (pièce : contour, usage, finitions sol/mur/plafond)
     │              ├─ Slab[] / Roof[] (contour, épaisseur, pente, type)
     │              └─ Annotation[] (cotes, textes liés à des éléments)
     ├─ AiProposal[]        (voir §6.2)
     ├─ QuantitySet (versionné, dérivé du modèle + règles)
     │    └─ QuantityLine[]   (code catalogue, quantité, unité, trace)
     ├─ Estimate[]          (scénarios : QuantitySet vX + PriceBook vY + paramètres)
     │    └─ EstimateLine[]   (quantité × prix résolu, lot, déboursé, montant)
     └─ Document[]          (DQE/DPGF/devis générés : instantanés, hash, version de tout ce qui y a contribué)
```

Tables transverses (hors projet) : `MarketPack`, `Catalogue*`, `PriceBook*`, `Unit`, `Currency`, `TaxRuleSet`, `DocumentTemplate`, `MeasurementRuleSet`, `ModelArtifact` (modèles IA).

### 3.3 Provenance, confiance, preuve (colonne vertébrale de la transparence)

Chaque élément du modèle (mur, ouverture…) et chaque attribut critique (échelle, longueur, épaisseur) porte :

```jsonc
{
  "value": 8.40,
  "unit": "m",
  "origin": "ai_detected | user_entered | user_corrected | derived | default_rule",
  "confidence": 0.72,                 // null si origin = user_*
  "evidence": {                       // pour retrouver « pourquoi »
    "sheetId": "…", "page": 1,
    "bbox": [x, y, w, h],             // zone du plan
    "detectorId": "walls-seg@1.3.0", "modelHash": "sha256:…"
  },
  "validation": "unreviewed | accepted | rejected | edited",
  "history": ["op-id-1", "op-id-2"]   // renvoie à l'oplog : qui a changé quoi
}
```

Règle : **un élément `unreviewed` ne peut pas alimenter un document final** sans avertissement explicite visible sur le document (« X éléments non validés »).

### 3.4 Géométrie

- Repère local du niveau, axe X/Y en mètres, origine définie à la calibration du plan.
- **Mur** = polyligne d'axe + épaisseur + hauteur + `layers[]` (enduit, bloc, enduit) → permet métré par couche *et* rendu 3D.
- **Ouverture** = rattachée à un mur hôte (`hostWallId`, `offsetAlongWall`) → la soustraction de surface est une relation, pas un calcul fragile par chevauchement géométrique.
- **Pièce** = cycle fermé de murs (graphe topologique), pas seulement un polygone dessiné → une modification de mur propage à la surface de la pièce.
- Topologie stockée : `wall.startNode / endNode` avec nœuds partagés → déplacer un mur déplace les murs connectés (comportement attendu en 2D éditable).
- Champs de hauteur/élévation/pente présents dès le MVP (valeurs par défaut) pour que la 3D n'impose pas de migration.

### 3.5 Exemple minimal (JSON de sérialisation)

```jsonc
{
  "wall": {
    "id": "0192…", "levelId": "…", "code": "M-023",
    "axis": [[0,0],[8.40,0]],
    "thickness": { "value": 0.20, "unit": "m", "origin": "ai_detected", "confidence": 0.88 },
    "height":    { "value": 3.00, "unit": "m", "origin": "default_rule" },
    "role": "load_bearing",
    "layers": [
      {"material": "enduit-ciment-ext", "thickness": 0.015},
      {"material": "agglo-creux-20",    "thickness": 0.20},
      {"material": "enduit-ciment-int", "thickness": 0.015}
    ]
  }
}
```

---

## 4. Moteur de métré (déterministe)

### 4.1 Principe

```
Modèle validé ─┐
Règles de métré (versionnées) ─┼─► Évaluateur ─► QuantityLine[] + Trace
Compositions d'ouvrages ───────┘
```

Aucune IA ici. Même entrée → même sortie, bit à bit. C'est testable par des cas étalons.

### 4.2 Deux niveaux de règles

1. **Règles de mesure** (géométrie → grandeurs) : surface brute, ouvertures déduites, périmètres, volumes de dalle…
   Exemple : `wall.netArea = wall.length * wall.height - Σ opening.area`.
2. **Compositions d'ouvrages** (grandeur → composants) : un *ouvrage* (ex. « maçonnerie agglo 20 cm ») = liste de composants avec **consommation par unité** et **taux de perte**.

Les deux sont des **données** (JSON/YAML) rattachées à un `MeasurementRuleSet` et à un pack marché : les pratiques constructives (épaisseur d'agglos courants, dosage, pertes) varient selon le pays et seront ajustables sans toucher au code.

### 4.3 Format d'une composition (exemple illustratif)

```jsonc
{
  "code": "OUV.MAC.AGGLO20", "unit": "m2", "version": "1.0.0",
  "measure": "wall.netArea",                     // d'où vient la quantité d'ouvrage
  "components": [
    { "item": "MAT.AGGLO.20x20x40", "kind": "material",
      "consumption": "12.5", "per": "m2",         // blocs / m² (exemple)
      "lossRate": "0.05" },
    { "item": "MAT.CIMENT.CPJ35",  "kind": "material",
      "consumption": "…", "per": "m2", "lossRate": "0.03" },
    { "item": "MAT.SABLE.MORTIER",  "kind": "material", "consumption": "…", "per": "m2" },
    { "item": "MO.MACON",           "kind": "labour",    "consumption": "…", "per": "m2" }
  ],
  "roundingOrder": { "MAT.AGGLO.20x20x40": "ceil_unit" }
}
```

Les composants de type `material | labour | equipment | transport | subcontract` reçoivent leur prix **plus tard** (§5).
Le métré ne produit que `(item, quantité, unité, trace)`.

### 4.4 Évaluateur d'expressions

- Langage d'expression **restreint et sûr** (arithmétique décimale, fonctions `sum`, `min`, `max`, `ceil`, `round`, accès aux propriétés) — **pas d'`eval`**, pas d'accès I/O.
- Arithmétique **décimale** ; arrondi **uniquement** aux points déclarés (`roundingOrder`, présentation).
- Unités vérifiées : `m² × blocs/m²` → `blocs` ; une incohérence dimensionnelle est une **erreur**, pas un avertissement.

### 4.5 Trace (l'« explication » de chaque chiffre)

Chaque `QuantityLine` porte un arbre de trace généré par l'évaluateur (pas rédigé a posteriori) :

```jsonc
{
  "item": "MAT.AGGLO.20x20x40",
  "quantity": { "value": "284", "unit": "u" },
  "trace": {
    "rule": "OUV.MAC.AGGLO20@1.0.0",
    "steps": [
      { "expr": "wall.length * wall.height", "inputs": {"length": "8.40 m", "height": "3.00 m"}, "result": "25.20 m²", "source": "wall:M-023" },
      { "expr": "Σ opening.area",             "inputs": {"O-007": "1.20", "O-008": "2.40"},        "result": "3.60 m²" },
      { "expr": "gross - openings",           "result": "21.60 m²" },
      { "expr": "net × 12.5 blocs/m²",        "result": "270.0 u (théorique)" },
      { "expr": "théorique × (1 + 0.05)",     "result": "283.5 u" },
      { "expr": "ceil",                       "result": "284 u (commandable)" }
    ],
    "inputsProvenance": [{"wall:M-023": "user_corrected"}, {"opening:O-008": "ai_detected, conf 0.72"}],
    "ruleSetVersion": "BJ-gros-oeuvre@0.1.0"
  },
  "flags": ["input_low_confidence"]
}
```

L'UI affiche cette trace telle quelle (« Pourquoi cette quantité ? »). L'assistant IA ne fait que la **reformuler**.

### 4.6 Recalcul incrémental

Graphe de dépendances : `élément du modèle → règles → QuantityLine`. Une modification (ex. chambre 12 → 16 m²) invalide uniquement les lignes touchées. Garantie : le résultat incrémental est **identique** au recalcul complet (test de propriété systématique).

### 4.7 Hors périmètre déterministe « sûr »

Structure, fondations, ferraillage : le MVP propose des **estimations paramétriques** (ratios, ex. kg d'acier/m³ selon type d'élément) étiquetées « estimation — validation par un ingénieur requise », avec avertissement imprimé sur les documents. Aucun dimensionnement de stabilité.

---

## 5. Moteur de prix

### 5.1 Séparation stricte

```
QuantityLine (item, qté, unité)        ← métré, aucun prix
        │  (jointure au moment du chiffrage uniquement)
PriceBook (version, pays/région/ville, devise)
        │
EstimateLine = qté × prix résolu (+ coefficients) → montant
```

Un `Estimate` référence : `QuantitySet@vN` + `PriceBook@vM` + `EstimateParameters@vK` (marges, frais, imprévus, taxes). Changer le prix ne touche pas au métré, et inversement. Plusieurs `Estimate` coexistent (Éco/Standard/Premium).

### 5.2 Modèle de prix

```
PriceObservation (append-only)
  item, unit, currency, amount
  scope: country/region/city, supplierId?
  observedAt, source{type: supplier_quote|market_survey|invoice|user|import, ref}
  quantityBreak?  (prix par palier)
PriceStat (calculé, par item × zone × période)
  min, mean(ou médiane), max, n, lastObservedAt, confidence
PriceBook (publié, signé, versionné)
  = sélection figée de PriceStat + règles de résolution
```

- **Les observations ne sont jamais écrasées** (traçabilité et audit).
- **Médiane** recommandée par défaut plutôt que moyenne (robustesse aux valeurs aberrantes) ; la moyenne reste disponible comme demandé.
- **Confiance** = f(nombre d'observations, ancienneté, dispersion, fiabilité de la source). Formule publiée et testée.

### 5.3 Résolution d'un prix (cascade déterministe)

1. Override utilisateur du projet (explicitement marqué).
2. Prix fournisseur choisi (si fournisseur sélectionné).
3. Ville → région → pays → (jamais un autre pays sans signalement).
4. Si aucun prix : la ligne est `unpriced` — **jamais 0**, jamais inventé. Le devis refuse de se finaliser sans décision de l'utilisateur.

Chaque `EstimateLine` enregistre quel niveau de cascade a servi, la date du prix, l'âge, la confiance → alertes « prix > 90 jours », « prix issu de la région et non de la ville ».

### 5.4 Du déboursé au prix de vente

Structure configurable par pack marché (valeurs par défaut à valider localement) :

```
Déboursé sec = Σ (matériaux + main-d'œuvre + matériel + transport + sous-traitance)
+ Frais généraux (%)  + Frais de chantier (%)  + Imprévus (%)
→ Prix de revient
+ Marge/bénéfice (%)
→ Prix de vente HT  (équivalent d'un coefficient K)
+ Taxes (selon TaxRuleSet : ex. TVA)  → TTC
```

Les taux sont des **paramètres de l'Estimate**, pas des constantes. Les règles d'arrondi (par ligne, par lot, au total) sont déclarées dans le pack marché.

### 5.5 Devises

- Chaque `PriceBook` a **une** devise. Un `Estimate` a **une** devise de présentation.
- Conversion = `ExchangeRate` versionné (date, source). Le XOF est arrimé à l'euro (parité fixe officielle) : cas particulier simple et utile pour un affichage double.
- Un document n'est jamais recalculé silencieusement avec un autre taux : le taux utilisé est écrit dans le document.

---

## 6. Architecture IA

### 6.1 Pipeline d'analyse de plan

```
Import ─► Normalisation ─► Classification de page ─► Échelle ─► OCR/texte ─► Détection ─► Reconstruction ─► Contrôles ─► PROPOSITIONS ─► Validation humaine ─► Modèle
```

| Étape | Méthode | Où | Nature |
|---|---|---|---|
| Normalisation | PDF : **extraction vectorielle si disponible** (lignes, polylignes, texte exacts) ; sinon rastérisation 200–300 dpi, redressement, binarisation | local | déterministe |
| Classification de page | plan / coupe / façade / cartouche / détail | local | IA légère |
| Échelle | 1) texte d'échelle (« 1/100 »), 2) cotes reconnues vs longueurs mesurées, 3) barre d'échelle ; sinon **demande à l'utilisateur** | local | OCR + calcul déterministe |
| OCR / cotes | OCR (PaddleOCR/Tesseract exportés ONNX) + parseur de cotes | local | IA + règles |
| Détection | segmentation des murs, détection portes/fenêtres, étiquettes de pièces | local (MVP) ; cloud pour plans difficiles | IA |
| Reconstruction | vectorisation des murs, fermeture des pièces, graphe topologique, rattachement ouvertures→murs | local | **géométrie déterministe** sur sortie IA |
| Contrôles | cohérence : surface annotée vs calculée, pièces non fermées, cotes contradictoires, échelle incohérente | local | déterministe |
| Propositions | émission d'`AiProposal` | local | — |

Le **PDF vectoriel** est le cas le plus favorable (géométrie exacte, texte extractible) : à traiter en premier et à mesurer séparément du raster (photo/scan), nettement plus difficile.

### 6.2 `AiProposal` : le contrat qui rend l'IA non-opaque

```jsonc
{
  "id": "…", "kind": "wall | opening | space | dimension | scale | level",
  "proposedValue": { /* géométrie ou valeur */ },
  "confidence": 0.72,
  "evidence": { "sheetId": "…", "bbox": [..], "detectorId": "openings@0.4.1", "modelHash": "sha256:…" },
  "alternatives": [ { "value": {...}, "confidence": 0.18 } ],
  "checks": [ { "id": "area-mismatch", "severity": "warn", "message": "Surface annotée 14,2 m² ≠ 12,9 m² mesurée" } ],
  "status": "pending | accepted | rejected | edited"
}
```

- Une proposition ne modifie **jamais** le modèle tant qu'elle n'est pas `accepted/edited`.
- Acceptation en lot possible au-dessus d'un seuil de confiance **choisi par l'utilisateur**, avec revue obligatoire en dessous.
- Les éléments à faible confiance sont **visuellement signalés sur le plan** (ex. contour orange).

### 6.3 IA locale vs IA cloud

| Fonction | Local (offline) | Cloud (optionnel) | Justification |
|---|---|---|---|
| OCR, cotes, texte d'échelle | ✅ MVP | repli | modèles petits, exigence offline |
| Segmentation murs / ouvertures | ✅ MVP (modèle quantifié) | ✅ modèle plus gros pour plans difficiles | qualité vs taille |
| Reconstruction topologique | ✅ (déterministe) | — | pas de l'IA |
| Contrôles de cohérence | ✅ | — | déterministe |
| Compréhension fine d'un plan complexe (VLM) | ❌ | ✅ V1, opt-in | modèles trop lourds pour PC modeste |
| Assistant conversationnel | ✅ petit LLM quantifié (V1, si matériel) | ✅ LLM puissant | l'assistant reformule et appelle des outils |
| Optimisation de coût (suggestions) | calcul local (moteur de scénarios) ; texte explicatif IA | ✅ | les chiffres viennent du moteur |
| Génération de plans | ❌ | ✅ V2 | calcul lourd |
| Suggestion de matériau alternatif | ✅ (règles + catalogue d'équivalences) | ✅ | équivalences = **données**, pas hallucination |

**Règle cloud** : envoi uniquement de ce qui est nécessaire (recadrages plutôt que plan complet quand possible), consentement par projet, journal des envois consultable, pas d'entraînement sur les données clients sans accord explicite (§11.4).

### 6.4 Risque principal et stratégie de réduction

La reconnaissance fiable de plans réels (qualité de dessin hétérogène, scans, photos, conventions variables) est **le** risque technique du projet. Constats à assumer :

1. Les jeux de données publics de plans (surtout occidentaux/asiatiques) généralisent mal à des plans béninois.
2. Aucun modèle ne sera à 100 % : l'outil doit être conçu pour que **corriger soit rapide**, pas pour que l'IA ait toujours raison.

Stratégie :

- **Constituer un jeu étalon dès maintenant** : 30–50 plans béninois réels (avec autorisation), annotés, avec métré de référence d'un professionnel. Il sert à la fois de **jeu d'évaluation** et de test de non-régression.
- **Définir des KPI avant de choisir les modèles** : p.ex. « temps pour obtenir un modèle validé vs traçage manuel », rappel/précision murs & ouvertures par type de source (PDF vectoriel / PDF raster / photo).
- **Boucle de données** : les corrections utilisateur (avec consentement) deviennent des annotations d'entraînement → l'outil s'améliore avec l'usage local.
- **Palier de sécurité** : si l'IA est insuffisante sur raster, l'outil reste utile grâce au traçage assisté (accrochage aux lignes détectées, fermeture de pièces auto, copie d'ouvertures types).

### 6.5 Gestion des modèles IA

`ModelArtifact` : identifiant, version, hash, tâche, taille, matériel requis, métriques sur le jeu étalon, licence. Installés comme paquets signés ; plusieurs versions coexistent ; chaque proposition enregistre le `modelHash` utilisé → reproductibilité et audit.

### 6.6 Assistant (V1) : LLM = interface, moteurs = vérité

```
Utilisateur : « Combien de blocs pour cette maison ? »
LLM ─► outil get_quantity(item="MAT.AGGLO.*", scope="project") ─► QuantityLine + trace
LLM ─► reformule : « 4 120 blocs commandables (voir détail par mur) »  + lien vers la trace
```

- Outils exposés : `get_quantity`, `explain_line`, `list_low_confidence`, `compare_versions`, `simulate_change` (retourne un *delta* **sans l'appliquer**), `suggest_alternatives`.
- **Aucun nombre dans la réponse qui ne provienne d'un appel d'outil** (vérifié par un contrôle de sortie : tout nombre doit être rattaché à un résultat d'outil).
- Toute modification passe par une **proposition d'opération** que l'utilisateur accepte (§8.3).
- « Réduis le coût de 10 % » = recherche déterministe dans l'espace des substitutions autorisées (équivalences du catalogue, réduction de pertes, finitions alternatives), classée par économie ; l'IA présente et explique.

---

## 7. Qu'est-ce qui est déterministe, IA, local, cloud ? (tableau de décision)

| Fonction | Déterministe | IA locale | IA cloud |
|---|:--:|:--:|:--:|
| Calcul de surfaces, volumes, déductions d'ouvertures | ✅ | | |
| Application des consommations, pertes, arrondis | ✅ | | |
| Résolution et calcul des prix, TVA, marges | ✅ | | |
| Génération DQE/DPGF/devis/Excel/PDF | ✅ | | |
| Détection d'échelle (calcul final) | ✅ | (OCR du texte) | |
| Détection murs / ouvertures / pièces | | ✅ | (plans difficiles) |
| OCR des textes et cotes | | ✅ | |
| Fermeture des pièces, graphe topologique | ✅ | | |
| Contrôles de cohérence | ✅ | | |
| Classement des postes à fort impact | ✅ | | |
| Rédaction d'explications, dialogue | | ✅ (petit) | ✅ |
| Propositions d'optimisation | ✅ (calcul) | | ✅ (formulation) |
| Génération de plans | | | ✅ (V2) |
| Dimensionnement structure | ❌ jamais automatique : estimation paramétrique + validation pro | | |

---

## 8. Projets, versions, historique

### 8.1 Trois couches

1. **Oplog** (fin) : chaque opération (ajout mur, déplacement, acceptation d'une proposition, changement de prix…) est un enregistrement immuable `{opId, hlc, actor, entity, patch, inverse}` → undo/redo, audit, sync.
2. **Révisions** (nommées) : « instantanés » d'un état du modèle à un moment (`Rev 3 — après validation client`). Contenu adressé par hash, partage de structure.
3. **Documents émis** : un DQE/devis est lié à des versions précises `(Model@rev, QuantitySet@v, PriceBook@v, Params@v, Template@v)`. On peut **reproduire** un document des mois plus tard et prouver ce qu'il contenait.

### 8.2 Comparer deux versions

Diff structuré : éléments ajoutés/supprimés/modifiés → delta de quantités → delta de coût ventilé par cause (« +120 000 XOF dont 80 % dus à la surface, 15 % à la hausse du ciment »). Possible car quantités et prix sont séparés et versionnés.

### 8.3 Édition comme commandes

Toute modification (humaine, assistant, optimisation) est une **Command** validable par le core avant application (invariants : topologie, unités, intégrité référentielle). L'assistant propose une `Command[]` ; l'utilisateur voit le delta (quantité + coût) puis accepte.

### 8.4 Format de fichier projet

`.btpx` = archive : `project.sqlite` (ou export JSON canonique) + `blobs/` (plans) + `manifest.json` (versions de schéma, hash). Permet : sauvegarde manuelle, envoi par WhatsApp/e-mail/clé USB, ouverture sur un autre PC sans cloud. Migrations de schéma explicites et testées (jamais de lecture « en espérant »).

---

## 9. Multi-pays : packs marché

### 9.1 Contenu d'un `MarketPack` (données signées et versionnées)

| Élément | Exemples |
|---|---|
| Géographie | pays, régions, villes (hiérarchie), fuseau |
| Monnaie | code ISO, unités mineures, règles d'arrondi, format d'affichage |
| Fiscalité | `TaxRuleSet` (taux, assiette, exonérations, mentions légales), à valider par un fiscaliste local |
| Langues | fichiers de traduction, glossaire BTP (FR au départ ; EN pour Ghana/Nigeria) |
| Unités et conventions | m², ml, u, forfait, ensemble ; sens des décimales |
| Catalogue | matériaux, ouvrages, équivalences, main-d'œuvre (qualifications) |
| Règles de métré | compositions locales, taux de perte, hauteurs standard |
| Gabarits de documents | DQE, DPGF, devis, mentions obligatoires |
| Paramètres par défaut | frais généraux, marge, imprévus (modifiables) |

**Ajouter le Togo = publier un pack**, pas modifier le code. Test d'architecture : un pack factice « Pays Test » (autre devise, autre taxe, autre langue) doit fonctionner de bout en bout en CI, pour garantir qu'aucun Bénin n'est codé en dur.

### 9.2 Catalogue à deux niveaux

- **Catalogue universel** : concepts neutres (`MAT.AGGLO` + attributs : dimensions, résistance) avec **code stable**.
- **Spécialisation par pays** : noms locaux (« agglo », « parpaing »…), conditionnements, fournisseurs, équivalences.
Les règles de métré parlent des **codes universels** ; les prix sont locaux. C'est ce qui rend les pays comparables et les règles réutilisables.

### 9.3 Base Bénin : stratégie de constitution

Les prix publics structurés et à jour pour le BTP béninois sont probablement rares et dispersés : **il faut planifier une collecte** et ne jamais présenter une donnée non vérifiée comme fiable.

- Phase 0 : catalogue restreint (≈ 150–300 articles couvrant les lots du MVP) + prix collectés sur Cotonou, avec dates et sources.
- Phase 1 : Abomey-Calavi, Porto-Novo, Parakou.
- Outil de collecte hors-ligne (saisie terrain avec photo du devis/facture, synchronisation différée) — c'est aussi la future brique « communauté de prix ».
- Chaque prix est étiqueté `confidence` + `observedAt` ; l'UI affiche l'âge.
- Gouvernance : une personne/équipe responsable de la validation du catalogue, avec procédure de publication (`PriceBook` signé).

---

## 10. Documents : DQE, DPGF, devis

### 10.1 Pipeline

```
Estimate ──► DocumentModel (neutre : sections, tableaux, totaux, mentions) ──► Renderer PDF
                                                                          └─► Renderer XLSX
```

- Le **DocumentModel** est calculé par le core (chiffres) ; le rendu ne fait **aucun calcul** (évite les écarts PDF vs Excel).
- Gabarits = données (dans le pack) : en-têtes, mentions légales, structure de lots, langue, devise, numérotation.
- Identité entreprise (logo, RCCM/IFU, coordonnées) = profil local ; signature = image ou espace réservé.
- Excel : valeurs, et option **formules vivantes** (sous-totaux, TVA) pour les utilisateurs qui veulent modifier.

### 10.2 Contenu

| Document | Particularités |
|---|---|
| **DQE** | lots → articles : n°, désignation, unité, quantité, PU, montant ; totaux de lot |
| **DPGF** | idem + sous-détails (composition de l'ouvrage), prix forfaitaires par lot (V1) |
| **Devis** | émetteur, client, chantier, date, n°, validité, travaux, HT, TVA, TTC, conditions, observations, signature |
| **Annexe de traçabilité** (optionnelle) | version des prix, éléments non validés, hypothèses, avertissements (structure, etc.) |

### 10.3 Garde-fous

- Impossible d'émettre un devis avec lignes `unpriced` sans confirmation explicite.
- Les éléments à confiance basse ou non validés sont listés dans l'annexe.
- Numérotation de devis séquentielle locale (préfixe appareil/utilisateur pour éviter les collisions hors ligne ; renumérotation officielle côté cloud en V1 si nécessaire).

---

## 11. Sécurité et confidentialité

### 11.1 Données locales

- Chiffrement au repos (SQLCipher ou chiffrement applicatif des blobs) ; clé dérivée d'un secret utilisateur et/ou du coffre OS (DPAPI sous Windows).
- Plans stockés comme blobs adressés par hash, chiffrés.
- Journal d'audit local (exports, envois cloud).

### 11.2 Modèle de menace réaliste (MVP)

Vol/perte d'ordinateur ; copie de fichiers projet ; partage involontaire ; piratage de licence ; fuite via IA cloud. On ne prétend pas défendre contre un attaquant disposant d'un accès administrateur à une machine déverrouillée.

### 11.3 Licences hors ligne

- Jeton de licence **signé** (Ed25519) contenant plan, expiration, identifiant d'appareil ; vérifié localement.
- Période de grâce hors ligne (ex. 30 jours) puis revalidation requise.
- **Essai 5 jours** : l'horloge locale est manipulable. Mitigation : jeton d'essai émis par le serveur à l'activation (nécessite un accès réseau une fois), stockage d'un compteur monotone + détection de recul d'horloge. Pas de protection parfaite ; ne pas sur-investir côté anti-piratage au MVP.
- Principe : dégrader proprement (lecture/export des projets toujours possibles) plutôt que verrouiller les données du client.

### 11.4 Confidentialité IA et cloud

- Par défaut : **tout reste local**.
- IA cloud / sync = case à cocher **par projet**, avec explication claire de ce qui est envoyé.
- Transport TLS ; stockage cloud chiffré ; option de chiffrement de bout en bout des blobs de plans (clé détenue par l'utilisateur) à partir de la V1.
- Aucune utilisation des plans ou corrections pour entraîner des modèles sans **consentement distinct, révocable**.
- Conformité : le Bénin dispose d'un cadre de protection des données personnelles (Code du numérique, autorité APDP). À **faire valider par un juriste** avant la collecte de données clients (noms/adresses de clients dans les devis, transfert hors du pays pour l'IA cloud).

### 11.5 Intégrité des paquets de données

Catalogues, packs, modèles IA : signés ; refus si signature invalide ; versions de schéma vérifiées. Empêche l'injection de prix ou de règles falsifiés.

---

## 12. Périmètre fonctionnel de métré du MVP

Lots proposés (ordre de priorité, à confirmer avec des métreurs) :

1. Terrassement / fondations **en estimation paramétrique** (avertie)
2. Maçonnerie (élévation en agglos, linteaux/chaînages en estimation paramétrique)
3. Enduits (intérieurs/extérieurs)
4. Dallages / planchers (surface, épaisseur)
5. Revêtements sol et mur (carrelage, plinthes)
6. Peinture (murs, plafonds)
7. Menuiseries (portes, fenêtres : comptage par type et dimension)
8. Couverture (surface développée selon pente, charpente en estimation)
9. Plomberie / électricité : **comptages simples par pièce** (points) seulement

Chaque lot = un `MeasurementRuleSet` testé contre au moins 3 projets étalons.

---

## 13. Qualité, tests, reproductibilité

| Niveau | Contenu |
|---|---|
| Unitaire | évaluateur d'expressions, unités, arrondis, résolution de prix |
| Propriétés | recalcul incrémental ≡ recalcul complet ; décimal ≡ référence ; sérialisation aller-retour |
| Étalons | N projets réels avec métré et DQE de référence d'un professionnel ; écart toléré documenté par poste |
| Offline | scénario complet avec réseau coupé en CI |
| Multi-pays | pack « Pays Test » de bout en bout |
| IA | évaluation sur jeu étalon par source (vectoriel/raster/photo) ; seuils de non-régression ; rapport à chaque nouveau modèle |
| Migration | ouverture de fichiers projets de toutes les versions de schéma antérieures |

---

## 14. Évolution cloud sans casser le local

1. **Dès le MVP** : oplog + HLC + UUIDv7 + `deviceId` ⇒ le protocole de sync existe déjà en puissance.
2. **V1 – Sync** : le serveur Postgres applique le même schéma ; échange d'opérations ; blobs via hash (dédoublonnage) ; reprise sur coupure (opérations idempotentes).
3. **Conflits** : résolution au niveau champ (dernier écrivain par HLC) pour les attributs simples ; pour la géométrie, détection de conflit entité par entité et choix explicite de l'utilisateur ; la majorité des projets étant mono-utilisateur, cas rare au départ.
4. **Services cloud** (catalogues, IA lourde, licences, API) exposent les mêmes contrats que les ports locaux.
5. **Règle de non-régression** : tout ce qui marche en local doit continuer à marcher hors ligne ; la CI offline le garantit.

---

## 15. 2D / 3D

- **Source de vérité = modèle architectural** (§3). Les rendus 2D et 3D en sont des projections ; la 3D n'est jamais éditée directement.
- **2D** : canvas ; outils = commandes (§8.3) ; accrochages ; cotation automatique liée aux éléments.
- **3D** : extrusion murs/dalles/toiture depuis le modèle ; ouvertures = soustractions ; matériaux depuis `layers`.
- **Liaison au chiffrage** : toute commande 2D émet un delta → recalcul incrémental (§4.6) → affichage du delta de coût en direct (« passer la chambre de 12 à 16 m² : +X m² de mur, +Y blocs, +Z XOF »).
- **IFC (V3)** : table de correspondance `Wall → IfcWall`, `Opening → IfcOpeningElement`, `Space → IfcSpace`, `Level → IfcBuildingStorey`. Les schémas incluent déjà les attributs nécessaires (hauteurs, élévations, matériaux en couches).

---

## 16. Structure de dépôt proposée

```
btp-platform/
  packages/
    core-model/        # types + invariants du modèle architectural
    core-units/        # unités, décimal, devises
    core-measure/      # évaluateur d'expressions, règles, traces
    core-pricing/      # PriceBook, résolution, estimations, taxes
    core-docs/         # DocumentModel (DQE/DPGF/devis)
    core-ops/          # oplog, commandes, versions, diff
    ai-contracts/      # AiProposal, ports AI, schémas ModelArtifact
    ai-pipeline/       # étapes d'analyse (local) ; adaptateurs ONNX
    market-packs/      # bj/ (Bénin), test/ (pays factice) — DONNÉES
    render-pdf/ render-xlsx/
    storage-sqlite/ sync-protocol/
  apps/
    desktop/           # Tauri + UI
    (later) web/ api/ workers/
  fixtures/golden/     # projets étalons + métré de référence
  docs/adr/            # décisions d'architecture
```

Règle de dépendance : `core-*` ne dépend d'aucun adaptateur ; les `apps` assemblent.

### ADR à rédiger en premier

1. Local-first + oplog · 2. Tauri vs Electron · 3. Représentation des nombres et arrondis · 4. Format des règles de métré · 5. Séparation Quantités/Prix · 6. Schéma de provenance/confiance · 7. Contrat `AiProposal` · 8. Format `.btpx` · 9. Packs marché signés · 10. Politique de consentement cloud · 11. Licence offline · 12. Taxonomie du catalogue universel.

---

## 17. Feuille de route proposée

| Jalon | Contenu | Livrable vérifiable |
|---|---|---|
| **M0 — Fondations** (sans UI) | core-model/units/measure/pricing/docs ; projet étalon n°1 chiffré **en ligne de commande** ; DQE PDF/Excel générés | métré CLI = métré du professionnel (écart toléré) |
| **M1 — Chaîne manuelle assistée** | UI minimale : import plan, calibration, traçage assisté, validation, métré, prix Bénin v0, DQE, devis, versions, offline | un métreur chiffre un vrai projet sans IA et le juge utilisable |
| **M2 — IA locale v1** | PDF vectoriel d'abord, puis raster ; OCR/échelle ; propositions murs/pièces/ouvertures ; contrôles | gain de temps mesuré vs M1 sur le jeu étalon |
| **M3 — MVP béta** | corrections de retour, licences/essai, packaging, catalogue étendu, tests terrain à Cotonou | N projets réels chiffrés par des utilisateurs externes |
| **V1** | éditeur 2D, 3D, DPGF, scénarios, sync cloud, multi-pays, assistant | — |
| **V2 / V3** | selon §1.3 | — |

Cette séquence applique la chaîne PLAN → IA → VALIDATION → MÉTRÉ → PRIX → DQE → DEVIS **dans l'ordre inverse du risque** : le déterministe (valeur sûre) est livré d'abord, l'IA vient l'accélérer, avec un critère de mesure objectif.

---

## 18. Risques majeurs

| Risque | Gravité | Réponse |
|---|---|---|
| Qualité insuffisante de la reconnaissance sur plans réels | Élevée | Jeu étalon + KPI + traçage assisté de repli (§6.4) |
| Absence de données de prix fiables et à jour | Élevée | Collecte planifiée, confiance/âge affichés, gouvernance de catalogue (§9.3) |
| Règles de métré contestées par les professionnels | Moyenne | Règles ouvertes et modifiables, validées avec des métreurs béninois, trace visible |
| Performance IA sur PC modestes | Moyenne | Modèles quantifiés, traitement en arrière-plan, matériel minimal testé tôt |
| Périmètre trop large | Élevée | Respect strict de §1.2 ; tout le reste est « prévu, non développé » |
| Responsabilité professionnelle (structure) | Moyenne | Estimations étiquetées, avertissements imprimés, pas de dimensionnement auto |
| Conformité données personnelles | Moyenne | Local par défaut, consentement, revue juridique avant lancement |
| Piratage de licence | Faible/Moyenne | Mesures proportionnées, ne pas dégrader l'accès aux données |

---

## 19. Questions ouvertes (réponses nécessaires avant M0)

1. **Équipe et ressources** : qui développe (nombre, compétences TS/Rust/ML) ? Cela conditionne Tauri vs Electron et l'ambition du jalon M2.
2. **Accès à des plans réels béninois** (avec autorisation) et à **au moins un métreur partenaire** pour valider règles et projets étalons ?
3. **Sources de prix** : fournisseurs partenaires, quincailleries, entrepreneurs prêts à partager des devis/factures ?
4. **Plateformes cibles** : Windows seulement au MVP, ou mobile (Android) indispensable dès le début ? (Android change l'architecture IA locale et l'UI.)
5. **Types de bâtiments du MVP** : villas/maisons R+0/R+1 uniquement ? (recommandé) ou immeubles/bâtiments publics ?
6. **Langue** : français uniquement au MVP (recommandé) ?
7. **Modèle d'activation** : compte requis pour l'essai de 5 jours, ou activation hors ligne par clé ?
8. **Budget IA cloud** : acceptable pour le MVP, ou 100 % local ?

---

## 20. Prochaines étapes concrètes

1. Valider ce document (décisions D1–D12 et périmètre MVP §1.2).
2. Répondre aux questions §19.
3. Rédiger les 12 ADR (§16) — 1 à 2 pages chacun.
4. Concevoir les schémas détaillés (types TS + JSON Schema) du modèle, de la trace et de `AiProposal`.
5. Constituer le premier **projet étalon** (un plan réel + métré du professionnel) : il guidera tous les choix du M0.
6. Démarrer M0 (CLI, sans interface).
