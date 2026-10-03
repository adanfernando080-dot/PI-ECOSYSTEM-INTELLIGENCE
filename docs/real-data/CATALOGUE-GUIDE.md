# Guide du catalogue réel — collecte, rédaction, vérification

Ce guide dit **comment constituer** le fichier `catalogue.real.json` importé par `npm run catalogue:import` (voir [`README.md`](README.md)). Il accompagne la [fiche de vérification](FICHE-VERIFICATION.md) et le [registre de suivi](catalogue.registre.template.csv).

> **Ce kit ne contient aucune donnée d'application.** Les valeurs entre `<…>` sont des emplacements : l'outil d'import les **refuse** si elles sont recopiées telles quelles. Le catalogue réel est un travail de collecte humain, sourcé, hors du dépôt.

## 1. Règles d'or

1. **Réel et sourcé, ou absent.** Une information qu'on ne peut pas sourcer n'entre pas dans le fichier. On ne comble jamais un champ « pour faire joli ».
2. **Aucun chiffre.** Pas de nombre d'utilisateurs, de transactions, de revenus, de notes, de classement, de staking : ils sont calculés plus tard par les moteurs à partir de données réelles. L'outil refuse ces champs.
3. **Déclaré n'est pas vérifié.** Une adresse est *déclarée* tant qu'une vérification documentée n'existe pas (méthode, preuve, date).
4. **Deux personnes.** Dans le processus normal, le rédacteur du fichier et le vérificateur sont **deux personnes différentes** : le Vérificateur est **distinct du Rédacteur**. **Repli exceptionnel :** lorsqu'aucun Vérificateur distinct du Rédacteur n'est disponible de façon exceptionnelle et temporaire, la procédure de repli documentée (§ 2 bis) peut être utilisée, sous réserve du respect de ses conditions et de sa traçabilité. Le repli n'est pas le mode normal de fonctionnement et ne supprime pas, de façon générale, l'exigence d'indépendance de la vérification.
5. **Neutralité.** Le catalogue décrit ; il ne juge pas, ne classe pas, ne recommande pas, n'accuse pas.
6. **Pas d'accès privé.** On n'utilise que des informations **publiques**. Jamais d'analytics privées, de données personnelles, ni d'accès obtenu sans autorisation.
7. **Ce n'est pas une validation officielle.** Aucune mention suggérant un agrément, un soutien ou une validation par la Pi Core Team ou par Pi Network.

## 2. Processus (une application à la fois)

```
1 Préparer ─► 2 Vérifier ─► 3 Relecture à froid (si requise) ─► 4 Décision de vérification
                                                                        │
 8 Import (après autorisation explicite) ◄─ 7 Approbation d'import ◄─ 6 Simulation ◄─ 5 Approbation de publication + empreinte ◄─┘
```

| # | Étape | Qui | Sortie |
|---|---|---|---|
| 1 | **Préparer** : rassembler les sources publiques (§3) ; remplir la [fiche](FICHE-VERIFICATION.md) : sections A à C et E ; relire à froid (le lendemain) et corriger | rédacteur | liens datés, copies d'écran/archives, fiche stabilisée |
| 2 | **Vérifier** : contrôler **indépendamment** chaque champ à partir des sources (sections D, F) | vérificateur, **distinct du rédacteur** (processus normal) ; en cas de repli : § 2 bis | contrôles renseignés |
| 3 | **Relecture à froid lorsque requise** : uniquement en cas de repli (§ 2 bis) | personne exerçant le repli | relecture consignée |
| 4 | **Décision de vérification** motivée GO / NO-GO (la fiche § G prévoit aussi « À compléter ») ; signatures du rédacteur et du vérificateur (fiche § H) | vérificateur ; rédacteur (signature) | décision motivée, fiche signée par ces deux rôles |
| 5 | **Approbation de publication** (acte 1) : le chef de projet approuve la publication (signature, fiche § H) ; calculer l'**empreinte** du fichier JSON | chef de projet (approbation) | fiche signée par les trois rôles, empreinte notée |
| 6 | Simulation `npm run catalogue:import -- --file=…` (lecture seule) | rédacteur | rapport « N to create, 0 error, 0 conflict » |
| 7 | **Approbation d'import** (acte 2) : confirmation écrite **distincte** de l'approbation de publication, traçable, identifiant au minimum l'opération autorisée, la cible et l'empreinte du fichier ; associée à la fiche signée. Support exact et portée : **À CONFIRMER PAR LE RESPONSABLE DU PROJET** | chef de projet | confirmation écrite d'import |
| 8 | Import `--apply` **uniquement** après l'autorisation explicite de l'étape 7 et si l'empreinte est identique | exécution technique (runbook § 8.4) | applications créées |

