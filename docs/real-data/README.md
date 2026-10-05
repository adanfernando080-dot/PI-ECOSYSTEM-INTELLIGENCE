# Données réelles : amorçage, catalogue, adresses

Outils **d'administration en ligne de commande** pour préparer une base vide à accueillir des données réelles, sans aucune donnée fictive. Ils ne remplacent pas le seed DEMO (qui reste réservé au développement local).

| Besoin | Commande | Écrit par défaut ? |
|---|---|---|
| Catégories + premier administrateur | `npm run db:bootstrap` | **non** (simulation) |
| Import du catalogue d'applications | `npm run catalogue:import -- --file=<fichier.json>` | **non** (simulation) |

Tout ce qui écrit exige `--apply`. Sans lui, les outils lisent la base, valident et affichent exactement ce qui serait fait.

## Principes

- **Rien n'est inventé.** Le catalogue n'accepte que des champs documentés ; les chiffres (métriques, scores, transactions, staking, notes…) sont **refusés** : ils sont calculés à partir de données réelles par les moteurs. Aucune adresse n'est devinée ni dérivée.
- **Déclaré ≠ vérifié.** Une adresse est `DECLARED` tant que le fichier ne documente pas une vérification (méthode + preuve + date). Elle conserve toujours sa provenance (`source`, `sourceNote`). Une base de données interdit d'enregistrer « vérifiée » sans méthode, preuve et date.
- **Applications importées :** `isDemo = false`, non revendiquées (aucun développeur lié), statut `PENDING` par défaut (non listées publiquement tant qu'un administrateur ne les active pas ; un statut `ACTIVE` explicite est possible dans le fichier).
- **Jamais d'écrasement.** Une application existante n'est pas modifiée : les différences sont signalées comme conflits. La vérification d'une adresse ne peut qu'être améliorée (déclarée → vérifiée), jamais rétrogradée.
- **Idempotent.** Relancer le même fichier ne change rien.
- **Pas de mélange avec le DEMO.** Si la base contient des lignes `isDemo`, l'écriture est refusée (option réservée aux tests locaux : `--allow-demo-data-present`).

## Sécurité contre les opérations accidentelles

Même mécanisme que le seed (`packages/database/src/seed/guard.ts`), variable **distincte** :

- base **locale** : autorisée ;
- base **distante** (Neon…) : `--apply` est refusé sauf si `DB_ALLOW_REMOTE_WRITE` vaut **exactement le nom d'hôte** de la base (ni `true`, ni un autre hôte). Débloquer le seed (`SEED_ALLOW_REMOTE_DATABASE`) ne débloque **pas** ces outils, et inversement ;
- les messages n'affichent que le nom d'hôte, jamais l'URL ni le mot de passe ;
- la simulation (sans `--apply`) ne fait que lire.

## Étape A : `db:bootstrap`

Crée, de façon idempotente : les catégories manquantes (12, voir `taxonomy.ts` ; les existantes ne sont jamais modifiées) et, si demandé, le **premier administrateur**.

```bash
npm run db:bootstrap                                  # simulation
npm run db:bootstrap -- --apply                       # catégories seulement
npm run db:bootstrap -- --apply --admin-pi-username=<VOTRE_NOM_PI> --confirm-admin=<VOTRE_NOM_PI>
```

Règles pour l'administrateur : le nom est fourni **au moment de l'exécution** et saisi **deux fois** ; aucun compte par défaut, aucun identifiant ni jeton n'est créé ni affiché ; création uniquement s'il n'existe **aucun** administrateur ; jamais un nom `demo_…` ; jamais par-dessus un utilisateur existant (pas de promotion).

> **Important :** cette ligne prépare l'identité seulement. Tant que l'authentification Pi n'est pas implémentée, **personne ne peut agir en tant qu'administrateur** sur une base de production (l'API n'émet aucun jeton et `token:dev` est refusé en production). L'import du catalogue passe donc par cette ligne de commande, pas par l'API.

## Étape B : `catalogue:import`

```bash
npm run catalogue:import -- --file=mon-catalogue.json            # validation + simulation
npm run catalogue:import -- --file=mon-catalogue.json --apply    # import
```

Gabarit vide : [`catalogue.template.json`](catalogue.template.json) (importe 0 application). Ne mettez dans votre fichier que des informations réelles et documentées.

**Constituer le catalogue réel :** [`CATALOGUE-GUIDE.md`](CATALOGUE-GUIDE.md) (collecte, sources, rédaction, vérification par un Vérificateur distinct du Rédacteur, repli exceptionnel encadré, approbation de publication et confirmation d'import), [`FICHE-VERIFICATION.md`](FICHE-VERIFICATION.md) (une fiche par application) et [`catalogue.registre.template.csv`](catalogue.registre.template.csv) (registre de suivi).

Structure (les valeurs entre `<…>` sont des **emplacements**, pas des données : elles sont refusées si elles sont recopiées telles quelles) :

```jsonc
{
  "schemaVersion": 1,
  "apps": [
    {
      "name": "<nom public de l'application>",              // requis, 2-80 caractères
      "slug": "<identifiant-en-minuscules>",                // requis, jamais dérivé automatiquement
      "categorySlug": "<slug d'une catégorie existante>",   // requis (voir taxonomy.ts)
      "description": "<texte>",                             // facultatif, ≤ 2000
      "url": "<https://…>",                                 // facultatif, https uniquement
      "logoUrl": "<https://…>",                             // facultatif, https uniquement
      "tags": ["<tag>"],                                    // facultatif, ≤ 10
      "status": "PENDING",                                  // facultatif : PENDING (défaut) | ACTIVE | INACTIVE
      "addresses": [                                        // facultatif
        {
          "address": "<adresse publique>",                  // 20-128 caractères alphanumériques
          "label": "<libellé>",                             // facultatif
          "sourceNote": "<où cette adresse a été trouvée>", // REQUIS : provenance
          "verification": {                                 // facultatif ; absent = déclarée
            "status": "verified",                           // "declared" | "verified"
            "method": "ADMIN_REVIEW",                       // ADMIN_REVIEW | OWNER_SIGNATURE | ONCHAIN_CHALLENGE
            "evidence": "<ce qui prouve la vérification>",  // requis si verified, ≥ 10 caractères
            "verifiedAt": "<date ISO 8601>"                 // requis si verified, pas dans le futur
          }
        }
      ]
    }
  ]
}
```

Contrôles : champs obligatoires, clés inconnues ou « chiffres » refusés, doublons de slug / nom / adresse (dans le fichier **et** dans la base), catégorie existante, URL https sans identifiants, texte nettoyé du balisage. **Toutes** les erreurs sont listées ; au moindre problème, rien n'est écrit.

## Étape C : adresses (`app_addresses`)

Migration Prisma **additive** `20261002000000_app_addresses` : deux types et une table nouvelle ; aucune table, colonne ni ligne existante n'est modifiée ou supprimée.

- plusieurs adresses par application, unicité (application, adresse), suppression en cascade avec l'application ;
- `source` (`ADMIN_IMPORT` | `DEVELOPER_DECLARED`) et `sourceNote` (obligatoire) : provenance ;
- `verificationStatus` (`DECLARED` | `VERIFIED`) + méthode, preuve, date ; contraintes `CHECK` en base ;
- aucune exposition publique des adresses à ce stade.

Une adresse n'est jamais présentée comme appartenant à une application « vérifiée » sans preuve ; une adresse déclarée n'est pas une donnée observée.

## Mise en service (à ne faire qu'après approbation écrite et explicite du Chef de projet, pour chaque opération à effet réel, avec vérification du résultat : runbook § 1 ; l'import du catalogue exige en outre une confirmation d'import écrite, distincte et traçable, limitée à application + fichier + SHA-256 + opération : guide § 2 quinquies)

1. Fusionner la branche dans `main`, puis un déploiement Render **manuel** : la build command applique la migration (additive) via `npm run db:migrate`.
2. Depuis un terminal local (URL saisie sans écho, jamais affichée) :
   ```bash
   read -rs -p "DATABASE_URL Neon: " DATABASE_URL; echo; export DATABASE_URL
   npm ci --include=dev && npm run db:generate
   npm run db:bootstrap                      # simulation : vérifier le plan
   DB_ALLOW_REMOTE_WRITE='<HOTE_NEON>' npm run db:bootstrap -- --apply
   npm run catalogue:import -- --file=<catalogue.json>                                  # simulation
   DB_ALLOW_REMOTE_WRITE='<HOTE_NEON>' npm run catalogue:import -- --file=<catalogue.json> --apply
   unset DATABASE_URL
   ```
3. Vérifier dans le SQL Editor de Neon : `SELECT count(*) FROM apps WHERE "isDemo"` doit valoir 0.

Ne jamais lancer `db:seed` ni `db:reset` sur cette base.
