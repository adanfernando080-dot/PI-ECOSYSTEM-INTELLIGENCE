# ADR-0007 — Authentification V1

- Statut : accepté (V1) — à remplacer par Pi authentication

## Contexte
L'authentification Pi n'est pas encore branchée, mais les rôles `USER`, `DEVELOPER`, `ADMIN` et les permissions doivent fonctionner.

## Décision
- Jetons **JWT HS256** vérifiés avec `node:crypto` (`auth/jwt.ts`) : seul `HS256` est accepté (rejette `alg: none`), comparaison à temps constant, `iss` et `exp` vérifiés.
- Le jeton ne porte que `sub`. **Le rôle est relu en base à chaque requête** : impossible d'escalader ses droits en forgeant un jeton.
- RBAC hiérarchique (`ADMIN ⊃ DEVELOPER ⊃ USER`) + contrôle de propriété (`canManageApp`) dans `auth/policies.ts`. Les routes admin ont un garde routeur **et** chaque service revérifie (défense en profondeur).
- En développement, `npm run token:dev -- <piUsername>` émet un jeton (refusé si `NODE_ENV=production`).

## Évolution prévue
Un endpoint `POST /api/auth/pi` vérifiera le jeton Pi via `PiAuthProvider`, créera/relira l'utilisateur et renverra un JWT de ce type.
