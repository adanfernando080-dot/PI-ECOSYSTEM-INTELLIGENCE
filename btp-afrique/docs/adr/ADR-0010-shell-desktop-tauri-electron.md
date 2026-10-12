# ADR-0010 — Shell desktop : Tauri ou Electron

- Statut : **Recommandé, à confirmer** (présenté avant gel ; aucune dépendance du code à l'un ou l'autre — voir « Mesure de réversibilité »)
- Liens : ARCHITECTURE.md D2/D3, ADR-0016, ADR-0017 · REQ-01, REQ-14

## Contexte
Le moteur (`src/core`) est du TypeScript pur, sans dépendance : il tourne indifféremment dans un navigateur, Node ou un shell desktop. Le choix du shell ne concerne donc que : accès fichiers, impression/PDF, base locale, ressources système (vision par ordinateur future), distribution, mises à jour, taille. Le développement est assisté par IA et l'équipe annoncée est réduite : la **maintenabilité** prime sur l'empreinte mémoire.

## Comparaison
| Critère | Electron | Tauri 2 |
|---|---|---|
| Langages à maîtriser | TypeScript partout (renderer + processus principal Node) | TypeScript (UI) **+ Rust** (backend, plugins, commandes) |
| Équipe / assistance IA | Très large base de code et d'exemples ; l'IA produit du Node fiable | Rust : l'IA aide bien, mais la revue, le débogage et le recrutement sont plus coûteux |
| Moteur de rendu | Chromium embarqué : **rendu identique** sur Windows/macOS/Linux | WebView du système (WebView2/WKWebView/WebKitGTK) : variations, anciennes versions sur postes peu mis à jour |
| PDF | pdf-lib/pdfkit dans le renderer ou Node ; `printToPDF` Chromium | pdf-lib dans la WebView ; impression native variable selon plateforme |
| Vision par ordinateur future | ONNX Runtime Node / WASM / WebGPU (Chromium) ; processus enfants Node ou Python faciles | WASM/WebGPU dépend de la WebView ; inférence native possible en Rust (ort) mais développement spécifique |
| 2D/3D (plans, BIM) | WebGL/WebGPU Chromium stable et uniforme | WebGL selon WebView (WebKitGTK sur Linux souvent limité) |
| Stockage local | SQLite (better-sqlite3), fichiers ; mêmes API que le serveur | SQLite via plugin Rust ; fichiers via plugin |
| Hors ligne | Natif | Natif |
| Taille d'installation | ~90–150 Mo | ~5–15 Mo (avantage réel pour la diffusion sur connexions limitées) |
| Mémoire au repos | Plus élevée | Plus faible |
| Sécurité | Large surface (Node) ; durcissable (contextIsolation, sandbox, CSP) | Modèle de permissions par capacité, surface réduite |
| Mises à jour | electron-updater (mature) ; installateurs signés | Updater intégré (signature obligatoire) |
| Maturité / écosystème | Très mûr (VS Code, Slack…) | Mûr mais plus récent ; plugins moins nombreux |

## Considérations propres au contexte
- **Postes cibles** : machines parfois anciennes, Windows non à jour, connexions faibles. Tauri gagne sur la taille de téléchargement ; Electron gagne sur la **prévisibilité** du moteur de rendu (pas de WebView obsolète).
- **Vision/IA locale** (ADR-0017) : l'essentiel de l'inférence passera par des runtimes (ONNX/WASM, processus sidecar). Les deux le permettent ; Electron avec un seul langage réduit le coût d'intégration d'un sidecar.
- **Coût d'équipe** : introduire Rust double la surface de compétences pour un gain principalement de taille.

## Recommandation
**Electron** pour le MVP (M1–M2), derrière une interface **`HostApi`** indépendante du shell (ouvrir/enregistrer un `.btpx`, lire les packs installés, écrire un export, lister les modèles IA locaux). Le renderer n'appelle jamais directement Node ni Tauri.
**Réexamen à M3** (avant distribution large) : mesurer taille, mémoire et défauts de WebView sur des postes réels ; migrer vers Tauri si le coût de téléchargement devient bloquant — la migration ne touche que l'implémentation de `HostApi` et l'empaquetage.

## Mesure de réversibilité
Le moteur n'importe rien du shell ; l'UI (`apps/desktop`) ne dépend que de `HostApi`. Un hôte de développement (serveur Node local) implémente déjà ce port et sert à la validation automatisée (Playwright) sans Electron.

## Décisions à prendre par le porteur de projet (non bloquantes pour M1)
1. Confirmer Electron (recommandé) ou demander Tauri malgré le coût Rust.
2. Fournir un parc de postes cibles représentatif (OS, RAM) pour la mesure de M3.

## Mise en œuvre (étape 8)
Electron 33 + electron-builder 25 : `apps/desktop/electron/` (main, preload, CSP, aides fichiers), contrat IPC fermé `apps/desktop/shared/ipc.ts` (5 canaux), hôte renderer `electronHost` dans `host.ts`. Le renderer reste identique en navigateur (`DevHttpHost`) et en bureau. Détails, commandes et limites : `docs/DESKTOP.md`.
