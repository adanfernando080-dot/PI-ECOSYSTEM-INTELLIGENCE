# Quand utiliser Lovable (ou un outil de design d'interface) — et quoi lui transmettre

## État
Une interface **fonctionnelle minimale** existe déjà (`apps/desktop`, React + Vite) et fonctionne sur le moteur réel : elle sert de **référence comportementale**. Elle est volontairement sobre (tableaux, formulaires, un plan SVG en lecture). Rien n'oblige à passer par Lovable pour avancer ; il devient utile pour la **qualité d'usage et l'esthétique**, pas pour la logique.

## Règle d'or
Lovable (ou tout générateur d'UI) ne reçoit **jamais** le moteur à réécrire. Il redessine **les composants de présentation** ; les données viennent de `apps/desktop/src/viewmodel.ts` (vues déjà calculées) et les actions de `session.ts`/`HostApi`. Le moteur reste testé, déterministe et indépendant.

## Quand l'utiliser (déclencheurs)
1. **Maintenant, si vous voulez** : refonte visuelle des écrans existants (navigation, hiérarchie, densité des tableaux, thème clair/sombre, mobile/tablette) — faible risque car la logique est figée par `npm run e2e` (46 vérifications sur des `data-testid`).
2. **Avant la première démonstration à un professionnel du BTP** : cheminement « créer un projet → plan → hypothèses → DQE → devis ».
3. **Quand l'éditeur de plan 2D sera spécifié** (placement/édition de murs, calibration d'échelle, validation des propositions IA) : c'est le plus gros chantier UX ; à faire après le choix de la bibliothèque graphique (Canvas/SVG) et avec des vrais plans.

## Quoi lui transmettre
- Ce dépôt (ou le dossier `apps/desktop/`) en lecture ; **interdit de modifier** `src/core`, `src/adapters`, `market-packs`.
- Le contrat d'interface : types de `viewmodel.ts` (lignes de tableaux), `session.ts` (actions pures), `host.ts` (`HostApi`), et la liste des `data-testid` utilisés par `apps/desktop/e2e/e2e.ts` (à conserver à l'identique).
- Les captures de `apps/desktop/e2e/screenshots/` (état actuel) et la liste des écrans : Accueil, Marché, Modèle, Hypothèses, Métré, Prix, Chiffrage, Documents, Plans & IA, Historique.
- Principes UX non négociables : bandeau permanent « données synthétiques » quand le pack est `synthetic/test` ; **jamais** de valeur inventée (champ « non spécifié » bloquant visible) ; bouton « Pourquoi ? » partout où il y a un chiffre ; hypothèses *proposées* visuellement distinctes des *confirmées* ; états hors ligne ; français d'abord, textes dans des fichiers de libellés (pas de texte dans la logique) ; accessibilité (contraste, clavier).
- Public cible et contraintes : métreurs/conducteurs de travaux, ordinateurs modestes, connexion intermittente ; écrans denses mais lisibles ; impression/PDF prioritaire.
- Critère de réception : `npm run ui:typecheck`, `npm test`, `npm run e2e` passent ; aucun terme de marché dans l'UI (test `tests/ui`).

## Ce qu'il ne faut PAS lui demander
Calculs, arrondis, prix, taxes, vérification de traçabilité, format de fichier, exports : tout cela est dans le moteur et ses adaptateurs.
