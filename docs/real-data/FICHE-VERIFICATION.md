# Fiche de vérification — une application

> **Modèle à copier.** Une fiche par application, remplie **hors dépôt** (dossier privé `catalogue-private/` ou équivalent) : elle contient des liens, des preuves et des noms de personnes. **Ne la commitez pas.** Les règles sont dans le [guide](CATALOGUE-GUIDE.md).
> Les valeurs entre `<…>` sont à remplacer. Ne rien inventer : une case non justifiée reste **non cochée**.

## A. Identification

| Élément | Valeur |
|---|---|
| N° de fiche | `<FICHE-001>` |
| Slug proposé | `<slug>` |
| Nom public exact | `<nom>` |
| Catégorie (`categorySlug`) | `<un des 12 slugs>` |
| Rédacteur | `<nom>` — date de rédaction `<AAAA-MM-JJ>` |
| Vérificateur (distinct du rédacteur ; en cas de repli : voir § H2) | `<nom>` — date de vérification `<AAAA-MM-JJ>` |

## B. Sources consultées (au moins une **officielle**)

| # | Type (officielle / déclaration datée / autre) | URL ou référence exacte | Date de consultation | Archive (réf. capture) |
|---|---|---|---|---|
| 1 | `<officielle>` | `<https://…>` | `<AAAA-MM-JJ>` | `<…>` |
| 2 | | | | |

## C. Contenu à publier (copie **exacte** de ce qui ira dans le JSON)

| Champ | Valeur | Source n° |
|---|---|---|
| `name` | | |
| `slug` | | |
| `categorySlug` | | |
| `description` (ou « aucune ») | | |
| `url` (ou « aucune ») | | |
| `logoUrl` | « aucune » (sauf autorisation écrite : référence `<…>`) | |
| `tags` (ou « aucun ») | | |
| `status` proposé | `ACTIVE` (seulement si décision GO) | — |

## D. Contrôles du vérificateur (à refaire **à partir des sources**, pas à partir de la fiche)

Cocher **OK** / **KO** / **N.A.** et justifier tout KO.

