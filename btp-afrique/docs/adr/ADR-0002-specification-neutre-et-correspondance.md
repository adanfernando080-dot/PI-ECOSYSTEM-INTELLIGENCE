# ADR-0002 — Spécification de construction neutre, correspondance, métré en deux étages

- Statut : **Proposé** (révisé v0.3 après audit)
- Liens : ADR-0001, ADR-0004, ADR-0005, ADR-0007 · `ARCHITECTURE.md` §3, §4

## Contexte
Un plan décrit une géométrie et parfois une intention (« mur de 20 cm », « carrelage »), rarement des produits commerciaux. Si le modèle stockait un code de catalogue local, il cesserait d'être universel.

## Décision

### 1. Spécification de construction neutre (dans le modèle architectural)
Chaque élément porte une `constructionSpec` en **classes génériques** d'une taxonomie versionnée et extensible :

```jsonc
"constructionSpec": {
  "system": "masonry.block.hollow",       // taxonomie neutre hiérarchique
  "layers": [ {"class": "render.cementitious", "thickness": 0.015, "side": "exterior"}, … ],
  "origin": "ai_detected | user_entered | assumption",
  "assumptionId": "A-02"                   // si origin = assumption (ADR-0005)
}
```
*(v0.2 stockait `defaultedBy: "profile:pack.bj/…"` dans le modèle : rupture d'étanchéité supprimée.)*

### 2. Couche de correspondance fournie par le pack
- `SpecMapping` : spécification neutre → ouvrage(s) du catalogue local (avec conditions : épaisseur, usage…).
- `DefaultSpecProfile` : **propose** des hypothèses (ADR‑0005) ; n'écrit jamais dans le modèle.
- `Assembly` : ouvrage → composants, consommations, pertes (matériaux, main‑d'œuvre, matériel, transport), **hiérarchiques** (un composant peut référencer un sous‑ouvrage ; cycles interdits à la validation du pack).
- `MeasurementMethod` : décide quelle `GeoQuantity` alimente la base demandée par une `Assembly` (`measureBasis: "wall.area"` → brute ou nette, seuils de déduction).

Spécification sans correspondance : état `unmapped_spec` ; jamais de substitution silencieuse. Un **rapport de couverture** (% d'éléments mappés) précède le chiffrage.

### 3. Métré en deux étages
```
ÉTAGE 1 (UNIVERSEL)  Model@rev + AssumptionSet@rev ─► GeometricTakeoff : GeoQuantity[] (id stable, trace, engine)
ÉTAGE 2 (PACK)       GeoQuantity[] × SpecMapping × MeasurementMethod × Assembly ─► QuantitySet : QuantityLine[]
```
L'étage 2 consomme les `GeoQuantity` **par identifiant** et ne recalcule jamais la géométrie. Chaque `QuantityLine` référence : binding, pack résolu (hash), mapping, méthode, assemblage (+ hash et paramètres), `GeoQuantity` d'entrée (ADR‑0007).

### 4. Provenance
L'IA peut proposer une *spécification neutre* détectée (hachures, annotations) ; jamais un produit.

## Conséquences
- (+) Changer de pack = recalculer l'étage 2 seulement.
- (+) Étage 1 testable sur projets synthétiques à vérité analytique.
- (−) La taxonomie neutre doit être gouvernée (versionnée ; une classe manquante bloque le mapping, pas le moteur) — ADR de gouvernance à rédiger.
- (−) Travail de correspondance initial important pour chaque pack.

## Alternatives écartées
- Codes de catalogue local dans le modèle : rompt l'universalité.
- IA devinant le matériau commercial : opacité et erreurs silencieuses.
- Une seule base de calcul (net) imposée à tous les packs : certaines méthodes de mesurage utilisent la surface brute ou des seuils de déduction.
