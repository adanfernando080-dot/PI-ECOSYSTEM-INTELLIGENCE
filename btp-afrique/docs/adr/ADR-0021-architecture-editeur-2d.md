# ADR-0021 — Architecture de l'éditeur 2D (proposition, non implémenté)

- Statut : **Partiellement implémenté (incréments 1 à 4)** — voir « État d'implémentation » en fin de document. Liens : ADR-0005, ADR-0009, ADR-0015, ADR-0017 · REQ-03, REQ-13, REQ-25

## Principe
L'éditeur est une **vue-contrôleur** du modèle architectural : il ne possède aucun état métier. Il lit le `Run`, propose des **commandes**, et celles-ci deviennent des **opérations de l'oplog** (ADR-0009) appliquées par `session.apply`. Le moteur recalcule ; l'éditeur n'a ni calcul de quantité, ni arrondi, ni prix.

## Couches
```
Rendu (SVG d'abord ; Canvas si > ~5 000 objets)        ← pur affichage, coordonnées monde → écran
Interaction (outils : sélection, mur, ouverture, cote)  ← produit des Commandes (brouillon)
Brouillon (Draft) — état éphémère, hors modèle          ← aperçu, aimantation, validation
Commande validée → Operation(s) → oplog → recompute     ← seul chemin d'écriture
Liens (links.ts) : entité → GeoQuantity → ouvrage → ligne ← panneau « Pourquoi ? » à la sélection
```

## Coordonnées et unités
- **Monde** = unités du modèle : entiers en 0,1 mm (ADR-0006), repère unique par niveau, axe Y vers le haut. Aucun flottant ne traverse la frontière vers le modèle.
- **Écran** = pixels, dérivés par une transformation affine (échelle, translation) **purement visuelle** ; la conversion écran→monde arrondit à l'entier le plus proche *après* aimantation (grille en unités du modèle, aimantation aux nœuds/axes).
- **Plan importé** = source (`SourceDocument`) + `ScaleCalibration` confirmée par l'humain (ADR-0015) : pixels→0,1 mm en BigInt (déjà implémenté et testé). Sans calibration, aucun objet ne peut être créé *depuis* l'image (le tracé libre en unités du modèle reste possible).

## Objets et opérations
| Geste | Opérations (oplog) | Garde-fous |
|---|---|---|
| Créer un mur | `addNode`×2 (ou réutilise un nœud existant) + `addWall` | épaisseur/hauteur : valeur saisie ou hypothèse ; sinon `unspecified` visible et bloquant |
| Déplacer un nœud | `moveNode` | aimantation ; les murs liés suivent par référence |
| Ouverture | `addOpening` (mur hôte obligatoire) ; `setOpeningSize` | dimensions >0, ≤ longueur du mur (validation) |
| Supprimer | `removeOpening` → `removeWall` → `removeNode` | refus si encore référencé (déjà implémenté) ; l'éditeur propose la suppression en cascade comme **lot** d'opérations |
| Pièce | à ajouter : `addSpace` / `setSpaceBoundary` (cycle fermé de murs) | hors périmètre actuel : pièces rectangulaires seulement (limite du moteur) |
| Cote / mesure | aucune (affichage) | une cote affichée est toujours une `GeoQuantity` du moteur, jamais recalculée par l'éditeur |

## Annuler / rétablir
`undoOperation` existe (opération inverse, historique jamais réécrit). À ajouter : **pile de rétablissement** côté session (les inverses d'inverses), invalidée par toute nouvelle opération ; regroupement des opérations d'un geste en un **lot** (transaction : tout ou rien, un seul recalcul).

## Validation avant recalcul
1. Le geste construit un **Draft** (non committé) validé par `validateModel` sur une copie ; erreurs affichées sur l'objet.
2. Aperçu de l'impact **optionnel** : `recompute` sur la copie + `diffRuns` (déjà implémentés) pour montrer « +X m² de mur, +Y XOF » avant validation.
3. Validation explicite (Entrée / bouton) → lot d'opérations → recalcul réel. Les propositions IA suivent exactement le même chemin (`decide` produit les mêmes opérations après décision humaine).

## Traçabilité graphique ↔ modèle ↔ métré
- Chaque forme dessinée porte `data-entity-id` = id de l'entité du modèle (jamais un id propre à l'éditeur).
- À la sélection, `linksFor(run, id)` donne : quantités géométriques, ouvrages et lignes de chiffrage dépendants ; « Pourquoi ? » ouvre l'explication déterministe existante.
- Toute entité créée par IA porte `origin: ai_detected` + preuve (source, page, bbox) : l'éditeur peut afficher la zone du plan d'origine.

## Ce qui n'est PAS décidé / reste à faire
Bibliothèque de rendu (SVG natif suffit pour M1) · gestion des niveaux multiples · pièces non rectangulaires (évolution du moteur, nouvel ADR) · accessibilité clavier du dessin · performance sur grands plans (à mesurer) · aucune reconnaissance IA n'existe.

## Ordre d'implémentation proposé
1. Rétablir + lots d'opérations (noyau/session, testés). 2. Outil sélection + panneau de liens (lecture). 3. Création/déplacement de murs sur grille avec Draft et validation. 4. Ouvertures. 5. Plan importé + calibration manuelle. 6. Propositions IA (quand un détecteur existera).

## État d'implémentation (étape 10)
| Élément | État | Où |
|---|---|---|
| Groupes d'opérations atomiques, annuler/rétablir, vérification d'intégrité | ✅ | `src/core/ops/history.ts` (+ `oplog.ts`, inverses exacts avec position et provenance) |
| Commandes geste → opérations (mur, déplacement, propriétés, pièce rectangulaire, pièce depuis murs, ouverture, suppression en cascade) | ✅ | `src/core/ops/commands.ts` |
| Contrôles géométriques de brouillon (largeur > mur, doublons, épaisseur ≥ longueur…) | ✅ | `src/core/model/checks.ts` |
| Historique enregistré dans `.btpx` (`project.json` : `oplog` complet + `history`), restauré et vérifié à la réouverture | ✅ | `src/adapters/btpx.ts`, `apps/desktop/src/session.ts` |
| Brouillon → aperçu sur copie (validation + recalcul + comparaison) → validation → recalcul | ✅ | `session.preview/commit`, `editor/PlanEditor.tsx` |
| Grille, aimantation, échelle, zoom/panoramique, coordonnées en mètres | ✅ | `editor/viewport.ts` |
| Sélection, création (mur, pièce rectangulaire, ouverture), déplacement de point, suppression, dimensions saisies | ✅ | `PlanEditor.tsx` |
| Liens objet → quantités → ouvrages → lignes + « Pourquoi ? » | ✅ | `editor/links.ts` |
| Plan importé + calibration manuelle dans l'éditeur | ✖ | contrats seulement (ADR-0015) |
| Pièces non rectangulaires, niveaux multiples, dalles/toitures dans l'éditeur | ✖ | limite du moteur |
| Position des ouvertures sur le mur | ✖ | le modèle n'a pas de position : marqueur schématique au milieu du mur |
| Rétablissement persistant (pile « rétablir » après réouverture) | ✅ restaurée si cohérente ; sinon écartée avec avertissement | `restoreHistory` |
**Décisions simples prises** : SVG (pas de Canvas) ; un seul niveau affiché (le premier) ; un brouillon est perdu quand on change d'onglet (il n'est pas persistant) ; supprimer un mur supprime les pièces dont il est un côté (annulable) ; l'épaisseur d'un nouveau mur est **obligatoire** (jamais de défaut caché), la hauteur vient du niveau (hypothèse référencée) ou de la saisie.
