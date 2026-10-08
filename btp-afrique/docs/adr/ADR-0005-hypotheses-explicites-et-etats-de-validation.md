# ADR-0005 — Hypothèses explicites et états de validation

- Statut : **Proposé** (v0.3, issu de l'audit)
- Liens : ADR-0001 (R7), ADR-0002, ADR-0007 · `ARCHITECTURE.md` §3.3, §3.7, §6.2

## Contexte
Le modèle v0.2 matérialisait des valeurs par défaut du pack (`defaultedBy: pack.bj/…`) dans le modèle architectural : le modèle dépendait d'un pack, un changement de pack aurait pu en modifier la signification, et le test de rejeu multi‑packs (R5) devenait impossible. Par ailleurs, deux mécanismes se chevauchaient : les propositions IA (hors modèle) et un état `unreviewed` des éléments (dans le modèle).

## Décision
1. **Aucune valeur par défaut implicite.** Un attribut non lisible sur le plan est `unspecified`. Tout calcul qui en dépend est `blocked` avec message explicite.
2. **Hypothèse = objet explicite** (`AssumptionSet`, versionné, au niveau projet, hors modèle et hors pack) : clé, valeur, portée, justification, statut (`proposed` | `confirmed`), auteur, date, provenance informative optionnelle (`seededFrom`, chaîne opaque).
3. **Le pack propose, l'utilisateur confirme.** Un `DefaultSpecProfile` génère des hypothèses `proposed` à la création d'un `MarketBinding` ; seules les `confirmed` alimentent l'étage 1. Aucune confirmation implicite (pas de « tout accepter » silencieux à la création du projet ; un « confirmer en lot » explicite est autorisé et tracé).
4. **Changer de pack ne modifie jamais une hypothèse confirmée** ; l'UI affiche les écarts avec le profil du nouveau pack.
5. Les éléments du modèle référencent une hypothèse par `assumptionId` (origine `assumption`).
6. **Machine d'états d'un élément** : proposition IA (`pending`, hors modèle) → `accepted` | `edited` | `batch_accepted` | `rejected` ; saisie directe `user_entered`. `unreviewed` est supprimé. Un élément `batch_accepted` est signalé et listé dans l'annexe jusqu'à revue individuelle.
7. **Propagation de confiance** : plancher = min des confiances des entrées `ai_detected` non revues ; les entrées revues, saisies ou hypothèses confirmées n'abaissent pas le plancher.

## Conséquences
- (+) Étage 1 indépendant du pack ; rejeu multi‑packs possible ; changement de pack sans effet de bord.
- (+) Chaque valeur « non lue sur le plan » est visible et attribuée à une personne.
- (−) Un peu plus de friction à la création d'un projet (confirmer les hypothèses) — atténuée par la confirmation en lot explicite.

## Alternatives écartées
- Défauts silencieux du pack : opacité, dépendance au pack.
- Défauts codés dans le moteur : viole R7.
