/**
 * Test d'acceptation de l'APPLICATION DE BUREAU (Electron réel, piloté par Playwright).
 * Usage : `npm run desktop:e2e -- dev`       → `electron .` sur le build local (apps/desktop/dist)
 *         `npm run desktop:e2e -- packaged`  → exécutable empaqueté `release/linux-unpacked/*` (après `npm run desktop:pack`)
 * Les boîtes de dialogue natives sont remplacées DEPUIS le test (dans le processus principal) : aucun crochet de test dans le code livré.
 * Sous Linux sans affichage : `xvfb-run -a npm run desktop:e2e -- packaged`.
 */
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipRead, zipStore } from '../../../src/adapters/btpx.js';
import { loadPackCatalog } from '../../../src/adapters/packs.js';
import { fmtMoney } from '../../../src/adapters/render-text.js';
import { recompute } from '../../../src/core/project/recompute.js';
import { houseAssumptions, houseModel } from '../../../fixtures/synthetic/house.js';
import { defaultZone } from '../src/viewmodel.js';
import { TAXONOMY } from '../src/session.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const mode = process.argv[2] === 'packaged' ? 'packaged' : 'dev';
const tmp = mkdtempSync(join(tmpdir(), 'btp-desktop-'));
let passed = 0; const failures: string[] = [];
const check = (name: string, cond: boolean, detail = ''): void => { if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); } };
const digits = (s: string): string => s.replace(/[^\d]/g, '');
const txt = async (p: Page, id: string): Promise<string> => ((await p.getByTestId(id).first().textContent({ timeout: 15000 })) ?? '').replace(/\s+/g, ' ').trim();

function launchSpec(): { executablePath?: string; args: string[] } {
  if (mode === 'dev') return { args: ['--no-sandbox', ROOT] };
  const dir = join(ROOT, 'release', 'linux-unpacked');
  const exe = existsSync(dir) ? readdirSync(dir).find((f) => { const p = join(dir, f); return statSync(p).isFile() && (statSync(p).mode & 0o111) !== 0 && !f.includes('.') && !['chrome-sandbox', 'chrome_crashpad_handler'].includes(f); }) : undefined;
  if (!exe) throw new Error('Exécutable empaqueté introuvable : lancer `npm run desktop:pack` d\'abord');
  return { executablePath: join(dir, exe), args: ['--no-sandbox'] };
}
const mockSave = (app: ElectronApplication, path: string | null): Promise<void> => app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = (async () => (p ? { canceled: false, filePath: p } : { canceled: true, filePath: '' })) as never; }, path);
const mockOpen = (app: ElectronApplication, path: string | null): Promise<void> => app.evaluate(({ dialog }, p) => { dialog.showOpenDialog = (async () => (p ? { canceled: false, filePaths: [p] } : { canceled: true, filePaths: [] })) as never; }, path);

