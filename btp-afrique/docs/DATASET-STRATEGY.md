# Stratégie de corpus (dataset) — moteur architectural universel

> Statut : proposition (v0.3, révisée après audit de cohérence), complète `ARCHITECTURE.md` §6. Remplace la formule initiale « 30–50 plans béninois ».
> Les ordres de grandeur sont **indicatifs** : ils seront recalibrés par des courbes d'apprentissage mesurées.

## 1. Principes

1. **Le moteur de perception est universel.** Il apprend à comprendre des *plans*, pas une *nationalité* de plans.
2. **Le pays est une métadonnée d'évaluation, jamais une entrée du modèle.** Il sert à échantillonner et à mesurer par tranche ; aucun modèle ne reçoit « pays = X » en paramètre.
3. **Trois corpus aux rôles distincts** (A général, B africain, C validation locale) — §2.
4. **Évaluation par tranches** (région × type de source × complexité × qualité), pas par moyenne globale — §5.
5. **Jeux de test scellés** : jamais utilisés pour entraîner, jamais inspectés pour régler un modèle — §4.
6. **Chaque plan a une fiche de provenance** (source, licence, consentement, restrictions) — §7.
7. **La diversité se construit par échantillonnage, pas par volume** : ajouter 10 000 plans d'une même origine n'améliore pas la robustesse ailleurs.
8. **Aucun raccourci « pays »** : le moteur doit comprendre le plan, pas deviner la nationalité du plan (tests anti‑raccourci, §5).
9. **Universel ≠ tout couvert au MVP** : on déclare un *domaine de validité* (§6) et on l'élargit progressivement.

## 2. Les trois corpus

| | **A — Corpus architectural général** | **B — Corpus africain** | **C — Corpus local de validation** |
|---|---|---|---|
| Objectif | compréhension générale d'un plan | robustesse aux pratiques et représentations rencontrées en Afrique | valider **le produit** sur les projets réels du premier marché |
| Contenu | plans d'Europe, Amériques, Asie, Océanie et sources mondiales sans origine africaine identifiée ; contemporains ; niveaux de complexité variés ; PDF vectoriels, scans, photos ; plans CAO, dessinés à la main, rendus | plans d'Afrique de l'Ouest, Centrale, de l'Est, Australe, du Nord ; plans d'agence, de permis, de lotissement, dessinés à la main numérisés, photographiés, captures de messagerie | projets béninois réels : plan + **métré de référence d'un professionnel** + DQE/devis réel + prix constatés |
| Usage | pré-entraînement et entraînement | entraînement **+** validation **+** test | **test uniquement, scellé** ; validation du produit de bout en bout |
| Ce qu'on mesure | perception (murs, ouvertures, pièces, cotes, échelle) | idem, par tranche africaine | perception **et** chaîne complète : métré, chiffrage, temps de correction humaine |
| Taille indicative | milliers à dizaines de milliers (annotations souvent partielles/faibles) | d'abord quelques centaines annotées par des experts, puis milliers | 30–50 projets pour le premier marché, extensible ; **un corpus C par marché** (C‑BJ, puis C‑SN, C‑CI, C‑GH…) |
| Sources | jeux publics (licence vérifiée), partenariats, contenus sous licence, **plans synthétiques** | architectes, bureaux d'études, promoteurs, universités, collectes consenties, contributions via le produit | partenaires professionnels (métreur, entrepreneurs) avec contrat |
| Annotation | pipeline semi-automatique + revue | experts, double lecture sur un sous-échantillon | experts + métreur professionnel (vérité terrain du métré) |

**Règle de disjonction** : chaque plan appartient à **un seul** corpus selon sa provenance — B pour l'origine africaine curée, A pour le reste du monde et le synthétique, C pour les projets d'un marché avec vérité terrain professionnelle. Aucun plan de C n'est dans A ou B, y compris sous forme de variante redessinée connue.

