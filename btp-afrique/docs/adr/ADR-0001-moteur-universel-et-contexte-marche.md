# ADR-0001 — Moteur architectural universel, contexte marché localisable

- Statut : **Proposé** (révisé v0.3 après audit)
- Remplace : la formulation initiale « plateforme panafricaine centrée Bénin »
- Liens : ADR-0002 à 0008 · `ARCHITECTURE.md` §0.1, §9.4, §9.6

## Contexte
L'architecture contemporaine est largement mondialisée : murs, pièces, ouvertures, cotation, niveaux, surfaces se représentent de façon très proche d'un pays à l'autre. En revanche, matériaux disponibles, prix, fiscalité, normes, pratiques d'exécution, unités commerciales et documents sont locaux. Le Bénin est le premier marché commercial et de validation, le Sénégal le deuxième marché de test d'étanchéité ; aucun des deux ne définit les limites du moteur.

## Décision
Le produit est une **plateforme BTP mondiale adaptable aux marchés africains**, en deux dimensions étanches :

1. **Moteur architectural (universel)** : compréhension de plans (IA de perception), modèle architectural neutre, métré géométrique (étage 1), mécaniques génériques (évaluateur, résolution de prix, rendu de documents), édition 2D/3D, versions, traçabilité.
2. **Contexte marché (localisable, par packs)** : zones, devise, taxes, normes, catalogue, prix, fournisseurs, main‑d'œuvre, pratiques de construction, méthode de mesurage, structure de coût, unités commerciales, types et gabarits de documents, identifiants légaux, numérotation, paramètres de calcul locaux.

Le seul point où un projet « connaît » un marché est le **`MarketBinding`** (pack résolu + zone + paramètres, immuable par révision), appliqué à l'étage 2 du métré et au chiffrage.

### Règles d'étanchéité (vérifiées automatiquement)
- **R1.** **Aucun** `core-*` ni `ai-*` n'importe `market-packs`. Seuls `apps/*` et les harnais `tests/market/**` assemblent moteur et pack. *(v0.2 ne couvrait que `core-model`, `core-geometry` et `ai-*` : insuffisant, `core-measure`, `core-pricing`, `core-docs` exécutent des données de pack.)*
- **R2.** Schémas du moteur fermés : aucun champ pays, devise, taxe, fournisseur, prix, norme (`additionalProperties: false` + test).
- **R3.** Lint de pureté : aucun code pays ISO, code de devise, nom de pays **ni constante de marché** (seuil de péremption, taux, noms de niveaux administratifs, libellés d'identifiants légaux) dans le code, les schémas et les fixtures du moteur.
- **R4.** Aucun **modèle de perception** ne reçoit pays, marché, `Location` ni métadonnée de projet en entrée. Le pays n'est qu'une métadonnée d'évaluation (ADR‑0003). *(Hors périmètre de R4 : l'assistant conversationnel, qui opère dans un `MarketBinding` actif.)*
- **R5.** Test de rejeu : un même `Model@rev` + `AssumptionSet@rev` avec deux packs (dont le pack factice divergent) donne un `GeometricTakeoff` **identique au hash près** (déterminisme : ADR‑0006).
- **R6.** Le moteur démarre et produit un `GeometricTakeoff` avec **zéro pack** installé.
- **R7.** Aucune valeur par défaut implicite dans le moteur : tout paramètre de marché requis est **obligatoire dans le pack** (sa validation échoue s'il manque) ; une valeur de modèle non lisible est `unspecified` (ADR‑0005).
- **R8.** Ajouter un pack ne modifie aucun fichier de `core-*`/`ai-*` (règle de CI sur les chemins modifiés).

### Zones grises tranchées
| Sujet | Côté | Raison |
|---|---|---|
| Conventions de dessin (unités m/cm/ft‑in, hachures, symboles, langue des textes, échelle, papier) | **Moteur** — détectées, jamais supposées | elles varient par plan, pas par pays |
| Système constructif *reconnu ou déclaré* | Moteur (spécification neutre, ADR‑0002) | propriété du bâtiment |
| Pratiques d'exécution, compositions, consommations, pertes | **Pack** | dépendent du marché |
| Valeurs par défaut (hauteur sous plafond, épaisseurs…) | **Jamais implicites** : le pack **propose** (`DefaultSpecProfile`), l'utilisateur **confirme** (`AssumptionSet`, ADR‑0005) | l'étage 1 doit rester indépendant du pack |
| Convention de déduction des ouvertures, seuils de mesurage | **Pack** (`MeasurementMethod`) ; le moteur fournit brute/ouvertures/nette | les méthodes normalisées diffèrent |
| Structure de coût (déboursé, frais, marge, sommes provisionnelles…) | **Pack** (`CostBuildUp`, ADR‑0008) | pratique de marché |
| Types de documents, identifiants légaux, numérotation | **Pack** (ADR‑0008) | exigences locales |
| Niveaux administratifs / zones | **Pack** (arbre de zones typé) | diffèrent d'un pays à l'autre |
| Langue de l'interface | Application (préférence utilisateur) ; glossaire et textes de documents : pack | — |
| Cadre de protection des données | Registre de juridictions (hors moteur) | dépend de l'utilisateur et de l'hébergement |

## Conséquences
- (+) Ajouter un marché = publier un pack ; un même projet se chiffre avec plusieurs packs.
- (+) Le moteur IA bénéficie de données de toutes origines sans fork par pays.
- (−) Discipline de modélisation : couche de correspondance (ADR‑0002) et généricité des packs (ADR‑0008) sont un coût réel.
- (−) Un pack incomplet est visible (rapport de couverture) au lieu d'être masqué par des défauts.

## Alternatives écartées
- Moteur « Bénin d'abord », généralisé plus tard : coût de refonte élevé, dette de données locales dans les schémas.
- Un modèle IA par pays : multiplie la maintenance, prive chaque marché des données des autres.
- Défauts de marché écrits dans le modèle : rompt R5 et rend un projet dépendant d'un pack.