| # | Contrôle | OK / KO / N.A. | Commentaire |
|---|---|---|---|
| D1 | Le **nom** et le **slug** correspondent à l'application réelle (orthographe, pas de confusion avec une autre) | | |
| D2 | La **catégorie** est la plus fidèle à l'usage réel | | |
| D3 | L'**URL** est officielle, en `https`, sans identifiants, et répond | | |
| D4 | Chaque affirmation de la **description** se retrouve dans une source officielle (rien d'extrapolé) | | |
| D5 | La description est **neutre** : aucun superlatif, jugement, promesse, comparaison ni mention d'agrément Pi/Pi Core Team | | |
| D6 | **Aucun chiffre** (utilisateurs, transactions, revenus, notes, classement, staking) | | |
| D7 | **Aucune donnée personnelle** de personne physique (sauf mention officielle publique) | | |
| D8 | **Droits** : pas de logo ni de texte d'un tiers sans autorisation ; `logoUrl` vide ou autorisé | | |
| D9 | Pas de doublon : l'application n'existe pas déjà sous un autre nom ou slug (catalogue, registre) | | |
| D10 | Les sources sont **publiques** ; aucune information obtenue par un accès non autorisé | | |
| D11 | Le contenu est **à jour** à la date de vérification | | |

## E. Adresses publiques (une ligne par adresse ; laisser vide s'il n'y en a pas)

| # | Adresse (copie exacte) | `sourceNote` (où publiée, date) | Proposée : déclarée / vérifiée | Méthode | Preuve (`evidence`) | Date de vérification |
|---|---|---|---|---|---|---|
| 1 | `<…>` | `<page officielle + date>` | `<déclarée>` | — | — | — |
| 2 | | | | | | |

Contrôles du vérificateur sur les adresses :

| # | Contrôle | OK / KO / N.A. |
|---|---|---|
| E1 | Chaque adresse est **publiée par l'application ou son développeur** (source consultée par le vérificateur) | |
| E2 | Aucune adresse n'est devinée, déduite ou trouvée par exploration de la blockchain | |
| E3 | Une adresse « **vérifiée** » a une **méthode**, une **preuve réelle** et une **date de vérification** (≤ aujourd'hui) | |
| E4 | La preuve ne contient **aucune clé secrète**, phrase de récupération ni mot de passe | |
| E5 | Chaque adresse n'apparaît que pour **cette** application (pas déjà dans une autre fiche) | |

## F. Réserves et risques

- Points sensibles (droits, vie privée, affirmation contestable, application récente ou peu documentée) : `<…>`
- Moyen de **rectification / retrait** du titulaire connu ? `<oui / non — contact public>`

## G. Décision

☐ **GO — publier** (`status: "ACTIVE"`) : toutes les lignes D et E sont **OK** ou **N.A. justifiées**, et la vérification humaine est valide. **GO n'est pas une confirmation d'import** : l'import exige séparément la confirmation d'import ([guide](CATALOGUE-GUIDE.md) § 2 quinquies).
☐ **À COMPLÉTER** : motif `<…>` (l'application **n'entre pas** dans le fichier pour l'instant).
☐ **NO-GO** : motif `<…>`.

Vocabulaire des statuts : [guide](CATALOGUE-GUIDE.md) § 2 quater. Validité de la vérification : guide § 2 sexies.

Motif / commentaire du vérificateur : `<…>`

## H. Signatures (trois rôles distincts)

Rédaction, vérification et approbation de publication sont trois fonctions distinctes ([guide](CATALOGUE-GUIDE.md) § 2). Seuls trois rôles opérationnels existent : Rédacteur, Vérificateur, Chef de projet. Cumuls (guide § 2 ter) : Rédacteur + Vérificateur uniquement dans le repli exceptionnel (H2) ; Rédacteur + Chef de projet et Vérificateur + Chef de projet autorisés ; les trois rôles cumulés par une seule personne ne peuvent pas satisfaire le repli, qui exige un Chef de projet distinct du Rédacteur/Vérificateur. Aucun cumul ne supprime les exigences de preuve, de traçabilité ou de relecture.

### H1. Procédure normale

| Rôle | Fonction | Nom | Date | Signature / initiales |
|---|---|---|---|---|
| Rédacteur | prépare la fiche et le dossier | | | |
| Vérificateur (**distinct du rédacteur**) | vérification indépendante à partir des sources | | | |
| Chef de projet | **approbation de publication** (acte 1) | | | |

La **confirmation d'import** (acte 2) est une confirmation écrite **distincte** (guide § 2, étape 7 et § 2 quinquies) : elle n'est pas signée dans cette fiche, mais elle est conservée avec elle.

### H2. Procédure de repli — à remplir **uniquement** si le repli est utilisé (guide § 2 bis)

| Élément | Valeur |
|---|---|
| Raison du recours au repli (aucun Vérificateur distinct réellement disponible, de façon exceptionnelle et temporaire) | |
| Date et heure de la première vérification par le Rédacteur (fin) | |
| Date et heure de la relecture à froid (seconde lecture complète) — au moins 24 h après la fin de la première vérification | |
| Identité de la personne exerçant le repli | |
| Justification de la conformité des critères | |
| Une seule application à la fois (ou décision explicite et documentée du Chef de projet : référence) | |
| Approbation du Chef de projet (nom, date, signature) | |
| Signatures (minimum 2, par deux personnes distinctes) : (1) Rédacteur/Vérificateur ; (2) Chef de projet, distinct du Rédacteur/Vérificateur | |

## I. Traçabilité du fichier importé

| Élément | Valeur |
|---|---|
| Fichier JSON vérifié | `catalogue.real.json` (hors dépôt) |
| Empreinte `sha256sum` au moment de la vérification | `<64 caractères hexadécimaux>` |
| Empreinte recalculée **juste avant l'import** | `<identique ? oui / non>` — si **non** : stop |
| Résultat de la simulation | `<N to create, 0 error, 0 conflict>` |
| Simulation faite sur le fichier de l'empreinte approuvée ; exécutant (identité) | `<oui / non — nom>` |
| Résultat de la simulation vérifié par le Chef de projet avant la confirmation d'import (simulation réussie, même fichier, même SHA-256, opération autorisée) ; date | `<oui / non — date>` |
| Confirmation d'import (acte 2) : référence du support traçable dans `catalogue-private/`, décision « AUTORISÉ POUR IMPORT » | `<référence>` |
| Date et heure de l'import (UTC) | `<…>` |
