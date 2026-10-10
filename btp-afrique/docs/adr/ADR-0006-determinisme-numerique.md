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

## Addendum M0 — Garantie de reproductibilité (définie précisément)
Le « bit à bit » n'est ni nécessaire ni réaliste partout. La garantie est donc définie **par niveau** :

| Niveau | Objets | Garantie | Mécanisme | Test |
|---|---|---|---|---|
| **R1 — Exacte** | modèle, hypothèses, `GeoQuantity`, `QuantitySet`, `Estimate`, `DocumentModel`, manifeste, fichiers du bundle | mêmes entrées ⇒ **mêmes octets canoniques ⇒ même SHA‑256**, sur tout processus et toute plateforme | `BigInt` exact, aucun flottant, racine entière, arrondis explicites, JSON canonique (clés triées), SHA‑256 pur TS | `tests/reproducibility`, `tests/golden`, inter‑processus |
| **R2 — Contenu** | rendus Markdown/PDF/XLSX | les **chiffres** sont ceux du `DocumentModel` ; les octets d'un PDF peuvent différer (polices, métadonnées) | le rendu ne calcule rien | `tests/documents` (rendu) |
| **R3 — Enregistrée** | sorties de perception IA (V1+) | **non rejouables** à l'identique d'un matériel à l'autre ; la garantie commence au **modèle accepté** | proposition → décision humaine → modèle versionné | T‑AI‑07 (M1) |

**Ce qui est inclus dans une empreinte de contenu** : entrées, règles (+ hash), paramètres, résultats. **Ce qui n'y est pas** : l'empreinte du code du moteur (`engine.sourceHash`), enregistrée à part dans le bundle — un moteur correct, quelle que soit sa build, produit les mêmes empreintes ; une divergence est un bogue détecté par les `golden`.
**Évolution volontaire du moteur** : un changement de résultat légitime met à jour `tests/golden/hashes.json` (`UPDATE_GOLDEN=1`), avec entrée de changelog et, si l'API change, incrément d'`engineApi`.
**Portée vérifiée en M0** : inter‑processus Node (même OS). Windows/macOS/WASM : à ajouter en CI dès que ces cibles existent (T‑ENG‑03 reste ouvert pour ces plateformes).
