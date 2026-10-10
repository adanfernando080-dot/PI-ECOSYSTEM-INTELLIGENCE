# Registre des décisions d'architecture (ADR)

| N° | Titre | Statut | Exigences servies (voir `../INDEX.md`) |
|---|---|---|---|
| [0001](ADR-0001-moteur-universel-et-contexte-marche.md) | Moteur architectural universel, contexte marché localisable | Rédigé (proposé, rév. v0.3) | REQ-18, REQ-08 |
| [0002](ADR-0002-specification-neutre-et-correspondance.md) | Spécification neutre, correspondance, métré en deux étages | Rédigé (proposé, rév. v0.3) | REQ-05, REQ-06, REQ-18 |
| [0003](ADR-0003-strategie-de-corpus-abc.md) | Corpus A / B / C, disjonction et scellement | Rédigé (proposé, rév. v0.3) | REQ-19, REQ-20 |
| [0004](ADR-0004-packs-marche.md) | Packs marché : contrat, héritage, liaison au projet | Rédigé (proposé, rév. v0.3) | REQ-08, REQ-22, REQ-24 |
| [0005](ADR-0005-hypotheses-explicites-et-etats-de-validation.md) | Hypothèses explicites et états de validation | Rédigé (proposé, v0.3) | REQ-11, REQ-25, REQ-18 |
| [0006](ADR-0006-determinisme-numerique.md) | Déterminisme numérique | Rédigé (proposé, v0.3) | REQ-05, REQ-21 |
| [0007](ADR-0007-chaine-de-tracabilite-et-manifeste.md) | Chaîne de traçabilité et manifeste de provenance | Rédigé (proposé, v0.3) | REQ-21, REQ-11, REQ-13 |
| [0008](ADR-0008-genericite-des-packs.md) | Généricité des packs : zones, structure de coût, documents | Rédigé (proposé, v0.3) | REQ-22, REQ-09, REQ-07 |
| [0009](ADR-0009-oplog-et-revisions.md) | Journal d'opérations (oplog), révisions et annulation | Accepté pour M0 (implémenté) | REQ-13, REQ-15, REQ-26 |
| 0010 | Tauri vs Electron | À rédiger (M1, avant l'application) | REQ-01 |
| [0011](ADR-0011-nombres-unites-arrondis.md) | Unités, décimaux, arrondis et ordre de calcul | Accepté pour M0 (implémenté) | REQ-05, REQ-07, REQ-09 |
| [0012](ADR-0012-format-declaratif-des-packs.md) | Format déclaratif des packs : vocabulaire fermé « declarative-1 » | Accepté pour M0 (implémenté) | REQ-05, REQ-08, REQ-22 |
| 0013 | Séparation Quantités / Prix | Absorbé par ADR-0002, ADR-0007 et le test T-PRC-03 (pas d'ADR distinct) | REQ-06 |
| 0014 | Schéma de provenance / confiance et calibration | À rédiger (M1) | REQ-11 |
| 0015 | Contrat `AiProposal` et ports IA | À rédiger (M1) | REQ-03, REQ-20 |
| [0016](ADR-0016-format-projet-btpx.md) | Format de projet `.btpx` (paquets embarqués) | Accepté pour M0 (conteneur logique) | REQ-13, REQ-21 |
| [0017](ADR-0017-politique-ia-local-cloud-consentement.md) | Politique IA : essentiel hors ligne, IA locale ou cloud optionnelle, consentement | Accepté (principe) ; IA : M1/M2 | REQ-01, REQ-14, REQ-20, REQ-28 |
| 0018 | Licence hors ligne | À rédiger (M3) | REQ-23 |
| [0019](ADR-0019-gouvernance-taxonomie-neutre.md) | Gouvernance de la taxonomie neutre de spécification | Accepté pour M0 | REQ-18 |
| [0020](ADR-0020-paquets-signes-et-retention.md) | Paquets signés, intégrité et rétention | Accepté pour M0 (implémenté) | REQ-24 |
