# ADR-0009 — Journal d'opérations (oplog), révisions et annulation

- Statut : **Accepté pour M0** (implémenté : `src/core/ops/oplog.ts`, `tests/ops`)
- Liens : ADR-0005, ADR-0007 · REQ-13, REQ-26

## Contexte
Toute modification (humaine, assistant, optimisation) doit être traçable, annulable, et permettre à un document émis de rester rattaché à la révision exacte qui l'a produit. La synchronisation cloud (V1) doit réutiliser le même mécanisme.

## Décision
1. **Révision = hash de contenu** : `stateRev = hash(modelRev, assumptionSetRev)`. Les états sont **immuables** : appliquer une opération renvoie un nouvel état ; l'ancien n'est jamais modifié.
2. **Opération = enregistrement immuable** `{opId, parentRev, resultRev, op, inverse, hlc, actor}`. `opId` est déterministe (hash du contenu).
3. **Inverse calculé à l'application** (valeur précédente capturée) ; **annuler = appliquer l'inverse** comme une NOUVELLE opération : l'historique est ajouté, jamais réécrit. Refusé si l'état courant n'est pas celui produit par l'opération.
4. **Horloge fournie par l'appelant** (`hlc: {wall, counter, node}`) : le noyau n'a ni horloge ni aléa. L'application branchera une vraie HLC ; la synchronisation (V1) échangera ces mêmes enregistrements, idempotents par `opId`.
5. **Vocabulaire d'opérations minimal en M0** : `moveNode`, `setOpeningSize`, `setAssumptionValue`. Chaque nouvelle opération est un changement d'API du noyau (test + inverse obligatoires). Les opérations IA (acceptation d'une proposition) suivront en M1.
6. Une opération ne peut pas produire un modèle invalide (le modèle résultant est revalidé par l'appelant avant chiffrage ; `validateModel` fait partie du pipeline).

## Conséquences
- (+) Continuité conception → chiffrage (REQ‑26) : opération ⇒ nouvelle révision ⇒ nouveau métré ; documents anciens intacts et vérifiables.
- (−) Pas encore de fusion de révisions concurrentes (V1) ; pas de compaction de l'historique.

## Alternatives écartées
Snapshots seuls (pas de causalité ni d'annulation fine) ; event sourcing complet avec reconstruction obligatoire (surdimensionné pour M0).
