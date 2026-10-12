/**
 * Processus principal Electron. Responsabilités : fenêtre, chargement LOCAL (protocole app://), fichiers via boîtes de dialogue,
 * packs marché vérifiés, fermeture. AUCUN calcul métier ici : le moteur tourne dans le renderer (mêmes modules que l'hôte de développement).
 */
import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPackCatalog } from '../../../src/adapters/packs.js';
import { CHANNELS, FILE_KINDS, type AppInfo, type IpcResult, type PickedFile } from '../shared/ipc.js';
import { CSP } from './csp.js';
import { checkSize, isFileKind, MAX_SAVE_BYTES, sanitizeFileName, SAVE_TYPES, withExpectedExtension } from './files.js';

const APP_ORIGIN = 'app://btp';
const RENDERER_DIR = app.isPackaged ? join(app.getAppPath(), 'apps', 'desktop', 'dist') : join(__dirname, '..', '..', 'dist');
const PACKS_ROOT = app.isPackaged ? process.resourcesPath : join(__dirname, '..', '..', '..', '..');
const DEV_URL = process.env['BTP_DEV_SERVER_URL'];          // uniquement `npm run desktop:dev` (jamais en production)
let mainWindow: BrowserWindow | null = null; let dirty = false; let closing = false;

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const ok = <T>(value: T): IpcResult<T> => ({ ok: true, value });
const fail = (e: unknown): IpcResult<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const trusted = (e: IpcMainInvokeEvent | IpcMainEvent): boolean => {
  const url = e.senderFrame?.url ?? ''; return e.sender === mainWindow?.webContents && (url.startsWith(APP_ORIGIN + '/') || (!!DEV_URL && url.startsWith(DEV_URL)));
};

function registerIpc(): void {
  ipcMain.handle(CHANNELS.listPacks, async (e) => {
    if (!trusted(e)) return fail('expéditeur non autorisé');
    try {
      const catalog = loadPackCatalog(PACKS_ROOT);
      const parents = new Set([...catalog.raw.values()].map((p) => (p.extends ? p.extends.id : '')));   // un pack parent est une base commune, pas un marché
      return ok([...new Set([...catalog.raw.values()].map((p) => p.id))].filter((id) => !parents.has(id)).map((id) => catalog.resolve(id)));
    } catch (err) { return fail(err); }
  });
  ipcMain.handle(CHANNELS.pickFile, async (e, kind: unknown): Promise<IpcResult<PickedFile | null>> => {
    if (!trusted(e)) return fail('expéditeur non autorisé');
    if (!isFileKind(kind)) return fail('type de fichier inconnu');
    try {
      const spec = FILE_KINDS[kind];
      const r = await dialog.showOpenDialog(mainWindow!, { title: spec.title, properties: ['openFile'], filters: [{ name: spec.title, extensions: spec.extensions }] });
      if (r.canceled || !r.filePaths[0]) return ok(null);
      const path = r.filePaths[0]; const st = await stat(path); if (!st.isFile()) return fail('Ce n\'est pas un fichier');
      const tooBig = checkSize(kind, st.size); if (tooBig) return fail(tooBig);
      return ok({ name: basename(path), bytes: new Uint8Array(await readFile(path)) });
    } catch (err) { return fail(`Lecture impossible : ${(err as Error).message}`); }
  });
  ipcMain.handle(CHANNELS.saveFile, async (e, name: unknown, bytes: unknown, mediaType: unknown): Promise<IpcResult<{ saved: boolean }>> => {
    if (!trusted(e)) return fail('expéditeur non autorisé');
    if (!(bytes instanceof Uint8Array) || typeof mediaType !== 'string') return fail('requête invalide');
    if (bytes.byteLength > MAX_SAVE_BYTES) return fail('Fichier trop volumineux');
    const proposed = withExpectedExtension(sanitizeFileName(name), mediaType); if (!proposed) return fail(`Type de fichier non autorisé : ${mediaType}`);
    try {
      const t = SAVE_TYPES[mediaType]!;
      const r = await dialog.showSaveDialog(mainWindow!, { title: 'Enregistrer', defaultPath: proposed, filters: [{ name: t.label, extensions: [t.ext] }] });
      if (r.canceled || !r.filePath) return ok({ saved: false });
      const path = r.filePath.toLowerCase().endsWith('.' + t.ext) ? r.filePath : `${r.filePath}.${t.ext}`;
      await writeFile(path, bytes); return ok({ saved: true });
    } catch (err) { return fail(`Écriture impossible : ${(err as Error).message}`); }
  });
  ipcMain.on(CHANNELS.setDirty, (e, v: unknown) => { if (trusted(e)) dirty = v === true; });
  ipcMain.handle(CHANNELS.appInfo, (e): IpcResult<AppInfo> => trusted(e) ? ok({ name: app.getName(), version: app.getVersion(), electron: process.versions.electron ?? '', packaged: app.isPackaged, platform: process.platform }) : fail('expéditeur non autorisé'));
}

