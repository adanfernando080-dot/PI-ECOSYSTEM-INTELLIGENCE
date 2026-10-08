# Plateforme BTP mondiale adaptable aux marchés africains — Architecture de référence (v0.3 — post‑audit de cohérence)

> Statut : proposition à valider. Aucun code n'est écrit. Ce document fixe les fondations, les frontières
> (déterministe / IA locale / IA cloud) et le découpage MVP → V3.
> Les valeurs métier (taxes, coefficients, prix) citées en exemple sont **illustratives** et doivent être
> validées par des professionnels du marché concerné (d'abord le Bénin) avant d'entrer dans une base de production.
>
> **Révision v0.3** : audit de cohérence complet (voir `AUDIT-v0.2.md`, navigation dans `INDEX.md`). Corrige des ruptures d'étanchéité moteur/marché, ajoute les décisions D15–D17 et les ADR‑0005 à 0008.
>
> **Révision v0.2** : le moteur architectural est **universel** ; le contexte économique et réglementaire est
> **localisable par packs marché**. Voir §0.1, `adr/ADR-0001` à `ADR-0004` et `DATASET-STRATEGY.md`.

---

## 0. Synthèse en 17 décisions

| # | Décision | Pourquoi |
|---|---|---|
| D1 | **Noyau métier pur en TypeScript** (modèle, métré, prix, documents), sans I/O, exécutable partout (desktop, web, serveur, worker) | Un seul moteur de calcul, identique en local et dans le cloud : mêmes résultats, testables |
| D2 | **Application desktop Windows en premier** (Tauri + UI web), PWA/Android ensuite | Parc matériel des professionnels = laptops Windows ; accès fichier/GPU local ; offline réel |
| D3 | **SQLite local = source de vérité** ; le cloud est un réplica optionnel | Offline-first sans compromis ; le cloud ne casse jamais le local |
| D4 | **Toute écriture = opération dans un journal (oplog)** horodaté (HLC) | Historique, undo, versions, synchronisation et audit viennent du même mécanisme |
| D5 | **Quantités ≠ Prix** : le métré référence des *codes catalogue*, jamais un montant ; le métré se fait en **deux étages** (géométrique universel, puis commercial via le pack) | Exigence centrale ; permet scénarios, mises à jour de prix, multi-pays |
| D6 | **Métré = règles déclaratives versionnées + évaluateur sûr + arbre de trace** | Traçabilité de chaque chiffre, aucun calcul confié à une IA |
| D7 | **L'IA ne produit que des « propositions »** (avec confiance et preuve visuelle) ; seul l'humain les promeut en modèle validé | Transparence, responsabilité professionnelle |
| D8 | **Les « packs marché » sont des données signées, pas du code** : tout le contexte économique, réglementaire et de pratiques (arbre de zones, devise, taxes, normes, catalogue, prix, fournisseurs, main-d'œuvre, méthode de mesurage, unités commerciales, gabarits, paramètres) | Extension multi-pays sans recompiler ; un même projet se chiffre avec plusieurs packs |
| D9 | **Un LLM n'appelle que des outils** (moteurs déterministes) et n'écrit aucun nombre de sa propre initiative | L'assistant explique, il ne calcule pas |
| D10 | **Plans chiffrés localement par défaut ; envoi cloud = opt-in explicite par projet** | Confidentialité des plans |
| D11 | **Modèle géométrique unique** (2D/3D/IFC = vues et exports du même modèle) | Continuité conception → chiffrage |
| D12 | **Le premier jalon livre de la valeur sans IA** (plan calibré + traçage assisté → métré → DQE → devis) ; l'IA arrive comme accélérateur mesurable | Le plus gros risque du projet est la reconnaissance de plans réels (voir §6.4) |
| D13 | **Moteur architectural universel** : aucun schéma, règle, modèle IA ou donnée du moteur ne contient de pays, devise, taxe, prix, norme ; le contexte marché n'entre que par un `MarketBinding` au moment du chiffrage (ADR-0001, vérifié en CI) | Le Bénin est le premier marché, pas la limite du moteur |
| D14 | **Trois corpus** : A général, B africain, C validation locale (un par marché) ; tests scellés ; évaluation par tranches ; le pays est une métadonnée d'évaluation, jamais une entrée de modèle (ADR-0003, `DATASET-STRATEGY.md`) | Généralisation prouvée, sans enfermer le moteur dans un pays |
| D15 | **Aucune valeur par défaut implicite** : ce qui n'est pas lisible sur le plan est `unspecified` ; une hypothèse est un objet explicite (`AssumptionSet`), confirmé par l'utilisateur, éventuellement *proposé* par un profil du pack (ADR-0005) | L'étage 1 reste indépendant du pack ; le moteur ne devine pas |
| D16 | **Déterminisme numérique** : géométrie en virgule fixe entière, arithmétique décimale, pas de trigonométrie flottante dans l'étage 1 ; version du moteur enregistrée dans chaque trace (ADR-0006) | « Bit à bit » devient vérifiable entre plateformes |
| D17 | **Traçabilité de bout en bout** : plan@version → objet → règle → paramètres → calcul → résultat → ouvrage → prix → `MarketBinding` → document, par identifiants et hachages ; manifeste de provenance vérifiable hors ligne (ADR-0007) | Aucun chiffre sans origine |

### 0.1 Principe directeur : deux dimensions étanches

```
 PLAN (PDF/image) ─► ┌───────────── MOTEUR ARCHITECTURAL (universel) ─────────────┐
                     │ Compréhension IA ─► Modèle architectural NEUTRE            │
                     │      ─► Métré GÉOMÉTRIQUE (surfaces, longueurs, volumes)   │
                     └──────────────────────────┬───────────────────────────────┘
                                                │  spécification neutre (classes génériques)
                          MarketBinding = pack@version + zone
                     ┌──────────────────────────▼───────────────────────────────┐
                     │ CONTEXTE MARCHÉ (pack) : correspondances, compositions,   │
                     │ catalogue, prix, fournisseurs, main-d'œuvre, taxes,       │
                     │ normes, méthode de mesurage, unités, documents            │
                     └──────────────────────────┬───────────────────────────────┘
                                                ▼
                          Métré commercial ─► Prix ─► DQE / DPGF / Devis

  Même projet architectural  ─►  Pack Bénin  |  Pack Sénégal  |  Pack Côte d'Ivoire  |  Pack Ghana …
```

| Universel (moteur) | Localisable (pack marché) |
|---|---|
| murs, pièces, ouvertures, escaliers, niveaux, cotes, textes, symboles, relations spatiales | pays, régions, villes, devise, taxes |
| conventions de dessin **détectées** (unités, langues, hachures, échelle) | normes et réglementations applicables |
| modèle neutre + spécification de construction **générique** | catalogue, matériaux disponibles, équivalences |
| métré géométrique (brut / ouvertures / net, périmètres, volumes, comptages) | compositions d'ouvrages, consommations, pertes, pratiques de construction |
| 2D/3D, versions, traçabilité, assistant (outils) | prix, fournisseurs, main-d'œuvre, unités commerciales |
| évaluateur de règles, moteur de prix (mécanique) | méthode de mesurage, paramètres de calcul, gabarits de documents |

**Zones grises tranchées** (détail en ADR-0001) : les *conventions de représentation* d'un plan sont une propriété du plan (moteur) ; les *pratiques d'exécution* appartiennent au pack. Les *valeurs par défaut* (hauteur sous plafond, épaisseur…) ne sont **jamais implicites** : un profil du pack peut les **proposer**, l'utilisateur les **confirme** comme hypothèses explicites matérialisées dans le projet (ADR-0005) ; le moteur ne devine pas. Les décisions D15–D17 et les ADR‑0005 à 0008 précisent cette frontière.

---

## 1. Périmètre : maintenant / MVP / plus tard

### 1.1 À poser MAINTENANT (fondations, avant toute interface)

Ce sont les éléments coûteux ou impossibles à corriger après coup :

1. Modèle de données (schémas, identifiants, provenance, unités ; les devises appartiennent aux packs) — §3
2. Oplog + versions de projet + format de fichier projet — §2, §8
3. Séparation Quantités / Prix + schéma du catalogue et des packs marché — §4, §5, §9
4. Format de règles de métré + moteur d'évaluation + format de trace — §4
5. Cadre de test : projets synthétiques à vérité analytique + corpus C‑BJ (projets réels avec métré de référence d'un professionnel) — §13
6. Schéma des « propositions IA » (confiance, preuve, statut) — §6.2
7. Modèle de sécurité (chiffrement local, licence offline, consentement cloud) — §11
8. Contrats d'interface (ports) pour stockage, IA, sync, rendu de documents — §2.3
9. **Frontière moteur / pack** : spécification neutre, `MarketBinding`, règles d'étanchéité vérifiées en CI — §0.1, ADR-0001/0002
10. **Stratégie de corpus A/B/C**, taxonomie d'annotation, registre de provenance, protocole de scellement — `DATASET-STRATEGY.md`
11. **Hypothèses explicites** (`AssumptionSet`) et machine d'états de validation — §3.3, §3.7, ADR-0005
12. **Représentation numérique déterministe** (virgule fixe, décimal) — §3.1, ADR-0006
13. **Chaîne de traçabilité** et manifeste de provenance — §4.5, §10.4, ADR-0007
14. **Généricité des packs** : arbre de zones, structure de coût, types de documents, identifiants légaux — §9, ADR-0008

### 1.2 MVP — chaîne PLAN → MÉTRÉ → PRIX (pack Bénin) → DQE → DEVIS (offline)

| Domaine | Inclus au MVP |
|---|---|
| Projet | création, historique de versions, restauration, export/import de fichier projet |
| Import | PDF (vectoriel et raster), JPG, PNG ; calibration d'échelle (manuelle + détection assistée) |
| Modèle | niveaux, murs, pièces, ouvertures (portes/fenêtres), dalles/toiture en **surface et pente simples** |
| Édition | correction manuelle du modèle sur le plan (outils de traçage/ajustement 2D minimaux) |
| IA locale | modèles **universels** (non spécifiques à un pays) : OCR (langues **déclarées** dans le domaine de validité : FR et EN au MVP, les autres seulement après mesure) + détection de cotes/échelle/titres, **propositions** de murs/pièces/ouvertures, contrôle de cohérence ; domaine de validité déclaré (§6.0) |
| Métré | lots gros-œuvre, maçonnerie, enduits, revêtements, peinture, menuiseries, couverture (liste exacte §12) |
| Prix | **pack Bénin v0** (premier pack marché), catalogue local, XOF, prix par ville/région avec date, source, confiance ; saisie/override utilisateur |
| Documents | DQE (PDF + Excel), devis (PDF) — types de documents **définis par le pack Bénin v0** —, fiche de traçabilité du métré, manifeste de provenance |
| Offline | 100 % des étapes ci-dessus ; mise à jour de catalogue par fichier ou réseau quand disponible |
| Sécurité | chiffrement local, licence + essai 5 jours vérifiables hors ligne |

**Explicitement hors MVP** : éditeur 2D complet, 3D, DPGF avancé (sous-détails), scénarios, fournisseurs,
multi-pays actif, assistant conversationnel, structure/ferraillage, sync cloud multi-appareils.

### 1.3 À PRÉVOIR architecturalement, à développer plus tard

| Fonction | Ce qu'on prépare dès maintenant | Livraison |
|---|---|---|
| Éditeur 2D complet | modèle géométrique + commandes d'édition (undo/redo) | V1 |
| 3D | extrusion depuis le modèle, champs d'élévation/épaisseur/couches déjà dans le schéma | V1 |
| DPGF + sous-détails | assemblages hiérarchiques (sous‑ouvrages) déjà dans le schéma de pack (§4.3) | V1 |
| Scénarios | `Estimate` = (`ArchitecturalModel@rev`, `MarketBinding`, `QuantitySet`, `PriceBook`, paramètres) → N estimations par projet | V1 |
| Multi-pays / devises | packs marché signés, héritage de packs, taux de change versionnés, `ComplianceRuleSet`, pack n°2 comme preuve d'étanchéité | V1 |
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
| `PackStore` | paquets signés locaux (dossier + copies embarquées dans `.btpx`) | service cloud de distribution |
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
| PDF | pdfium/pdf.js (lecture) ; génération via pdf-lib/pdfmake | Typst | Polices embarquées multilingues (accents, symboles monétaires selon le pack) |
| Excel | exceljs | — | formules Excel réelles optionnelles |
| Cloud (V1) | Postgres, stockage objet, workers de jobs | — | Aucun besoin avant V1 |

**Matériel minimal cible à valider avec des utilisateurs réels** : 8 Go RAM, CPU 4 cœurs sans GPU, Windows 10/11. Tout le pipeline IA du MVP doit tourner sur CPU en un temps acceptable (objectif : < 60 s par page A3 courante) ; sinon traitement en tâche de fond avec progression.

---

## 3. Modèle de données architectural

### 3.1 Principes transversaux

- **Identifiants** : UUIDv7 (triables, générables hors ligne sans collision).
- **Unités** : géométrie en **mètres (m)** en interne, toujours. Les unités d'affichage sont une préférence. Aucun nombre sans unité dans les schémas (`{ value, unit }` ou colonne nommée avec unité).
- **Nombres** : quantités en décimal exact (pas de `float` pour les sommes). Argent en **entier de la plus petite unité de la devise** ; les définitions de devises (code, unités mineures, arrondi) viennent du pack, jamais du code du moteur.
- **Géométrie en virgule fixe** : coordonnées en entiers (unité de base 0,1 mm, à confirmer par prototype), longueurs/aires/volumes en décimal à précision arbitraire ; **aucune trigonométrie flottante** dans l'étage 1 (pentes exprimées en rapport montée/portée, racines par `sqrt` décimal) → résultats identiques sur toutes les plateformes (ADR-0006).
- **Provenance de chaque attribut significatif** (voir 3.3).
- **Immuabilité par version** : on ne modifie pas une version publiée ; on en crée une nouvelle (§8).
- **Données tenant** : tout objet porte `projectId`, `createdAt`, `createdBy`, `schemaVersion`.
- **Pureté du modèle architectural** : il ne contient **aucun** pays, devise, taxe, prix, fournisseur, norme ni code de catalogue local. Schémas fermés (`additionalProperties: false`), test de schéma et lint de pureté en CI (ADR-0001, règles R1–R3).
- **Pas de valeur par défaut implicite** : un attribut non lisible est `unspecified` (bloquant pour les calculs qui en dépendent) ou référence une hypothèse explicite (§3.7, ADR-0005).

### 3.2 Hiérarchie

```
Workspace (organisation)
 └─ Project
     ├─ Location (adresse libre / coordonnées — descriptive ; JAMAIS transmise aux modèles de perception)
     ├─ SourceDocument[] (PDF/JPG/PNG, hash, pages ; `supersedes` si nouvelle version du plan)   → blobs immuables
     │    └─ PlanSheet[] (page, échelle, calibration, niveau associé, DrawingConventions)
     ├─ ArchitecturalModel (versionnée, rev = hash de contenu) — NEUTRE, UNIVERSEL
     │    └─ Building[]
     │         └─ Level[]  (élévation, hauteur sous plafond)
     │              ├─ Wall[]       (axe, épaisseur, hauteur, constructionSpec neutre, rôle: porteur/cloison…)
     │              ├─ Opening[]    (type, dimensions, allège, linteau, hôte: wallId)
     │              ├─ Space[]      (pièce : contour, usage normalisé, libellé d'origine, finitions en classes neutres)
     │              ├─ Stair[] / Slab[] / Roof[] (contour, épaisseur, pente en montée/portée, type)
     │              └─ Annotation[] (cotes, textes liés à des éléments)
     ├─ AssumptionSet (versionné ; hypothèses CONFIRMÉES par l'utilisateur ; hors modèle, hors pack)   ← ADR-0005
     ├─ GeometricTakeoff (dérivé du modèle@rev + AssumptionSet@rev ; UNIVERSEL ; étage 1)
     │    └─ GeoQuantity[]  (id stable, brut / ouvertures / net, périmètres, volumes, comptages + trace)
     ├─ AiProposal[]        (voir §6.2 ; vivent HORS du modèle tant qu'elles ne sont pas acceptées)
     ├─ MarketBinding[]     ← SEUL point où le projet connaît un marché : pack résolu (hash) + zone + params ; IMMUABLE (toute modification = nouvelle révision)
     ├─ QuantitySet[]       (un par MarketBinding@rev : GeometricTakeoff × SpecMapping × Assembly × MeasurementMethod)
     │    └─ QuantityLine[]   (code catalogue du pack, quantité, unité, trace)
     ├─ ManualLine[] / QuantityAdjustment[]  (lignes ou corrections manuelles ; justification obligatoire ; jamais anonymes)
     ├─ Estimate[]          (scénarios : ArchitecturalModel@rev + MarketBinding@rev + QuantitySet vX + PriceBook vY + paramètres)
     │    └─ EstimateLine[]   (quantité × prix résolu, lot, coût par couche de CostBuildUp, montant)
     └─ Document[]          (DQE/devis/… générés : instantanés, hash, ProvenanceManifest — §10.4)
```

**Même projet, plusieurs marchés** : le modèle architectural, l'`AssumptionSet` et le `GeometricTakeoff` sont communs ; chaque `MarketBinding` produit son propre `QuantitySet` et ses `Estimate`.

Tables transverses :
- **Moteur** : `Unit`, `ModelArtifact` (modèles IA), taxonomie neutre de spécification (versionnée), `DrawingConventions`.
- **Dans les packs marché** (pas dans le moteur) : `MarketPack`, `Zone` (arbre typé), `Currency`/règles d'arrondi, `Catalogue*`, `SpecMapping`, `DefaultSpecProfile`, `Assembly`, `MeasurementMethod`, `CostBuildUp`, `PriceBook*`, `TaxRuleSet`, `ComplianceRuleSet`, `Supplier`, `LabourRate`, `DocumentTemplate`, `LegalIdentifier`, `NumberingRule`, `WorkBreakdown` (lots).
- **Service de données de prix** (hors paquets signés) : `PriceObservation` (append‑only).

### 3.3 Provenance, confiance, preuve, états de validation

Chaque élément du modèle (mur, ouverture…) et chaque attribut critique (échelle, longueur, épaisseur) porte :

```jsonc
{
  "value": 8.40,
  "unit": "m",
  "origin": "ai_detected | user_entered | user_corrected | derived | assumption",
  "assumptionId": null,               // renseigné si origin = assumption (→ AssumptionSet du projet, §3.7)
  "confidence": 0.72,                 // CALIBRÉE (§6.2) ; null si origin = user_* | assumption
  "evidence": {                       // pour retrouver « pourquoi »
    "sheetId": "…", "sourceHash": "sha256:…", "page": 1,
    "bbox": [x, y, w, h],             // zone du plan
    "detectorId": "walls-seg@1.3.0", "modelHash": "sha256:…"
  },
  "validation": "accepted | edited | batch_accepted | rejected",
  "history": ["op-id-1", "op-id-2"]   // renvoie à l'oplog : qui a changé quoi
}
```

**Machine d'états (cohérente avec §6.2)** :
1. Une détection IA est d'abord une `AiProposal` (`pending`) **hors du modèle**. Un élément n'entre dans le modèle que par acceptation individuelle (`accepted`), modification (`edited`, origine `user_corrected`), acceptation **en lot** (`batch_accepted`) ou saisie utilisateur (`user_entered`).
2. Un élément `batch_accepted` alimente les calculs mais n'a pas été revu individuellement : il est signalé à l'écran et listé dans l'annexe des documents ; il devient `accepted` dès qu'il est revu.
3. Un attribut absent est `unspecified` : tout calcul qui en dépend est `blocked` avec un message explicite, jusqu'à saisie ou hypothèse confirmée (§3.7). **Jamais de remplacement silencieux.**
4. **Propagation de confiance** : le `confidenceFloor` d'une grandeur dérivée est le minimum des confiances de ses entrées d'origine `ai_detected` non revues (`batch_accepted`) ; les entrées revues, saisies ou issues d'hypothèses confirmées n'abaissent pas le plancher. Les quantités concernées portent le drapeau `input_low_confidence` sous un seuil réglable par l'utilisateur.
5. Règle de document : un élément `batch_accepted` ou à plancher bas ne bloque pas l'émission mais est **toujours listé** (annexe + manifeste).

### 3.4 Géométrie

- Repère local du niveau, axe X/Y en mètres, origine définie à la calibration du plan.
- **Mur** = polyligne d'axe + épaisseur + hauteur + `constructionSpec` (système générique + couches en classes neutres) → permet métré par couche *et* rendu 3D, sans référence à un produit local.
- **Ouverture** = rattachée à un mur hôte (`hostWallId`, `offsetAlongWall`) → la soustraction de surface est une relation, pas un calcul fragile par chevauchement géométrique.
- **Pièce** = cycle fermé de murs (graphe topologique), pas seulement un polygone dessiné → une modification de mur propage à la surface de la pièce.
- Topologie stockée : `wall.startNode / endNode` avec nœuds partagés → déplacer un mur déplace les murs connectés (comportement attendu en 2D éditable).
- Champs de hauteur/élévation/pente présents dès le MVP (valeurs **à renseigner ou à confirmer comme hypothèses**, jamais implicites) pour que la 3D n'impose pas de migration.
- **Numérique** : coordonnées entières en virgule fixe ; longueur = racine décimale de la somme des carrés ; surface développée d'une pente = surface en plan × √(portée² + montée²) / portée (ADR-0006).

### 3.5 Exemple minimal (JSON de sérialisation)

```jsonc
{
  "wall": {
    "id": "0192…", "levelId": "…", "code": "M-023",
    "axis": [[0,0],[84000,0]],                       // entiers, unité de base 0,1 mm (ici 8,40 m)
    "thickness": { "value": 0.20, "unit": "m", "origin": "ai_detected", "confidence": 0.88, "validation": "accepted" },
    "height":    { "value": 3.00, "unit": "m", "origin": "assumption", "assumptionId": "A-01" },
    "role": "load_bearing",
    "constructionSpec": {
      "system": "masonry.block.hollow",            // classe NEUTRE (taxonomie versionnée)
      "layers": [
        {"class": "render.cementitious", "thickness": 0.015, "side": "exterior"},
        {"class": "masonry.block.hollow", "thickness": 0.20},
        {"class": "render.cementitious", "thickness": 0.015, "side": "interior"}
      ],
      "origin": "assumption", "assumptionId": "A-02"
    }
  }
}
```

Le pack traduit `masonry.block.hollow` / 0,20 m en ouvrage(s) de son catalogue via `SpecMapping` (ADR-0002). Aucun code local, aucune référence à un pack n'apparaît ici : la hauteur et la spécification proviennent d'**hypothèses explicites** du projet (§3.7).

### 3.6 Conventions de dessin (propriété du plan, pas du pays)

Chaque `PlanSheet` porte les conventions **détectées** (ou saisies), jamais supposées :

```jsonc
"drawingConventions": {
  "unitSystem": { "value": "metric_cm", "confidence": 0.93 },   // metric_m | metric_cm | metric_mm | imperial_ft_in
  "languages":  [ {"code": "fr", "confidence": 0.97} ],
  "scale":      { "text": "1/100", "confidence": 0.9 },
  "symbolSet":  { "doors": "arc_swing", "windows": "triple_line" },
  "paper": "A3", "sourceType": "pdf_vector"
}
```

Elles pilotent le parseur de cotes et l'OCR (multilingue : texte arabe, anglais, portugais, chinois…), et servent de clés de tranches pour l'évaluation IA (§6.4).

### 3.7 Hypothèses explicites (`AssumptionSet`)

```jsonc
"assumptionSet": { "id": "…", "rev": 3, "items": [
  { "id": "A-01", "key": "level.clearHeight", "value": {"value": 3.00, "unit": "m"},
    "scope": "project", "status": "confirmed", "confirmedBy": "user:…", "confirmedAt": "…",
    "rationale": "saisie sur la coupe A-A",                       // ou : « proposée par profil, confirmée »
    "seededFrom": { "kind": "market_profile", "ref": "<chaîne opaque>" } }   // provenance informative, optionnelle
]}
```

- Vit **au niveau projet**, hors `ArchitecturalModel` et hors pack ; le lint de pureté n'y inspecte pas `seededFrom.ref` (chaîne opaque).
- Un profil du pack (`DefaultSpecProfile`) peut **proposer** des hypothèses à la création d'un `MarketBinding` ; rien n'est appliqué tant que l'utilisateur ne confirme pas.
- **Changer de pack ne modifie jamais une hypothèse confirmée** ; l'interface affiche seulement les écarts (« le profil du nouveau pack propose 2,80 m, hypothèse actuelle 3,00 m »).
- Sans pack du tout, le moteur fonctionne : les éléments non renseignés restent `unspecified` (T-PUR-04/05).

---

## 4. Moteur de métré (déterministe)

### 4.1 Principe : deux étages

```
ÉTAGE 1 — MÉTRÉ GÉOMÉTRIQUE (universel, aucun pack)
  Modèle validé ──► Règles géométriques ──► GeometricTakeoff
     (aires brute / ouvertures / nette, périmètres, volumes, comptages) + Trace

ÉTAGE 2 — MÉTRÉ COMMERCIAL (fourni par le MarketBinding)
  GeometricTakeoff ─┐
  SpecMapping       ├─► Évaluateur ──► QuantityLine[] + Trace
  Assembly (compositions, pertes)  │
  MeasurementMethod ─┘
```

Aucune IA ici. Même entrée → même sortie, bit à bit (ADR-0006 : virgule fixe, décimal, version du moteur enregistrée). L'étage 2 **consomme des `GeoQuantity` par identifiant** ; il ne recalcule jamais une géométrie. L'étage 1 est testable sur des **projets synthétiques à vérité analytique** et ne change jamais avec le pack ; l'étage 2 est validé sur le corpus C du marché.

### 4.2 Deux niveaux de règles

1. **Règles géométriques (moteur, étage 1)** : surface brute, surface des ouvertures, surface nette, périmètres, volumes de dalle…
   Exemple : `wall.netArea = wall.length * wall.height - Σ opening.area`. Le moteur fournit **les trois grandeurs** (brute, ouvertures, nette).
2. **Méthode de mesurage et compositions d'ouvrages (pack, étage 2)** : une `Assembly` demande une grandeur de base (`measureBasis: "wall.area"`) ; la `MeasurementMethod` du pack décide **quelle** `GeoQuantity` l'alimente (brute ou nette, seuils de déduction des ouvertures — qui diffèrent selon les méthodes normalisées) ; les `Assembly` transforment une grandeur en composants avec **consommation par unité** et **taux de perte**.

Les règles de l'étage 2 sont des **données** (JSON/YAML) livrées par le pack : les pratiques constructives (épaisseur d'agglos courants, dosage, pertes) varient selon le marché et s'ajustent sans toucher au code.

### 4.3 Format d'une composition (exemple illustratif, contenu d'un pack)

```jsonc
{
  "code": "OUV.MAC.AGGLO20", "unit": "m2", "version": "1.0.0",
  "measureBasis": "wall.area",                   // grandeur demandée ; la MeasurementMethod choisit brute/nette
  "components": [
    { "kind": "material", "item": "MAT.AGGLO.20x20x40", "consumption": "12.5", "per": "m2", "lossRate": "0.05" },   // blocs / m² (exemple)
    { "kind": "material", "item": "MAT.CIMENT.CPJ35",   "consumption": "…",  "per": "m2", "lossRate": "0.03" },
    { "kind": "labour",   "item": "MO.MACON",           "consumption": "…",  "per": "m2" },
    { "kind": "assembly", "ref": "OUV.MAC.JOINT@1.0.0", "per": "m2" }        // sous‑ouvrage (DPGF : sous‑détails)
  ],
  "roundingOrder": { "MAT.AGGLO.20x20x40": "ceil_unit" }
}
```

Les composants de type `material | labour | equipment | transport | subcontract` reçoivent leur prix **plus tard** (§5) ; un composant `assembly` référence un sous‑ouvrage (récursion bornée, cycles interdits à la validation du pack).
Le métré ne produit que `(item, quantité, unité, trace)`.

### 4.4 Évaluateur d'expressions

- Langage d'expression **restreint et sûr** (arithmétique décimale, fonctions `sum`, `min`, `max`, `ceil`, `round`, accès aux propriétés) — **pas d'`eval`**, pas d'accès I/O.
- Arithmétique **décimale** ; arrondi **uniquement** aux points déclarés (`roundingOrder`, présentation).
- Unités vérifiées : `m² × blocs/m²` → `blocs` ; une incohérence dimensionnelle est une **erreur**, pas un avertissement.
- Chaque évaluation enregistre `engine.version` + `engine.hash` et le hash de la règle (`ruleHash`) : le même hash de règle + les mêmes entrées doivent redonner la même sortie (T-ENG-03).

### 4.5 Trace (l'« explication » de chaque chiffre) — deux niveaux liés

Chaque valeur porte un arbre de trace **généré par l'évaluateur** (pas rédigé a posteriori). Les références sont des **identifiants stables et des hachages**, jamais des codes lisibles seuls.

**Étage 1 — `GeoQuantity` (universel)**
```jsonc
{
  "id": "geo:0192…:wall.area.net",
  "entity": { "id": "0192…", "code": "M-023", "modelRev": "sha256:…", "assumptionSetRev": 3 },
  "quantity": { "value": "21.60", "unit": "m2" },
  "trace": {
    "rule": "geom.wall.area.net@1.0.0", "ruleHash": "sha256:…",
    "steps": [
      { "expr": "wall.length * wall.height", "inputs": {"length": "8.40 m", "height": "3.00 m (assumption A-01)"}, "result": "25.20 m²" },
      { "expr": "Σ opening.area",             "inputs": {"O-007": "1.20", "O-008": "2.40"},                       "result": "3.60 m²" },
      { "expr": "gross - openings",           "result": "21.60 m²" }
    ],
    "inputsProvenance": [{"wall:M-023.length": "user_corrected"}, {"opening:O-008": "ai_detected, conf 0.72, batch_accepted"}]
  },
  "engine": { "version": "1.0.0", "hash": "sha256:…" }
}
```

**Étage 2 — `QuantityLine` (fourni par le `MarketBinding`)**
```jsonc
{
  "item": "MAT.AGGLO.20x20x40",
  "quantity": { "value": "284", "unit": "u" },
  "trace": {
    "binding": "mb:…@rev2", "packResolvedHash": "sha256:…",
    "spec":     { "entity": "wall:0192…", "class": "masonry.block.hollow", "thickness": "0.20 m" },
    "mapping":  { "id": "SM.MAC.BLOC20@1.0.0", "condition": "thickness ∈ [0.19, 0.21]" },
    "method":   { "id": "MM.GO@1.0.0", "basis": "wall.area → net", "deduction": "…" },
    "assembly": { "code": "OUV.MAC.AGGLO20", "version": "1.0.0", "hash": "sha256:…", "params": {"consumption": "12.5", "lossRate": "0.05"} },
    "inputs":   [ { "geo": "geo:0192…:wall.area.net", "value": "21.60 m²" } ],
    "steps": [
      { "expr": "net × 12.5 blocs/m²",    "result": "270.0 u (théorique)" },
      { "expr": "théorique × (1 + 0.05)", "result": "283.5 u" },
      { "expr": "ceil",                   "result": "284 u (commandable)" }
    ],
    "confidenceFloor": { "value": 0.72, "limitedBy": "opening:O-008" }
  },
  "engine": { "version": "1.0.0", "hash": "sha256:…" },
  "flags": ["input_low_confidence"]
}
```

L'UI affiche cette trace telle quelle (« Pourquoi cette quantité ? »). L'assistant IA ne fait que la **reformuler**. La chaîne complète jusqu'au document est décrite en §10.4 et ADR-0007.

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
PriceBook (version, zone du pack, devise)
        │
EstimateLine = qté × prix résolu (+ coefficients) → montant
```

Un `Estimate` référence : `ArchitecturalModel@rev` + `MarketBinding` (pack@version) + `QuantitySet@vN` + `PriceBook@vM` + `EstimateParameters@vK` (marges, frais, imprévus, taxes — valeurs par défaut fournies par le pack). Changer le prix ne touche pas au métré, et inversement. Plusieurs `Estimate` coexistent (Éco/Standard/Premium).

### 5.2 Modèle de prix

```
PriceObservation (append-only)
  item, unit, currency, amount
  scope: zoneId (arbre de zones du pack), supplierId?
  observedAt, source{type: supplier_quote|market_survey|invoice|user|import, ref}
  quantityBreak?  (prix par palier)
PriceStat (calculé, par item × zone × période)
  min, médiane, moyenne, max, n, lastObservedAt, confidence
PriceBook (publié, signé, versionné)
  = sélection figée de PriceStat + règles de résolution
```

- **Les observations ne sont jamais écrasées** (traçabilité et audit). Elles vivent dans le **service de données de prix** (local + cloud), hors paquets signés ; seuls les `PriceBook` publiés sont signés et embarqués (pack, `.btpx`).
- **Médiane** recommandée par défaut plutôt que moyenne (robustesse aux valeurs aberrantes) ; la moyenne reste disponible comme demandé.
- **Confiance** = f(nombre d'observations, ancienneté, dispersion, fiabilité de la source). Formule publiée et testée.

### 5.3 Résolution d'un prix (cascade déterministe)

1. Override utilisateur du projet (explicitement marqué, justifié).
2. Prix fournisseur choisi (si fournisseur sélectionné).
3. Zone de la liaison → zones parentes dans l'**arbre de zones défini par le pack** (les niveaux et leurs noms varient d'un marché à l'autre) ; sortir du périmètre du pack est interdit sans signalement explicite.
4. Si aucun prix : la ligne est `unpriced` — **jamais 0**, jamais inventé. Le devis refuse de se finaliser sans décision de l'utilisateur.

Chaque `EstimateLine` enregistre le niveau de cascade utilisé, l'identifiant de l'entrée de prix (`priceEntryId`) et le hash du `PriceBook`, la date, l'âge, la confiance → alertes « prix périmé » (seuil `staleAfterDays` **fourni par le pack, paramètre obligatoire** : la validation du pack échoue s'il manque) et « prix issu d'une zone parente et non de la zone demandée ».

### 5.4 Structure de coût déclarée par le pack (`CostBuildUp`)

La manière de passer des coûts directs au prix de vente (couches, assiettes, ordre) est une **pratique de marché** : le moteur évalue une structure déclarée, il n'en impose aucune. Exemple illustratif :

```jsonc
"costBuildUp": [
  { "id": "direct",      "kind": "sum",     "of": ["material", "labour", "equipment", "transport", "subcontract"] },
  { "id": "overheads",   "kind": "percent", "base": ["direct"],                         "rate": {"param": "overheadRate"} },
  { "id": "contingency", "kind": "percent", "base": ["direct", "overheads"],            "rate": {"param": "contingencyRate"} },
  { "id": "margin",      "kind": "percent", "base": ["direct", "overheads", "contingency"], "rate": {"param": "marginRate"} },
  { "id": "tax",         "kind": "taxRuleSet", "base": ["margin"] }
]
```

D'autres marchés peuvent exiger d'autres couches (sommes provisionnelles, prime cost, travaux en régie, taxes composées…) : ce sont des données, pas du code. Les taux sont des **paramètres de l'Estimate** (valeurs par défaut proposées par le pack, à valider localement). Les règles d'arrondi (par ligne, par lot, au total) sont déclarées dans le pack. `EstimateLine` stocke le montant **par couche**, pour l'explication et la comparaison.

### 5.5 Devises

- Chaque `PriceBook` a **une** devise. Un `Estimate` a **une** devise de présentation.
- Conversion = `ExchangeRate` versionné (date, source). Une devise arrimée à une autre par une parité fixe est un cas particulier déclaré par le pack (ex. zone monétaire commune) ; le moteur ne connaît aucune devise.
- Un document n'est jamais recalculé silencieusement avec un autre taux : le taux utilisé est écrit dans le document.

---

## 6. Architecture IA

### 6.0 Principe : un moteur de perception universel

- Les modèles apprennent à comprendre des **plans** (murs, pièces, portes, fenêtres, escaliers, cotes, niveaux, textes, symboles, relations spatiales, éventuellement systèmes constructifs), **pas** une architecture nationale.
- **Entrées** : pixels / vecteurs / texte de la page, et rien d'autre. **Aucun paramètre pays ou marché** n'est donné aux **modèles de perception** (ADR-0001 R4) : ni `Location`, ni `MarketBinding`, ni métadonnées de projet. (L'assistant conversationnel, §6.6, n'est pas un modèle de perception : il opère dans un `MarketBinding` actif.) Les **conventions de dessin** (unités, langues, symboles) sont *détectées* (§3.6).
- **Sorties** : éléments de la **taxonomie neutre** (`DATASET-STRATEGY.md` §3) ; jamais de produit ni de code de catalogue.
- **OCR et parseur de cotes multilingues** et multi-systèmes d'unités (mètres, centimètres, millimètres, pieds‑pouces).
- **Un modèle par tâche, pour tous les marchés.** Des adaptateurs régionaux ne sont envisagés que si les métriques par tranche le justifient (ADR-0003).
- **Domaine de validité déclaré** par modèle ; un plan hors domaine est signalé, sa confiance est plafonnée et l'outil bascule vers le traçage assisté (`DATASET-STRATEGY.md` §6).
- **Prévention du raccourci « pays »** : la langue, l'écriture, le cartouche et le style graphique d'un plan sont des indices implicites du pays. Mesures : (1) têtes de modèle *géométrie* et *texte* séparées ; (2) masquage/permutation aléatoire des cartouches et textes pendant l'entraînement des têtes géométriques ; (3) tests *leave‑one‑region‑out* et ablation du cartouche/texte (T‑AI‑03) ; (4) épaisseurs, hauteurs et dimensions toujours **mesurées**, jamais déduites d'un a priori régional (une valeur absente reste `unspecified`) ; (5) rapports par tranche publiés.
- **Détection hors domaine** : combinaison de signaux (conventions de dessin détectées hors domaine, incertitude du modèle, distance dans l'espace de représentations), calibrée sur le jeu de validation ; faux négatifs mesurés sur des plans volontairement hors domaine (T‑AI‑05). Méthode exacte à choisir en M2.
- **Corpus d'entraînement et d'évaluation** : A général, B africain, C validation locale — §6.4.

### 6.1 Pipeline d'analyse de plan

```
Import ─► Normalisation ─► Classification de page ─► Échelle ─► OCR/texte ─► Détection ─► Reconstruction ─► Contrôles ─► PROPOSITIONS ─► Validation humaine ─► Modèle
```

| Étape | Méthode | Où | Nature |
|---|---|---|---|
| Normalisation | PDF : **extraction vectorielle si disponible** (lignes, polylignes, texte exacts) ; sinon rastérisation 200–300 dpi, redressement, binarisation | local | déterministe |
| Classification de page | plan / coupe / façade / cartouche / détail | local | IA légère |
| Conventions de dessin | détection du système d'unités, des langues, du style de symboles, du papier (§3.6) | local | IA + règles |
| Échelle | 1) texte d'échelle (« 1/100 », « 1:50 », échelles impériales), 2) cotes reconnues vs longueurs mesurées, 3) barre d'échelle ; sinon **demande à l'utilisateur** | local | OCR + calcul déterministe |
| OCR / cotes | OCR (PaddleOCR/Tesseract exportés ONNX ; licences de poids à vérifier) + parseur de cotes ; langues = celles du domaine de validité | local | IA + règles |
| Détection | segmentation des murs, détection portes/fenêtres, étiquettes de pièces | local (MVP) ; cloud pour plans difficiles | IA |
| Reconstruction | vectorisation des murs, fermeture des pièces, graphe topologique, rattachement ouvertures→murs | local | **géométrie déterministe** sur sortie IA |
| Contrôles | cohérence : surface annotée vs calculée, pièces non fermées, cotes contradictoires, échelle incohérente | local | déterministe |
| Propositions | émission d'`AiProposal` | local | — |

Le **PDF vectoriel** est le cas le plus favorable (géométrie exacte, texte extractible) : à traiter en premier et à mesurer séparément du raster (photo/scan), nettement plus difficile.

### 6.2 Chaîne de confiance et `AiProposal`

```
Détection ─► Preuve (bbox, détecteur, version) ─► Score CALIBRÉ ─► Contrôles de cohérence ─► Proposition (pending)
   ─► Décision humaine (accepter / modifier / rejeter / accepter en lot) ─► Élément du modèle (origin + validation)
   ─► Propagation du plancher de confiance aux GeoQuantity puis aux QuantityLine
```

```jsonc
{
  "id": "…", "kind": "<classe de la taxonomie neutre : wall | opening | space | stair | column | dimension | scale | level | construction_spec | convention …>",
  "taxonomyVersion": "1.0.0",
  "proposedValue": { /* géométrie ou valeur */ },
  "confidence": { "value": 0.72, "calibrated": true, "calibrationRef": "cal:walls-seg@1.3.0/slice:vector-L2" },
  "inDomain": true,                 // sinon : confiance plafonnée + avertissement (§6.0)
  "evidence": { "sheetId": "…", "sourceHash": "sha256:…", "bbox": [..], "detectorId": "openings@0.4.1", "modelHash": "sha256:…" },
  "alternatives": [ { "value": {...}, "confidence": 0.18 } ],
  "checks": [ { "id": "area-mismatch", "severity": "warn", "message": "Surface annotée 14,2 m² ≠ 12,9 m² mesurée" } ],
  "status": "pending | accepted | edited | rejected | batch_accepted"
}
```

- Une proposition ne modifie **jamais** le modèle tant qu'elle n'est pas `accepted`/`edited`/`batch_accepted` (T‑AI‑07).
- **Calibration** : un score n'est affiché comme « confiance » que s'il est calibré par tranche (mesure d'erreur de calibration publiée par `ModelArtifact`, T‑AI‑04). Les seuils d'acceptation en lot proposés à l'utilisateur sont fondés sur cette calibration, pas sur le score brut.
- Acceptation en lot possible au‑dessus d'un seuil **choisi par l'utilisateur**, avec revue obligatoire en dessous ; les éléments acceptés en lot restent marqués `batch_accepted` (§3.3).
- Les éléments à faible confiance sont **visuellement signalés sur le plan** (ex. contour orange).
- Aucune proposition ne contient de produit, de code de catalogue ou de prix : la `construction_spec` détectée est une **classe neutre** (ADR‑0002).

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
| Suggestion de matériau alternatif | ✅ (règles + équivalences **du pack actif**) | ✅ | équivalences = **données du pack**, pas hallucination |

**Règle cloud** : envoi uniquement de ce qui est nécessaire (recadrages plutôt que plan complet quand possible), consentement par projet, journal des envois consultable, pas d'entraînement sur les données clients sans accord explicite (§11.4).

### 6.4 Risque principal et stratégie de corpus

La reconnaissance fiable de plans réels (qualité de dessin hétérogène, scans, photos, conventions variables) est **le** risque technique du projet. Constats à assumer :

1. Les jeux publics de plans sont surtout européens/asiatiques et résidentiels, avec des licences parfois non commerciales : ils ne suffisent pas, mais ne sont pas à écarter.
2. Aucun modèle ne sera à 100 % : l'outil doit permettre de **corriger vite**.
3. Valider la *perception* (corpus A/B) et valider le *produit* (métré, chiffrage ; corpus C) sont deux questions distinctes.

**Trois corpus** (détail complet dans `DATASET-STRATEGY.md`, ADR-0003) :

| | Rôle | Usage |
|---|---|---|
| **A — Général** | compréhension générale des plans du monde entier (Europe, Amériques, Asie, Afrique ; contemporains ; PDF vectoriels, scans, photos ; plusieurs niveaux de complexité) | entraînement |
| **B — Africain** | robustesse aux pratiques et représentations rencontrées en Afrique | entraînement + validation + test |
| **C — Local de validation** | projets réels du premier marché (C‑BJ) : plan + métré de référence d'un professionnel + DQE/devis réel ; un C par nouveau marché | **test scellé** ; validation du produit de bout en bout |

Règles clés :
- **Le pays est une métadonnée d'évaluation**, jamais une entrée de modèle.
- **Tests scellés** (A‑test, B‑test, C) ; découpage par source ; dédoublonnage.
- **Évaluation par tranches** : région × type de source × complexité × qualité ; non‑régression par tranche.
- **KPI produit défini avant le choix des modèles** : temps pour obtenir un modèle validé vs traçage manuel.
- **Boucle de données** : corrections utilisateur réutilisables uniquement avec consentement distinct et révocable.
- **Palier de sécurité** : si la perception est insuffisante sur une tranche, le traçage assisté (accrochage aux lignes détectées, fermeture de pièces auto, copie d'ouvertures types) garde l'outil utile.

### 6.5 Gestion des modèles IA

`ModelArtifact` : identifiant, version, hash, tâche, taille, matériel requis, **version de dataset**, **métriques par tranche** (région × source × complexité × qualité) avec intervalles de confiance et effectifs, **calibration par tranche**, **domaine de validité**, licence du modèle et des poids de départ. Installés comme paquets signés ; plusieurs versions coexistent ; chaque proposition enregistre le `modelHash` utilisé → reproductibilité et audit.

### 6.6 Assistant (V1) : LLM = interface, moteurs = vérité

```
Utilisateur : « Combien de blocs pour cette maison ? »
LLM ─► outil get_quantity(item="MAT.AGGLO.*", scope="project") ─► QuantityLine + trace
LLM ─► reformule : « 4 120 blocs commandables (voir détail par mur) »  + lien vers la trace
```

- L'assistant opère toujours dans un **`MarketBinding` actif** ; chaque réponse indique le pack et la version de prix utilisés. Changer de pack = nouvelle estimation, pas une réécriture de la précédente.
- Outils exposés : `get_quantity`, `explain_line`, `list_low_confidence`, `compare_versions`, `simulate_change` (retourne un *delta* **sans l'appliquer**), `suggest_alternatives`.
- **Aucun nombre dans la réponse qui ne provienne d'un appel d'outil** (vérifié par un contrôle de sortie : tout nombre doit être rattaché à un résultat d'outil).
- Toute modification passe par une **proposition d'opération** que l'utilisateur accepte (§8.3).
- En cas d'assistant cloud, seuls des résultats dérivés (quantités, traces, libellés) quittent l'appareil, jamais les plans, et seulement avec le consentement du projet (§11.4).
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
| Résolution des spécifications (`SpecMapping`), rapport de couverture | ✅ | | |
| Calibration d'un score de confiance (vérification) | ✅ (mesure) | ✅ (score) | |
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
3. **Documents émis** : un document est lié à des versions précises `(PlanRevision, Model@rev, AssumptionSet@rev, MarketBinding@rev + pack résolu (hash), QuantitySet@v, PriceBook (hash), Params@v, Template@v, engine)`, consignées dans un **`ProvenanceManifest`** (§10.4). On peut **reproduire** un document des mois plus tard et prouver ce qu'il contenait.

### 8.2 Comparer deux versions

Diff structuré : éléments ajoutés/supprimés/modifiés → delta de quantités → delta de coût ventilé par cause (« +120 000 XOF dont 80 % dus à la surface, 15 % à la hausse du ciment »). Possible car quantités et prix sont séparés et versionnés.

### 8.3 Édition comme commandes

Toute modification (humaine, assistant, optimisation) est une **Command** validable par le core avant application (invariants : topologie, unités, intégrité référentielle). L'assistant propose une `Command[]` ; l'utilisateur voit le delta (quantité + coût) puis accepte.

### 8.4 Format de fichier projet

`.btpx` = archive : `project.sqlite` (ou export JSON canonique) + `blobs/` (plans) + `packs/` (versions de packs **résolus** et de `PriceBook` utilisées, signées, adressées par hash) + `manifest.json` (versions de schéma, hash). Un projet reste ainsi **rouvrable, vérifiable et re‑chiffrable à l'identique** sur une machine qui n'a pas le pack. Permet : sauvegarde manuelle, envoi par WhatsApp/e-mail/clé USB, ouverture sur un autre PC sans cloud. Migrations de schéma explicites et testées (jamais de lecture « en espérant »).

---

## 9. Packs marché : le contexte économique et réglementaire localisable

> Un pack contient **tout ce qui dépend du marché**, et rien de ce qui concerne la compréhension du plan (ADR-0001, ADR-0004).

### 9.1 Contenu d'un `MarketPack` (données signées et versionnées)

| Élément | Exemples |
|---|---|
| Géographie | **arbre de zones typé défini par le pack** (niveaux administratifs et noms propres au marché), zones de prix |
| Monnaie | code ISO, unités mineures, règles d'arrondi, format d'affichage |
| Fiscalité | `TaxRuleSet` (règles déclaratives composables : taux, assiette, exonérations, mentions légales), à valider par un fiscaliste local |
| Normes et réglementations | `ComplianceRuleSet` : règles déclaratives qui produisent des **avertissements** (V1) ; le moteur n'invente aucune réglementation |
| Catalogue et matériaux disponibles | articles locaux, conditionnements, équivalences |
| Fournisseurs | référentiel, zones de livraison, conditions |
| Main-d'œuvre | qualifications, taux, productivités |
| Pratiques de construction | `SpecMapping` (spécification neutre → ouvrages), `DefaultSpecProfile` (**propositions** d'hypothèses, ADR‑0005), `Assembly` (compositions hiérarchiques, consommations, pertes) |
| Méthode de mesurage | quelle `GeoQuantity` alimente quelle base, conventions et seuils de déduction, règles de présentation |
| Structure de coût | `CostBuildUp` (couches, assiettes, ordre) |
| Découpage des travaux | `WorkBreakdown` (lots / sections) |
| Unités commerciales | m², ml, u, forfait, sacs, camions…, conversions |
| Prix | `PriceBook` par zone : min/médiane/moyenne/max, date, source, confiance ; `staleAfterDays` **obligatoire** |
| Documents | types de documents et gabarits, mentions obligatoires, **identifiants légaux** (libellés/formats), `NumberingRule` |
| Langues | glossaire BTP et textes des documents ; la traduction de l'interface appartient à l'application (préférence utilisateur), pas au marché |
| Paramètres de calcul locaux | frais généraux, marge, imprévus, coefficients de transport (modifiables) |

**Héritage** : un pack peut en étendre **un seul** autre (zone monétaire ou cadre commun) et ne surcharger/retirer que ce qui diffère ; le pack **résolu** est aplati et haché, et c'est ce hash qui est enregistré (ADR‑0004). **Ajouter un pays = publier un pack**, pas modifier le code.

### 9.2 Spécification neutre ↔ catalogue local (couche de correspondance)

- Le **modèle architectural** parle en classes génériques (`masonry.block.hollow`, `render.cementitious`…).
- Le **pack** les traduit en ouvrages et articles locaux (`SpecMapping`) et fournit les valeurs par défaut quand le plan est muet (`DefaultSpecProfile`).
- Spécification sans correspondance → `unmapped_spec` ; jamais de substitution silencieuse (ADR-0002).
- Un **rapport de couverture** précède tout chiffrage : % d'éléments mappés, prix manquants, prix périmés.

### 9.3 Chiffrer le même projet avec plusieurs packs

```
Projet architectural (modèle@rev, GeometricTakeoff)  ─►  MarketBinding[Bénin]  ─► QuantitySet, Estimate (XOF)
                                                     ─►  MarketBinding[Sénégal] ─► …
                                                     ─►  MarketBinding[Ghana]   ─► … (GHS)
```
Le modèle n'est jamais modifié ; l'étage 1 du métré est identique pour tous. Les comparaisons inter‑marchés affichent devise, date des prix et taux de change utilisé.

### 9.4 Garde-fous d'étanchéité

- **Règle de dépendance** vérifiée en CI : **aucun** `core-*` ni `ai-*` ne peut importer `market-packs` ; seuls `apps/*` et les harnais de test dédiés assemblent moteur + pack (ADR‑0001 R1).
- **Lint de pureté** : aucun code pays/devise/nom de pays, ni constante de marché (seuils, taux, noms de niveaux administratifs), dans le code, les schémas et les fixtures du moteur.
- **Moteur sans pack** : le moteur démarre et produit un `GeometricTakeoff` avec **zéro** pack installé (T‑PUR‑04).
- **Pack factice « test » divergent** (devise à sous‑unités, taxes composées, langue anglaise, unités impériales/commerciales, structure de coût de type métré quantitatif, types de documents différents) exécuté de bout en bout (T‑MKT‑01) ; **rejeu multi‑packs** : métré géométrique identique entre packs (T‑MKT‑02).
- **Squelette Sénégal** dès M0 (schéma, arbre de zones, héritage, 3 spécifications, données fictives marquées) : ajouté **sans aucune modification** de `core-*`/`ai-*` (vérifié par règle de CI sur les chemins modifiés, T‑MKT‑03/04).
- **Étagement des tests** : `tests/engine/**` n'utilise que le pack factice ; `tests/market/<pays>/**` est le seul endroit où un pack réel est chargé.
- **Porte de disponibilité** par marché (`DATASET-STRATEGY.md` §5) avant d'annoncer « supporté ».

### 9.5 Pack Bénin (premier pack) : stratégie de constitution

Les prix publics structurés et à jour pour le BTP béninois sont probablement rares et dispersés : **il faut planifier une collecte** et ne jamais présenter une donnée non vérifiée comme fiable.

- Le pack Bénin est le **premier marché commercial et le premier environnement de validation (C‑BJ)** ; il ne borne pas le moteur.
- Phase 0 : catalogue restreint (≈ 150–300 articles couvrant les lots du MVP) + prix collectés sur Cotonou, avec dates et sources.
- Phase 1 : Abomey-Calavi, Porto-Novo, Parakou.
- Outil de collecte hors-ligne (saisie terrain avec photo du devis/facture, synchronisation différée) — c'est aussi la future brique « communauté de prix ».
- Chaque prix est étiqueté `confidence` + `observedAt` ; l'UI affiche l'âge.
- Gouvernance : une personne/équipe responsable de la validation du catalogue, avec procédure de publication (`PriceBook` signé).

### 9.6 Test avec deux marchés réels : Bénin et Sénégal

**Constat d'audit** : le Bénin et le Sénégal partagent la monnaie (XOF), la langue de travail (français) et un cadre régional commun (UEMOA, OHADA). Cette paire teste très bien la séparation **zones / catalogue / prix / pratiques / fournisseurs / paramètres**, mais **ne teste pas** la séparation devise, langue, unités et structure documentaire : d'où l'obligation de conserver le **pack factice divergent** en CI (T‑MKT‑01). Le Sénégal est donc le deuxième marché de test **sans remplacer** le pack factice.

| Dimension | Peut différer entre les deux marchés ? | Contrat du moteur qui l'absorbe | Test |
|---|---|---|---|
| Niveaux et noms administratifs | oui | `Zone` = arbre typé défini par le pack (pas de niveaux fixes pays/région/ville) | T‑PRC‑01, T‑MKT‑03 |
| Zones de prix, villes | oui | `PriceBook` par zone ; cascade par arbre | T‑PRC‑01 |
| Catalogue, matériaux, conditionnements | oui | `Catalogue` + `SpecMapping` | T‑MKT‑05 |
| Pratiques d'exécution (épaisseurs courantes, dosages, pertes) | oui | `Assembly`, `MeasurementMethod`, `DefaultSpecProfile` | T‑MKT‑02, T‑C‑01 |
| Prix, fournisseurs, main‑d'œuvre | oui | `PriceBook`, `Supplier`, `LabourRate` | T‑PRC‑03 |
| Fiscalité | possible | `TaxRuleSet` composable | T‑PRC‑02 |
| Normes locales | oui | `ComplianceRuleSet` | T‑MKT‑01 |
| Documents (intitulés, mentions, identifiants légaux, numérotation) | oui | `DocumentTemplate`, `LegalIdentifier`, `NumberingRule` | T‑DOC‑01 |
| Structure de coût | possible | `CostBuildUp` | T‑PRC‑02 |
| Devise | **non** (XOF) — non testé par cette paire | `Currency` du pack | T‑MKT‑01 |
| Langue | **non** (FR) — non testé par cette paire | glossaire/gabarits du pack | T‑MKT‑01 |
| Cadre de protection des données | oui (juridiction) | registre de juridictions (§11.4) | revue juridique |
| Socle commun | oui | pack parent partagé (`extends`) | T‑MKT‑06 |

**Conclusion** : l'ajout du pack Sénégal ne requiert **aucune modification du moteur architectural**, *à condition* que les corrections de l'audit soient appliquées. Avant ces corrections, trois points auraient exigé une modification du moteur : les niveaux administratifs figés (pays/région/ville), la structure de coût figée (déboursé → coefficient), et les identifiants légaux/documents figés dans `core-docs`.

---

## 10. Documents (DQE, DPGF, devis… définis par les packs)

### 10.1 Pipeline

```
Estimate ──► DocumentModel (neutre : sections, tableaux, totaux, mentions) ──► Renderer PDF
                                                                          └─► Renderer XLSX
```

- Le **core ne connaît que le `DocumentModel` neutre**. Les **types de documents** (DQE, DPGF, devis, bordereaux… selon le marché), leur structure, leurs mentions et leur langue sont des `DocumentTemplate` fournis par le pack.
- Le **DocumentModel** est calculé par le core (chiffres) ; le rendu ne fait **aucun calcul** (évite les écarts PDF vs Excel).
- Identité entreprise : logo, coordonnées et **identifiants légaux** dont libellés et formats sont définis par le pack (`LegalIdentifier`) ; signature = image ou espace réservé.
- Excel : valeurs, et option **formules vivantes** (sous-totaux, taxes) pour les utilisateurs qui veulent modifier.

### 10.2 Contenu (documents du pack Bénin v0 — exemple)

| Document | Particularités |
|---|---|
| **DQE** | lots → articles : n°, désignation, unité, quantité, PU, montant ; totaux de lot |
| **DPGF** | idem + sous-détails (composition de l'ouvrage), prix forfaitaires par lot (V1) |
| **Devis** | émetteur, client, chantier, date, n°, validité, travaux, HT, taxes, TTC, conditions, observations, signature |
| **Annexe de traçabilité** (optionnelle) | version des prix, éléments `batch_accepted`/à faible confiance, hypothèses, ajustements manuels, avertissements (structure, etc.) |

### 10.3 Garde-fous

- Impossible d'émettre un devis avec lignes `unpriced` sans confirmation explicite.
- Les éléments à confiance basse, `batch_accepted`, les hypothèses et les lignes/ajustements manuels sont listés dans l'annexe.
- La **numérotation** suit la `NumberingRule` du pack (séquence locale avec préfixe appareil/utilisateur hors ligne ; contraintes légales de continuité à valider par marché — décision ouverte OD‑13).

### 10.4 Manifeste de provenance (`ProvenanceManifest`) — obligatoire

Tout document émis embarque un manifeste lisible par machine (pièce jointe PDF, feuille masquée Excel) et imprime en pied de page son identifiant et son empreinte :

```
document hash ─► Estimate@rev ─► MarketBinding@rev (pack résolu hash, zone) ─► PriceBook hash + priceEntryId[]
              ─► QuantitySet@v ─► QuantityLine[] ─► trace étage 2 (mapping, méthode, assemblage + params)
              ─► GeoQuantity[] ─► trace étage 1 (règle + ruleHash, engine)
              ─► Model@rev + AssumptionSet@rev ─► entités (origin, validation, confidence)
              ─► PlanRevision (SourceDocument hash, page) ─► oplog (history)
```

- Commande `verify` (hors ligne) : recharge les paquets embarqués, **recalcule** et compare les empreintes (T‑TRC‑02).
- Chaque lien est résolu par identifiant + hachage ; un lien manquant est une erreur de génération (T‑TRC‑01).
- Les `ManualLine`/`QuantityAdjustment` apparaissent dans le manifeste avec leur justification et leur auteur.

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
- Conformité : les obligations dépendent de la **juridiction de l'utilisateur et de l'hébergement des données**, pas seulement du marché chiffré. Un **registre de juridictions** (une entrée par pays où le produit est utilisé ou héberge des données : cadre légal, autorité, transferts transfrontaliers, durées de conservation) est tenu à jour ; le premier est le Bénin, le Sénégal suit. Chaque entrée est **à faire valider par un juriste local** avant la collecte de données clients (noms/adresses dans les devis) et avant tout transfert hors du pays pour l'IA cloud. Le choix de la **région d'hébergement** du cloud est une décision ouverte (OD‑14).

### 11.5 Intégrité des paquets de données

Catalogues, packs, modèles IA : signés ; refus si signature invalide ; versions de schéma vérifiées. Empêche l'injection de prix ou de règles falsifiés.

---

## 12. Périmètre fonctionnel de métré du MVP

Lots du **pack Bénin v0** (`WorkBreakdown` ; ordre de priorité, à confirmer avec des métreurs ; un autre pack peut définir un autre découpage) :

1. Terrassement / fondations **en estimation paramétrique** (avertie)
2. Maçonnerie (élévation en agglos, linteaux/chaînages en estimation paramétrique)
3. Enduits (intérieurs/extérieurs)
4. Dallages / planchers (surface, épaisseur)
5. Revêtements sol et mur (carrelage, plinthes)
6. Peinture (murs, plafonds)
7. Menuiseries (portes, fenêtres : comptage par type et dimension)
8. Couverture (surface développée selon pente, charpente en estimation)
9. Plomberie / électricité : **comptages simples par pièce** (points) seulement

Chaque lot = un jeu de règles d'étage 2 (`Assembly` + `MeasurementMethod`) testé contre au moins 3 projets du corpus C‑BJ ; les grandeurs géométriques qu'il consomme (étage 1) sont testées séparément sur projets synthétiques (T‑GEO‑01).

---

## 13. Qualité, tests, reproductibilité

Chaque test a un identifiant **stable** utilisé par la matrice `Exigence → Architecture → ADR → Modèle → Test` (`INDEX.md` §3). Jalon = premier jalon où le test doit passer.

| ID | Test | Jalon |
|---|---|---|
| T‑ENG‑01 | Évaluateur d'expressions : décimal, vérification dimensionnelle, aucune évaluation arbitraire | M0 |
| T‑ENG‑02 | Arrondis : ordre d'arrondi déclaré respecté, aucun arrondi implicite | M0 |
| T‑ENG‑03 | **Déterminisme cross‑plateforme** : mêmes hash de `GeometricTakeoff`/`QuantitySet` sur Windows, Linux, macOS et WASM | M0 |
| T‑ENG‑04 | Propriété : recalcul incrémental ≡ recalcul complet | M0 |
| T‑ENG‑05 | Sérialisation aller‑retour ; migrations de schéma (modèle, projet, `.btpx`) depuis toutes les versions antérieures | M0 |
| T‑GEO‑01 | Étage 1 sur **projets synthétiques à vérité analytique** (murs obliques, pentes, ouvertures) | M0 |
| T‑GEO‑02 | Invariants topologiques : pièces fermées, ouvertures dans un mur hôte, nœuds partagés | M0 |
| T‑SYN‑01 | Le générateur synthétique est vérifié par une seconde implémentation indépendante des quantités | M0 |
| T‑PUR‑01 | Aucune dépendance `core-*`/`ai-*` → `market-packs` | M0 |
| T‑PUR‑02 | Lint de pureté : codes pays/devise, noms de pays, constantes de marché (code, schémas, fixtures du moteur) | M0 |
| T‑PUR‑03 | Schémas fermés : modèle et contrats IA sans champ marché | M0 |
| T‑PUR‑04 | **Moteur sans pack** : produit un `GeometricTakeoff` avec zéro pack installé | M0 |
| T‑PUR‑05 | Aucune valeur par défaut implicite : élément sans hauteur → `unspecified` bloquant, rien d'inventé | M0 |
| T‑MKT‑01 | **Pack factice divergent** de bout en bout (devise à sous‑unités, taxes composées, langue EN, unités impériales/commerciales, `CostBuildUp` différent, types de documents différents) | M0 |
| T‑MKT‑02 | **Rejeu multi‑packs** : même `Model@rev` + `AssumptionSet@rev` avec ≥ 2 packs → `GeometricTakeoff` identique (hash) | M0 |
| T‑MKT‑03 | **Squelette Sénégal** valide le schéma de pack, l'arbre de zones, l'héritage `extends` et se lie à un projet | M0 |
| T‑MKT‑04 | Règle de CI : ajouter un pack ne modifie aucun fichier de `core-*`/`ai-*` | M0 |
| T‑MKT‑05 | Spécification sans correspondance → `unmapped_spec`, jamais de substitution silencieuse ; rapport de couverture exact | M0 |
| T‑MKT‑06 | Héritage de packs : sémantique surcharge/retrait, **hash du pack résolu stable** | M0 |
| T‑MKT‑07 | Intégrité : signature invalide ou `engineApi` incompatible → refus | M0 |
| T‑PRC‑01 | Cascade de prix par arbre de zones ; `unpriced` jamais 0 ; péremption via `staleAfterDays` du pack ; pack sans ce paramètre refusé | M0 |
| T‑PRC‑02 | `CostBuildUp` : deux structures différentes donnent des totaux conformes à des calculs de référence | M0 |
| T‑PRC‑03 | Séparation Quantités/Prix : modifier un prix ne change aucune `QuantityLine` (hash) | M0 |
| T‑PRC‑04 | Devises/taux : le taux utilisé est écrit dans le document ; aucun recalcul silencieux | M0 |
| T‑DOC‑01 | `DocumentModel` → PDF et XLSX : mêmes totaux ; types de documents issus du pack | M0 |
| T‑DOC‑02 | Garde‑fous d'émission (lignes `unpriced`, éléments non revus listés) | M0 |
| T‑DOC‑03 | Manifeste de provenance présent, vérifiable hors ligne (`verify`) | M0 |
| T‑TRC‑01 | **Chaîne complète** : pour chaque `QuantityLine`/`EstimateLine`/document, tous les maillons se résolvent (zéro lien manquant) | M0 |
| T‑TRC‑02 | **Reproductibilité** : rejouer un document émis avec les paquets embarqués redonne les mêmes empreintes | M0 |
| T‑TRC‑03 | `ManualLine`/`QuantityAdjustment` exigent justification et apparaissent dans l'annexe et le manifeste | M0 |
| T‑OFF‑01 | Scénario complet **réseau coupé** | M1 |
| T‑SEC‑01 | Chiffrement au repos ; blobs chiffrés ; clé non stockée en clair | M1 |
| T‑SEC‑02 | Licence hors ligne : jeton signé, détection de recul d'horloge, essai 5 jours | M3 |
| T‑SEC‑03 | Aucun octet de plan ne sort sans consentement du projet (test avec réseau simulé) | M2 |
| T‑C‑01 | Étage 2 sur **corpus C‑BJ** : écart au métré de référence ≤ tolérance par poste | M0 (n°1) → M3 |
| T‑C‑02 | KPI produit : temps pour un modèle validé vs traçage manuel | M2 |
| T‑AI‑01 | Évaluation sur A‑test/B‑test **par tranches** avec effectifs et intervalles de confiance | M2 |
| T‑AI‑02 | Non‑régression par tranche à chaque nouveau modèle | M2 |
| T‑AI‑03 | **Anti‑raccourci** : leave‑one‑region‑out ; ablation cartouche/texte ; écart mesuré et borné | M2 |
| T‑AI‑04 | Calibration (erreur de calibration par tranche) ; seuils d'acceptation en lot fondés sur la calibration | M2 |
| T‑AI‑05 | Détection hors domaine : plans volontairement hors domaine → signalement (rappel/précision mesurés) | M2 |
| T‑AI‑06 | Contrat de port IA : l'entrée de perception ne comporte que pixels/vecteurs/texte (aucun champ marché ni projet) | M2 |
| T‑AI‑07 | Machine d'états : aucune proposition non acceptée n'altère le modèle | M1 |
| T‑DAT‑01 | **Fuites** : dédoublonnage inter‑corpus + découpage par source (rapport automatique) | M2 |
| T‑DAT‑02 | **Registre de provenance** : tout fichier d'entraînement a licence et consentement valides, sinon la CI bloque | M2 |
| T‑DAT‑03 | **Scellement** : le pipeline d'entraînement n'a pas accès au stockage des tests ; propagation du scellé aux dérivés | M2 |
| T‑MOD‑01 | Modification 2D → delta de quantités et de coût cohérent avec un recalcul complet | V1 |
| T‑OPT‑01 | Une optimisation proposée n'est jamais appliquée sans acceptation ; l'économie annoncée = delta recalculé | V2 |
| T‑3D‑01 | Les vues 2D/3D et l'export IFC dérivent du seul modèle (aucune donnée propre à la vue) | V1 |
| T‑IMP‑01 | Import PDF vectoriel / PDF raster / JPG / PNG : hash et pages exacts, extraction vectorielle fidèle, calibration d'échelle (manuelle et assistée) | M1 |
| T‑PKG‑01 | Import hors ligne d'un paquet (pack, `PriceBook`, modèle IA) depuis un fichier : vérification de signature, installation, retour arrière | M1 |
| T‑OPS‑01 | Oplog : rejeu, annulation/rétablissement, restauration d'une révision nommée, comparaison de deux révisions | M0 |
| T‑PRC‑05 | Confiance de prix : formule publiée (effectif, ancienneté, dispersion, source) vérifiée sur cas de référence | M0 |
| T‑DOC‑04 | Éléments structurels : estimation paramétrique étiquetée « validation par un ingénieur requise » et avertissement imprimé sur les documents | M0 |
| T‑AI‑08 | Contrôles de cohérence : surface annotée vs calculée, pièces non fermées, cotes contradictoires, échelle incohérente → détectés sur plans de test | M2 |
| T‑PERF‑01 | Matériel minimal (8 Go, 4 cœurs, sans GPU) : pipeline IA < 60 s par page A3 courante ou traitement en tâche de fond ; décimal sans goulot sur projet R+1 | M2 |
| T‑SCN‑01 | Comparaison de versions / scénarios : le delta de coût ventilé par cause est exactement égal à la différence des totaux | V1 |
| T‑SYNC‑01 | Synchronisation idempotente, reprise sur coupure, détection de conflit entité par entité | V1 |
| T‑AST‑01 | Assistant : aucun nombre sans appel d'outil (contrôle de sortie) ; `simulate_change` n'applique rien | V1 |

Niveaux d'exécution : unitaires et propriétés en continu ; étalons synthétiques et rejeux multi‑packs à chaque commit ; corpus C et rapports IA à chaque candidat de version. **Les jeux scellés ne sont pas dans le dépôt** (voir §16).

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
- **3D** : extrusion murs/dalles/toiture depuis le modèle ; ouvertures = soustractions ; matériaux depuis `constructionSpec.layers`.
- **Liaison au chiffrage** : toute commande 2D émet un delta → recalcul incrémental (§4.6) → affichage du delta de coût en direct (« passer la chambre de 12 à 16 m² : +X m² de mur, +Y blocs, +Z XOF »).
- **IFC (V3)** : table de correspondance `Wall → IfcWall`, `Opening → IfcOpeningElement`, `Space → IfcSpace`, `Level → IfcBuildingStorey`. Les schémas incluent déjà les attributs nécessaires (hauteurs, élévations, matériaux en couches).

---

## 16. Structure de dépôt proposée

```
btp-platform/
  packages/
    core-model/        # types + invariants du modèle architectural NEUTRE (aucun pays/devise)
    core-geometry/     # métré géométrique (étage 1), universel, virgule fixe
    core-units/        # unités et décimal (aucune devise)
    core-money/        # arithmétique monétaire générique ; définitions de devises fournies par données
    core-measure/      # évaluateur d'expressions, assemblages, traces (étage 2 : exécute les règles d'un pack)
    core-pricing/      # résolution de prix, CostBuildUp, estimations, taxes (mécanique uniquement)
    core-pack/         # chargement, validation, signature, héritage et hash des packs (aucun contenu marché)
    core-docs/         # DocumentModel neutre (les types de documents viennent des packs)
    core-trace/        # ProvenanceManifest, hachages, commande verify
    core-ops/          # oplog, commandes, versions, diff
    ai-contracts/      # AiProposal, ports AI, schémas ModelArtifact
    ai-pipeline/       # étapes d'analyse (local) ; adaptateurs ONNX
    ai-eval/           # évaluation par tranches, calibration, anti‑raccourci, non-régression
    datasets/          # outils, taxonomie, registre de provenance (données HORS dépôt)
    market-packs/      # base.xof/, bj/ (Bénin), sn/ (squelette Sénégal), test/ (pack factice divergent) — DONNÉES, jamais importé par core-*/ai-*
    render-pdf/ render-xlsx/
    storage-sqlite/ sync-protocol/
  apps/
    desktop/           # Tauri + UI
    (later) web/ api/ workers/
  tests/
    engine/            # n'utilise que le pack factice
    market/<pays>/     # seul endroit où un pack réel est chargé
  fixtures/synthetic/  # projets à vérité analytique
  fixtures/golden/     # POINTEURS + empreintes seulement : les corpus C et les tests scellés vivent dans un stockage privé à accès contrôlé (le pipeline d'entraînement n'a aucun droit d'accès)
  docs/adr/            # décisions d'architecture
```

Règle de dépendance : `core-*` ne dépend d'aucun adaptateur ; les `apps` assemblent.

### Décisions d'architecture (ADR)

Rédigés : **ADR-0001** moteur universel / contexte marché · **ADR-0002** spécification neutre, correspondance, métré en deux étages · **ADR-0003** corpus A/B/C et scellement · **ADR-0004** packs marché · **ADR-0005** hypothèses explicites et états de validation · **ADR-0006** déterminisme numérique · **ADR-0007** chaîne de traçabilité et manifeste · **ADR-0008** généricité des packs (zones, structure de coût, documents).
À rédiger : local‑first + oplog · Tauri vs Electron · nombres et arrondis · format des règles de métré · séparation Quantités/Prix · provenance/confiance · contrat `AiProposal` · format `.btpx` · consentement cloud · licence offline · gouvernance de la taxonomie neutre · paquets signés. Index : `adr/README.md`.

---

## 17. Feuille de route proposée

| Jalon | Contenu | Livrable vérifiable |
|---|---|---|
| **M0 — Fondations** (sans UI) | core-model/geometry/units/measure/pricing/docs ; **projets synthétiques** (étage 1 exact) ; pack factice divergent + pack Bénin v0 + squelette Sénégal ; chaîne de traçabilité et `verify` ; projet C‑BJ n°1 chiffré **en ligne de commande** ; DQE PDF/Excel ; CI d'étanchéité | étage 1 = vérité analytique ; métré CLI = métré du professionnel (écart toléré) ; rejeu 2 packs OK |
| **M1 — Chaîne manuelle assistée** | UI minimale : import plan, calibration, traçage assisté, validation, métré, pack Bénin v0, DQE, devis, versions, offline | un métreur chiffre un vrai projet sans IA et le juge utilisable |
| **M2 — IA locale v1** | modèles **universels** ; PDF vectoriel d'abord, puis raster ; OCR multilingue/échelle ; propositions murs/pièces/ouvertures ; contrôles ; corpus A + amorce B | rapport par tranches avec effectifs et calibration ; tests anti‑raccourci ; gain de temps mesuré vs M1 sur C‑BJ |
| **M3 — MVP béta** | corrections de retour, licences/essai, packaging, catalogue étendu, tests terrain à Cotonou | N projets réels chiffrés par des utilisateurs externes |
| **V1** | éditeur 2D, 3D, DPGF, scénarios, sync cloud, **second pack marché (preuve d'étanchéité) + son corpus C**, assistant | porte de disponibilité du 2ᵉ marché |
| **V2 / V3** | selon §1.3 | — |

Cette séquence applique la chaîne PLAN → IA → VALIDATION → MÉTRÉ → PRIX → DQE → DEVIS **dans l'ordre inverse du risque** : le déterministe (valeur sûre) est livré d'abord, l'IA vient l'accélérer, avec un critère de mesure objectif.

---

## 18. Risques majeurs

| Risque | Gravité | Réponse |
|---|---|---|
| Qualité insuffisante de la reconnaissance sur plans réels | Élevée | Corpus A/B/C, évaluation par tranches, KPI, domaine de validité, traçage assisté de repli (§6.4) |
| Biais du corpus (géographique, graphique) ou licences inadaptées | Élevée | Corpus B, registre de provenance, plans synthétiques, revue juridique |
| Fuite du contexte local dans le moteur (dette « Bénin ») | Moyenne | Règles R1–R7 d'ADR-0001 en CI, pack factice **divergent**, squelette Sénégal dès M0 |
| Raccourci implicite « pays » dans les modèles de perception | Moyenne | Têtes séparées, masquage cartouche/texte, leave‑one‑region‑out (T‑AI‑03) |
| Fuite du scellé (corrections produit, dérivés, doublons) | Élevée | Propagation du scellé, accès technique séparé, dédoublonnage inter‑corpus (T‑DAT‑01/03) |
| Non‑déterminisme numérique entre plateformes | Moyenne | Virgule fixe, décimal, T‑ENG‑03 dès M0 |
| Chaîne de traçabilité incomplète | Élevée | Manifeste obligatoire, T‑TRC‑01/02 dès M0 |
| Droits sur les plans et licences (données, poids, dépendances) | Élevée | Registre de provenance, contrats types, revue juridique par juridiction |
| Absence de données de prix fiables et à jour | Élevée | Collecte planifiée, confiance/âge affichés, gouvernance de catalogue (§9.5) |
| Règles de métré contestées par les professionnels | Moyenne | Règles ouvertes et modifiables, validées avec des métreurs béninois, trace visible |
| Performance IA sur PC modestes | Moyenne | Modèles quantifiés, traitement en arrière-plan, matériel minimal testé tôt |
| Périmètre trop large | Élevée | Respect strict de §1.2 ; tout le reste est « prévu, non développé » |
| Responsabilité professionnelle (structure) | Moyenne | Estimations étiquetées, avertissements imprimés, pas de dimensionnement auto |
| Conformité données personnelles | Moyenne | Local par défaut, consentement, revue juridique avant lancement |
| Piratage de licence | Faible/Moyenne | Mesures proportionnées, ne pas dégrader l'accès aux données |

---

## 19. Questions ouvertes (réponses nécessaires avant M0)

1. **Équipe et ressources** : qui développe (nombre, compétences TS/Rust/ML) ? Cela conditionne Tauri vs Electron et l'ambition du jalon M2.
2. **Accès aux corpus** : (a) sources de plans du monde (jeux publics à licence vérifiée, partenariats) ; (b) partenaires africains (cabinets, bureaux d'études, universités) ; (c) plans béninois réels avec autorisation et **au moins un métreur partenaire** pour le corpus C‑BJ ?
3. **Sources de prix** : fournisseurs partenaires, quincailleries, entrepreneurs prêts à partager des devis/factures ?
4. **Plateformes cibles** : Windows seulement au MVP, ou mobile (Android) indispensable dès le début ? (Android change l'architecture IA locale et l'UI.)
5. **Types de bâtiments du MVP** : villas/maisons R+0/R+1 uniquement ? (recommandé) ou immeubles/bâtiments publics ?
6. **Langue** : français uniquement au MVP (recommandé) ?
7. **Modèle d'activation** : compte requis pour l'essai de 5 jours, ou activation hors ligne par clé ?
8. **Budget IA cloud** : acceptable pour le MVP, ou 100 % local ?
9. **Second marché** : *tranché* — **Sénégal** (squelette dès M0, pack complet V1). Reste ouvert : le partenaire pour C‑SN.
10. **Droits sur les plans** : cadre contractuel type pour collecter/annoter des plans de tiers (revue juridique) ?
11. **Numérotation légale des devis** par marché (continuité de séquence exigée ou non hors ligne) — OD‑13.
12. **Hébergement des données cloud** : région(s) et juridiction — OD‑14.

Registre complet des décisions ouvertes (avec décideur et échéance) : `INDEX.md` §7.

---

## 20. Prochaines étapes concrètes

1. Valider ce document (décisions D1–D17 et périmètre MVP §1.2).
2. Répondre aux questions §19.
3. Relire ADR-0001 à 0008 puis rédiger les ADR restants (`adr/README.md`) — 1 à 2 pages chacun.
4. Concevoir les schémas détaillés (types TS + JSON Schema) du modèle, de la trace et de `AiProposal`.
5. Lancer en parallèle : le **registre de provenance** et l'inventaire des licences (corpus A), les premiers **projets synthétiques**, et le premier projet **C‑BJ** (plan réel + métré du professionnel).
6. Démarrer M0 (CLI, sans interface).
