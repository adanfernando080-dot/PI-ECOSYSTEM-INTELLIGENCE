# ADR-0015 — Contrat `AiProposal` et ports IA

- Statut : **Accepté pour les contrats (implémentés)** ; **aucun détecteur ni OCR n'existe** (M2). Liens : ADR-0005, ADR-0017 · REQ-03, REQ-20, REQ-25

## Décision
1. **Le moteur ne dépend pas de l'IA.** `src/core/ai` n'est importé par aucun autre module du noyau (test statique) et ne contient aucun terme économique ou réglementaire local.
2. **Ports** : `OcrPort`, `DetectorPort` (async, avec `id` et `modelHash`). Implémentation locale ou cloud interchangeable ; le cloud exige un consentement par projet vérifié par l'hôte (ADR-0017). Seul un bouchon de test existe, dans `tests/`.
3. **Source** : `registerSource` reconnaît PDF/PNG/JPEG par signature, lit les dimensions des images, empreinte SHA-256 ; le nombre de pages d'un PDF est `null` (non analysé) — jamais inventé.
4. **Échelle** : `ScaleCalibration` est toujours saisie par un humain (deux points + longueur réelle) ; conversion pixel→0,1 mm en entiers exacts. Aucune échelle déduite n'est appliquée.
5. **Proposition** : `AiProposal {payload neutre, evidence{source, page, bbox, detectorId, modelHash}, confidence, state}`. États : `proposed → accepted | edited | rejected`.
6. **Porte** (`decide`) : unique chemin vers le modèle ; produit des **opérations ordinaires** de l'oplog (`addNode/addWall/addOpening`), annulables, avec origine `ai_detected` (ou `user_corrected` si modifiée), `validation` `accepted`/`edited`, preuve et confiance. Rejet = aucune opération. Sans calibration confirmée : refus. Un texte détecté n'entre jamais dans le modèle.
7. **Pas d'invention** : l'épaisseur/hauteur absentes de la proposition restent `unspecified` et **bloquent** le métré tant que l'humain ne les renseigne pas ou ne confirme pas une hypothèse.
8. Les propositions en attente peuvent être stockées dans `ai/` du `.btpx` sans effet sur les empreintes de calcul.

## Limites connues
Acceptation unitaire seulement (l'acceptation par lot `batch_accepted` et les seuils de confiance viennent avec l'évaluation M2) ; murs droits, pas de pièces/dalles/toitures proposées ; aucune évaluation de performance de perception.