L'approbation de publication (étape 5) **ne vaut pas** autorisation d'import (étape 7).

Les applications **NO-GO ou non encore vérifiées ne figurent pas dans le fichier** : elles restent dans le registre (`A_VERIFIER`, `REFUSEE`).

### 2 bis. Repli exceptionnel (aucun Vérificateur distinct disponible)

Lorsqu'aucun Vérificateur distinct du Rédacteur n'est disponible de façon exceptionnelle et temporaire, la procédure de repli documentée peut être utilisée, sous réserve du respect de ses conditions et de sa traçabilité. Le repli est une **exception encadrée** au processus normal, avec des garde-fous renforcés : il peut permettre de poursuivre vers un GO **uniquement** si toutes ses conditions sont satisfaites. Il ne supprime pas, de façon générale, l'exigence d'indépendance. Si aucun Vérificateur distinct n'est disponible et que les conditions du repli ne sont pas toutes satisfaites, le Rédacteur ne peut pas vérifier seul : la vérification n'est pas valide et le dossier ne peut pas progresser vers le GO.

Conditions :
- **Circonstance** : absence exceptionnelle **et temporaire** d'un Vérificateur distinct. Le repli ne doit pas devenir le mode normal d'une équipe qui ne dispose durablement que d'une personne ; une absence **durable** de Vérificateur est une question de gouvernance distincte, et non une utilisation répétée du repli.
- **Délai minimal : au moins 24 h** (plancher : ≥ 24 h, pas nécessairement égal à 24 h). Principe approuvé : le délai sépare la fin de la rédaction / première vérification concernée par le repli et la relecture à froid exigée avant l'approbation finale. Les événements exacts de départ et d'arrivée ne sont pas définis sans ambiguïté : **À CONFIRMER PAR LE RESPONSABLE DU PROJET**.
- **Relecture à froid** (étape 3), puis décision de vérification (étape 4).
- **Traçabilité** : la mise en œuvre du repli est consignée (fiche § H2). Niveau exact de justification écrite : **À CONFIRMER PAR LE RESPONSABLE DU PROJET**.
- **Approbations requises** : l'approbation de publication (étape 5) et l'approbation d'import (étape 7) restent distinctes et inchangées ; d'éventuelles approbations propres au repli : **À CONFIRMER PAR LE RESPONSABLE DU PROJET**.
- Nombre de signatures en cas de repli : **À CONFIRMER PAR LE RESPONSABLE DU PROJET**.

## 3. Sources

**Acceptables** (au moins **une source officielle** par application) :
- le **site officiel** de l'application ou de son développeur (HTTPS) ;
- l'**annuaire ou la page officielle** de l'écosystème Pi dans lequel l'application est référencée, **à vérifier dans la documentation Pi officielle actuelle** (n'en supposez aucune sans l'avoir consultée) ;
- une **déclaration publique et datée** du développeur (page du projet, publication signée de son compte officiel) ;
- pour une adresse : la page officielle où le développeur la publie, ou une preuve de contrôle (§7).

**Refusées** : rumeurs, publications anonymes, messages privés, captures sans URL, descriptions rédigées par un outil d'IA sans source, textes copiés d'un tiers sous droits, toute donnée non publique.

Conservez pour chaque source : l'**URL exacte**, la **date de consultation** et, si possible, une archive (capture datée ou archivage web). Elles vont dans la section B de la fiche, **hors dépôt**.

## 4. Champ par champ

Limites **vérifiées dans le code** (`packages/database/src/real-data/catalogue.ts`). Le fichier entier est refusé si un seul champ est invalide ; **toutes** les erreurs sont listées.

| Champ | Obligatoire | Règle | Où le trouver / erreurs fréquentes |
|---|---|---|---|
| `name` | oui | 2 à 80 caractères, balisage retiré | nom public exact de l'application ; pas de slogan |
| `slug` | oui | minuscules, chiffres et tirets, ≤ 80 ; **jamais dérivé automatiquement** | stable dans le temps ; ex. forme `mon-application` ; deux apps ne partagent jamais un slug |
| `categorySlug` | oui | un des 12 slugs du §5 | choisir **une** catégorie principale |
| `description` | non | ≤ 2000 caractères | voir §6 ; laisser vide plutôt que d'inventer |
| `url` | non | `https` uniquement, ≤ 500, sans identifiants (`user:mdp@`) | adresse officielle ; vérifier qu'elle répond |
| `logoUrl` | non | idem | **laisser vide** sauf autorisation écrite du titulaire des droits |
| `tags` | non | ≤ 10 ; chacun en minuscules, chiffres, tirets, ≤ 30 caractères | pas de marque de tiers ni de jugement (« meilleur ») |
| `status` | non | `PENDING` (défaut, invisible), `ACTIVE`, `INACTIVE` | voir §8 |
| `addresses` | non | ≤ 50 par application | voir §7 |

