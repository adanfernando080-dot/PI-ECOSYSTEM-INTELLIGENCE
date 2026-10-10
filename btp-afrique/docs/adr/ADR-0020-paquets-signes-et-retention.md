# ADR-0020 — Paquets signés, intégrité et rétention

- Statut : **Accepté pour M0** (implémenté : `core/pack/validate.ts` `verifyPackIntegrity`, `adapters/signature.ts`, `tests/market/packs.test.ts`)
- Liens : ADR-0004, ADR-0016 · REQ-24

## Décision
1. **Deux niveaux d'intégrité** : (a) `contentHash` = hash canonique du contenu (hors `contentHash`/`signature`) ; (b) `signature` Ed25519 du `contentHash`. L'héritage vérifie le `contentHash` du parent déclaré par l'enfant (parent altéré ⇒ refus).
2. **Le noyau n'embarque aucune cryptographie asymétrique** : il dépend d'un port `SignatureVerifier` ; l'adaptateur Node (Ed25519) le fournit. Un pack signé sans vérificateur est refusé.
3. **Classe de données** : tout pack et tout prix porte `dataClass`. Un pack `commercial` doit être signé et ne peut contenir aucun prix `synthetic/test` ; un pack synthétique ne peut contenir que des prix synthétiques. Les documents issus d'un pack synthétique portent une **bannière obligatoire**.
4. **Clé de test** : la graine de la clé de test est **publique** dans le dépôt (`adapters/signature.ts`) et ne protège rien ; les clés de publication réelles ne seront jamais versionnées (gestion des clés : décision ouverte, avant tout pack commercial).
5. **Rétention** : le projet embarque le **pack résolu et le PriceBook utilisés** (ADR‑0016). Politique de purge et de taille : OD‑20 (défaut M0 : tout embarquer).
6. **Mise à jour hors ligne** : un pack se transporte comme un fichier ; l'installation = validation de schéma + intégrité + compatibilité `engineApi` (T‑PKG‑01, M1).

## Conséquences
(+) Prix/règles falsifiés détectés ; reproductibilité des devis. (−) Gestion de clés et de publication à instituer avant le premier pack commercial.
