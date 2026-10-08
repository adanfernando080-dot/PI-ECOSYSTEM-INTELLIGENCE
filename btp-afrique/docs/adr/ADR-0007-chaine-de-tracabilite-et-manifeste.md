# ADR-0007 — Chaîne de traçabilité et manifeste de provenance

- Statut : **Proposé** (v0.3, issu de l'audit)
- Liens : ADR-0002, ADR-0004, ADR-0005, ADR-0006 · `ARCHITECTURE.md` §4.5, §8, §10.4 · tests T‑TRC‑01/02/03, T‑DOC‑03

## Contexte
Exigence : relier chaque quantité à `plan/version → objet → règle → paramètres → calcul → résultat → ouvrage/catalogue → prix → MarketBinding → document final`. L'audit de v0.2 a relevé des maillons manquants ou faibles :

| # | Trou | Correction |
|---|---|---|
| G1 | Pas de notion de **révision de plan** (un nouveau plan remplace l'ancien) | `SourceDocument.supersedes` ; `PlanRevision` référencée par le modèle |
| G2 | Les traces citaient des **codes lisibles** (`wall:M-023`), pas des identifiants/révisions | références `{id, modelRev}` |
| G3 | Règle/paramètres identifiés par un **numéro de version** seulement | `ruleHash` + valeurs de paramètres inscrites dans la trace |
| G4 | **Étages 1 et 2 mélangés** dans une seule trace | deux niveaux liés par `GeoQuantity.id` |
| G5 | Le **choix de mapping** (quelle spécification → quel ouvrage) non enregistré | `mapping` + `method` + `assembly` (hash) dans la trace |
| G6 | Prix : niveau de cascade noté, mais pas **l'entrée de prix** ni le hash du PriceBook | `priceEntryId` + `priceBookHash` dans `EstimateLine` |
| G7 | `MarketBinding` **mutable** et sans empreinte | révisions immuables + `packResolvedHash` |
| G8 | Document final : liste de versions décrite mais **pas de manifeste** vérifiable | `ProvenanceManifest` obligatoire + commande `verify` |
| G9 | **Ajustements/lignes manuelles** non modélisés (quantité sans origine) | `ManualLine`, `QuantityAdjustment` avec justification et auteur |
| G10 | Version du moteur non enregistrée | `engine.version/hash` dans chaque trace (ADR‑0006) |
| G11 | Paquets (pack, prix) **non embarqués** : un projet partagé n'est pas rejouable | embarquement dans `.btpx` et dans la pièce jointe du document |

## Décision
1. **Identifiants stables + hachages** à chaque maillon : `SourceDocument.hash` → `PlanRevision` → `Model@rev` (hash de contenu) + `AssumptionSet@rev` → `GeoQuantity.id` (+ `ruleHash`, `engine`) → `QuantityLine` (binding, `packResolvedHash`, mapping, méthode, assemblage + hash + paramètres) → `EstimateLine` (`priceEntryId`, `priceBookHash`, couches de `CostBuildUp`) → `Document` (hash).
2. **`ProvenanceManifest`** obligatoire dans tout document émis (pièce jointe PDF, feuille masquée Excel) + identifiant/empreinte imprimés en pied de page.
3. **`verify`** (hors ligne) : recharge les paquets embarqués, recalcule, compare les empreintes.
4. **Lignes et ajustements manuels** : `ManualLine` (poste hors modèle) et `QuantityAdjustment` (correction d'une `QuantityLine`) exigent justification, auteur, date ; ils apparaissent dans l'annexe et le manifeste ; ils ne modifient jamais les `GeoQuantity`.
5. Un lien manquant à la génération est une **erreur**, pas un avertissement (T‑TRC‑01).
6. Les versions de plan, de modèle et d'hypothèses sont **immuables** une fois référencées par un document.

## Conséquences
- (+) Preuve complète de l'origine de chaque chiffre ; rejouabilité des documents.
- (−) Poids des documents/projets (manifeste, paquets embarqués) ; politique de rétention à arrêter (OD‑20).
- (−) Discipline stricte de sérialisation canonique (ADR‑0006).

## Alternatives écartées
- Traçabilité « best effort » dans l'UI seulement : non vérifiable ni rejouable.
