# ADR-0006 — Déterminisme numérique

- Statut : **Proposé** (v0.3, issu de l'audit) — paramètres à confirmer par prototype en M0
- Liens : ADR-0001 (R5) · `ARCHITECTURE.md` §3.1, §3.4, §4 · tests T‑ENG‑03, T‑MKT‑02

## Contexte
L'architecture promet « même entrée → même sortie, bit à bit » et un test de rejeu par hash. Or une géométrie en flottants et l'usage de fonctions trigonométriques (`Math.sin`, `Math.cos`…) ne garantissent pas des résultats identiques entre moteurs et plateformes (la précision de ces fonctions est dépendante de l'implémentation). Le « bit à bit » n'était donc pas démontrable.

## Décision
1. **Coordonnées en entiers** en virgule fixe (unité de base proposée : 0,1 mm), stockées telles quelles dans le modèle.
2. **Grandeurs dérivées en décimal à précision arbitraire** (longueurs, aires, volumes, quantités), avec contexte d'arrondi explicite et unique.
3. **Aucune trigonométrie flottante dans l'étage 1.** Longueur = racine décimale de la somme des carrés ; pentes exprimées en rapport montée/portée (surface développée = surface en plan × √(portée² + montée²) / portée) ; angles éventuels par rationnels ou par table déterministe.
4. **Précision et racine carrée** : précision fixée (nombre de chiffres significatifs) et mode d'arrondi déclaré dans la spécification du moteur ; la racine est calculée par l'implémentation décimale (même résultat partout).
5. **Sérialisation canonique** (ordre des clés, représentation décimale normalisée) avant hachage.
6. **Traçabilité de la version** : chaque évaluation enregistre `engine.version` et `engine.hash` ; un changement de version du moteur est un événement visible (re‑chiffrage explicite, jamais silencieux).
7. **Test** : T‑ENG‑03 compare les empreintes sur Windows, Linux, macOS et WASM dès M0 ; échec = bloquant.

## Conséquences
- (+) Le « bit à bit » devient vérifiable ; les documents émis sont rejouables (T‑TRC‑02).
- (−) Coût de performance de l'arithmétique décimale ; à mesurer (objectif M0 : pas de goulot sur des projets R+1 ; sinon optimisation ciblée, jamais retour aux flottants dans l'étage 1).
- (−) Courbes (murs courbes, V1) : discrétisation déterministe à spécifier (ADR ultérieur).

## Alternatives écartées
- Flottants IEEE + tolérance : empêche l'égalité par hash.
- Rust/WASM pour toute la géométrie : n'élimine pas le choix de représentation ; envisageable si un goulot est mesuré.