### Jeux publics connus (exemples, **à vérifier avant tout usage**)
CubiCasa5K, RPLAN, FloorPlanCAD, CVC‑FP, Structured3D (synthétique), R2V. Ils existent, mais :
- plusieurs sont limités à la **recherche non commerciale** → licence à vérifier une par une ;
- leur couverture est surtout européenne/asiatique et résidentielle, avec des conventions graphiques précises → **c'est la raison d'être du corpus B**, pas un argument pour s'en passer ;
- chacun a son propre jeu d'étiquettes → il faut une **table de correspondance versionnée** vers la taxonomie interne (§3).

### Plans synthétiques
Générateur procédural (graphe de pièces → murs → ouvertures → rendu dans plusieurs styles : CAO propre, trait manuscrit, scan dégradé, photo inclinée, langues et unités variées).
- Sert à : volume, cas rares, robustesse aux dégradations, **et** à tester le métré géométrique avec une vérité **analytique** (quantités connues exactement).
- Ne sert **jamais** à constituer un jeu de test de perception.

## 3. Taxonomie d'annotation unique (universelle, versionnée)

| Famille | Classes (première version) |
|---|---|
| Murs | extérieur, intérieur, cloison ; porteur/non porteur si indiqué ; courbe/droit |
| Ouvertures | porte simple/double/coulissante/pliante/garage ; fenêtre ; baie/vide |
| Circulations verticales | escalier droit/L/U/hélicoïdal ; rampe ; ascenseur |
| Espaces | pièce (+ libellé tel qu'écrit, multilingue, + usage normalisé) |
| Cotation | valeur, lignes de cote, unité, cote de niveau |
| Repères | niveaux (R+1, +3,20…), nord, barre/texte d'échelle, cartouche, grille d'axes |
| Éléments | poteau, balcon, terrasse, sanitaires, cuisine (équipements fixes), hachures/matériaux conventionnels |
| Électricité / plomberie | symboles (V1 : comptages de points) |

Le format interne est un **graphe vectoriel** (nœuds, murs, ouvertures, pièces, cotes) dont on dérive les masques ; chaque annotation porte son annotateur, sa version de taxonomie et son statut de revue.

### Métadonnées obligatoires par plan (clés de tranches)
`corpus` (A/B/C) · `sourceId` (cabinet > projet > plan > page) · `region` / `country` (métadonnée d'évaluation seulement) · `sourceType` (pdf_vector, pdf_raster, scan, photo, cad_export, hand_drawn) · `qualityGrade` (1–4) · `complexityLevel` · `unitSystem` · `languages[]` · `scaleKnown` · `typology` · `year` · `license` · `trainingUseAllowed` · `consentScope` · `sealed` · `annotatorId` · `reviewStatus`

Niveaux de complexité : **L1** orthogonal, 1 niveau · **L2** R+1/R+2, plusieurs plans cohérents · **L3** géométrie irrégulière/courbe, mixte · **L4** multi-bâtiments, commercial/collectif, plans très denses.

## 4. Découpages et scellement

- **Découpage par source, jamais par image** : toutes les pages d'un même projet, d'un même cabinet/gabarit, restent du même côté. Hiérarchie de source : cabinet > projet > plan > page ; pour le synthétique : famille de gabarit / graine du générateur.
- **Dédoublonnage** (hash perceptuel + vérification manuelle des quasi‑doublons) entre train/val/test, y compris **entre A, B et C**. Risque résiduel assumé : un même bâtiment redessiné par des cabinets différents peut échapper au dédoublonnage ; il est documenté dans chaque rapport.
- **A‑test** (petit, diversifié), **B‑test** (15–20 % de B, tiré par source) et **C (entier)** sont scellés. Un test scellé n'est consulté que pour les rapports de version ; le réglage utilise la validation.
- **Propagation du scellé** : tout dérivé d'une donnée scellée (annotations, corrections, sorties de modèle, caches, embeddings) hérite de `sealed = true` et ne peut jamais entrer dans un jeu d'entraînement.
- **Flux « P » (production)** : les corrections d'utilisateurs consentantes forment un flux séparé, **exclu de tous les jeux de test** ; si un projet de C est ouvert dans le produit par un évaluateur, ses corrections héritent du scellé.
- **Séparation technique** : les jeux scellés vivent dans un stockage privé à accès contrôlé ; le pipeline d'entraînement n'a **aucun droit** dessus (vérifié par test d'autorisations, T‑DAT‑03). Le dépôt de code ne contient que des pointeurs et des empreintes (`fixtures/golden`).
- Un test scellé ne se « rafraîchit » que par ajout de nouvelles sources, jamais par retrait de cas difficiles.

## 5. Évaluation

| Cible | Métriques |
|---|---|
| Murs | F1 sur graphe, erreur de longueur/épaisseur |
| Ouvertures | F1, erreur de largeur, type correct |
| Pièces | F1, erreur relative de surface |
| Cotes / échelle | exact‑match, réussite de calibration dans une tolérance |
| Chaîne complète (corpus C) | écart de métré vs référence du professionnel, par poste ; **temps pour obtenir un modèle validé** vs traçage manuel |

Rapport standard : matrice **région × type de source × complexité × qualité**, avec pour chaque cellule l'**effectif** et un **intervalle de confiance**. Une cellule sous l'effectif minimal est rapportée « donnée insuffisante » et ne peut fonder ni un succès ni un échec (le corpus C‑BJ, 30–50 projets, ne soutient pas de verdict par fine tranche : ses résultats sont lus globalement et par poste de métré).

**Calibration** : l'erreur de calibration du score de confiance est mesurée par tranche et publiée dans le `ModelArtifact` ; les seuils d'acceptation en lot proposés à l'utilisateur en dérivent (T‑AI‑04).

**Tests anti‑raccourci « pays »** (T‑AI‑03) : (1) *leave‑one‑region‑out* — entraîner sans une région, tester sur elle, et comparer à l'entraînement avec ; (2) *ablation du cartouche et du texte* — retirer ou permuter ces zones et mesurer la dégradation de la détection géométrique ; (3) rapports de dimensions (épaisseurs, largeurs d'ouvertures) par région pour détecter un a priori régional. Un écart au‑delà d'un seuil bloque la publication du modèle.

**Seuils chiffrés** (non‑régression, porte de disponibilité, effectif minimal) : proposés après la mesure de base de la phase P0 puis validés ; décision ouverte OD‑11. Aucun seuil n'est inventé avant d'avoir une base de comparaison.
**Règle de non‑régression par tranche** : un nouveau modèle n'est publié que s'il ne dégrade aucune tranche au‑delà d'un seuil convenu, même si la moyenne augmente.
**Porte de disponibilité d'un marché** (readiness gate) : un pack n'est annoncé « supporté » que si (a) la couverture de correspondances du pack atteint un seuil, (b) un corpus C du marché existe et a été passé, (c) les tranches de perception pertinentes sont au‑dessus d'un seuil.

## 6. Domaine de validité et plans hors distribution

Chaque `ModelArtifact` déclare son **domaine de validité** (types de source, complexités, unités, langues, conventions couvertes) et publie ses métriques par tranche. À l'exécution :
- une page dont les caractéristiques sortent du domaine déclaré est signalée (« plan hors domaine validé — vérification manuelle recommandée ») et sa confiance est plafonnée ;
- l'outil bascule vers le traçage assisté plutôt que de proposer avec fausse assurance.

**Méthode** : combinaison de signaux (conventions de dessin détectées hors domaine, incertitude du modèle, distance dans l'espace de représentations), calibrée sur la validation ; sa performance (rappel du signalement sur des plans volontairement hors domaine : manuscrits non standard, photos inclinées, unités rares, symboles inconnus) est mesurée par T‑AI‑05. Un détecteur hors domaine défaillant est un risque en soi : ses faux négatifs sont publiés.

Cela permet d'affirmer honnêtement « moteur universel » sans promettre une couverture totale dès le premier jour.

## 7. Gouvernance, droits, éthique

- **Registre de provenance** par fichier : source, licence, preuve de consentement, restrictions (usage commercial, redistribution), date, possibilité de retrait.
- **Les plans sont des œuvres protégées et des données sensibles** : contrats avec cabinets/propriétaires, finalité explicite, pas de revente.
- **Anonymisation** avant partage interne : masquage des cartouches (noms, adresses, coordonnées).
- **Données de produit** (corrections utilisateur) : réutilisation pour l'entraînement uniquement avec un **consentement distinct et révocable** (§11.4 de l'architecture).
- **Retrait** : un plan retiré doit pouvoir être exclu des futurs entraînements ; chaque modèle enregistre la version de dataset utilisée.
- **Revue juridique** (droit d'auteur, protection des données, transferts transfrontaliers, **droit d'entraîner un modèle sur des œuvres protégées, qui varie selon les juridictions**) avant toute collecte à grande échelle.
- **Registre de licences** couvrant aussi : poids de modèles pré‑entraînés et leurs données d'origine, dépendances logicielles (licences permissives vs copyleft ; éviter les licences incompatibles avec une distribution commerciale), jeux publics. Une CI bloque l'entraînement si un fichier n'a pas `trainingUseAllowed = true` (T‑DAT‑02).
- **Contrat de contribution de données** — liste de contrôle : finalité (entraînement, évaluation, ou les deux) · durée et conditions de retrait · anonymisation du cartouche · droits sur les annotations et sur le modèle dérivé · exclusivité ou non · rémunération éventuelle · juridiction et loi applicable · conservation et suppression · engagement de ne pas redistribuer · mention du flux scellé (usage en test uniquement pour C).
- **Retrait** : retirer un plan exclut ce plan des futurs entraînements ; un modèle déjà publié n'est pas « désappris ». Les contrats doivent le dire ; la politique est : ré‑entraînement à la version suivante, avec délai annoncé.

## 8. Progression par phases

| Phase | Jalons | Corpus | Entraînement |
|---|---|---|---|
| P0 | M0–M1 | A (échantillon public vérifié) + synthétiques + **C‑BJ initial** | aucun entraînement requis : extraction vectorielle + OCR pré‑entraîné + traçage assisté |
| P1 | M2 | A élargi + **B amorce** | premiers modèles de segmentation/ouvertures ; rapports par tranche |
| P2 | M3 → V1 | B élargi (plusieurs pays africains, tous types de source) | affinage, détection de hors‑domaine, boucle de corrections consenties |
| P3 | V1 → V2 | A diversifié (Amériques, Asie, Europe, plans contemporains complexes) | généralisation ; décision par les métriques d'éventuels adaptateurs légers (voir ci‑dessous) |
| Par marché | à chaque nouveau pack | **un corpus C par marché** | pas d'entraînement spécifique au pays par défaut |

**Décision d'architecture** : un seul modèle universel par tâche. Des adaptateurs régionaux légers ne seront envisagés que si les métriques par tranche montrent un écart systématique **et** qu'un volume suffisant justifie le coût de maintenance (ADR dédié le moment venu).

## 9. Lien avec le métré

- Le **métré géométrique** (surfaces, longueurs, volumes, comptages) est universel et testé sur des **projets synthétiques à vérité analytique**.
- Le **métré commercial** (blocs, ciment, main‑d'œuvre…) dépend d'un pack ; il est validé sur le corpus C du marché avec la référence d'un professionnel local.
- Ainsi, un défaut de perception (corpus A/B) et un défaut de règle locale (corpus C) sont **détectables séparément**.

## 10. Risques

| Risque | Réponse |
|---|---|
| Licences des jeux publics incompatibles avec un usage commercial | inventaire licence par jeu ; plan B = synthétique + partenariats |
| Biais géographique/graphique du corpus A | corpus B ; rapports par tranche ; porte de disponibilité |
| Corpus B coûteux à constituer | partenariats universités/cabinets ; annotation pré‑remplie par le modèle ; mesurer le gain marginal avant d'étendre |
| Fuite entre train et test | découpage par source, dédoublonnage, scellement |
| Engagement excessif sur « universel » | domaine de validité déclaré et publié |
| Raccourci « pays » appris par le modèle (langue, cartouche, style) | têtes géométrie/texte séparées, masquage, leave‑one‑region‑out, ablation (T‑AI‑03) |
| Fuite du scellé via corrections produit, dérivés ou doublons redessinés | propagation du scellé, flux P séparé, accès technique distinct, dédoublonnage inter‑corpus |
| Licence des poids pré‑entraînés ou d'une dépendance incompatible avec la distribution commerciale | registre de licences, revue avant adoption |
| Droits d'auteur sur les plans | contrats, registre, retrait |