console.log(`Mode : ${mode}`);
const spec = launchSpec();
const app = await electron.launch({ ...(spec.executablePath ? { executablePath: spec.executablePath } : {}), args: spec.args, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' } });
const page = await app.firstWindow(); const requests: string[] = []; const consoleErrors: string[] = [];
page.on('request', (r) => requests.push(r.url())); page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); }); page.on('pageerror', (e) => consoleErrors.push(String(e)));
const SHOTS = join(ROOT, 'apps', 'desktop', 'e2e', 'screenshots'); const shot = (n: string): Promise<Buffer> => page.screenshot({ path: join(SHOTS, `desktop-${mode}-${n}.png`), fullPage: true });
try {
  console.log('1. Démarrage');
  await page.getByTestId('pack-select').waitFor({ timeout: 30000 });
  const info = await page.evaluate(() => (window as unknown as { btpHost: { appInfo(): Promise<{ ok: boolean; value: { packaged: boolean; platform: string; version: string; electron: string } }> } }).btpHost.appInfo());
  check('application démarrée, fenêtre affichée', (await app.windows()).length === 1 && /BTP/.test(await page.title()), await page.title());
  check(mode === 'packaged' ? 'application EMPAQUETÉE (app.isPackaged)' : 'mode développement local (non empaqueté)', info.ok && info.value.packaged === (mode === 'packaged'), JSON.stringify(info));
  check('chargée depuis le protocole local app:// (aucun serveur)', page.url().startsWith('app://btp/'), page.url());
  const packOptions = await page.getByTestId('pack-select').locator('option').allTextContents();
  check('3 packs marché vérifiés chargés par le processus principal', packOptions.length === 3, packOptions.join('|'));
  await shot('01-accueil');

  console.log('2. Sécurité du renderer');
  const prefs = await app.evaluate(({ BrowserWindow }) => { const w = (BrowserWindow.getAllWindows()[0]!.webContents as any).getLastWebPreferences(); return { contextIsolation: w.contextIsolation, nodeIntegration: w.nodeIntegration, sandbox: w.sandbox, webSecurity: w.webSecurity }; });
  check('contextIsolation actif, nodeIntegration inactif, sandbox, webSecurity', prefs.contextIsolation === true && prefs.nodeIntegration === false && prefs.sandbox === true && prefs.webSecurity === true, JSON.stringify(prefs));
  const world = await page.evaluate(() => ({ req: typeof (window as any).require, proc: typeof (window as any).process, mod: typeof (window as any).module, buf: typeof (window as any).Buffer, bridge: Object.keys((window as any).btpHost).sort(), ipc: typeof (window as any).ipcRenderer, electron: typeof (window as any).electron }));
  check('aucun accès Node.js dans le renderer (require/process/module/Buffer/ipcRenderer absents)', world.req === 'undefined' && world.proc === 'undefined' && world.mod === 'undefined' && world.buf === 'undefined' && world.ipc === 'undefined' && world.electron === 'undefined', JSON.stringify(world));
  check('pont exposé = 5 fonctions explicites uniquement', JSON.stringify(world.bridge) === JSON.stringify(['appInfo', 'listPacks', 'pickFile', 'saveFile', 'setDirty']), JSON.stringify(world.bridge));
  const csp = await page.evaluate(async () => (await fetch(location.href)).headers.get('content-security-policy'));
  check('en-tête CSP présent (default-src none, script-src self)', !!csp && csp.includes("default-src 'none'") && csp.includes("script-src 'self'"), String(csp));
  const inlineBlocked = await page.evaluate(() => { const sc = document.createElement('script'); sc.textContent = 'window.__inline = 1'; document.body.appendChild(sc); return (window as any).__inline === 1 ? 'executed' : 'blocked'; });
  check('script inline interdit par la CSP (injection bloquée)', inlineBlocked === 'blocked', inlineBlocked);
  const net = await page.evaluate(async () => {
    const out: Record<string, string> = {};
    try { await fetch('https://example.com/', { mode: 'no-cors' }); out['fetch'] = 'reachable'; } catch { out['fetch'] = 'blocked'; }
    try { await new Promise<void>((res, rej) => { const ws = new WebSocket('wss://example.com/'); ws.onopen = () => res(); ws.onerror = () => rej(new Error('x')); setTimeout(() => rej(new Error('t')), 4000); }); out['ws'] = 'reachable'; } catch { out['ws'] = 'blocked'; }
    try { await new Promise<void>((res, rej) => { const i = new Image(); i.onload = () => res(); i.onerror = () => rej(new Error('x')); i.src = 'https://example.com/x.png'; }); out['img'] = 'reachable'; } catch { out['img'] = 'blocked'; }
    return out;
  });
  check('requêtes réseau sortantes bloquées (fetch, WebSocket, image)', net['fetch'] === 'blocked' && net['ws'] === 'blocked' && net['img'] === 'blocked', JSON.stringify(net));
  const bad = await page.evaluate(() => (window as any).btpHost.saveFile('x.exe', new Uint8Array([1]), 'application/x-msdownload'));
  check('IPC : type de fichier non autorisé refusé par le processus principal', bad.ok === false && /non autorisé/.test(bad.error), JSON.stringify(bad));
  const badKind = await page.evaluate(() => (window as any).btpHost.pickFile('../../etc/passwd'));
  check('IPC : type d\'ouverture inconnu refusé', badKind.ok === false, JSON.stringify(badKind));
  await app.evaluate(({ BrowserWindow }) => { void BrowserWindow; });

  console.log('3. Projet de démonstration : résultats identiques au moteur de référence');
  await page.getByTestId('pack-select').selectOption('pack.bj'); await page.getByTestId('open-demo').click();
  check('bandeau synthétique et traçabilité vérifiée', /SYNTH/.test(await txt(page, 'synthetic-banner')) && /vérifiée/.test(await txt(page, 'verify-chip')));
  await page.getByTestId('tab-estimate').click();
  const catalog = loadPackCatalog(ROOT); const pack = catalog.resolve('pack.bj'); const today = new Date().toISOString().slice(0, 10);
  const ref = recompute(null, { taxonomy: TAXONOMY, state: { model: houseModel(), assumptions: houseAssumptions() }, pack, binding: { zoneId: defaultZone(pack), asOf: today } }).run;
  const refTotal = fmtMoney(ref.estimate.total, ref.estimate.currency.minorUnits, ref.estimate.currency.code);
  const uiTotal = await txt(page, 'total');
  check(`total de l'application = total du moteur de référence (${refTotal})`, digits(uiTotal) === digits(refTotal) && uiTotal.includes('XOF'), `${uiTotal} vs ${refTotal}`);
  const refLines = ref.estimate.lines.map((l) => `${l.id}=${l.amount}`);
  const uiRows = await page.locator('[data-testid^="line-"]').count(); check(`${refLines.length} lignes de chiffrage, comme le moteur`, uiRows === refLines.length, `${uiRows}`);
  await shot('02-chiffrage');

  console.log('4. Enregistrer un projet .btpx, fermer, rouvrir');
  const file = join(tmp, 'projet.btpx'); await mockSave(app, file);
  await page.getByTestId('save').click(); await page.getByTestId('notice').filter({ hasText: 'enregistré' }).waitFor({ timeout: 15000 }).catch(() => undefined);
  check('fichier .btpx écrit sur le disque par le processus principal (ZIP valide)', existsSync(file) && /No errors/.test(execFileSync('unzip', ['-tq', file]).toString()));
  const entries = zipRead(new Uint8Array(readFileSync(file))).entries; check('contient manifest, projet, pack résolu embarqué', 'manifest.json' in entries && 'project.json' in entries && Object.keys(entries).some((k) => k.startsWith('packs/')));
  await page.getByTestId('close').click(); await mockOpen(app, file);
  await page.getByTestId('open-file').click(); await page.getByTestId('notice').filter({ hasText: 'rouvert' }).waitFor({ timeout: 15000 }).catch(() => undefined);
  check('réouverture : fichier vérifié et recalcul à froid IDENTIQUE', /IDENTIQUE/.test(await txt(page, 'notice')), await txt(page, 'notice').catch(() => '(aucun message)'));
  await page.getByTestId('tab-estimate').click(); check('même total après réouverture', digits(await txt(page, 'total')) === digits(refTotal));

  console.log('5. Fichier corrompu / annulation');
  await page.getByTestId('close').click();
  const z = zipRead(new Uint8Array(readFileSync(file))).entries; z['estimate.json'] = new TextEncoder().encode(new TextDecoder().decode(z['estimate.json']!).replace(/"total":"(\d)/, '"total":"9$1'));
  const bad2 = join(tmp, 'corrompu.btpx'); writeFileSync(bad2, zipStore(z)); await mockOpen(app, bad2); await page.getByTestId('open-file').click();
  await page.getByTestId('error').waitFor({ timeout: 15000 }).catch(() => undefined);
  check('fichier altéré : message d\'erreur contrôlé, aucun projet ouvert', /refusé/.test(await txt(page, 'error').catch(() => '')) && (await page.getByTestId('project-name').count()) === 0, await txt(page, 'error').catch(() => '(aucune erreur)'));
  const junk = join(tmp, 'pas-un-zip.btpx'); writeFileSync(junk, 'ceci n\'est pas une archive'); await mockOpen(app, junk); await page.getByTestId('open-file').click();
  await page.waitForTimeout(800); check('fichier non-ZIP : refusé proprement (pas de plantage)', /refusé/.test(await txt(page, 'error').catch(() => '')) && (await app.windows()).length === 1);
  await mockOpen(app, null); await page.getByTestId('open-file').click(); await page.waitForTimeout(400); check('annulation du sélecteur : sans effet, application vivante', (await app.windows()).length === 1);
  await mockOpen(app, join(tmp, 'inexistant.btpx')); await page.getByTestId('open-file').click(); await page.waitForTimeout(800);
  check('chemin inexistant : erreur contrôlée', /impossible|refusé|introuvable|ENOENT/i.test(await txt(page, 'error').catch(() => '')), await txt(page, 'error').catch(() => '(aucune erreur)'));

  console.log('6. Exports PDF et XLSX');
  await mockOpen(app, file); await page.getByTestId('open-file').click(); await page.getByTestId('notice').filter({ hasText: 'rouvert' }).waitFor({ timeout: 15000 });
  await page.getByTestId('tab-docs').click(); await page.getByTestId('make-dqe').click(); await page.getByTestId('doc-preview').waitFor();
  const pdf = join(tmp, 'dqe.pdf'); await mockSave(app, pdf); await page.getByTestId('export-pdf').click(); await page.getByTestId('doc-msg').filter({ hasText: 'PDF' }).waitFor({ timeout: 30000 }).catch(() => undefined);
  check('PDF exporté : valide (pdfinfo) et contient le total et la bannière', existsSync(pdf) && /Pages:\s+\d+/.test(execFileSync('pdfinfo', [pdf]).toString()) && digits(execFileSync('pdftotext', ['-layout', pdf, '-']).toString()).includes(digits(refTotal)) && /SYNTH/.test(execFileSync('pdftotext', [pdf, '-']).toString()));
  const xlsx = join(tmp, 'dqe.xlsx'); await mockSave(app, xlsx); await page.getByTestId('export-xlsx').click(); await page.getByTestId('doc-msg').filter({ hasText: 'Excel' }).waitFor({ timeout: 30000 }).catch(() => undefined);
  check('XLSX exporté : archive valide avec formules', existsSync(xlsx) && /No errors/.test(execFileSync('unzip', ['-tq', xlsx]).toString()) && /<f>ROUND/.test(execFileSync('unzip', ['-p', xlsx, 'xl/worksheets/sheet1.xml']).toString()));
  await mockSave(app, null); await page.getByTestId('export-pdf').click(); await page.waitForTimeout(1200);
  check('annulation de la boîte « Enregistrer » : pas d\'erreur', (await page.getByTestId('error').count()) === 0);
  await shot('03-documents');

  console.log('7. Fermeture avec modifications non enregistrées');
  await page.getByTestId('tab-assumptions').click(); const hid = (await page.locator('[data-testid^="as-val-"]').first().getAttribute('data-testid'))!.replace('as-val-', '');
  const h0 = await page.getByTestId(`as-val-${hid}`).inputValue(); await page.getByTestId(`as-val-${hid}`).fill(String(Number(h0) + 0.1)); await page.getByTestId(`as-set-${hid}`).click();
  await page.waitForTimeout(300);
  await app.evaluate(({ dialog, BrowserWindow }) => { (globalThis as any).__asked = 0; dialog.showMessageBoxSync = (() => { (globalThis as any).__asked++; return 0; }) as never; BrowserWindow.getAllWindows()[0]!.close(); });
  await page.waitForTimeout(500);
  check('fermeture refusée par l\'utilisateur : fenêtre toujours ouverte, confirmation demandée', (await app.windows()).length === 1 && (await app.evaluate(() => (globalThis as any).__asked)) === 1);

  console.log('8. Hors ligne / réseau');
  const external = requests.filter((u) => !u.startsWith('app://btp/') && !u.startsWith('data:') && !u.startsWith('blob:') && !u.includes('example.com'));
  check('aucune requête réseau de l\'application (seules les sondes du test ciblent example.com, bloquées)', external.length === 0, external.join(','));
  check('toutes les ressources chargées via app://btp/', requests.filter((u) => u.startsWith('app://btp/')).length > 0);
  check('aucune erreur console inattendue', consoleErrors.filter((e) => !/example\.com|ERR_BLOCKED|Content Security Policy|Refused to/i.test(e)).length === 0, consoleErrors.join(' | '));

  console.log('9. Quitter');
  const closed = new Promise<void>((res) => app.process().once('exit', () => res()));
  await app.evaluate(({ dialog, BrowserWindow }) => { dialog.showMessageBoxSync = (() => 1) as never; BrowserWindow.getAllWindows()[0]!.close(); });
  const t = await Promise.race([closed.then(() => 'exit'), new Promise((r) => setTimeout(() => r('timeout'), 10000))]); check('fermeture confirmée : le processus se termine proprement', t === 'exit', String(t));
} catch (e) { failures.push('exception: ' + (e as Error).message); console.error(e); await shot('erreur').catch(() => undefined); }
finally { await app.close().catch(() => undefined); rmSync(tmp, { recursive: true, force: true }); }
console.log(`\n[${mode}] ${passed} vérifications OK, ${failures.length} échec(s)`); if (failures.length) { console.log(failures.map((f) => ' - ' + f).join('\n')); process.exit(1); }
