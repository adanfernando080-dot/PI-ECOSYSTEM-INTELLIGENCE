# Application de bureau (Electron) — guide

## Architecture
```
renderer (React, sandbox, CSP)  ──IPC explicite (5 canaux)──►  main (Node)  ──► disque (boîtes de dialogue natives), packs vérifiés
   moteur + exports (mêmes modules que partout)                 aucun calcul métier
```
- `apps/desktop/electron/main.ts` : fenêtre, protocole `app://btp/` (sert `apps/desktop/dist`, anti-traversée), CSP en en-tête, blocage de tout réseau externe, permissions refusées, navigation/fenêtres/webview interdits, instance unique, confirmation de fermeture si modifications non enregistrées.
- `electron/preload.ts` : expose `window.btpHost` (gelé) = `listPacks`, `pickFile`, `saveFile`, `setDirty`, `appInfo`. Rien d'autre (ni Node, ni `ipcRenderer`).
- Fichiers : le renderer ne fournit **jamais de chemin**. Ouverture = sélecteur natif (types `btpx`/`plan`, taille bornée) ; enregistrement = boîte « Enregistrer sous » (nom assaini, extension imposée par le type MIME, types non listés refusés).
- Packs : chargés et **vérifiés** (schéma, empreinte, signature Ed25519) par le processus principal, résolus, envoyés au renderer. En production : `resources/market-packs`. ⚠ Clé de signature = clé de TEST publique.
- `src/core` et `src/adapters` n'importent pas Electron (test `tests/desktop`).

## Commandes (depuis `btp-afrique/`)
| But | Commande |
|---|---|
| Installer | `npm install --legacy-peer-deps` (télécharge le binaire Electron) |
| Développement (rechargement à chaud) | `npm run desktop:dev` |
| Lancer le build local dans Electron | `npm run desktop:start` |
| Paquet Linux décompressé (tests) | `npm run desktop:pack` → `release/linux-unpacked/` |
| **Installateur Windows (NSIS x64)** | `npm run desktop:dist:win` → `release/BTP-Afrique-Setup-<version>-x64.exe` ; sous Linux exige `wine` + `wine32:i386` (`apt-get install wine wine64 wine32:i386`) et `xvfb-run` |
| Vérification statique de l'installateur | `npm run desktop:verify-win` |
| Acceptation Electron | `xvfb-run -a npm run desktop:e2e -- dev` puis `... -- packaged` (après `desktop:pack`) |
| Acceptation interface navigateur | `npm run e2e` |

## Limites et risques non résolus
- **Installateur non testé sous Windows** : produit sous Linux avec Wine ; vérifié statiquement (PE x64, charge utile, empreintes) et l'exécutable a tourné 40 s sous Wine sans plantage. L'installation, le démarrage, les associations `.btpx`, la désinstallation et SmartScreen restent à valider sur Windows réel.
- **Non signé** (pas de certificat de signature de code) : Windows SmartScreen avertira. Décision/coût : certificat à acquérir.
- **Icône** : icône Electron par défaut (aucun visuel de marque fourni).
- Tests d'acceptation exécutés avec `--no-sandbox` (conteneur root) : le sandbox Chromium complet n'est pas exercé ; `sandbox: true` du renderer est vérifié par les préférences.
- « Hors ligne » : aucune requête sortante n'est émise ni possible (bloquées et testées) ; non testé en coupant réellement le réseau d'une machine Windows.
- Pas de mise à jour automatique (aucun code d'updater ; l'URL `updates.invalid` du `publish` n'est jamais appelée, elle ne sert qu'à générer le manifeste).
- Hôte de développement (`npm run ui:dev`) conservé ; il n'est pas utilisé en production.
