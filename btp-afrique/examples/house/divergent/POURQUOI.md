# Explications déterministes (pack.test.divergent)

> DONNÉES SYNTHÉTIQUES / SYNTHETIC TEST DATA — NE PAS UTILISER COMME PRIX OU QUANTITÉS RÉELS

### el:D.SLAB

Pourquoi 6.1 m3 pour « Reinforced slab (parametric estimate) » (D.SLAB@1.0.0) ?
1. La quantité d'ouvrage est la somme de 1 contribution(s) = 6.1008 m3, arrondie à 2 décimale(s) (half_up) : 6.1 m3.
2.1 slab DAL1 (classe slab.reinforced.concrete) → correspondance D.SM.9@1.0.0 ; base « slab.volume » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 6.1008 m3.
      geo:sl-1:slab.volume = 6.1008 m3  [règle geom.slab.volume@1.0.0]
        - 50.84 × 0.12 = 6.1008 m3
          geo:sl-1:slab.area = 50.84 m2  [règle geom.slab.area@1.0.0]
            - formule du lacet (entiers 0,1 mm) = 50.84 m2
            · contour = S1,S2,S3,S4 - (sl-1.outlineNodeIds, origine undefined)
        · épaisseur = 0.12 m (sl-1.thickness, origine user_entered, accepted)

