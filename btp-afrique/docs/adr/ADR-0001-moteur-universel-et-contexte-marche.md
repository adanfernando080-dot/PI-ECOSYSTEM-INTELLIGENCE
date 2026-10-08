# ADR-0001 — Moteur architectural universel, contexte marché localisable

- Statut : **Proposé** (v0.2)
- Remplace : la formulation initiale « plateforme panafricaine centrée Bénin »
- Liens : ADR-0002, ADR-0003, ADR-0004 · `ARCHITECTURE.md` §0.1

## Contexte
L'architecture contemporaine est largement mondialisée : murs, pièces, ouvertures, cotation, niveaux, surfaces se représentent de façon très proche d'un pays à l'autre. En revanche, matériaux disponibles, prix, fiscalité, normes, pratiques d'exécution, unités commerciales et documents sont locaux. Le Bénin est le premier marché commercial et de validation, mais ne doit pas définir les limites du moteur.

## Décision
Le produit est une **plateforme BTP mondiale adaptable aux marchés africains**, structurée en deux dimensions étanches :

1. **Moteur architectural (universel)** : compréhension de plans (IA), modèle architectural neutre, métré géométrique, édition 2D/3D, versions, traçabilité.
2. **Contexte marché (localisable, par packs)** : pays/régions/villes, devise, taxes, normes, catalogue, prix, fournisseurs, main‑d'œuvre, pratiques de construction, méthode de mesurage, unités commerciales, gabarits de documents, paramètres de calcul locaux.

Le seul point où un projet « connaît » un marché est le **`MarketBinding`** (pack + version + zone), appliqué au moment du chiffrage.

### Règles d'étanchéité (vérifiées automatiquement)
- R1. Les paquets du moteur (`core-model`, `core-geometry`, `ai-*`) **ne dépendent pas** de `market-packs` (règle de dépendance vérifiée en CI).
- R2. Les schémas du moteur n'ont **aucun champ** pays, devise, taxe, fournisseur, prix, norme (`additionalProperties: false` + test de schéma).
- R3. Lint de pureté : aucune occurrence de codes pays ISO, codes de devise ou noms de pays dans le code et les schémas du moteur.
- R4. Aucun modèle IA ne reçoit le pays en entrée (le pays est une métadonnée d'évaluation, cf. ADR‑0003).
- R5. Test de rejeu : un même projet de référence chiffré avec deux packs (dont un pack factice) donne un métré géométrique **identique bit à bit**.

### Zones grises tranchées
| Sujet | Côté | Raison |
|---|---|---|
| Conventions de dessin (unités m/cm/ft‑in, hachures, symboles, langue des textes, échelle, papier) | **Moteur** — détectées, jamais supposées | elles varient par plan, pas par pays |
| Système constructif *reconnu ou déclaré* (maçonnerie, béton, ossature…) | Moteur (spécification neutre, ADR‑0002) | propriété du bâtiment |
| Pratiques d'exécution, compositions, consommations, pertes | **Pack** | dépendent du marché |
| Valeurs par défaut (hauteur sous plafond, épaisseurs) | **Pack** (profil de spécification par défaut) | le moteur ne devine pas |
| Convention de déduction des ouvertures, seuils de mesurage | **Pack** (méthode de mesurage) ; le moteur fournit surfaces brute/ouvertures/nette | les méthodes normalisées diffèrent |
| Langue de l'interface | Préférence utilisateur + défaut du pack | — |

## Conséquences
- (+) Ajouter un pays = publier un pack ; le même projet se chiffre avec plusieurs packs.
- (+) Le moteur IA bénéficie de données de toutes origines sans fork par pays.
- (−) Discipline de modélisation : la couche de correspondance (ADR‑0002) est un coût réel.
- (−) Les propriétés « par défaut » doivent être explicitement fournies par le pack, ce qui rend un pack incomplet visible (rapport de couverture).

## Alternatives écartées
- Moteur « Bénin d'abord », généralisé plus tard : coût de refonte élevé, dette de données locales dans les schémas.
- Un modèle IA par pays : multiplie la maintenance, prive chaque marché des données des autres.
