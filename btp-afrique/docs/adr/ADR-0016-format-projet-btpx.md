# ADR-0016 — Format de projet `.btpx`

- Statut : **Accepté pour M0 (conteneur logique)** (implémenté : `src/core/project/bundle.ts`, adaptateur `fs`)
- Liens : ADR-0007, ADR-0020 · REQ-13, REQ-21

## Décision
1. **Contenu** : fichiers JSON **canoniques** — `model`, `assumptions`, `taxonomy`, `binding`, `takeoff`, `quantity-set`, `estimate`, `documents/*`, et `packs/<id>@<version>.resolved.json` (**pack résolu embarqué**, PriceBook compris) — plus `manifest.json` : `{format, formatVersion, engine, dataClass, files: {path: {sha256, bytes}}, roots}`.
2. **Autonomie** : un projet est **rouvrable, vérifiable et recalculable hors ligne, sans pack installé** (`verifyBundle` : empreintes de fichiers + recalcul intégral + résolution de chaque ligne de chaque document).
3. **Intégrité** : fichier modifié, manquant ou non déclaré ⇒ échec ; falsification cohérente des empreintes de fichiers ⇒ détectée par le recalcul et les hash croisés.
4. **Marquage des données** : `dataClass` (`synthetic/test` | `commercial`) en tête de manifeste.
5. **Conteneur physique** : en M0, un **dossier** ; le paquet monofichier (ZIP déterministe : méthode « store », horodatages fixes) est un adaptateur de stockage à ajouter en M1 sans changer le contenu logique ni les empreintes.
6. **Chiffrement au repos et plans sources** (blobs) : hors périmètre M0 (REQ‑14, M1).
7. **Migrations** : `formatVersion` explicite ; lecture d'une version inconnue = refus.

## Conséquences
(+) Partage par clé USB/WhatsApp sans dépendance. (−) Taille accrue par l'embarquement des paquets (rétention : OD‑20).