Prix unitaire 35938 TST/m3 pour « Reinforced slab (parametric estimate) » (valeur exacte avant arrondi : 35937.615).
  - D.CONCRETE « Ready-mix concrete [TEST] » : 1.03 m3/m3 × 11800 (minor) = 12154  [entrée pe:div:D.CONCRETE, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.STEEL « Reinforcement steel per lb [TEST] » : 184.8 lb/m3 × 85 (minor) = 15708  [entrée pe:div:D.STEEL, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 5 h/m3 × 380 (minor) = 1900  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 29762
  = Contingency : 1488.1 (taux 0.05 sur direct)
  = Overhead and profit : 4687.515 (taux 0.15 sur direct+contingency)
  Montant de ligne = 6.1 × 35938 = 219222 TST.

### el:D.MASONRY.4

Pourquoi 27 m2 pour « Masonry, 4in blocks » (D.MASONRY.4@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 27 m2, arrondie à 2 décimale(s) (half_up) : 27 m2.
2.1 wall W08 (classe masonry.block.hollow) → correspondance D.SM.2@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 10.5 m2.
      geo:w-08:wall.area.gross = 10.5 m2  [règle geom.wall.area.gross@1.0.0]
        - 3.5 × 3 = 10.5 m2
          geo:w-08:wall.length.axis = 3.5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 12.25 m2
            - racine(dx² + dy²) [échelle 8] = 3.5 m
            - arrondi demi-haut à 6 décimales = 3.5 m
            · dx = 0 m (w-08.startNode→endNode, origine undefined)
            · dy = 3.5 m (w-08.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.2 wall W09 (classe masonry.block.hollow) → correspondance D.SM.2@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 7.5 m2.
      geo:w-09:wall.area.gross = 7.5 m2  [règle geom.wall.area.gross@1.0.0]
        - 2.5 × 3 = 7.5 m2
          geo:w-09:wall.length.axis = 2.5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 6.25 m2
            - racine(dx² + dy²) [échelle 8] = 2.5 m
            - arrondi demi-haut à 6 décimales = 2.5 m
            · dx = 0 m (w-09.startNode→endNode, origine undefined)
            · dy = 2.5 m (w-09.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.3 wall W10 (classe masonry.block.hollow) → correspondance D.SM.2@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 9 m2.
      geo:w-10:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
        - 3 × 3 = 9 m2
          geo:w-10:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 9 m2
            - racine(dx² + dy²) [échelle 8] = 3 m
            - arrondi demi-haut à 6 décimales = 3 m
            · dx = 3 m (w-10.startNode→endNode, origine undefined)
            · dy = 0 m (w-10.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)

Prix unitaire 1593 TST/m2 pour « Masonry, 4in blocks » (valeur exacte avant arrondi : 1592.6976283344817767825).
  - D.BLOCK4 « Concrete block 4in [TEST] » : 11.44 u/m2 × 90 (minor) = 1029.6  [entrée pe:div:D.BLOCK4, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.SAND « Sand, cubic yard [TEST] » : 0.026159012386287845 cuyd/m2 × 3800 (minor) = 99.404247067893811  [entrée pe:div:D.SAND, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 0.5 h/m2 × 380 (minor) = 190  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 1319.004247067893811
  = Contingency : 65.95021235339469055 (taux 0.05 sur direct)
  = Overhead and profit : 207.7431689131932752325 (taux 0.15 sur direct+contingency)
  Montant de ligne = 27 × 1593 = 43011 TST.

### el:D.MASONRY.8

Pourquoi 84 m2 pour « Masonry, 8in blocks » (D.MASONRY.8@1.0.0) ?
1. La quantité d'ouvrage est la somme de 7 contribution(s) = 84 m2, arrondie à 2 décimale(s) (half_up) : 84 m2.
2.1 wall W01 (classe masonry.block.hollow) → correspondance D.SM.1@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 15 m2.
      geo:w-01:wall.area.gross = 15 m2  [règle geom.wall.area.gross@1.0.0]
        - 5 × 3 = 15 m2
          geo:w-01:wall.length.axis = 5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 25 m2
            - racine(dx² + dy²) [échelle 8] = 5 m
            - arrondi demi-haut à 6 décimales = 5 m
            · dx = 5 m (w-01.startNode→endNode, origine undefined)
            · dy = 0 m (w-01.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.2 wall W02 (classe masonry.block.hollow) → correspondance D.SM.1@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 9 m2.
      geo:w-02:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
        - 3 × 3 = 9 m2
          geo:w-02:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 9 m2
            - racine(dx² + dy²) [échelle 8] = 3 m
            - arrondi demi-haut à 6 décimales = 3 m
            · dx = 3 m (w-02.startNode→endNode, origine undefined)
            · dy = 0 m (w-02.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.3 wall W03 (classe masonry.block.hollow) → correspondance D.SM.1@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 10.5 m2.
      geo:w-03:wall.area.gross = 10.5 m2  [règle geom.wall.area.gross@1.0.0]
        - 3.5 × 3 = 10.5 m2
          geo:w-03:wall.length.axis = 3.5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 12.25 m2
            - racine(dx² + dy²) [échelle 8] = 3.5 m
            - arrondi demi-haut à 6 décimales = 3.5 m
            · dx = 0 m (w-03.startNode→endNode, origine undefined)
            · dy = 3.5 m (w-03.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.4 wall W04 (classe masonry.block.hollow) → correspondance D.SM.1@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 7.5 m2.
      geo:w-04:wall.area.gross = 7.5 m2  [règle geom.wall.area.gross@1.0.0]
        - 2.5 × 3 = 7.5 m2
          geo:w-04:wall.length.axis = 2.5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 6.25 m2
            - racine(dx² + dy²) [échelle 8] = 2.5 m
            - arrondi demi-haut à 6 décimales = 2.5 m
            · dx = 0 m (w-04.startNode→endNode, origine undefined)
            · dy = 2.5 m (w-04.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.5 wall W05 (classe masonry.block.hollow) → correspondance D.SM.1@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 9 m2.
      geo:w-05:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
        - 3 × 3 = 9 m2
          geo:w-05:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 9 m2
            - racine(dx² + dy²) [échelle 8] = 3 m
            - arrondi demi-haut à 6 décimales = 3 m
            · dx = 3 m (w-05.startNode→endNode, origine undefined)
            · dy = 0 m (w-05.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.6 wall W06 (classe masonry.block.hollow) → correspondance D.SM.1@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 15 m2.
      geo:w-06:wall.area.gross = 15 m2  [règle geom.wall.area.gross@1.0.0]
        - 5 × 3 = 15 m2
          geo:w-06:wall.length.axis = 5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 25 m2
            - racine(dx² + dy²) [échelle 8] = 5 m
            - arrondi demi-haut à 6 décimales = 5 m
            · dx = 5 m (w-06.startNode→endNode, origine undefined)
            · dy = 0 m (w-06.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.7 wall W07 (classe masonry.block.hollow) → correspondance D.SM.1@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 18 m2.
      geo:w-07:wall.area.gross = 18 m2  [règle geom.wall.area.gross@1.0.0]
        - 6 × 3 = 18 m2
          geo:w-07:wall.length.axis = 6 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 36 m2
            - racine(dx² + dy²) [échelle 8] = 6 m
            - arrondi demi-haut à 6 décimales = 6 m
            · dx = 0 m (w-07.startNode→endNode, origine undefined)
            · dy = 6 m (w-07.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)

Prix unitaire 2461 TST/m2 pour « Masonry, 8in blocks » (valeur exacte avant arrondi : 2461.24725).
  - D.BLOCK8 « Concrete block 8in [TEST] » : 11.44 u/m2 × 120 (minor) = 1372.8  [entrée pe:div:D.BLOCK8, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.CEMENT « Cement bag 40 kg [TEST] » : 0.35 bag/m2 × 1250 (minor) = 437.5  [entrée pe:div:D.CEMENT, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 0.6 h/m2 × 380 (minor) = 228  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 2038.3
  = Contingency : 101.915 (taux 0.05 sur direct)
  = Overhead and profit : 321.03225 (taux 0.15 sur direct+contingency)
  Montant de ligne = 84 × 2461 = 206724 TST.

### el:D.PAINT.CEIL

Pourquoi 44.38 m2 pour « Ceiling paint » (D.PAINT.CEIL@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 44.375 m2, arrondie à 2 décimale(s) (half_up) : 44.38 m2.
2.1 space CHA (classe paint.emulsion) → correspondance D.SM.7@1.0.0 ; base « space.ceiling.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 9.5475 m2.
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
2.2 space SAL (classe paint.emulsion) → correspondance D.SM.7@1.0.0 ; base « space.ceiling.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 28.13 m2.
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
2.3 space SDB (classe paint.emulsion) → correspondance D.SM.7@1.0.0 ; base « space.ceiling.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 6.6975 m2.
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

Prix unitaire 1188 TST/m2 pour « Ceiling paint » (valeur exacte avant arrondi : 1188.18).
  - D.PAINT « Paint, 20 l pail [TEST] » : 0.3 l/m2 × 2900 (minor) = 870  [entrée pe:div:D.PAINT, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 0.3 h/m2 × 380 (minor) = 114  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 984
  = Contingency : 49.2 (taux 0.05 sur direct)
  = Overhead and profit : 154.98 (taux 0.15 sur direct+contingency)
  Montant de ligne = 44.38 × 1188 = 52723 TST.

### el:D.PAINT.WALL

Pourquoi 101.1 m2 pour « Wall paint » (D.PAINT.WALL@1.0.0) ?
1. La quantité d'ouvrage est la somme de 2 contribution(s) = 101.1 m2, arrondie à 2 décimale(s) (half_up) : 101.1 m2.
2.1 space CHA (classe paint.emulsion) → correspondance D.SM.5@1.0.0 ; base « space.wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 37.2 m2.
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
2.2 space SAL (classe paint.emulsion) → correspondance D.SM.5@1.0.0 ; base « space.wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 63.9 m2.
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

Prix unitaire 1165 TST/m2 pour « Wall paint » (valeur exacte avant arrondi : 1165.2375).
  - D.PAINT « Paint, 20 l pail [TEST] » : 0.3 l/m2 × 2900 (minor) = 870  [entrée pe:div:D.PAINT, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 0.25 h/m2 × 380 (minor) = 95  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 965
  = Contingency : 48.25 (taux 0.05 sur direct)
  = Overhead and profit : 151.9875 (taux 0.15 sur direct+contingency)
  Montant de ligne = 101.1 × 1165 = 117782 TST.

### el:D.RENDER.EXT

Pourquoi 84 m2 pour « External render » (D.RENDER.EXT@1.0.0) ?
1. La quantité d'ouvrage est la somme de 7 contribution(s) = 84 m2, arrondie à 2 décimale(s) (half_up) : 84 m2.
2.1 wall W01 (classe render.cementitious) → correspondance D.SM.3@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 15 m2.
      geo:w-01:wall.area.gross = 15 m2  [règle geom.wall.area.gross@1.0.0]
        - 5 × 3 = 15 m2
          geo:w-01:wall.length.axis = 5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 25 m2
            - racine(dx² + dy²) [échelle 8] = 5 m
            - arrondi demi-haut à 6 décimales = 5 m
            · dx = 5 m (w-01.startNode→endNode, origine undefined)
            · dy = 0 m (w-01.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.2 wall W02 (classe render.cementitious) → correspondance D.SM.3@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 9 m2.
      geo:w-02:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
        - 3 × 3 = 9 m2
          geo:w-02:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 9 m2
            - racine(dx² + dy²) [échelle 8] = 3 m
            - arrondi demi-haut à 6 décimales = 3 m
            · dx = 3 m (w-02.startNode→endNode, origine undefined)
            · dy = 0 m (w-02.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.3 wall W03 (classe render.cementitious) → correspondance D.SM.3@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 10.5 m2.
      geo:w-03:wall.area.gross = 10.5 m2  [règle geom.wall.area.gross@1.0.0]
        - 3.5 × 3 = 10.5 m2
          geo:w-03:wall.length.axis = 3.5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 12.25 m2
            - racine(dx² + dy²) [échelle 8] = 3.5 m
            - arrondi demi-haut à 6 décimales = 3.5 m
            · dx = 0 m (w-03.startNode→endNode, origine undefined)
            · dy = 3.5 m (w-03.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.4 wall W04 (classe render.cementitious) → correspondance D.SM.3@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 7.5 m2.
      geo:w-04:wall.area.gross = 7.5 m2  [règle geom.wall.area.gross@1.0.0]
        - 2.5 × 3 = 7.5 m2
          geo:w-04:wall.length.axis = 2.5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 6.25 m2
            - racine(dx² + dy²) [échelle 8] = 2.5 m
            - arrondi demi-haut à 6 décimales = 2.5 m
            · dx = 0 m (w-04.startNode→endNode, origine undefined)
            · dy = 2.5 m (w-04.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.5 wall W05 (classe render.cementitious) → correspondance D.SM.3@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 9 m2.
      geo:w-05:wall.area.gross = 9 m2  [règle geom.wall.area.gross@1.0.0]
        - 3 × 3 = 9 m2
          geo:w-05:wall.length.axis = 3 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 9 m2
            - racine(dx² + dy²) [échelle 8] = 3 m
            - arrondi demi-haut à 6 décimales = 3 m
            · dx = 3 m (w-05.startNode→endNode, origine undefined)
            · dy = 0 m (w-05.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.6 wall W06 (classe render.cementitious) → correspondance D.SM.3@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 15 m2.
      geo:w-06:wall.area.gross = 15 m2  [règle geom.wall.area.gross@1.0.0]
        - 5 × 3 = 15 m2
          geo:w-06:wall.length.axis = 5 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 25 m2
            - racine(dx² + dy²) [échelle 8] = 5 m
            - arrondi demi-haut à 6 décimales = 5 m
            · dx = 5 m (w-06.startNode→endNode, origine undefined)
            · dy = 0 m (w-06.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)
2.7 wall W07 (classe render.cementitious) → correspondance D.SM.3@1.0.0 ; base « wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 18 m2.
      geo:w-07:wall.area.gross = 18 m2  [règle geom.wall.area.gross@1.0.0]
        - 6 × 3 = 18 m2
          geo:w-07:wall.length.axis = 6 m  [règle geom.wall.length.axis@1.0.0]
            - dx² + dy² = 36 m2
            - racine(dx² + dy²) [échelle 8] = 6 m
            - arrondi demi-haut à 6 décimales = 6 m
            · dx = 0 m (w-07.startNode→endNode, origine undefined)
            · dy = 6 m (w-07.startNode→endNode, origine undefined)
        · hauteur = 3 m (hypothèse A-01)

Prix unitaire 531 TST/m2 pour « External render » (valeur exacte avant arrondi : 531.3).
  - D.CEMENT « Cement bag 40 kg [TEST] » : 0.2 bag/m2 × 1250 (minor) = 250  [entrée pe:div:D.CEMENT, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 0.5 h/m2 × 380 (minor) = 190  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 440
  = Contingency : 22 (taux 0.05 sur direct)
  = Overhead and profit : 69.3 (taux 0.15 sur direct+contingency)
  Montant de ligne = 84 × 531 = 44604 TST.

### el:D.RENDER.INT

Pourquoi 132.3 m2 pour « Internal render » (D.RENDER.INT@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 132.3 m2, arrondie à 2 décimale(s) (half_up) : 132.3 m2.
2.1 space CHA (classe render.cementitious) → correspondance D.SM.4@1.0.0 ; base « space.wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 37.2 m2.
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
2.2 space SAL (classe render.cementitious) → correspondance D.SM.4@1.0.0 ; base « space.wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 63.9 m2.
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
2.3 space SDB (classe render.cementitious) → correspondance D.SM.4@1.0.0 ; base « space.wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 31.2 m2.
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

Prix unitaire 508 TST/m2 pour « Internal render » (valeur exacte avant arrondi : 508.3575).
  - D.CEMENT « Cement bag 40 kg [TEST] » : 0.2 bag/m2 × 1250 (minor) = 250  [entrée pe:div:D.CEMENT, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 0.45 h/m2 × 380 (minor) = 171  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 421
  = Contingency : 21.05 (taux 0.05 sur direct)
  = Overhead and profit : 66.3075 (taux 0.15 sur direct+contingency)
  Montant de ligne = 132.3 × 508 = 67208 TST.

### el:D.TILE.FLOOR

Pourquoi 44.38 m2 pour « Floor tiling » (D.TILE.FLOOR@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 44.375 m2, arrondie à 2 décimale(s) (half_up) : 44.38 m2.
2.1 space CHA (classe floor.tile.ceramic) → correspondance D.SM.8@1.0.0 ; base « space.floor.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 9.5475 m2.
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
2.2 space SAL (classe floor.tile.ceramic) → correspondance D.SM.8@1.0.0 ; base « space.floor.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 28.13 m2.
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
2.3 space SDB (classe floor.tile.ceramic) → correspondance D.SM.8@1.0.0 ; base « space.floor.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 6.6975 m2.
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

Prix unitaire 6168 TST/m2 pour « Floor tiling » (valeur exacte avant arrondi : 6168.2178159).
  - D.TILE « Floor/wall tile per sq ft [TEST] » : 11.625012 sqft/m2 × 410 (minor) = 4766.25492  [entrée pe:div:D.TILE, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 0.9 h/m2 × 380 (minor) = 342  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 5108.25492
  = Contingency : 255.412746 (taux 0.05 sur direct)
  = Overhead and profit : 804.5501499 (taux 0.15 sur direct+contingency)
  Montant de ligne = 44.38 × 6168 = 273736 TST.

### el:D.TILE.WALL

Pourquoi 31.2 m2 pour « Wall tiling » (D.TILE.WALL@1.0.0) ?
1. La quantité d'ouvrage est la somme de 1 contribution(s) = 31.2 m2, arrondie à 2 décimale(s) (half_up) : 31.2 m2.
2.1 space SDB (classe wall.tile.ceramic) → correspondance D.SM.6@1.0.0 ; base « space.wall.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune déduction) : 31.2 m2.
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

Prix unitaire 6260 TST/m2 pour « Wall tiling » (valeur exacte avant arrondi : 6259.9878159).
  - D.TILE « Floor/wall tile per sq ft [TEST] » : 11.625012 sqft/m2 × 410 (minor) = 4766.25492  [entrée pe:div:D.TILE, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 1.1 h/m2 × 380 (minor) = 418  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 5184.25492
  = Contingency : 259.212746 (taux 0.05 sur direct)
  = Overhead and profit : 816.5201499 (taux 0.15 sur direct+contingency)
  Montant de ligne = 31.2 × 6260 = 195312 TST.

### el:D.DOOR

Pourquoi 3 u pour « Door set, fitted » (D.DOOR@1.0.0) ?
1. La quantité d'ouvrage est la somme de 3 contribution(s) = 3 u, arrondie à 0 décimale(s) (half_up) : 3 u.
2.1 opening D-01 (classe opening.door.single) → correspondance D.SM.11@1.0.0 ; base « opening.count » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 1 u.
      geo:o-d1:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u
2.2 opening D-02 (classe opening.door.single) → correspondance D.SM.11@1.0.0 ; base « opening.count » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 1 u.
      geo:o-d2:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u
2.3 opening D-03 (classe opening.door.single) → correspondance D.SM.11@1.0.0 ; base « opening.count » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 1 u.
      geo:o-d3:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u

Prix unitaire 26275 TST/u pour « Door set, fitted » (valeur exacte avant arrondi : 26275.2).
  - D.DOOR « Door set [TEST] » : 1 u/u × 21000 (minor) = 21000  [entrée pe:div:D.DOOR, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 2 h/u × 380 (minor) = 760  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 21760
  = Contingency : 1088 (taux 0.05 sur direct)
  = Overhead and profit : 3427.2 (taux 0.15 sur direct+contingency)
  Montant de ligne = 3 × 26275 = 78825 TST.

### el:D.ROOF

Pourquoi 53.08 m2 pour « Roof sheeting » (D.ROOF@1.0.0) ?
1. La quantité d'ouvrage est la somme de 1 contribution(s) = 53.078518 m2, arrondie à 2 décimale(s) (half_up) : 53.08 m2.
2.1 roof TOI1 (classe roof.sheet.metal) → correspondance D.SM.10@1.0.0 ; base « roof.area » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 53.078518 m2.
      geo:rf-1:roof.area.developed = 53.078518 m2  [règle geom.roof.area.developed@1.0.0]
        - montée/portée = 0.3/1 = 0.3 -
        - √(1 + rapport²) [échelle 8] = 1.04403065 -
        - 50.84 × 1.04403065 = 53.078518246 m2
          geo:rf-1:roof.area.plan = 50.84 m2  [règle geom.roof.area.plan@1.0.0]
            - formule du lacet (entiers 0,1 mm) = 50.84 m2
            · contour = S1,S2,S3,S4 - (rf-1.outlineNodeIds, origine undefined)
        · montée = 0.3 m (rf-1.rise, origine user_entered, accepted)
        · portée = 1 m (rf-1.run, origine user_entered, accepted)

Prix unitaire 2707 TST/m2 pour « Roof sheeting » (valeur exacte avant arrondi : 2707.215).
  - D.SHEET « Roof sheet [TEST] » : 1.1 m2/m2 × 1900 (minor) = 2090  [entrée pe:div:D.SHEET, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 0.4 h/m2 × 380 (minor) = 152  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 2242
  = Contingency : 112.1 (taux 0.05 sur direct)
  = Overhead and profit : 353.115 (taux 0.15 sur direct+contingency)
  Montant de ligne = 53.08 × 2707 = 143688 TST.

### el:D.WINDOW

Pourquoi 4 u pour « Window set, fitted » (D.WINDOW@1.0.0) ?
1. La quantité d'ouvrage est la somme de 4 contribution(s) = 4 u, arrondie à 0 décimale(s) (half_up) : 4 u.
2.1 opening W-01 (classe opening.window.casement) → correspondance D.SM.12@1.0.0 ; base « opening.count » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 1 u.
      geo:o-w1:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u
2.2 opening W-02 (classe opening.window.casement) → correspondance D.SM.12@1.0.0 ; base « opening.count » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 1 u.
      geo:o-w2:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u
2.3 opening W-03 (classe opening.window.casement) → correspondance D.SM.12@1.0.0 ; base « opening.count » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 1 u.
      geo:o-w3:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u
2.4 opening W-04 (classe opening.window.casement) → correspondance D.SM.12@1.0.0 ; base « opening.count » ; méthode MM.DIVERGENT.GROSS@1.0.0 (aucune) : 1 u.
      geo:o-w4:opening.count = 1 u  [règle geom.opening.count@1.0.0]
        - 1 ouverture = 1 u

Prix unitaire 19405 TST/u pour « Window set, fitted » (valeur exacte avant arrondi : 19404.525).
  - D.WINDOW « Window set [TEST] » : 1 u/u × 15500 (minor) = 15500  [entrée pe:div:D.WINDOW, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  - D.LAB « Labour [TEST] » : 1.5 h/u × 380 (minor) = 570  [entrée pe:div:D.LAB, zone REALM-P1-D1-T1, 2026-09-15, source synthetic:TEST-DATA-DO-NOT-USE, confiance 0.80, synthetic/test]
  = Direct cost : 16070
  = Contingency : 803.5 (taux 0.05 sur direct)
  = Overhead and profit : 2531.025 (taux 0.15 sur direct+contingency)
  Montant de ligne = 4 × 19405 = 77620 TST.

## Articles à commander

Pourquoi 309 u de « Concrete block 4in [TEST] » (D.BLOCK4) à commander ?
1. Besoin théorique = 297 u ; avec pertes = 308.88 u ; arrondi de commande (ceil, 0 décimale(s)) : 309 u.
2.1 via D.MASONRY.4 (D.MASONRY.4/D.BLOCK4) : théorique 297, avec pertes 308.88 u

Pourquoi 961 u de « Concrete block 8in [TEST] » (D.BLOCK8) à commander ?
1. Besoin théorique = 924 u ; avec pertes = 960.96 u ; arrondi de commande (ceil, 0 décimale(s)) : 961 u.
2.1 via D.MASONRY.8 (D.MASONRY.8/D.BLOCK8) : théorique 924, avec pertes 960.96 u

Pourquoi 73 bag de « Cement bag 40 kg [TEST] » (D.CEMENT) à commander ?
1. Besoin théorique = 72.66 bag ; avec pertes = 72.66 bag ; arrondi de commande (ceil, 0 décimale(s)) : 73 bag.
2.1 via D.MASONRY.8 (D.MASONRY.8/D.CEMENT) : théorique 29.4, avec pertes 29.4 bag
2.2 via D.RENDER.EXT (D.RENDER.EXT/D.CEMENT) : théorique 16.8, avec pertes 16.8 bag
2.3 via D.RENDER.INT (D.RENDER.INT/D.CEMENT) : théorique 26.46, avec pertes 26.46 bag

Pourquoi 6.3 m3 de « Ready-mix concrete [TEST] » (D.CONCRETE) à commander ?
1. Besoin théorique = 6.1 m3 ; avec pertes = 6.283 m3 ; arrondi de commande (ceil, 1 décimale(s)) : 6.3 m3.
2.1 via D.SLAB (D.SLAB/D.CONCRETE) : théorique 6.1, avec pertes 6.283 m3

Pourquoi 3 u de « Door set [TEST] » (D.DOOR) à commander ?
1. Besoin théorique = 3 u ; avec pertes = 3 u ; arrondi de commande (ceil, 0 décimale(s)) : 3 u.
2.1 via D.DOOR (D.DOOR/D.DOOR) : théorique 3, avec pertes 3 u

Pourquoi 342 h de « Labour [TEST] » (D.LAB) à commander ?
1. Besoin théorique = 342.018 h ; avec pertes = 342.018 h ; arrondi de commande (half_up, 1 décimale(s)) : 342 h.
2.1 via D.SLAB (D.SLAB/D.LAB) : théorique 30.5, avec pertes 30.5 h
2.2 via D.MASONRY.4 (D.MASONRY.4/D.LAB) : théorique 13.5, avec pertes 13.5 h
2.3 via D.MASONRY.8 (D.MASONRY.8/D.LAB) : théorique 50.4, avec pertes 50.4 h
2.4 via D.PAINT.CEIL (D.PAINT.CEIL/D.LAB) : théorique 13.314, avec pertes 13.314 h
2.5 via D.PAINT.WALL (D.PAINT.WALL/D.LAB) : théorique 25.275, avec pertes 25.275 h
2.6 via D.RENDER.EXT (D.RENDER.EXT/D.LAB) : théorique 42, avec pertes 42 h
2.7 via D.RENDER.INT (D.RENDER.INT/D.LAB) : théorique 59.535, avec pertes 59.535 h
2.8 via D.TILE.FLOOR (D.TILE.FLOOR/D.LAB) : théorique 39.942, avec pertes 39.942 h
2.9 via D.TILE.WALL (D.TILE.WALL/D.LAB) : théorique 34.32, avec pertes 34.32 h
2.10 via D.DOOR (D.DOOR/D.LAB) : théorique 6, avec pertes 6 h
2.11 via D.ROOF (D.ROOF/D.LAB) : théorique 21.232, avec pertes 21.232 h
2.12 via D.WINDOW (D.WINDOW/D.LAB) : théorique 6, avec pertes 6 h

Pourquoi 44 l de « Paint, 20 l pail [TEST] » (D.PAINT) à commander ?
1. Besoin théorique = 43.644 l ; avec pertes = 43.644 l ; arrondi de commande (ceil, 0 décimale(s)) : 44 l.
2.1 via D.PAINT.CEIL (D.PAINT.CEIL/D.PAINT) : théorique 13.314, avec pertes 13.314 l
2.2 via D.PAINT.WALL (D.PAINT.WALL/D.PAINT) : théorique 30.33, avec pertes 30.33 l

Pourquoi 0.8 cuyd de « Sand, cubic yard [TEST] » (D.SAND) à commander ?
1. Besoin théorique = 0.706293334429771805 cuyd ; avec pertes = 0.706293334429771805 cuyd ; arrondi de commande (ceil, 1 décimale(s)) : 0.8 cuyd.
2.1 via D.MASONRY.4 (D.MASONRY.4/D.SAND) : théorique 0.706293334429771805, avec pertes 0.706293334429771805 cuyd

Pourquoi 59 m2 de « Roof sheet [TEST] » (D.SHEET) à commander ?
1. Besoin théorique = 53.08 m2 ; avec pertes = 58.388 m2 ; arrondi de commande (ceil, 0 décimale(s)) : 59 m2.
2.1 via D.ROOF (D.ROOF/D.SHEET) : théorique 53.08, avec pertes 58.388 m2

Pourquoi 1128 lb de « Reinforcement steel per lb [TEST] » (D.STEEL) à commander ?
1. Besoin théorique = 1073.6 lb ; avec pertes = 1127.28 lb ; arrondi de commande (ceil, 0 décimale(s)) : 1128 lb.
2.1 via D.SLAB (D.SLAB/D.STEEL) : théorique 1073.6, avec pertes 1127.28 lb

Pourquoi 879 sqft de « Floor/wall tile per sq ft [TEST] » (D.TILE) à commander ?
1. Besoin théorique = 813.535562 sqft ; avec pertes = 878.61840696 sqft ; arrondi de commande (ceil, 0 décimale(s)) : 879 sqft.
2.1 via D.TILE.FLOOR (D.TILE.FLOOR/D.TILE) : théorique 477.701882, avec pertes 515.91803256 sqft
2.2 via D.TILE.WALL (D.TILE.WALL/D.TILE) : théorique 335.83368, avec pertes 362.7003744 sqft

Pourquoi 4 u de « Window set [TEST] » (D.WINDOW) à commander ?
1. Besoin théorique = 4 u ; avec pertes = 4 u ; arrondi de commande (ceil, 0 décimale(s)) : 4 u.
2.1 via D.WINDOW (D.WINDOW/D.WINDOW) : théorique 4, avec pertes 4 u