Dans le fichier : au plus **500 applications**. Un nom déjà présent (insensible à la casse), un slug ou une adresse en double sont refusés, **dans le fichier et dans la base**.

## 5. Choisir la catégorie

| `categorySlug` | Nom | Sens |
|---|---|---|
| `marketplace` | Marketplace | acheter et vendre des biens entre Pioneers |
| `jobs` | Jobs | trouver du travail ou recruter |
| `education` | Education | cours et ressources d'apprentissage |
| `games` | Games | jeux et divertissement |
| `services` | Services | services professionnels et personnels |
| `ai` | AI | outils d'intelligence artificielle |
| `travel` | Travel | réservation et expériences de voyage |
| `shopping` | Shopping | boutiques en ligne |
| `tools` | Tools | utilitaires |
| `social` | Social | réseaux et communautés |
| `payments` | Payments | utilitaires de paiement |
| `creator` | Creator | outils pour créateurs de contenu |

À savoir : la **découverte par besoin** n'utilise que certaines catégories (`buy`/`sell` → marketplace, shopping ; `spend` → shopping, travel, payments ; `work` → jobs, services ; `services` → services ; `ai` → ai ; `games` → games ; `learn` → education). Une application classée `tools`, `social` ou `creator` **n'apparaît pas** dans ces parcours (elle reste visible dans la liste et par recherche). Choisissez la catégorie **la plus fidèle**, pas la plus visible.

## 6. Rédiger la description

**Faire :** une à trois phrases factuelles, à partir de la source officielle, reformulées avec vos mots, sans promesse. Indiquer ce que l'application **fait**, pas ce qu'elle « vaut ».

**Ne pas faire :**
- superlatifs ou jugements (« la meilleure », « incontournable », « fiable », « sécurisée ») ;
- chiffres, performances, gains, promesses de rendement ;
- affirmations sur la Pi Core Team, un agrément, une validation, un partenariat ;
- accusations, soupçons, allusions à une fraude ou à une anomalie ;
- données personnelles (noms, pseudos, contacts de personnes physiques), sauf mention officielle et publique du projet ;
- texte copié d'un tiers sous droits ; langage promotionnel ou comparatif.

Si vous hésitez : **laissez `description` vide** (`null`). Un champ vide est honnête ; une phrase approximative ne l'est pas.

## 7. Adresses publiques : provenance et vérification

Une adresse est **optionnelle** et n'est ajoutée que si elle est **publiée par l'application ou son développeur**. Aucune adresse n'est devinée, déduite ou récupérée par exploration de la blockchain.

- `sourceNote` (**obligatoire**, 5 à 300 caractères) : où l'adresse a été trouvée (page officielle, date). Sans elle, l'entrée est refusée.
- `label` (≤ 60) : usage annoncé (ex. « réception des paiements ») ; facultatif.
- Format accepté : 20 à 128 **lettres et chiffres**, sans espace. L'outil **ne prouve ni la validité sur le réseau, ni l'appartenance** : seule la section « vérification » le fait.

**Déclarée (par défaut)** : elle provient d'une source, rien de plus. **Vérifiée** : uniquement si les trois éléments existent réellement et sont consignés dans la fiche :

| Méthode (`method`) | Ce qu'elle signifie | Preuve à consigner (`evidence`, 10 à 500 caractères) |
|---|---|---|
| `ADMIN_REVIEW` | recoupement par le vérificateur de plusieurs sources officielles concordantes | liste des sources comparées et date |
| `OWNER_SIGNATURE` | le titulaire a signé un message de défi avec la clé de cette adresse | référence du message, du défi et de la signature (aucune clé secrète !) |
| `ONCHAIN_CHALLENGE` | le titulaire a émis, depuis cette adresse, une opération portant un code de défi | identifiant de l'opération publique et du défi |

Ces méthodes sont des **libellés** : la plateforme ne les exécute pas automatiquement. La preuve est celle que **vous** avez réellement obtenue. `verifiedAt` est la date de **la vérification**, jamais postérieure à aujourd'hui.

**Ne communiquez, ne copiez et ne stockez jamais de clé secrète, de phrase de récupération ou de mot de passe**, ni dans la fiche ni dans le fichier.

## 8. Statut de publication

| `status` | Effet | Quand |
|---|---|---|
| `ACTIVE` | **visible publiquement** (liste, fiche) | seulement si la fiche est **GO**, signée par les **trois** rôles (processus normal, ou repli aux conditions du § 2 bis) |
| `PENDING` | invisible du public | application importée mais non publiée (**non recommandé** : sans authentification administrateur en production, la publier ensuite exige du SQL manuel sur approbation) |
| `INACTIVE` | **reste visible** par son lien direct | ne **pas** l'utiliser pour « cacher » |

