# Explications déterministes (pack.bj)

> DONNÉES SYNTHÉTIQUES / SYNTHETIC TEST DATA — NE PAS UTILISER COMME PRIX OU QUANTITÉS RÉELS

### el:OUV.DALLE.BA

Pourquoi 6.1 m3 pour « Dalle en béton armé (estimation paramétrique) » (OUV.DALLE.BA@1.0.0) ?
1. La quantité d'ouvrage est la somme de 1 contribution(s) = 6.1008 m3, arrondie à 2 décimale(s) (half_up) : 6.1 m3.
2.1 slab DAL1 (classe slab.reinforced.concrete) → correspondance SM.DALLE@1.0.0 ; base « slab.volume » ; méthode MM.TEST.NET@1.0.0 (aucune) : 6.1008 m3.
      geo:sl-1:slab.volume = 6.1008 m3  [règle geom.slab.volume@1.0.0]
        - 50.84 × 0.12 = 6.1008 m3
          geo:sl-1:slab.area = 50.84 m2  [règle geom.slab.area@1.0.0]
            - formule du lacet (entiers 0,1 mm) = 50.84 m2
            · contour = S1,S2,S3,S4 - (sl-1.outlineNodeIds, origine undefined)
        · épaisseur = 0.12 m (sl-1.thickness, origine user_entered, accepted)

