# ADR-0002 — Spécification de construction neutre, couche de correspondance, métré en deux étages

- Statut : **Proposé** (v0.2)
- Liens : ADR-0001, ADR-0004 · `ARCHITECTURE.md` §3, §4

## Contexte
Un plan décrit rarement des matériaux commerciaux ; il décrit une géométrie et parfois une intention (« mur de 20 cm », « carrelage »). Si le modèle architectural stockait « agglo creux 20 » ou un code de catalogue béninois, il cesserait d'être universel et le même projet ne pourrait pas être chiffré avec un autre pack.

## Décision

### 1. Spécification de construction neutre (dans le modèle architectural)
Chaque élément porte une `constructionSpec` exprimée en **classes génériques** d'une taxonomie versionnée et extensible :

```jsonc
"constructionSpec": {
  "system": "masonry.block.hollow",       // taxonomie neutre hiérarchique
  "nominalThickness": 0.20,
  "finishes": { "exterior": "render.cementitious", "interior": "render.cementitious" },
  "origin": "default_rule",               // detected | user | default_rule
  "defaultedBy": "profile:pack.bj/residential-standard@0.1.0"   // si origin = default_rule
}
```

### 2. Couche de correspondance fournie par le pack
Le pack fournit :
- `SpecMapping` : spécification neutre → **ouvrage(s)** du catalogue local (avec conditions : épaisseur, usage) ;
- `DefaultSpecProfile` : spécification par défaut par typologie, quand le plan ne dit rien ;
- `Assembly` (compositions) : ouvrage → composants, consommations, pertes (matériaux, main‑d'œuvre, matériel, transport).

Si une spécification n'a pas de correspondance : état `unmapped_spec`. Jamais de substitution silencieuse : l'utilisateur choisit, ou la ligne reste `unpriced`. Un **rapport de couverture** (% d'éléments mappés) est calculé avant chiffrage.

### 3. Métré en deux étages
```
ÉTAGE 1 — Métré géométrique (UNIVERSEL)       modèle ─► GeometricTakeoff
    surfaces brute / ouvertures / nette, périmètres, volumes, comptages, hauteurs
ÉTAGE 2 — Métré commercial (PACK)             GeometricTakeoff + SpecMapping + Assembly + MeasurementMethod ─► QuantitySet
    blocs, ciment, sable, enduit, main‑d'œuvre… (avec pertes, arrondis de commande)
```
Le `GeometricTakeoff` ne dépend d'aucun pack et est mis en cache par révision du modèle. Le `QuantitySet` est dérivé par `MarketBinding`.

### 4. Provenance
Toute valeur issue d'un défaut de pack est marquée `origin: default_rule` avec la référence exacte (pack@version/profil) — visible dans la trace.

## Conséquences
- (+) Changer de pack = recalculer l'étage 2 seulement ; le modèle et l'étage 1 sont intacts.
- (+) Le métré géométrique est testable sur des projets synthétiques à vérité analytique.
- (−) La taxonomie neutre doit être gouvernée (versionnée, extensions documentées) ; une classe manquante bloque le mapping, pas le moteur.
- (−) Les packs requièrent un travail de correspondance initial important (c'est le vrai coût d'un nouveau marché).

## Alternatives écartées
- Stocker des codes de catalogue local dans le modèle : rompt l'universalité (ADR‑0001).
- Laisser l'IA deviner le matériau commercial : opacité et erreurs silencieuses ; l'IA peut proposer une *spécification neutre* détectée (hachures, annotations), jamais un produit.