Règle de simplicité : **une application vérifiée → `ACTIVE` ; une application non vérifiée → absente du fichier.** Le statut d'une application existante ne peut pas être modifié par l'import.

## 9. Droits, vie privée, retrait

- Vous publiez des informations sur des **tiers** : prévoyez un moyen de **rectification ou de retrait** sur demande du titulaire, et traitez-la dans un délai raisonnable. Le retrait d'une application importée se fait aujourd'hui par SQL sur approbation (voir le runbook, §11).
- Pas de logo, d'image ou de texte sous droits sans autorisation.
- Pas de donnée personnelle ; l'identité du **développeur** n'est pas dans ce fichier (le rattachement d'un développeur passe par la revendication, plus tard).
- Avant une soumission à l'écosystème Pi, **revérifier les exigences officielles actuelles** (ne supposez pas qu'un ancien critère est encore valable).

## 10. Construire le fichier

1. Copier le gabarit vide : `cp docs/real-data/catalogue.template.json ./catalogue.real.json` (**hors dépôt** : les motifs `catalogue.real*.json` et `catalogue-private/` sont ignorés par Git).
2. Ajouter **une entrée par fiche GO**. Structure (emplacements, refusés tels quels) :

```jsonc
{
  "schemaVersion": 1,
  "apps": [
    {
      "name": "<nom public exact>",
      "slug": "<identifiant-en-minuscules>",
      "categorySlug": "<un des 12 slugs du §5>",
      "description": "<1 à 3 phrases factuelles, ou supprimer la ligne>",
      "url": "<https://site-officiel>",
      "tags": ["<tag-en-minuscules>"],
      "status": "ACTIVE",
      "addresses": [
        {
          "address": "<adresse publique publiée par l'application>",
          "label": "<usage annoncé>",
          "sourceNote": "<page officielle + date de consultation>",
          "verification": {
            "status": "verified",
            "method": "ADMIN_REVIEW",
            "evidence": "<ce qui a été recoupé, avec dates>",
            "verifiedAt": "<AAAA-MM-JJ>"
          }
        }
      ]
    }
  ]
}
```
Supprimez les clés facultatives que vous ne pouvez pas sourcer (`description`, `url`, `tags`, `addresses`, `verification`). `verification` est à omettre pour une adresse simplement déclarée.

3. **Empreinte du fichier vérifié** (à consigner dans la fiche et le registre) :
```bash
sha256sum ./catalogue.real.json        # Git Bash / WSL (macOS : shasum -a 256)
```
Avant l'import, recalculer : **si l'empreinte diffère, le fichier n'est plus celui qui a été vérifié : stop.**

## 11. Ce que l'outil contrôle, et ce qu'il ne contrôle pas

| L'outil contrôle (automatique) | Seul un humain contrôle |
|---|---|
| champs obligatoires, types, longueurs, https | que l'information est **vraie** et à jour |
| clés inconnues, **chiffres** refusés | que la description est **neutre** et licite |
| doublons (slug, nom, adresse) dans le fichier et la base | que l'adresse **appartient bien** à l'application |
| catégorie existante | que les **droits** (logo, texte) sont respectés |
| refus de mélanger avec des données démo ; jamais d'écrasement | que la **preuve** de vérification existe réellement |
| atomicité : une erreur n'écrit rien | que l'import a été **approuvé** |

## 12. Checklist avant l'import

- [ ] Chaque application du fichier a une fiche **signée** (rédacteur, vérificateur, chef de projet), décision **GO**. Processus normal : vérificateur **≠ rédacteur**. En cas de repli : conditions du § 2 bis satisfaites et consignées (fiche § H2).
- [ ] L'**approbation de publication** du chef de projet est donnée (acte 1).
- [ ] Chaque application a au moins **une source officielle** consignée.
- [ ] Aucune description ne contient de chiffre, de superlatif, de donnée personnelle ni de mention d'agrément.
- [ ] Chaque adresse a une `sourceNote` ; chaque adresse « vérifiée » a méthode, preuve et date réelles.
- [ ] L'empreinte du fichier est identique à celle consignée.
- [ ] La simulation répond `N to create`, **0 error**, **0 conflict**.
- [ ] Le runbook ([`../deployment/RUNBOOK-real-data.md`](../deployment/RUNBOOK-real-data.md)) est à jour de ses étapes 1 à 7.
- [ ] L'**approbation d'import** (acte 2) est donnée **par écrit**, distincte de l'approbation de publication, et identifie l'opération, la cible et l'empreinte du fichier.