/** Sert apps/desktop/dist sous app://btp/ ; refuse toute sortie du dossier (traversée de chemin). */
function registerAppProtocol(): void {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url); if (u.host !== 'btp') return new Response('Forbidden', { status: 403 });
    let rel = decodeURIComponent(u.pathname); if (rel === '/' || rel === '') rel = '/index.html';
    const file = normalize(join(RENDERER_DIR, rel));
    if (file !== RENDERER_DIR && !file.startsWith(RENDERER_DIR + sep)) return new Response('Forbidden', { status: 403 });
    if (!existsSync(file)) return new Response('Not found', { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const h = new Headers(res.headers); h.set('Content-Security-Policy', CSP);
    return new Response(res.body, { status: res.status, headers: h });
  });
}

/** Aucune requête hors application : tout http(s)/ws(s) externe est annulé (sauf le serveur de dev explicitement fourni). */
function lockdownNetwork(): void {
  const allowed = (url: string): boolean => url.startsWith(APP_ORIGIN + '/') || url.startsWith('devtools:') || url.startsWith('data:') || url.startsWith('blob:') || (!!DEV_URL && (url.startsWith(DEV_URL) || url.startsWith(DEV_URL.replace('http', 'ws'))));
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !allowed(d.url) }));
  session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-navigate', (ev, url) => { if (!allowed(url)) ev.preventDefault(); });
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-attach-webview', (ev) => ev.preventDefault());
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600, show: false, title: 'BTP Afrique — poste de métré',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, spellcheck: false, devTools: !app.isPackaged },
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('close', (e) => {
    if (closing || !dirty) return;
    const choice = dialog.showMessageBoxSync(mainWindow!, { type: 'warning', buttons: ['Annuler', 'Quitter sans enregistrer'], defaultId: 0, cancelId: 0, title: 'Modifications non enregistrées', message: 'Le projet contient des modifications non enregistrées.', detail: 'Enregistrez-le (.btpx) avant de quitter, ou quittez en les perdant.' });
    if (choice === 0) e.preventDefault(); else closing = true;
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('render-process-gone', (_e, d) => { dialog.showErrorBox('Erreur de l\'interface', `Le processus d'affichage s'est arrêté (${d.reason}). L'application va se fermer ; vos fichiers .btpx enregistrés ne sont pas affectés.`); closing = true; app.quit(); });
  void mainWindow.loadURL(DEV_URL ?? `${APP_ORIGIN}/index.html`).catch((err) => { dialog.showErrorBox('Chargement impossible', String(err)); app.quit(); });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  void app.whenReady().then(() => { registerIpc(); registerAppProtocol(); lockdownNetwork(); createWindow(); });
  app.on('window-all-closed', () => app.quit());
  process.on('uncaughtException', (err) => { dialog.showErrorBox('Erreur inattendue', err.message); });
  void shell;
}
