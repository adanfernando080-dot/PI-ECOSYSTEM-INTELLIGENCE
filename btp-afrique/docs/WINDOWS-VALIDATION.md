# Validation Windows réel — procédure (M0)

> **Statut : NON EXÉCUTÉE.** Aucun poste Windows n'a été utilisé à ce jour. Ce qui a été vérifié sous Linux (installateur produit avec Wine, contrôle statique, exécutable resté 40 s sous Wine, application Electron testée sous Linux) est décrit dans `docs/DESKTOP.md`. **Rien de ce qui suit n'est présenté comme acquis tant que la fiche de résultats (§9) n'est pas remplie sur une machine Windows.**
> La signature de code **n'est pas un prérequis** : l'installateur est non signé, SmartScreen avertira (§3). L'achat d'un certificat n'est pas bloquant pour le développement ni pour cette validation.

## 1. Construire et obtenir les artefacts
Sur la machine de build (Linux, dépôt `btp-afrique/`) :
```bash
git status --porcelain            # doit être vide pour une provenance stricte
npm install --legacy-peer-deps
npm test && npm run typecheck && npm run ui:typecheck
# Windows depuis Linux : apt-get install -y wine wine64 wine32:i386 xvfb
WINEDEBUG=-all WINEPREFIX=/tmp/wineprefix xvfb-run -a npm run desktop:dist:win
npm run desktop:verify-win          # 17 contrôles statiques (PE x64, charge utile, asar = build local, 4 packs)
npm run desktop:release-manifest    # écrit release/RELEASE-MANIFEST.json et release/SHA256SUMS.txt
```
Fichiers à transmettre au testeur : `release/BTP-Afrique-Setup-<version>-x64.exe`, `release/SHA256SUMS.txt`, `release/RELEASE-MANIFEST.json`. (`release/` est ignoré par git : l'artefact n'existe que sur la machine qui l'a construit tant qu'il n'est pas publié.)
Alternative sans Linux : sur Windows, `npm install --legacy-peer-deps` puis `npm run desktop:dist:win` fonctionne sans Wine (non exécuté à ce jour).

## 2. Contrôles de provenance et d'empreinte (avant d'installer)
1. Comparer l'empreinte reçue avec `SHA256SUMS.txt` :
   - PowerShell : `Get-FileHash .\BTP-Afrique-Setup-0.0.1-m0-x64.exe -Algorithm SHA256` → doit être identique à la valeur de `SHA256SUMS.txt` **transmise par un second canal** (message séparé).
   - Invite de commandes : `certutil -hashfile BTP-Afrique-Setup-0.0.1-m0-x64.exe SHA256`.
2. Lire `RELEASE-MANIFEST.json` : `bytes` = taille du fichier, `gitCommit` = commit attendu, `gitDirty` = `false` (sinon provenance non stricte), `signed: false`.
3. Propriétés du fichier → onglet « Signatures numériques » : **absente** (attendu, non signé). Si une signature apparaît, elle n'est pas de nous : ne pas installer.
4. Optionnel : analyse antivirus locale ; consigner le résultat.
*Limite* : l'empreinte prouve l'identité du fichier avec celui construit, pas son innocuité ni l'identité du constructeur (aucune signature).

## 3. Installation
1. Double-clic sur l'installateur. **SmartScreen** : « Windows a protégé votre ordinateur » → « Informations complémentaires » → « Exécuter quand même » (attendu car non signé ; consigner l'écran).
2. Assistant NSIS (pas « en un clic ») : choisir le dossier, installation **par utilisateur** (pas d'élévation requise). Noter le dossier choisi.
3. Vérifier : raccourcis Menu Démarrer/Bureau « BTP Afrique », entrée dans « Applications installées », taille ≈ 240 Mo.
*Résultat attendu* : installation sans erreur ; aucun accès réseau demandé.

## 4. Premier démarrage
1. Lancer « BTP Afrique ». Fenêtre en moins de ~10 s ; titre « BTP Afrique — poste de métré » ; écran « Démarrer » avec **3 marchés** dans la liste.
2. Choisir `pack.bj`, ouvrir « le projet de démonstration » : bandeau rouge « DONNÉES SYNTHÉTIQUES », puce « traçabilité vérifiée », onglet Chiffrage : total **5 232 620 XOF** si la date système est dans la fenêtre de prix du pack de test (sinon l'écart doit s'expliquer par l'avertissement `stale_price` ; noter la date système).
3. Relever : antivirus/pare-feu ont-ils réagi ? Une 2ᵉ instance ouvre-t-elle la même fenêtre (instance unique) ?

## 5. Créer, enregistrer, rouvrir un `.btpx`
1. Ouvrir la démonstration, onglet Hypothèses : modifier A-01 (+0,1) puis Appliquer ; noter le total.
2. « Enregistrer .btpx » → boîte Windows « Enregistrer sous » → `projet-test.btpx` sur le Bureau. Le bouton ne doit pas demander de chemin saisi à la main.
3. « Fermer », puis « Choisir un fichier .btpx… » → sélectionner le fichier : message **« recalcul à froid IDENTIQUE »** et même total.
4. Vérifier le fichier hors application : renommer en `.zip`, l'ouvrir (Explorateur) : `manifest.json`, `project.json`, `packs/…`, etc. Sous PowerShell : `Get-FileHash projet-test.btpx` deux fois → identique (le fichier est déterministe).
5. **Fichier corrompu** : copier le fichier, en modifier un octet avec un éditeur hexadécimal, l'ouvrir : message « Fichier .btpx refusé … » et aucun projet ouvert. Ouvrir un fichier texte renommé `.btpx` : refus propre.
6. Fermer la fenêtre avec modifications non enregistrées : boîte de confirmation.
7. Chemins : tester un chemin avec accents/espaces (`C:\Users\Zoé Dossou\Mes plans\`) et un chemin réseau/OneDrive si disponible ; consigner.

## 6. Exports PDF / XLSX
1. Onglet Documents → « Générer le DQE » → « Exporter PDF » → enregistrer. Ouvrir dans un lecteur PDF : bandeau « DONNÉES SYNTHÉTIQUES » sur chaque page, colonnes lisibles (pas de chevauchement), total identique à l'écran. Pièces jointes (`provenance.json`, `document.json`) visibles dans Adobe Reader (panneau Pièces jointes) si disponible.
2. « Exporter Excel » → ouvrir dans Excel : montants en formules (`=ROUND(…)`), totaux recalculés à l'ouverture identiques, feuilles « Annexe » et « Provenance ». Noter la version d'Excel/LibreOffice.
3. Annuler la boîte « Enregistrer » : aucun message d'erreur.

## 7. Fonctionnement hors ligne
1. Couper le réseau (mode avion, ou débrancher/désactiver la carte), relancer l'application.
2. Refaire §4 et §5 : tout doit fonctionner à l'identique.
3. Réseau actif : surveiller avec le Moniteur de ressources → onglet Réseau (ou `netstat -ano` filtré sur le PID de « BTP Afrique.exe ») pendant 5 min d'utilisation : **aucune connexion sortante** de l'application n'est attendue (hors poste local). Toute connexion est un défaut à signaler.

## 8. Désinstallation
1. « Applications installées » → BTP Afrique → Désinstaller (ou `Uninstall BTP Afrique.exe` dans le dossier d'installation).
2. Vérifier : dossier d'installation supprimé, raccourcis supprimés, entrée retirée. Les fichiers `.btpx` de l'utilisateur doivent rester intacts. Les données applicatives (`%APPDATA%\btp-platform-core` ou `BTP Afrique`) sont conservées volontairement (`deleteAppDataOnUninstall: false`) : noter ce qui reste.
3. Réinstaller par-dessus une version existante : fonctionne sans erreur.

## 9. Fiche de résultats (à remplir par le testeur)
| Élément | Résultat (OK / KO / n.a.) | Preuve (capture, valeur) | Commentaire |
|---|---|---|---|
| Version de Windows (build), architecture, RAM | | | |
| Empreinte SHA-256 conforme | | | |
| Manifeste : gitDirty = false | | | |
| SmartScreen / antivirus | | | |
| Installation (dossier, raccourcis) | | | |
| Premier démarrage < 10 s, 3 packs | | | |
| Total de démonstration | | | |
| Enregistrer / rouvrir `.btpx` (IDENTIQUE) | | | |
| Fichier corrompu refusé | | | |
| Chemins accentués / espaces | | | |
| Export PDF (lisible, bandeau) | | | |
| Export XLSX (formules) | | | |
| Hors ligne complet | | | |
| Aucune connexion sortante | | | |
| Désinstallation propre | | | |
**Verdict** : ☐ validé ☐ validé avec réserves ☐ refusé — Testeur, date, machine : …

## 10. Ce que cette procédure ne couvre pas
Mises à jour automatiques (inexistantes) · associations de fichiers `.btpx` par double-clic (déclarées dans la configuration, **non vérifiées**) · multi-écrans/DPI élevés · Windows 10 ancien (support Electron 33 : Windows 10+) · installation « pour tous les utilisateurs » · signature de code.