Prix unitaire 184301 XOF/m3 pour « Dalle en béton armé (estimation paramétrique) » (valeur exacte avant arrondi : 184301.04).
  - MAT.CIMENT « Ciment, sac de 50 kg [TEST] » : 7.21 sac/m3 × 6000 (minor) = 43260  [entrée pe:bj:MAT.CIMENT:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.SABLE « Sable [TEST] » : 0.4725 m3/m3 × 12000 (minor) = 5670  [entrée pe:bj:MAT.SABLE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.GRAVIER « Gravier [TEST] » : 0.8925 m3/m3 × 18000 (minor) = 16065  [entrée pe:bj:MAT.GRAVIER:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.ACIER « Acier HA [TEST] » : 84 kg/m3 × 900 (minor) = 75600  [entrée pe:bj:MAT.ACIER:BJ, zone BJ, 2026-02-01, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.40, synthetic/test]
  - MO.MACON « Maçon [TEST] » : 6 h/m3 × 1500 (minor) = 9000  [entrée pe:bj:MO.MACON:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 149595
  = Frais généraux : 17951.4 (taux 0.12 sur direct)
  = Marge : 16754.64 (taux 0.1 sur direct+overheads)
  Montant de ligne = 6.1 × 184301 = 1124236 XOF.

### el:OUV.MAC.BLOC10

Pourquoi 23.22 m2 pour « Maçonnerie de blocs creux de 10 cm (cloisons) » (OUV.MAC.BLOC10@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 23.22 m2, arrondie à 2 décimale(s) (half_up) : 23.22 m2.
2.1 wall W08 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC10@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 8.61 m2.
      geo:w-08:wall.area.net = 8.61 m2  [règle geom.wall.area.net@1.0.0]
        - 10.5 − 1.89 = 8.61 m2
          geo:w-08:wall.area.gross = 10.5 m2  [règle geom.wall.area.gross@1.0.0]
            - 3.5 × 3 = 10.5 m2
              geo:w-08:wall.length.axis = 3.5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 12.25 m2
                - racine(dx² + dy²) [échelle 8] = 3.5 m
                - arrondi demi-haut à 6 décimales = 3.5 m
                · dx = 0 m (w-08.startNode→endNode, origine undefined)
                · dy = 3.5 m (w-08.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-08:wall.openings.area = 1.89 m2  [règle geom.wall.openings.area@1.0.0]
            - 1.89 = 1.89 m2
              geo:o-d2:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d2.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d2.height, origine user_entered, accepted)
2.2 wall W09 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC10@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 5.61 m2.
      geo:w-09:wall.area.net = 5.61 m2  [règle geom.wall.area.net@1.0.0]
        - 7.5 − 1.89 = 5.61 m2
          geo:w-09:wall.area.gross = 7.5 m2  [règle geom.wall.area.gross@1.0.0]
            - 2.5 × 3 = 7.5 m2
              geo:w-09:wall.length.axis = 2.5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 6.25 m2
                - racine(dx² + dy²) [échelle 8] = 2.5 m
                - arrondi demi-haut à 6 décimales = 2.5 m
                · dx = 0 m (w-09.startNode→endNode, origine undefined)
                · dy = 2.5 m (w-09.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-09:wall.openings.area = 1.89 m2  [règle geom.wall.openings.area@1.0.0]
            - 1.89 = 1.89 m2
              geo:o-d3:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d3.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d3.height, origine user_entered, accepted)
2.3 wall W10 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC10@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 9 m2.
      geo:w-10:wall.area.net = 9 m2  [règle geom.wall.area.net@1.0.0]
        - 9 − 0 = 9 m2
          geo:w-10:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
            - 3 × 3 = 9 m2
              geo:w-10:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 9 m2
                - racine(dx² + dy²) [échelle 8] = 3 m
                - arrondi demi-haut à 6 décimales = 3 m
                · dx = 3 m (w-10.startNode→endNode, origine undefined)
                · dy = 0 m (w-10.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-10:wall.openings.area = 0 m2  [règle geom.wall.openings.area@1.0.0]
            - (aucune ouverture) = 0 m2

Prix unitaire 7657 XOF/m2 pour « Maçonnerie de blocs creux de 10 cm (cloisons) » (valeur exacte avant arrondi : 7656.8184).
  - MAT.BLOC.10 « Bloc creux 10 cm [TEST] » : 13.125 u/m2 × 350 (minor) = 4593.75  [entrée pe:bj:MAT.BLOC.10:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.CIMENT « Ciment, sac de 50 kg [TEST] » : 0.0721 sac/m2 × 6000 (minor) = 432.6  [entrée pe:bj:MAT.CIMENT:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.SABLE « Sable [TEST] » : 0.01155 m3/m2 × 12000 (minor) = 138.6  [entrée pe:bj:MAT.SABLE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.MACON « Maçon [TEST] » : 0.7 h/m2 × 1500 (minor) = 1050  [entrée pe:bj:MO.MACON:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 6214.95
  = Frais généraux : 745.794 (taux 0.12 sur direct)
  = Marge : 696.0744 (taux 0.1 sur direct+overheads)
  Montant de ligne = 23.22 × 7657 = 177796 XOF.

### el:OUV.MAC.BLOC20

Pourquoi 77.22 m2 pour « Maçonnerie de blocs creux de 20 cm » (OUV.MAC.BLOC20@1.0.0) ?
1. La quantité d'ouvrage est la somme de 7 contribution(s) = 77.22 m2, arrondie à 2 décimale(s) (half_up) : 77.22 m2.
2.1 wall W01 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC20@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 11.46 m2.
      geo:w-01:wall.area.net = 11.46 m2  [règle geom.wall.area.net@1.0.0]
        - 15 − 3.54 = 11.46 m2
          geo:w-01:wall.area.gross = 15 m2  [règle geom.wall.area.gross@1.0.0]
            - 5 × 3 = 15 m2
              geo:w-01:wall.length.axis = 5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 25 m2
                - racine(dx² + dy²) [échelle 8] = 5 m
                - arrondi demi-haut à 6 décimales = 5 m
                · dx = 5 m (w-01.startNode→endNode, origine undefined)
                · dy = 0 m (w-01.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-01:wall.openings.area = 3.54 m2  [règle geom.wall.openings.area@1.0.0]
            - 2.1 + 1.44 = 3.54 m2
              geo:o-d1:opening.area = 2.1 m2  [règle geom.opening.area@1.0.0]
                - 1 × 2.1 = 2.1 m2
                · largeur = 1 m (o-d1.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d1.height, origine user_entered, accepted)
              geo:o-w1:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w1.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w1.height, origine user_entered, accepted)
2.2 wall W02 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC20@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 9 m2.
      geo:w-02:wall.area.net = 9 m2  [règle geom.wall.area.net@1.0.0]
        - 9 − 0 = 9 m2
          geo:w-02:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
            - 3 × 3 = 9 m2
              geo:w-02:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 9 m2
                - racine(dx² + dy²) [échelle 8] = 3 m
                - arrondi demi-haut à 6 décimales = 3 m
                · dx = 3 m (w-02.startNode→endNode, origine undefined)
                · dy = 0 m (w-02.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-02:wall.openings.area = 0 m2  [règle geom.wall.openings.area@1.0.0]
            - (aucune ouverture) = 0 m2
2.3 wall W03 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC20@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 9.06 m2.
      geo:w-03:wall.area.net = 9.06 m2  [règle geom.wall.area.net@1.0.0]
        - 10.5 − 1.44 = 9.06 m2
          geo:w-03:wall.area.gross = 10.5 m2  [règle geom.wall.area.gross@1.0.0]
            - 3.5 × 3 = 10.5 m2
              geo:w-03:wall.length.axis = 3.5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 12.25 m2
                - racine(dx² + dy²) [échelle 8] = 3.5 m
                - arrondi demi-haut à 6 décimales = 3.5 m
                · dx = 0 m (w-03.startNode→endNode, origine undefined)
                · dy = 3.5 m (w-03.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-03:wall.openings.area = 1.44 m2  [règle geom.wall.openings.area@1.0.0]
            - 1.44 = 1.44 m2
              geo:o-w3:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w3.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w3.height, origine user_entered, accepted)
2.4 wall W04 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC20@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 7.14 m2.
      geo:w-04:wall.area.net = 7.14 m2  [règle geom.wall.area.net@1.0.0]
        - 7.5 − 0.36 = 7.14 m2
          geo:w-04:wall.area.gross = 7.5 m2  [règle geom.wall.area.gross@1.0.0]
            - 2.5 × 3 = 7.5 m2
              geo:w-04:wall.length.axis = 2.5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 6.25 m2
                - racine(dx² + dy²) [échelle 8] = 2.5 m
                - arrondi demi-haut à 6 décimales = 2.5 m
                · dx = 0 m (w-04.startNode→endNode, origine undefined)
                · dy = 2.5 m (w-04.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-04:wall.openings.area = 0.36 m2  [règle geom.wall.openings.area@1.0.0]
            - 0.36 = 0.36 m2
              geo:o-w4:opening.area = 0.36 m2  [règle geom.opening.area@1.0.0]
                - 0.6 × 0.6 = 0.36 m2
                · largeur = 0.6 m (o-w4.width, origine ai_detected, batch_accepted, confiance 0.72)
                · hauteur = 0.6 m (o-w4.height, origine ai_detected, batch_accepted, confiance 0.72)
2.5 wall W05 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC20@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 9 m2.
      geo:w-05:wall.area.net = 9 m2  [règle geom.wall.area.net@1.0.0]
        - 9 − 0 = 9 m2
          geo:w-05:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
            - 3 × 3 = 9 m2
              geo:w-05:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 9 m2
                - racine(dx² + dy²) [échelle 8] = 3 m
                - arrondi demi-haut à 6 décimales = 3 m
                · dx = 3 m (w-05.startNode→endNode, origine undefined)
                · dy = 0 m (w-05.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-05:wall.openings.area = 0 m2  [règle geom.wall.openings.area@1.0.0]
            - (aucune ouverture) = 0 m2
2.6 wall W06 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC20@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 13.56 m2.
      geo:w-06:wall.area.net = 13.56 m2  [règle geom.wall.area.net@1.0.0]
        - 15 − 1.44 = 13.56 m2
          geo:w-06:wall.area.gross = 15 m2  [règle geom.wall.area.gross@1.0.0]
            - 5 × 3 = 15 m2
              geo:w-06:wall.length.axis = 5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 25 m2
                - racine(dx² + dy²) [échelle 8] = 5 m
                - arrondi demi-haut à 6 décimales = 5 m
                · dx = 5 m (w-06.startNode→endNode, origine undefined)
                · dy = 0 m (w-06.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-06:wall.openings.area = 1.44 m2  [règle geom.wall.openings.area@1.0.0]
            - 1.44 = 1.44 m2
              geo:o-w2:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w2.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w2.height, origine user_entered, accepted)
2.7 wall W07 (classe masonry.block.hollow) → correspondance SM.MAC.BLOC20@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 18 m2.
      geo:w-07:wall.area.net = 18 m2  [règle geom.wall.area.net@1.0.0]
        - 18 − 0 = 18 m2
          geo:w-07:wall.area.gross = 18 m2  [règle geom.wall.area.gross@1.0.0]
            - 6 × 3 = 18 m2
              geo:w-07:wall.length.axis = 6 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 36 m2
                - racine(dx² + dy²) [échelle 8] = 6 m
                - arrondi demi-haut à 6 décimales = 6 m
                · dx = 0 m (w-07.startNode→endNode, origine undefined)
                · dy = 6 m (w-07.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-07:wall.openings.area = 0 m2  [règle geom.wall.openings.area@1.0.0]
            - (aucune ouverture) = 0 m2
3. Attention : plancher de confiance 0.72 (limité par o-w4.width).

Prix unitaire 9810 XOF/m2 pour « Maçonnerie de blocs creux de 20 cm » (valeur exacte avant arrondi : 9810.4776).
  - MAT.BLOC.20 « Bloc creux 20 cm [TEST] » : 13.125 u/m2 × 450 (minor) = 5906.25  [entrée pe:bj:MAT.BLOC.20:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.CIMENT « Ciment, sac de 50 kg [TEST] » : 0.10815 sac/m2 × 6000 (minor) = 648.9  [entrée pe:bj:MAT.CIMENT:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.SABLE « Sable [TEST] » : 0.017325 m3/m2 × 12000 (minor) = 207.9  [entrée pe:bj:MAT.SABLE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.MACON « Maçon [TEST] » : 0.8 h/m2 × 1500 (minor) = 1200  [entrée pe:bj:MO.MACON:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 7963.05
  = Frais généraux : 955.566 (taux 0.12 sur direct)
  = Marge : 891.8616 (taux 0.1 sur direct+overheads)
  Montant de ligne = 77.22 × 9810 = 757528 XOF.

### el:OUV.CARRELAGE.MUR

Pourquoi 28.95 m2 pour « Faïence murale » (OUV.CARRELAGE.MUR@1.0.0) ?
1. La quantité d'ouvrage est la somme de 1 contribution(s) = 28.95 m2, arrondie à 2 décimale(s) (half_up) : 28.95 m2.
2.1 space SDB (classe wall.tile.ceramic) → correspondance SM.CARR.MUR@1.0.0 ; base « space.wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 28.95 m2.
      geo:sp-sdb:space.wall.area.net = 28.95 m2  [règle geom.space.wall.area.net@1.0.0]
        - 31.2 − 2.25 = 28.95 m2
          geo:sp-sdb:space.wall.area.gross = 31.2 m2  [règle geom.space.wall.area.gross@1.0.0]
            - 10.4 × 3 = 31.2 m2
              geo:sp-sdb:space.clear.perimeter = 10.4 m  [règle geom.space.clear.perimeter@1.0.0]
                - 2 × (2.85 + 2.35) = 10.4 m
                · Δx axes = 3 m (sp-sdb.boundaryWallIds, origine undefined)
                · Δy axes = 2.5 m (sp-sdb.boundaryWallIds, origine undefined)
                · épaisseur W09 = 0.1 m (hypothèse A-03)
                · épaisseur W04 = 0.2 m (w-04.thickness, origine user_entered, accepted)
                · épaisseur W10 = 0.1 m (hypothèse A-03)
                · épaisseur W05 = 0.2 m (w-05.thickness, origine user_entered, accepted)
            · hauteur libre = 3 m (hypothèse A-01)
          geo:sp-sdb:space.wall.openings.area = 2.25 m2  [règle geom.space.wall.openings.area@1.0.0]
            - 0.36 + 1.89 = 2.25 m2
              geo:o-w4:opening.area = 0.36 m2  [règle geom.opening.area@1.0.0]
                - 0.6 × 0.6 = 0.36 m2
                · largeur = 0.6 m (o-w4.width, origine ai_detected, batch_accepted, confiance 0.72)
                · hauteur = 0.6 m (o-w4.height, origine ai_detected, batch_accepted, confiance 0.72)
              geo:o-d3:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d3.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d3.height, origine user_entered, accepted)
3. Attention : plancher de confiance 0.72 (limité par o-w4.width).

Prix unitaire 10965 XOF/m2 pour « Faïence murale » (valeur exacte avant arrondi : 10964.8).
  - MAT.CARREAU.MUR « Carreau mural [TEST] » : 1.1 m2/m2 × 5500 (minor) = 6050  [entrée pe:bj:MAT.CARREAU.MUR:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.COLLE « Colle carrelage, sac de 25 kg [TEST] » : 0.21 sac25/m2 × 5000 (minor) = 1050  [entrée pe:bj:MAT.COLLE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.CARRELEUR « Carreleur [TEST] » : 1 h/m2 × 1800 (minor) = 1800  [entrée pe:bj:MO.CARRELEUR:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 8900
  = Frais généraux : 1068 (taux 0.12 sur direct)
  = Marge : 996.8 (taux 0.1 sur direct+overheads)
  Montant de ligne = 28.95 × 10965 = 317437 XOF.

### el:OUV.CARRELAGE.SOL

Pourquoi 44.38 m2 pour « Carrelage de sol » (OUV.CARRELAGE.SOL@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 44.375 m2, arrondie à 2 décimale(s) (half_up) : 44.38 m2.
2.1 space CHA (classe floor.tile.ceramic) → correspondance SM.CARR.SOL@1.0.0 ; base « space.floor.area » ; méthode MM.TEST.NET@1.0.0 (aucune) : 9.5475 m2.
      geo:sp-cha:space.clear.area = 9.5475 m2  [règle geom.space.clear.area@1.0.0]
        - largeur libre = 3 − (0.1 + 0.2)/2 = 2.85 m
        - profondeur libre = 3.5 − (0.2 + 0.1)/2 = 3.35 m
        - 2.85 × 3.35 = 9.5475 m2
        · Δx axes = 3 m (sp-cha.boundaryWallIds, origine undefined)
        · Δy axes = 3.5 m (sp-cha.boundaryWallIds, origine undefined)
        · épaisseur W08 = 0.1 m (hypothèse A-03)
        · épaisseur W03 = 0.2 m (w-03.thickness, origine user_entered, accepted)
        · épaisseur W02 = 0.2 m (w-02.thickness, origine user_entered, accepted)
        · épaisseur W10 = 0.1 m (hypothèse A-03)
2.2 space SAL (classe floor.tile.ceramic) → correspondance SM.CARR.SOL@1.0.0 ; base « space.floor.area » ; méthode MM.TEST.NET@1.0.0 (aucune) : 28.13 m2.
      geo:sp-sal:space.clear.area = 28.13 m2  [règle geom.space.clear.area@1.0.0]
        - largeur libre = 5 − (0.2 + 0.1)/2 = 4.85 m
        - profondeur libre = 6 − (0.2 + 0.2)/2 = 5.8 m
        - 4.85 × 5.8 = 28.13 m2
        · Δx axes = 5 m (sp-sal.boundaryWallIds, origine undefined)
        · Δy axes = 6 m (sp-sal.boundaryWallIds, origine undefined)
        · épaisseur W07 = 0.2 m (w-07.thickness, origine user_entered, accepted)
        · épaisseur W08 = 0.1 m (hypothèse A-03)
        · épaisseur W09 = 0.1 m (hypothèse A-03)
        · épaisseur W01 = 0.2 m (w-01.thickness, origine user_entered, accepted)
        · épaisseur W06 = 0.2 m (w-06.thickness, origine user_entered, accepted)
2.3 space SDB (classe floor.tile.ceramic) → correspondance SM.CARR.SOL@1.0.0 ; base « space.floor.area » ; méthode MM.TEST.NET@1.0.0 (aucune) : 6.6975 m2.
      geo:sp-sdb:space.clear.area = 6.6975 m2  [règle geom.space.clear.area@1.0.0]
        - largeur libre = 3 − (0.1 + 0.2)/2 = 2.85 m
        - profondeur libre = 2.5 − (0.1 + 0.2)/2 = 2.35 m
        - 2.85 × 2.35 = 6.6975 m2
        · Δx axes = 3 m (sp-sdb.boundaryWallIds, origine undefined)
        · Δy axes = 2.5 m (sp-sdb.boundaryWallIds, origine undefined)
        · épaisseur W09 = 0.1 m (hypothèse A-03)
        · épaisseur W04 = 0.2 m (w-04.thickness, origine user_entered, accepted)
        · épaisseur W10 = 0.1 m (hypothèse A-03)
        · épaisseur W05 = 0.2 m (w-05.thickness, origine user_entered, accepted)

Prix unitaire 11876 XOF/m2 pour « Carrelage de sol » (valeur exacte avant arrondi : 11876.48).
  - MAT.CARREAU.SOL « Carreau de sol [TEST] » : 1.1 m2/m2 × 6500 (minor) = 7150  [entrée pe:bj:MAT.CARREAU.SOL:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.COLLE « Colle carrelage, sac de 25 kg [TEST] » : 0.21 sac25/m2 × 5000 (minor) = 1050  [entrée pe:bj:MAT.COLLE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.CARRELEUR « Carreleur [TEST] » : 0.8 h/m2 × 1800 (minor) = 1440  [entrée pe:bj:MO.CARRELEUR:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 9640
  = Frais généraux : 1156.8 (taux 0.12 sur direct)
  = Marge : 1079.68 (taux 0.1 sur direct+overheads)
  Montant de ligne = 44.38 × 11876 = 527057 XOF.

### el:OUV.ENDUIT.EXT

Pourquoi 77.22 m2 pour « Enduit extérieur au mortier de ciment » (OUV.ENDUIT.EXT@1.0.0) ?
1. La quantité d'ouvrage est la somme de 7 contribution(s) = 77.22 m2, arrondie à 2 décimale(s) (half_up) : 77.22 m2.
2.1 wall W01 (classe render.cementitious) → correspondance SM.ENDUIT.EXT@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 11.46 m2.
      geo:w-01:wall.area.net = 11.46 m2  [règle geom.wall.area.net@1.0.0]
        - 15 − 3.54 = 11.46 m2
          geo:w-01:wall.area.gross = 15 m2  [règle geom.wall.area.gross@1.0.0]
            - 5 × 3 = 15 m2
              geo:w-01:wall.length.axis = 5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 25 m2
                - racine(dx² + dy²) [échelle 8] = 5 m
                - arrondi demi-haut à 6 décimales = 5 m
                · dx = 5 m (w-01.startNode→endNode, origine undefined)
                · dy = 0 m (w-01.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-01:wall.openings.area = 3.54 m2  [règle geom.wall.openings.area@1.0.0]
            - 2.1 + 1.44 = 3.54 m2
              geo:o-d1:opening.area = 2.1 m2  [règle geom.opening.area@1.0.0]
                - 1 × 2.1 = 2.1 m2
                · largeur = 1 m (o-d1.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d1.height, origine user_entered, accepted)
              geo:o-w1:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w1.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w1.height, origine user_entered, accepted)
2.2 wall W02 (classe render.cementitious) → correspondance SM.ENDUIT.EXT@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 9 m2.
      geo:w-02:wall.area.net = 9 m2  [règle geom.wall.area.net@1.0.0]
        - 9 − 0 = 9 m2
          geo:w-02:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
            - 3 × 3 = 9 m2
              geo:w-02:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 9 m2
                - racine(dx² + dy²) [échelle 8] = 3 m
                - arrondi demi-haut à 6 décimales = 3 m
                · dx = 3 m (w-02.startNode→endNode, origine undefined)
                · dy = 0 m (w-02.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-02:wall.openings.area = 0 m2  [règle geom.wall.openings.area@1.0.0]
            - (aucune ouverture) = 0 m2
2.3 wall W03 (classe render.cementitious) → correspondance SM.ENDUIT.EXT@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 9.06 m2.
      geo:w-03:wall.area.net = 9.06 m2  [règle geom.wall.area.net@1.0.0]
        - 10.5 − 1.44 = 9.06 m2
          geo:w-03:wall.area.gross = 10.5 m2  [règle geom.wall.area.gross@1.0.0]
            - 3.5 × 3 = 10.5 m2
              geo:w-03:wall.length.axis = 3.5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 12.25 m2
                - racine(dx² + dy²) [échelle 8] = 3.5 m
                - arrondi demi-haut à 6 décimales = 3.5 m
                · dx = 0 m (w-03.startNode→endNode, origine undefined)
                · dy = 3.5 m (w-03.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-03:wall.openings.area = 1.44 m2  [règle geom.wall.openings.area@1.0.0]
            - 1.44 = 1.44 m2
              geo:o-w3:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w3.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w3.height, origine user_entered, accepted)
2.4 wall W04 (classe render.cementitious) → correspondance SM.ENDUIT.EXT@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 7.14 m2.
      geo:w-04:wall.area.net = 7.14 m2  [règle geom.wall.area.net@1.0.0]
        - 7.5 − 0.36 = 7.14 m2
          geo:w-04:wall.area.gross = 7.5 m2  [règle geom.wall.area.gross@1.0.0]
            - 2.5 × 3 = 7.5 m2
              geo:w-04:wall.length.axis = 2.5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 6.25 m2
                - racine(dx² + dy²) [échelle 8] = 2.5 m
                - arrondi demi-haut à 6 décimales = 2.5 m
                · dx = 0 m (w-04.startNode→endNode, origine undefined)
                · dy = 2.5 m (w-04.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-04:wall.openings.area = 0.36 m2  [règle geom.wall.openings.area@1.0.0]
            - 0.36 = 0.36 m2
              geo:o-w4:opening.area = 0.36 m2  [règle geom.opening.area@1.0.0]
                - 0.6 × 0.6 = 0.36 m2
                · largeur = 0.6 m (o-w4.width, origine ai_detected, batch_accepted, confiance 0.72)
                · hauteur = 0.6 m (o-w4.height, origine ai_detected, batch_accepted, confiance 0.72)
2.5 wall W05 (classe render.cementitious) → correspondance SM.ENDUIT.EXT@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 9 m2.
      geo:w-05:wall.area.net = 9 m2  [règle geom.wall.area.net@1.0.0]
        - 9 − 0 = 9 m2
          geo:w-05:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
            - 3 × 3 = 9 m2
              geo:w-05:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 9 m2
                - racine(dx² + dy²) [échelle 8] = 3 m
                - arrondi demi-haut à 6 décimales = 3 m
                · dx = 3 m (w-05.startNode→endNode, origine undefined)
                · dy = 0 m (w-05.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-05:wall.openings.area = 0 m2  [règle geom.wall.openings.area@1.0.0]
            - (aucune ouverture) = 0 m2
2.6 wall W06 (classe render.cementitious) → correspondance SM.ENDUIT.EXT@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 13.56 m2.
      geo:w-06:wall.area.net = 13.56 m2  [règle geom.wall.area.net@1.0.0]
        - 15 − 1.44 = 13.56 m2
          geo:w-06:wall.area.gross = 15 m2  [règle geom.wall.area.gross@1.0.0]
            - 5 × 3 = 15 m2
              geo:w-06:wall.length.axis = 5 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 25 m2
                - racine(dx² + dy²) [échelle 8] = 5 m
                - arrondi demi-haut à 6 décimales = 5 m
                · dx = 5 m (w-06.startNode→endNode, origine undefined)
                · dy = 0 m (w-06.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-06:wall.openings.area = 1.44 m2  [règle geom.wall.openings.area@1.0.0]
            - 1.44 = 1.44 m2
              geo:o-w2:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w2.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w2.height, origine user_entered, accepted)
2.7 wall W07 (classe render.cementitious) → correspondance SM.ENDUIT.EXT@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 18 m2.
      geo:w-07:wall.area.net = 18 m2  [règle geom.wall.area.net@1.0.0]
        - 18 − 0 = 18 m2
          geo:w-07:wall.area.gross = 18 m2  [règle geom.wall.area.gross@1.0.0]
            - 6 × 3 = 18 m2
              geo:w-07:wall.length.axis = 6 m  [règle geom.wall.length.axis@1.0.0]
                - dx² + dy² = 36 m2
                - racine(dx² + dy²) [échelle 8] = 6 m
                - arrondi demi-haut à 6 décimales = 6 m
                · dx = 0 m (w-07.startNode→endNode, origine undefined)
                · dy = 6 m (w-07.startNode→endNode, origine undefined)
            · hauteur = 3 m (hypothèse A-01)
          geo:w-07:wall.openings.area = 0 m2  [règle geom.wall.openings.area@1.0.0]
            - (aucune ouverture) = 0 m2
3. Attention : plancher de confiance 0.72 (limité par o-w4.width).

Prix unitaire 2590 XOF/m2 pour « Enduit extérieur au mortier de ciment » (valeur exacte avant arrondi : 2590.1568).
  - MAT.CIMENT « Ciment, sac de 50 kg [TEST] » : 0.1442 sac/m2 × 6000 (minor) = 865.2  [entrée pe:bj:MAT.CIMENT:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.SABLE « Sable [TEST] » : 0.0231 m3/m2 × 12000 (minor) = 277.2  [entrée pe:bj:MAT.SABLE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.PLATRIER « Plâtrier-enduiseur [TEST] » : 0.6 h/m2 × 1600 (minor) = 960  [entrée pe:bj:MO.PLATRIER:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 2102.4
  = Frais généraux : 252.288 (taux 0.12 sur direct)
  = Marge : 235.4688 (taux 0.1 sur direct+overheads)
  Montant de ligne = 77.22 × 2590 = 200000 XOF.

### el:OUV.ENDUIT.INT

Pourquoi 117.96 m2 pour « Enduit intérieur au mortier de ciment » (OUV.ENDUIT.INT@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 117.96 m2, arrondie à 2 décimale(s) (half_up) : 117.96 m2.
2.1 space CHA (classe render.cementitious) → correspondance SM.ENDUIT.INT@1.0.0 ; base « space.wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 33.87 m2.
      geo:sp-cha:space.wall.area.net = 33.87 m2  [règle geom.space.wall.area.net@1.0.0]
        - 37.2 − 3.33 = 33.87 m2
          geo:sp-cha:space.wall.area.gross = 37.2 m2  [règle geom.space.wall.area.gross@1.0.0]
            - 12.4 × 3 = 37.2 m2
              geo:sp-cha:space.clear.perimeter = 12.4 m  [règle geom.space.clear.perimeter@1.0.0]
                - 2 × (2.85 + 3.35) = 12.4 m
                · Δx axes = 3 m (sp-cha.boundaryWallIds, origine undefined)
                · Δy axes = 3.5 m (sp-cha.boundaryWallIds, origine undefined)
                · épaisseur W08 = 0.1 m (hypothèse A-03)
                · épaisseur W03 = 0.2 m (w-03.thickness, origine user_entered, accepted)
                · épaisseur W02 = 0.2 m (w-02.thickness, origine user_entered, accepted)
                · épaisseur W10 = 0.1 m (hypothèse A-03)
            · hauteur libre = 3 m (hypothèse A-01)
          geo:sp-cha:space.wall.openings.area = 3.33 m2  [règle geom.space.wall.openings.area@1.0.0]
            - 1.44 + 1.89 = 3.33 m2
              geo:o-w3:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w3.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w3.height, origine user_entered, accepted)
              geo:o-d2:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d2.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d2.height, origine user_entered, accepted)
2.2 space SAL (classe render.cementitious) → correspondance SM.ENDUIT.INT@1.0.0 ; base « space.wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 55.14 m2.
      geo:sp-sal:space.wall.area.net = 55.14 m2  [règle geom.space.wall.area.net@1.0.0]
        - 63.9 − 8.76 = 55.14 m2
          geo:sp-sal:space.wall.area.gross = 63.9 m2  [règle geom.space.wall.area.gross@1.0.0]
            - 21.3 × 3 = 63.9 m2
              geo:sp-sal:space.clear.perimeter = 21.3 m  [règle geom.space.clear.perimeter@1.0.0]
                - 2 × (4.85 + 5.8) = 21.3 m
                · Δx axes = 5 m (sp-sal.boundaryWallIds, origine undefined)
                · Δy axes = 6 m (sp-sal.boundaryWallIds, origine undefined)
                · épaisseur W07 = 0.2 m (w-07.thickness, origine user_entered, accepted)
                · épaisseur W08 = 0.1 m (hypothèse A-03)
                · épaisseur W09 = 0.1 m (hypothèse A-03)
                · épaisseur W01 = 0.2 m (w-01.thickness, origine user_entered, accepted)
                · épaisseur W06 = 0.2 m (w-06.thickness, origine user_entered, accepted)
            · hauteur libre = 3 m (hypothèse A-01)
          geo:sp-sal:space.wall.openings.area = 8.76 m2  [règle geom.space.wall.openings.area@1.0.0]
            - 2.1 + 1.44 + 1.89 + 1.89 + 1.44 = 8.76 m2
              geo:o-d1:opening.area = 2.1 m2  [règle geom.opening.area@1.0.0]
                - 1 × 2.1 = 2.1 m2
                · largeur = 1 m (o-d1.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d1.height, origine user_entered, accepted)
              geo:o-w1:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w1.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w1.height, origine user_entered, accepted)
              geo:o-d2:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d2.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d2.height, origine user_entered, accepted)
              geo:o-d3:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d3.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d3.height, origine user_entered, accepted)
              geo:o-w2:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w2.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w2.height, origine user_entered, accepted)
2.3 space SDB (classe render.cementitious) → correspondance SM.ENDUIT.INT@1.0.0 ; base « space.wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 28.95 m2.
      geo:sp-sdb:space.wall.area.net = 28.95 m2  [règle geom.space.wall.area.net@1.0.0]
        - 31.2 − 2.25 = 28.95 m2
          geo:sp-sdb:space.wall.area.gross = 31.2 m2  [règle geom.space.wall.area.gross@1.0.0]
            - 10.4 × 3 = 31.2 m2
              geo:sp-sdb:space.clear.perimeter = 10.4 m  [règle geom.space.clear.perimeter@1.0.0]
                - 2 × (2.85 + 2.35) = 10.4 m
                · Δx axes = 3 m (sp-sdb.boundaryWallIds, origine undefined)
                · Δy axes = 2.5 m (sp-sdb.boundaryWallIds, origine undefined)
                · épaisseur W09 = 0.1 m (hypothèse A-03)
                · épaisseur W04 = 0.2 m (w-04.thickness, origine user_entered, accepted)
                · épaisseur W10 = 0.1 m (hypothèse A-03)
                · épaisseur W05 = 0.2 m (w-05.thickness, origine user_entered, accepted)
            · hauteur libre = 3 m (hypothèse A-01)
          geo:sp-sdb:space.wall.openings.area = 2.25 m2  [règle geom.space.wall.openings.area@1.0.0]
            - 0.36 + 1.89 = 2.25 m2
              geo:o-w4:opening.area = 0.36 m2  [règle geom.opening.area@1.0.0]
                - 0.6 × 0.6 = 0.36 m2
                · largeur = 0.6 m (o-w4.width, origine ai_detected, batch_accepted, confiance 0.72)
                · hauteur = 0.6 m (o-w4.height, origine ai_detected, batch_accepted, confiance 0.72)
              geo:o-d3:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d3.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d3.height, origine user_entered, accepted)
3. Attention : plancher de confiance 0.72 (limité par o-w4.width).

Prix unitaire 2393 XOF/m2 pour « Enduit intérieur au mortier de ciment » (valeur exacte avant arrondi : 2393.0368).
  - MAT.CIMENT « Ciment, sac de 50 kg [TEST] » : 0.1442 sac/m2 × 6000 (minor) = 865.2  [entrée pe:bj:MAT.CIMENT:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MAT.SABLE « Sable [TEST] » : 0.0231 m3/m2 × 12000 (minor) = 277.2  [entrée pe:bj:MAT.SABLE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.PLATRIER « Plâtrier-enduiseur [TEST] » : 0.5 h/m2 × 1600 (minor) = 800  [entrée pe:bj:MO.PLATRIER:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 1942.4
  = Frais généraux : 233.088 (taux 0.12 sur direct)
  = Marge : 217.5488 (taux 0.1 sur direct+overheads)
  Montant de ligne = 117.96 × 2393 = 282278 XOF.

### el:OUV.PEINT.MUR

Pourquoi 89.01 m2 pour « Peinture murale en émulsion » (OUV.PEINT.MUR@1.0.0) ?
1. La quantité d'ouvrage est la somme de 2 contribution(s) = 89.01 m2, arrondie à 2 décimale(s) (half_up) : 89.01 m2.
2.1 space CHA (classe paint.emulsion) → correspondance SM.PEINT.MUR@1.0.0 ; base « space.wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 33.87 m2.
      geo:sp-cha:space.wall.area.net = 33.87 m2  [règle geom.space.wall.area.net@1.0.0]
        - 37.2 − 3.33 = 33.87 m2
          geo:sp-cha:space.wall.area.gross = 37.2 m2  [règle geom.space.wall.area.gross@1.0.0]
            - 12.4 × 3 = 37.2 m2
              geo:sp-cha:space.clear.perimeter = 12.4 m  [règle geom.space.clear.perimeter@1.0.0]
                - 2 × (2.85 + 3.35) = 12.4 m
                · Δx axes = 3 m (sp-cha.boundaryWallIds, origine undefined)
                · Δy axes = 3.5 m (sp-cha.boundaryWallIds, origine undefined)
                · épaisseur W08 = 0.1 m (hypothèse A-03)
                · épaisseur W03 = 0.2 m (w-03.thickness, origine user_entered, accepted)
                · épaisseur W02 = 0.2 m (w-02.thickness, origine user_entered, accepted)
                · épaisseur W10 = 0.1 m (hypothèse A-03)
            · hauteur libre = 3 m (hypothèse A-01)
          geo:sp-cha:space.wall.openings.area = 3.33 m2  [règle geom.space.wall.openings.area@1.0.0]
            - 1.44 + 1.89 = 3.33 m2
              geo:o-w3:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w3.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w3.height, origine user_entered, accepted)
              geo:o-d2:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d2.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d2.height, origine user_entered, accepted)
2.2 space SAL (classe paint.emulsion) → correspondance SM.PEINT.MUR@1.0.0 ; base « space.wall.area » ; méthode MM.TEST.NET@1.0.0 (toutes les ouvertures déduites) : 55.14 m2.
      geo:sp-sal:space.wall.area.net = 55.14 m2  [règle geom.space.wall.area.net@1.0.0]
        - 63.9 − 8.76 = 55.14 m2
          geo:sp-sal:space.wall.area.gross = 63.9 m2  [règle geom.space.wall.area.gross@1.0.0]
            - 21.3 × 3 = 63.9 m2
              geo:sp-sal:space.clear.perimeter = 21.3 m  [règle geom.space.clear.perimeter@1.0.0]
                - 2 × (4.85 + 5.8) = 21.3 m
                · Δx axes = 5 m (sp-sal.boundaryWallIds, origine undefined)
                · Δy axes = 6 m (sp-sal.boundaryWallIds, origine undefined)
                · épaisseur W07 = 0.2 m (w-07.thickness, origine user_entered, accepted)
                · épaisseur W08 = 0.1 m (hypothèse A-03)
                · épaisseur W09 = 0.1 m (hypothèse A-03)
                · épaisseur W01 = 0.2 m (w-01.thickness, origine user_entered, accepted)
                · épaisseur W06 = 0.2 m (w-06.thickness, origine user_entered, accepted)
            · hauteur libre = 3 m (hypothèse A-01)
          geo:sp-sal:space.wall.openings.area = 8.76 m2  [règle geom.space.wall.openings.area@1.0.0]
            - 2.1 + 1.44 + 1.89 + 1.89 + 1.44 = 8.76 m2
              geo:o-d1:opening.area = 2.1 m2  [règle geom.opening.area@1.0.0]
                - 1 × 2.1 = 2.1 m2
                · largeur = 1 m (o-d1.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d1.height, origine user_entered, accepted)
              geo:o-w1:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w1.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w1.height, origine user_entered, accepted)
              geo:o-d2:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d2.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d2.height, origine user_entered, accepted)
              geo:o-d3:opening.area = 1.89 m2  [règle geom.opening.area@1.0.0]
                - 0.9 × 2.1 = 1.89 m2
                · largeur = 0.9 m (o-d3.width, origine user_entered, accepted)
                · hauteur = 2.1 m (o-d3.height, origine user_entered, accepted)
              geo:o-w2:opening.area = 1.44 m2  [règle geom.opening.area@1.0.0]
                - 1.2 × 1.2 = 1.44 m2
                · largeur = 1.2 m (o-w2.width, origine user_entered, accepted)
                · hauteur = 1.2 m (o-w2.height, origine user_entered, accepted)

Prix unitaire 906 XOF/m2 pour « Peinture murale en émulsion » (valeur exacte avant arrondi : 905.52).
  - MAT.PEINTURE « Peinture émulsion, pot de 20 l [TEST] » : 0.01375 pot20/m2 × 28000 (minor) = 385  [entrée pe:bj:MAT.PEINTURE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.PEINTRE « Peintre [TEST] » : 0.25 h/m2 × 1400 (minor) = 350  [entrée pe:bj:MO.PEINTRE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 735
  = Frais généraux : 88.2 (taux 0.12 sur direct)
  = Marge : 82.32 (taux 0.1 sur direct+overheads)
  Montant de ligne = 89.01 × 906 = 80643 XOF.

### el:OUV.PEINT.PLAFOND

Pourquoi 44.38 m2 pour « Peinture de plafond en émulsion » (OUV.PEINT.PLAFOND@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 44.375 m2, arrondie à 2 décimale(s) (half_up) : 44.38 m2.
2.1 space CHA (classe paint.emulsion) → correspondance SM.PEINT.PLAF@1.0.0 ; base « space.ceiling.area » ; méthode MM.TEST.NET@1.0.0 (aucune) : 9.5475 m2.
      geo:sp-cha:space.ceiling.area = 9.5475 m2  [règle geom.space.ceiling.area@1.0.0]
        - surface de plafond = surface libre = 9.5475 m2
          geo:sp-cha:space.clear.area = 9.5475 m2  [règle geom.space.clear.area@1.0.0]
            - largeur libre = 3 − (0.1 + 0.2)/2 = 2.85 m
            - profondeur libre = 3.5 − (0.2 + 0.1)/2 = 3.35 m
            - 2.85 × 3.35 = 9.5475 m2
            · Δx axes = 3 m (sp-cha.boundaryWallIds, origine undefined)
            · Δy axes = 3.5 m (sp-cha.boundaryWallIds, origine undefined)
            · épaisseur W08 = 0.1 m (hypothèse A-03)
            · épaisseur W03 = 0.2 m (w-03.thickness, origine user_entered, accepted)
            · épaisseur W02 = 0.2 m (w-02.thickness, origine user_entered, accepted)
            · épaisseur W10 = 0.1 m (hypothèse A-03)
2.2 space SAL (classe paint.emulsion) → correspondance SM.PEINT.PLAF@1.0.0 ; base « space.ceiling.area » ; méthode MM.TEST.NET@1.0.0 (aucune) : 28.13 m2.
      geo:sp-sal:space.ceiling.area = 28.13 m2  [règle geom.space.ceiling.area@1.0.0]
        - surface de plafond = surface libre = 28.13 m2
          geo:sp-sal:space.clear.area = 28.13 m2  [règle geom.space.clear.area@1.0.0]
            - largeur libre = 5 − (0.2 + 0.1)/2 = 4.85 m
            - profondeur libre = 6 − (0.2 + 0.2)/2 = 5.8 m
            - 4.85 × 5.8 = 28.13 m2
            · Δx axes = 5 m (sp-sal.boundaryWallIds, origine undefined)
            · Δy axes = 6 m (sp-sal.boundaryWallIds, origine undefined)
            · épaisseur W07 = 0.2 m (w-07.thickness, origine user_entered, accepted)
            · épaisseur W08 = 0.1 m (hypothèse A-03)
            · épaisseur W09 = 0.1 m (hypothèse A-03)
            · épaisseur W01 = 0.2 m (w-01.thickness, origine user_entered, accepted)
            · épaisseur W06 = 0.2 m (w-06.thickness, origine user_entered, accepted)
2.3 space SDB (classe paint.emulsion) → correspondance SM.PEINT.PLAF@1.0.0 ; base « space.ceiling.area » ; méthode MM.TEST.NET@1.0.0 (aucune) : 6.6975 m2.
      geo:sp-sdb:space.ceiling.area = 6.6975 m2  [règle geom.space.ceiling.area@1.0.0]
        - surface de plafond = surface libre = 6.6975 m2
          geo:sp-sdb:space.clear.area = 6.6975 m2  [règle geom.space.clear.area@1.0.0]
            - largeur libre = 3 − (0.1 + 0.2)/2 = 2.85 m
            - profondeur libre = 2.5 − (0.1 + 0.2)/2 = 2.35 m
            - 2.85 × 2.35 = 6.6975 m2
            · Δx axes = 3 m (sp-sdb.boundaryWallIds, origine undefined)
            · Δy axes = 2.5 m (sp-sdb.boundaryWallIds, origine undefined)
            · épaisseur W09 = 0.1 m (hypothèse A-03)
            · épaisseur W04 = 0.2 m (w-04.thickness, origine user_entered, accepted)
            · épaisseur W10 = 0.1 m (hypothèse A-03)
            · épaisseur W05 = 0.2 m (w-05.thickness, origine user_entered, accepted)

Prix unitaire 992 XOF/m2 pour « Peinture de plafond en émulsion » (valeur exacte avant arrondi : 991.76).
  - MAT.PEINTURE « Peinture émulsion, pot de 20 l [TEST] » : 0.01375 pot20/m2 × 28000 (minor) = 385  [entrée pe:bj:MAT.PEINTURE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.PEINTRE « Peintre [TEST] » : 0.3 h/m2 × 1400 (minor) = 420  [entrée pe:bj:MO.PEINTRE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 805
  = Frais généraux : 96.6 (taux 0.12 sur direct)
  = Marge : 90.16 (taux 0.1 sur direct+overheads)
  Montant de ligne = 44.38 × 992 = 44025 XOF.

### el:OUV.FEN.120

Pourquoi 3 u pour « Fenêtre aluminium 120×120, pose comprise » (OUV.FEN.120@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 3 u, arrondie à 0 décimale(s) (half_up) : 3 u.
2.1 opening W-01 (classe opening.window.casement) → correspondance SM.FEN.120@1.0.0 ; base « opening.count » ; méthode MM.TEST.NET@1.0.0 (aucune) : 1 u.
      geo:o-w1:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u
2.2 opening W-02 (classe opening.window.casement) → correspondance SM.FEN.120@1.0.0 ; base « opening.count » ; méthode MM.TEST.NET@1.0.0 (aucune) : 1 u.
      geo:o-w2:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u
2.3 opening W-03 (classe opening.window.casement) → correspondance SM.FEN.120@1.0.0 ; base « opening.count » ; méthode MM.TEST.NET@1.0.0 (aucune) : 1 u.
      geo:o-w3:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u

Prix unitaire 77246 XOF/u pour « Fenêtre aluminium 120×120, pose comprise » (valeur exacte avant arrondi : 77246.4).
  - MENU.FEN.120 « Fenêtre aluminium 120×120 [TEST] » : 1 u/u × 60000 (minor) = 60000  [entrée pe:bj:MENU.FEN.120:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.MENUISIER « Menuisier-poseur [TEST] » : 1.5 h/u × 1800 (minor) = 2700  [entrée pe:bj:MO.MENUISIER:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 62700
  = Frais généraux : 7524 (taux 0.12 sur direct)
  = Marge : 7022.4 (taux 0.1 sur direct+overheads)
  Montant de ligne = 3 × 77246 = 231738 XOF.

### el:OUV.FEN.60

Pourquoi 1 u pour « Fenêtre aluminium 60×60, pose comprise » (OUV.FEN.60@1.0.0) ?
1. La quantité d'ouvrage est la somme de 1 contribution(s) = 1 u, arrondie à 0 décimale(s) (half_up) : 1 u.
2.1 opening W-04 (classe opening.window.casement) → correspondance SM.FEN.60@1.0.0 ; base « opening.count » ; méthode MM.TEST.NET@1.0.0 (aucune) : 1 u.
      geo:o-w4:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u

Prix unitaire 33018 XOF/u pour « Fenêtre aluminium 60×60, pose comprise » (valeur exacte avant arrondi : 33017.6).
  - MENU.FEN.60 « Fenêtre aluminium 60×60 [TEST] » : 1 u/u × 25000 (minor) = 25000  [entrée pe:bj:MENU.FEN.60:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.MENUISIER « Menuisier-poseur [TEST] » : 1 h/u × 1800 (minor) = 1800  [entrée pe:bj:MO.MENUISIER:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 26800
  = Frais généraux : 3216 (taux 0.12 sur direct)
  = Marge : 3001.6 (taux 0.1 sur direct+overheads)
  Montant de ligne = 1 × 33018 = 33018 XOF.

### el:OUV.PORTE.100

Pourquoi 1 u pour « Porte bois 100×210, pose comprise » (OUV.PORTE.100@1.0.0) ?
1. La quantité d'ouvrage est la somme de 1 contribution(s) = 1 u, arrondie à 0 décimale(s) (half_up) : 1 u.
2.1 opening D-01 (classe opening.door.single) → correspondance SM.PORTE.100@1.0.0 ; base « opening.count » ; méthode MM.TEST.NET@1.0.0 (aucune) : 1 u.
      geo:o-d1:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u

Prix unitaire 109155 XOF/u pour « Porte bois 100×210, pose comprise » (valeur exacte avant arrondi : 109155.2).
  - MENU.PORTE.100 « Bloc-porte bois 100×210 [TEST] » : 1 u/u × 85000 (minor) = 85000  [entrée pe:bj:MENU.PORTE.100:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.MENUISIER « Menuisier-poseur [TEST] » : 2 h/u × 1800 (minor) = 3600  [entrée pe:bj:MO.MENUISIER:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 88600
  = Frais généraux : 10632 (taux 0.12 sur direct)
  = Marge : 9923.2 (taux 0.1 sur direct+overheads)
  Montant de ligne = 1 × 109155 = 109155 XOF.

### el:OUV.PORTE.90

Pourquoi 2 u pour « Porte bois 90×210, pose comprise » (OUV.PORTE.90@1.0.0) ?
1. La quantité d'ouvrage est la somme de 2 contribution(s) = 2 u, arrondie à 0 décimale(s) (half_up) : 2 u.
2.1 opening D-02 (classe opening.door.single) → correspondance SM.PORTE.90@1.0.0 ; base « opening.count » ; méthode MM.TEST.NET@1.0.0 (aucune) : 1 u.
      geo:o-d2:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u
2.2 opening D-03 (classe opening.door.single) → correspondance SM.PORTE.90@1.0.0 ; base « opening.count » ; méthode MM.TEST.NET@1.0.0 (aucune) : 1 u.
      geo:o-d3:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u

Prix unitaire 90675 XOF/u pour « Porte bois 90×210, pose comprise » (valeur exacte avant arrondi : 90675.2).
  - MENU.PORTE.90 « Bloc-porte bois 90×210 [TEST] » : 1 u/u × 70000 (minor) = 70000  [entrée pe:bj:MENU.PORTE.90:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.MENUISIER « Menuisier-poseur [TEST] » : 2 h/u × 1800 (minor) = 3600  [entrée pe:bj:MO.MENUISIER:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 73600
  = Frais généraux : 8832 (taux 0.12 sur direct)
  = Marge : 8243.2 (taux 0.1 sur direct+overheads)
  Montant de ligne = 2 × 90675 = 181350 XOF.

### el:OUV.TOLE

Pourquoi 53.08 m2 pour « Couverture en tôle » (OUV.TOLE@1.0.0) ?
1. La quantité d'ouvrage est la somme de 1 contribution(s) = 53.078518 m2, arrondie à 2 décimale(s) (half_up) : 53.08 m2.
2.1 roof TOI1 (classe roof.sheet.metal) → correspondance SM.TOLE@1.0.0 ; base « roof.area » ; méthode MM.TEST.NET@1.0.0 (aucune) : 53.078518 m2.
      geo:rf-1:roof.area.developed = 53.078518 m2  [règle geom.roof.area.developed@1.0.0]
        - montée/portée = 0.3/1 = 0.3 -
        - √(1 + rapport²) [échelle 8] = 1.04403065 -
        - 50.84 × 1.04403065 = 53.078518246 m2
          geo:rf-1:roof.area.plan = 50.84 m2  [règle geom.roof.area.plan@1.0.0]
            - formule du lacet (entiers 0,1 mm) = 50.84 m2
            · contour = S1,S2,S3,S4 - (rf-1.outlineNodeIds, origine undefined)
        · montée = 0.3 m (rf-1.rise, origine user_entered, accepted)
        · portée = 1 m (rf-1.run, origine user_entered, accepted)

Prix unitaire 6936 XOF/m2 pour « Couverture en tôle » (valeur exacte avant arrondi : 6936.16).
  - MAT.TOLE « Tôle de couverture [TEST] » : 1.1 m2/m2 × 4500 (minor) = 4950  [entrée pe:bj:MAT.TOLE:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - MO.COUVREUR « Couvreur [TEST] » : 0.4 h/m2 × 1700 (minor) = 680  [entrée pe:bj:MO.COUVREUR:BJ-LITTORAL-COTONOU, zone BJ-LITTORAL-COTONOU, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Déboursé sec : 5630
  = Frais généraux : 675.6 (taux 0.12 sur direct)
  = Marge : 630.56 (taux 0.1 sur direct+overheads)
  Montant de ligne = 53.08 × 6936 = 368163 XOF.

## Articles à commander

Pourquoi 513 kg de « Acier HA [TEST] » (MAT.ACIER) à commander ?
1. Besoin théorique = 488 kg ; avec pertes = 512.4 kg ; arrondi de commande (ceil, 0 décimale(s)) : 513 kg.
2.1 via OUV.DALLE.BA (OUV.DALLE.BA/MAT.ACIER) : théorique 488, avec pertes 512.4 kg

Pourquoi 305 u de « Bloc creux 10 cm [TEST] » (MAT.BLOC.10) à commander ?
1. Besoin théorique = 290.25 u ; avec pertes = 304.7625 u ; arrondi de commande (ceil, 0 décimale(s)) : 305 u.
2.1 via OUV.MAC.BLOC10 (OUV.MAC.BLOC10/MAT.BLOC.10) : théorique 290.25, avec pertes 304.7625 u

Pourquoi 1014 u de « Bloc creux 20 cm [TEST] » (MAT.BLOC.20) à commander ?
1. Besoin théorique = 965.25 u ; avec pertes = 1013.5125 u ; arrondi de commande (ceil, 0 décimale(s)) : 1014 u.
2.1 via OUV.MAC.BLOC20 (OUV.MAC.BLOC20/MAT.BLOC.20) : théorique 965.25, avec pertes 1013.5125 u

Pourquoi 31.9 m2 de « Carreau mural [TEST] » (MAT.CARREAU.MUR) à commander ?
1. Besoin théorique = 28.95 m2 ; avec pertes = 31.845 m2 ; arrondi de commande (ceil, 1 décimale(s)) : 31.9 m2.
2.1 via OUV.CARRELAGE.MUR (OUV.CARRELAGE.MUR/MAT.CARREAU.MUR) : théorique 28.95, avec pertes 31.845 m2

Pourquoi 48.9 m2 de « Carreau de sol [TEST] » (MAT.CARREAU.SOL) à commander ?
1. Besoin théorique = 44.38 m2 ; avec pertes = 48.818 m2 ; arrondi de commande (ceil, 1 décimale(s)) : 48.9 m2.
2.1 via OUV.CARRELAGE.SOL (OUV.CARRELAGE.SOL/MAT.CARREAU.SOL) : théorique 44.38, avec pertes 48.818 m2

Pourquoi 83 sac de « Ciment, sac de 50 kg [TEST] » (MAT.CIMENT) à commander ?
1. Besoin théorique = 79.7587 sac ; avec pertes = 82.151461 sac ; arrondi de commande (ceil, 0 décimale(s)) : 83 sac.
2.1 via OUV.DALLE.BA (OUV.DALLE.BA/MAT.CIMENT) : théorique 42.7, avec pertes 43.981 sac
2.2 via OUV.MAC.BLOC10 → OUV.MORTIER.CIM (OUV.MORTIER.CIM/MAT.CIMENT) : théorique 1.6254, avec pertes 1.674162 sac
2.3 via OUV.MAC.BLOC20 → OUV.MORTIER.CIM (OUV.MORTIER.CIM/MAT.CIMENT) : théorique 8.1081, avec pertes 8.351343 sac
2.4 via OUV.ENDUIT.EXT → OUV.MORTIER.CIM (OUV.MORTIER.CIM/MAT.CIMENT) : théorique 10.8108, avec pertes 11.135124 sac
2.5 via OUV.ENDUIT.INT → OUV.MORTIER.CIM (OUV.MORTIER.CIM/MAT.CIMENT) : théorique 16.5144, avec pertes 17.009832 sac

Pourquoi 16 sac25 de « Colle carrelage, sac de 25 kg [TEST] » (MAT.COLLE) à commander ?
1. Besoin théorique = 14.666 sac25 ; avec pertes = 15.3993 sac25 ; arrondi de commande (ceil, 0 décimale(s)) : 16 sac25.
2.1 via OUV.CARRELAGE.MUR (OUV.CARRELAGE.MUR/MAT.COLLE) : théorique 5.79, avec pertes 6.0795 sac25
2.2 via OUV.CARRELAGE.SOL (OUV.CARRELAGE.SOL/MAT.COLLE) : théorique 8.876, avec pertes 9.3198 sac25

Pourquoi 5.5 m3 de « Gravier [TEST] » (MAT.GRAVIER) à commander ?
1. Besoin théorique = 5.185 m3 ; avec pertes = 5.44425 m3 ; arrondi de commande (ceil, 1 décimale(s)) : 5.5 m3.
2.1 via OUV.DALLE.BA (OUV.DALLE.BA/MAT.GRAVIER) : théorique 5.185, avec pertes 5.44425 m3

Pourquoi 2 pot20 de « Peinture émulsion, pot de 20 l [TEST] » (MAT.PEINTURE) à commander ?
1. Besoin théorique = 1.667375 pot20 ; avec pertes = 1.8341125 pot20 ; arrondi de commande (ceil, 0 décimale(s)) : 2 pot20.
2.1 via OUV.PEINT.MUR (OUV.PEINT.MUR/MAT.PEINTURE) : théorique 1.112625, avec pertes 1.2238875 pot20
2.2 via OUV.PEINT.PLAFOND (OUV.PEINT.PLAFOND/MAT.PEINTURE) : théorique 0.55475, avec pertes 0.610225 pot20

Pourquoi 9 m3 de « Sable [TEST] » (MAT.SABLE) à commander ?
1. Besoin théorique = 8.56851 m3 ; avec pertes = 8.9969355 m3 ; arrondi de commande (ceil, 1 décimale(s)) : 9 m3.
2.1 via OUV.DALLE.BA (OUV.DALLE.BA/MAT.SABLE) : théorique 2.745, avec pertes 2.88225 m3
2.2 via OUV.MAC.BLOC10 → OUV.MORTIER.CIM (OUV.MORTIER.CIM/MAT.SABLE) : théorique 0.25542, avec pertes 0.268191 m3
2.3 via OUV.MAC.BLOC20 → OUV.MORTIER.CIM (OUV.MORTIER.CIM/MAT.SABLE) : théorique 1.27413, avec pertes 1.3378365 m3
2.4 via OUV.ENDUIT.EXT → OUV.MORTIER.CIM (OUV.MORTIER.CIM/MAT.SABLE) : théorique 1.69884, avec pertes 1.783782 m3
2.5 via OUV.ENDUIT.INT → OUV.MORTIER.CIM (OUV.MORTIER.CIM/MAT.SABLE) : théorique 2.59512, avec pertes 2.724876 m3

Pourquoi 59 m2 de « Tôle de couverture [TEST] » (MAT.TOLE) à commander ?
1. Besoin théorique = 53.08 m2 ; avec pertes = 58.388 m2 ; arrondi de commande (ceil, 0 décimale(s)) : 59 m2.
2.1 via OUV.TOLE (OUV.TOLE/MAT.TOLE) : théorique 53.08, avec pertes 58.388 m2

Pourquoi 3 u de « Fenêtre aluminium 120×120 [TEST] » (MENU.FEN.120) à commander ?
1. Besoin théorique = 3 u ; avec pertes = 3 u ; arrondi de commande (ceil, 0 décimale(s)) : 3 u.
2.1 via OUV.FEN.120 (OUV.FEN.120/MENU.FEN.120) : théorique 3, avec pertes 3 u

Pourquoi 1 u de « Fenêtre aluminium 60×60 [TEST] » (MENU.FEN.60) à commander ?
1. Besoin théorique = 1 u ; avec pertes = 1 u ; arrondi de commande (ceil, 0 décimale(s)) : 1 u.
2.1 via OUV.FEN.60 (OUV.FEN.60/MENU.FEN.60) : théorique 1, avec pertes 1 u

Pourquoi 1 u de « Bloc-porte bois 100×210 [TEST] » (MENU.PORTE.100) à commander ?
1. Besoin théorique = 1 u ; avec pertes = 1 u ; arrondi de commande (ceil, 0 décimale(s)) : 1 u.
2.1 via OUV.PORTE.100 (OUV.PORTE.100/MENU.PORTE.100) : théorique 1, avec pertes 1 u

Pourquoi 2 u de « Bloc-porte bois 90×210 [TEST] » (MENU.PORTE.90) à commander ?
1. Besoin théorique = 2 u ; avec pertes = 2 u ; arrondi de commande (ceil, 0 décimale(s)) : 2 u.
2.1 via OUV.PORTE.90 (OUV.PORTE.90/MENU.PORTE.90) : théorique 2, avec pertes 2 u

Pourquoi 64.45 h de « Carreleur [TEST] » (MO.CARRELEUR) à commander ?
1. Besoin théorique = 64.454 h ; avec pertes = 64.454 h ; arrondi de commande (half_up, 2 décimale(s)) : 64.45 h.
2.1 via OUV.CARRELAGE.MUR (OUV.CARRELAGE.MUR/MO.CARRELEUR) : théorique 28.95, avec pertes 28.95 h
2.2 via OUV.CARRELAGE.SOL (OUV.CARRELAGE.SOL/MO.CARRELEUR) : théorique 35.504, avec pertes 35.504 h

Pourquoi 21.23 h de « Couvreur [TEST] » (MO.COUVREUR) à commander ?
1. Besoin théorique = 21.232 h ; avec pertes = 21.232 h ; arrondi de commande (half_up, 2 décimale(s)) : 21.23 h.
2.1 via OUV.TOLE (OUV.TOLE/MO.COUVREUR) : théorique 21.232, avec pertes 21.232 h

Pourquoi 114.63 h de « Maçon [TEST] » (MO.MACON) à commander ?
1. Besoin théorique = 114.63 h ; avec pertes = 114.63 h ; arrondi de commande (half_up, 2 décimale(s)) : 114.63 h.
2.1 via OUV.DALLE.BA (OUV.DALLE.BA/MO.MACON) : théorique 36.6, avec pertes 36.6 h
2.2 via OUV.MAC.BLOC10 (OUV.MAC.BLOC10/MO.MACON) : théorique 16.254, avec pertes 16.254 h
2.3 via OUV.MAC.BLOC20 (OUV.MAC.BLOC20/MO.MACON) : théorique 61.776, avec pertes 61.776 h

Pourquoi 11.5 h de « Menuisier-poseur [TEST] » (MO.MENUISIER) à commander ?
1. Besoin théorique = 11.5 h ; avec pertes = 11.5 h ; arrondi de commande (half_up, 2 décimale(s)) : 11.5 h.
2.1 via OUV.FEN.120 (OUV.FEN.120/MO.MENUISIER) : théorique 4.5, avec pertes 4.5 h
2.2 via OUV.FEN.60 (OUV.FEN.60/MO.MENUISIER) : théorique 1, avec pertes 1 h
2.3 via OUV.PORTE.100 (OUV.PORTE.100/MO.MENUISIER) : théorique 2, avec pertes 2 h
2.4 via OUV.PORTE.90 (OUV.PORTE.90/MO.MENUISIER) : théorique 4, avec pertes 4 h

Pourquoi 35.57 h de « Peintre [TEST] » (MO.PEINTRE) à commander ?
1. Besoin théorique = 35.5665 h ; avec pertes = 35.5665 h ; arrondi de commande (half_up, 2 décimale(s)) : 35.57 h.
2.1 via OUV.PEINT.MUR (OUV.PEINT.MUR/MO.PEINTRE) : théorique 22.2525, avec pertes 22.2525 h
2.2 via OUV.PEINT.PLAFOND (OUV.PEINT.PLAFOND/MO.PEINTRE) : théorique 13.314, avec pertes 13.314 h

Pourquoi 105.31 h de « Plâtrier-enduiseur [TEST] » (MO.PLATRIER) à commander ?
1. Besoin théorique = 105.312 h ; avec pertes = 105.312 h ; arrondi de commande (half_up, 2 décimale(s)) : 105.31 h.
2.1 via OUV.ENDUIT.EXT (OUV.ENDUIT.EXT/MO.PLATRIER) : théorique 46.332, avec pertes 46.332 h
2.2 via OUV.ENDUIT.INT (OUV.ENDUIT.INT/MO.PLATRIER) : théorique 58.98, avec pertes 58.98 h
