> ⚠ **DONNÉES SYNTHÉTIQUES / SYNTHETIC TEST DATA — NE PAS UTILISER COMME PRIX OU QUANTITÉS RÉELS**

# Devis — N° DEV-2026-0001

Date : 2026-10-08 · Statut : **final** · Gabarit : tpl.devis.fr (fr)

**Émetteur** : ENTREPRISE DE TEST — IFU 000-TEST · RCCM —
**Client** : CLIENT DE TEST · **Chantier** : Chantier synthétique · Validité : 30 j

## LOT01 — Gros œuvre

| N° | Désignation | U | Quantité | Prix unitaire | Montant |
|---|---|---|---:|---:|---:|
| 1.1 | Dalle en béton armé (estimation paramétrique) _(low_confidence_price, parametric_structural, price_from_parent_zone, stale_price)_ | m3 | 6.1 | 184 301 XOF | 1 124 236 XOF |
| 1.2 | Maçonnerie de blocs creux de 10 cm (cloisons) | m2 | 23.22 | 7 657 XOF | 177 796 XOF |
| 1.3 | Maçonnerie de blocs creux de 20 cm | m2 | 77.22 | 9 810 XOF | 757 528 XOF |
| | **Sous-total du lot** | | | | **2 059 560 XOF** |

## LOT02 — Enduits et revêtements

| N° | Désignation | U | Quantité | Prix unitaire | Montant |
|---|---|---|---:|---:|---:|
| 2.1 | Faïence murale | m2 | 28.95 | 10 965 XOF | 317 437 XOF |
| 2.2 | Carrelage de sol | m2 | 44.38 | 11 876 XOF | 527 057 XOF |
| 2.3 | Enduit extérieur au mortier de ciment | m2 | 77.22 | 2 590 XOF | 200 000 XOF |
| 2.4 | Enduit intérieur au mortier de ciment | m2 | 117.96 | 2 393 XOF | 282 278 XOF |
| 2.5 | Peinture murale en émulsion | m2 | 89.01 | 906 XOF | 80 643 XOF |
| 2.6 | Peinture de plafond en émulsion | m2 | 44.38 | 992 XOF | 44 025 XOF |
| | **Sous-total du lot** | | | | **1 451 440 XOF** |

## LOT03 — Menuiseries

| N° | Désignation | U | Quantité | Prix unitaire | Montant |
|---|---|---|---:|---:|---:|
| 3.1 | Fenêtre aluminium 120×120, pose comprise | u | 3 | 77 246 XOF | 231 738 XOF |
| 3.2 | Fenêtre aluminium 60×60, pose comprise | u | 1 | 33 018 XOF | 33 018 XOF |
| 3.3 | Porte bois 100×210, pose comprise | u | 1 | 109 155 XOF | 109 155 XOF |
| 3.4 | Porte bois 90×210, pose comprise | u | 2 | 90 675 XOF | 181 350 XOF |
| | **Sous-total du lot** | | | | **555 261 XOF** |

## LOT04 — Couverture

| N° | Désignation | U | Quantité | Prix unitaire | Montant |
|---|---|---|---:|---:|---:|
| 4.1 | Couverture en tôle | m2 | 53.08 | 6 936 XOF | 368 163 XOF |
| | **Sous-total du lot** | | | | **368 163 XOF** |

## TOTAL

- Total des postes : 4 434 424 XOF
- TVA (taux de TEST) : 798 196 XOF (taxe)
- **Total HT** : 4 434 424 XOF
- **Total TTC** : 5 232 620 XOF

## Avis

- DONNÉES SYNTHÉTIQUES / SYNTHETIC TEST DATA — NE PAS UTILISER COMME PRIX OU QUANTITÉS RÉELS
- Poste en estimation paramétrique : validation par un ingénieur / un professionnel qualifié requise avant toute utilisation.
- 2 valeur(s) détectée(s) par IA non revue(s) individuellement (voir annexe).

## Annexe de traçabilité

- Hypothèses utilisées : A-01 level.clearHeight=3.00 m [confirmed] (DONNÉE DE TEST — hauteur libre lue sur la coupe synthétique) ; A-02 partition.system=masonry.block.hollow [confirmed] (DONNÉE DE TEST — nature des cloisons non cotée sur le plan) ; A-03 partition.thickness=0.10 m [confirmed] (DONNÉE DE TEST — épaisseur des cloisons non cotée sur le plan)
- Valeurs IA non revues : W-04.height (batch_accepted, confiance 0.72) ; W-04.width (batch_accepted, confiance 0.72)
- Éléments sans correspondance : aucun
- Alertes de prix : MAT.ACIER (prix périmé) ; MAT.ACIER (confiance du prix basse) ; MAT.ACIER (prix issu d'une zone parente)

## Provenance (manifeste)

```
document      doc:357309be8b85  contenu sha256:e119da89a909a497ac78ca2af4cd8774ac999fe0b7ec17634731a992e4fa1e82
manifeste     sha256:05bd310209186fe845433722ecdbb1e425bf780799e13e788ca4196da2f82b33
moteur        0.0.1-m0 (API 1)  taxonomie 1.0.0
plan          sha256:2fa4df233be47c2b3b6103f1d35a09bb1cfaedafd95ef9df51c9c9ddd83a8a84  « PLAN SYNTHÉTIQUE « house » — aucun plan réel »
modèle        sha256:9a6034b500aae0d7f963266023a7b1ea639e68954de091b073f78a23aa227db0
hypothèses    sha256:c663435cbd8344e5b3e3a3af6d603001ff2e0bd7fedfbf92feca92552a244e92
géométrie     sha256:7c2e4c5df93f6a6c2507e7a76f084d541c677a03337c516d2b52d84970d84cbf
MarketBinding mb:pack.bj:BJ-LITTORAL-COTONOU rev 1 sha256:539a654bb5e5228c57a3611e616f2aa4b62b1e182c3b342be3e7c42b8c6ee55e
pack résolu    pack.bj@0.0.1-synthetic sha256:dadf57d3e8758d63452d29f5e21e6e3b3f76fd732e5783feab981f1a337d5e2f
PriceBook     pb.bj.test sha256:d7008f95decc20db0bd76a01e88b73889ca0f72e640b311412c670b8a82888c7  zone BJ-LITTORAL-COTONOU  au 2026-10-08 (median)
métré         sha256:234ab494b7d415ebb643a61abbec98fed367935f5bf7a0db2f0674f6ba0d7c0a
estimation    sha256:303d31e939938efda427568e3b114777b75f83e1c3cbc5f306fa0c9a2afee63d
```
