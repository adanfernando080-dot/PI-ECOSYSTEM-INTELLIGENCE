# ADR-0004 — Packs marché : contrat, héritage, liaison au projet

- Statut : **Proposé** (révisé v0.3 après audit)
- Liens : ADR-0001, ADR-0002, ADR-0008 · `ARCHITECTURE.md` §9

## Contexte
Tout ce qui est économique, réglementaire ou propre aux pratiques locales sort du moteur. Un même projet doit pouvoir être chiffré avec le Bénin, le Sénégal, la Côte d'Ivoire ou le Ghana sans modifier le moteur.

## Décision

### Contenu d'un pack (données signées, versionnées)
Arbre de zones typé · devise et arrondis · `TaxRuleSet` · `ComplianceRuleSet` (avertissements, V1) · catalogue et équivalences · fournisseurs · main‑d'œuvre · `SpecMapping`, `DefaultSpecProfile`, `Assembly` · `MeasurementMethod` · `CostBuildUp` · `WorkBreakdown` · unités commerciales · `PriceBook` (avec `staleAfterDays` **obligatoire**) · types/gabarits de documents, `LegalIdentifier`, `NumberingRule` · glossaire · paramètres de calcul par défaut (propositions).
Les `PriceObservation` ne sont **pas** dans le pack : elles vivent dans le service de données de prix ; seuls les `PriceBook` publiés sont signés.

### Manifeste
```jsonc
{
  "id": "pack.<id>", "version": "0.1.0", "schemaVersion": "1",
  "extends": "pack.base.<id>@0.1.0",              // UN seul parent
  "scope": { "zoneTree": "…" },
  "requires": { "engineApi": ">=1.0 <2.0", "specTaxonomy": ">=1.0 <2.0", "exprVersion": "1" },
  "contents": { "currency": "…", "taxRuleSets": ["…"], "catalogue": "…", "specMappings": "…",
                "assemblies": "…", "measurementMethod": "…", "costBuildUp": "…", "defaultSpecProfiles": "…",
                "priceBooks": ["…"], "documentTemplates": ["…"], "legalIdentifiers": ["…"],
                "numberingRules": ["…"], "workBreakdown": "…", "locales": ["fr"] },
  "coverage": { "specTaxonomy": 0.82 },            // calculé et publié
  "signature": "ed25519:…"
}
```

### Sémantique de l'héritage (v0.2 ne la précisait pas)
- **Un seul parent** (chaîne simple) ; pas d'héritage multiple, pas de losange.
- Pour chaque collection, l'enfant peut `override` (par clé), `add` ou `remove` ; une clé retirée et réintroduite est une erreur de validation.
- Le pack **résolu** (parent ⊕ enfant) est aplati, trié de façon canonique et **haché** ; ce `packResolvedHash` est enregistré dans le `MarketBinding` et les traces (T‑MKT‑06).
- Un parent est un pack à part entière (ex. une base commune à une zone monétaire), jamais un pack « national » partiel.

### Liaison au projet
```
MarketBinding@rev { packResolvedHash, zoneId, priceBookHash, params }   // IMMUABLE : toute modification = nouvelle révision
Estimate          { Model@rev, AssumptionSet@rev, MarketBinding@rev, QuantitySet@v, params }
```
- Plusieurs `MarketBinding` par projet (comparaison inter‑marchés) ; chaque `Estimate` en choisit un.
- Changer de pack ne modifie **jamais** le modèle ni l'`AssumptionSet` ; il produit un nouvel `Estimate` et un rapport de couverture.
- Les documents et le `.btpx` **embarquent** les packs résolus et `PriceBook` utilisés (reproductibilité hors machine).

### Qualité d'un pack
- Validation de schéma + signature obligatoires à l'installation ; refus si `engineApi` incompatible.
- **Pack factice « test » divergent** en CI (devise à sous‑unités, taxes composées, langue anglaise, unités impériales/commerciales, `CostBuildUp` et types de documents différents) — il **ne** peut **pas** être remplacé par le Sénégal, qui partage devise et langue avec le Bénin.
- **Squelette Sénégal** dès M0 (schéma, zones, héritage, quelques spécifications, données fictives marquées) : ajout sans toucher au moteur (T‑MKT‑03/04).
- **Porte de disponibilité** avant d'annoncer un marché « supporté ».

## Conséquences
- (+) Extension multi‑pays par données ; mises à jour sans nouvelle version du logiciel.
- (+) Comparaison inter‑marchés avec devise, date de prix et taux explicites.
- (−) Gouvernance éditoriale par pack ; les normes locales exigent des experts locaux.
- (−) Poids du `.btpx` accru par l'embarquement des paquets (politique de rétention : décision ouverte OD‑20).

## Alternatives écartées
- Configuration par pays dans le code ; packs non signés/non versionnés ; héritage multiple.
