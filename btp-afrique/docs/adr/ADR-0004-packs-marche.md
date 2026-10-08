# ADR-0004 — Packs marché : contrat, héritage, liaison au projet

- Statut : **Proposé** (v0.2)
- Liens : ADR-0001, ADR-0002 · `ARCHITECTURE.md` §9

## Contexte
Tout ce qui est économique, réglementaire ou propre aux pratiques locales doit sortir du moteur. Les packs doivent permettre de chiffrer successivement le même projet avec le Bénin, le Sénégal, la Côte d'Ivoire ou le Ghana sans modifier le moteur.

## Décision

### Contenu d'un pack (données signées, versionnées)
Géographie (pays/régions/villes) · devise et règles d'arrondi · **fiscalité** (`TaxRuleSet`) · **normes et réglementations** (`ComplianceRuleSet`, règles déclaratives produisant des avertissements ; V1) · catalogue local et équivalences · **`SpecMapping`, `DefaultSpecProfile`, `Assembly`** (ADR‑0002) · **`MeasurementMethod`** (conventions de mesurage et de déduction) · main‑d'œuvre (qualifications, productivités) · **fournisseurs** · **`PriceBook`** (par zone) · unités commerciales · gabarits de documents · langues/glossaire · paramètres de calcul par défaut (frais généraux, marge, imprévus).

### Manifeste
```jsonc
{
  "id": "pack.bj", "version": "0.1.0", "schemaVersion": "1",
  "extends": ["pack.base.xof@0.1.0"],             // héritage : zone monétaire / cadre communs
  "scope": { "country": "BJ", "regions": ["…"], "cities": ["…"] },
  "requires": { "engineApi": ">=1.0 <2.0", "specTaxonomy": ">=1.0 <2.0" },
  "contents": { "currency": "…", "taxRuleSets": ["…"], "catalogue": "…", "specMappings": "…",
                "assemblies": "…", "measurementMethod": "…", "defaultSpecProfiles": "…",
                "priceBooks": ["…"], "documentTemplates": ["…"], "locales": ["fr"] },
  "coverage": { "specTaxonomy": 0.82 },            // calculé et publié
  "signature": "ed25519:…"
}
```
L'**héritage** permet de factoriser ce qui est commun à plusieurs marchés (par ex. une zone partageant une même monnaie ou un même cadre juridique), l'enfant surchargeant ce qui diffère. (À valider marché par marché avec des experts locaux.)

### Liaison au projet
```
MarketBinding { packId@version, zone (ville/région), priceBookVersion, params }
Estimate      { ArchitecturalModel@rev, MarketBinding, QuantitySet@v, params }
```
- Un projet peut avoir **plusieurs** `MarketBinding` (comparaison inter‑marchés) ; chaque `Estimate` en choisit un.
- Changer de pack ne modifie **jamais** le modèle architectural ; il produit un nouvel `Estimate` et un **rapport de couverture** (éléments non mappés, prix manquants).
- Les documents émis enregistrent pack@version et versions de prix.

### Qualité d'un pack
- Validation de schéma + signature obligatoire à l'installation.
- **Pack factice « test »** (devise, taxes, langue, unités distinctes) exécuté de bout en bout en CI : aucun marché réel n'est codé en dur.
- **Porte de disponibilité** (cf. `DATASET-STRATEGY.md` §5) avant d'annoncer un marché « supporté ».

## Conséquences
- (+) Extension multi-pays par données ; mises à jour de prix/règles sans nouvelle version du logiciel.
- (+) Comparaison de scénarios entre marchés possible, avec devise et date de prix explicites.
- (−) Gouvernance éditoriale nécessaire par pack (qui valide, comment on publie).
- (−) Les normes locales exigent des experts locaux : le moteur n'invente pas de réglementation.

## Alternatives écartées
- Configuration par pays dans le code : recompilation par marché, dette de branches.
- Packs non signés ou non versionnés : risque d'intégrité et de non‑reproductibilité des devis.
