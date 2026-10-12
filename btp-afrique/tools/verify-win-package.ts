/**
 * Vérifie STATIQUEMENT l'artefact Windows produit par `npm run desktop:dist:win` (sans Windows) :
 * installateur NSIS x64 cohérent (empreinte), charge utile contenant l'application, asar identique au build local, packs embarqués.
 * Ne prouve PAS que l'installateur s'installe ni que l'application démarre sous Windows (validation Windows réelle requise).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname; const REL = join(ROOT, 'release');
let ok = 0; const bad: string[] = []; const check = (n: string, c: boolean, d = ''): void => { if (c) { ok++; console.log(`  ✓ ${n}`); } else { bad.push(n + ' ' + d); console.log(`  ✗ ${n} ${d}`); } };
const exe = readdirSync(REL).find((f) => /^BTP-Afrique-Setup-.*-x64\.exe$/.test(f));
check('installateur présent', !!exe, 'lancer npm run desktop:dist:win'); if (!exe) process.exit(1);
const installer = join(REL, exe); const buf = readFileSync(installer);
console.log(`Installateur : ${installer} (${(buf.length / 1048576).toFixed(1)} Mo)`);
console.log(`SHA-256 : ${createHash('sha256').update(buf).digest('hex')}`);
check('format PE (MZ) et signature NSIS', buf[0] === 0x4d && buf[1] === 0x5a && buf.includes(Buffer.from('NullsoftInst')));
check('taille plausible (> 40 Mo : Electron + application embarqués)', buf.length > 40 * 1048576, String(buf.length));
const yml = readFileSync(join(REL, readdirSync(REL).find((f) => /^m0\.yml$|^latest\.yml$|\.yml$/.test(f) && f !== 'builder-debug.yml')!), 'utf8');
const sha512 = createHash('sha512').update(buf).digest('base64'); check('empreinte SHA-512 = celle du manifeste de publication', yml.includes(sha512));
const sevenZ = join(ROOT, 'node_modules', '7zip-bin', 'linux', 'x64', '7za'); const tmp = mkdtempSync(join(tmpdir(), 'btp-win-'));
try {
  execFileSync(sevenZ, ['x', installer, `-o${tmp}`, '-y'], { stdio: 'ignore' });
  const names = readdirSync(tmp, { recursive: true }).map(String).map((f) => f.split('\\').join('/'));
  check('charge utile de l\'installateur extraite par 7-Zip (contenu de l\'application)', names.length > 10);
  for (const f of ['BTP Afrique.exe', 'resources/app.asar', 'ffmpeg.dll', 'icudtl.dat', 'locales/fr.pak']) check(`charge utile contient ${f}`, names.includes(f), f);
  const packs = names.filter((f) => /^resources\/market-packs\/.*\/pack\.json$/.test(f)); check('4 packs marché embarqués', packs.length === 4, String(packs.length));
  const appExe = readFileSync(join(tmp, 'BTP Afrique.exe')); const pe = appExe.readUInt32LE(0x3c);
  check('BTP Afrique.exe : PE x64 (machine 0x8664)', appExe.readUInt32LE(pe) === 0x4550 && appExe.readUInt16LE(pe + 4) === 0x8664);
  const asar = join(tmp, 'resources', 'app.asar'); const files = execFileSync('npx', ['asar', 'list', asar], { cwd: ROOT }).toString();
  check('asar : contient le build de l\'interface et du processus principal', /apps\/desktop\/dist\/index\.html/.test(files) && /apps\/desktop\/electron\/dist\/main\.cjs/.test(files) && /preload\.cjs/.test(files));
  check('asar : aucun node_modules embarqué (tout est empaqueté dans les bundles)', !/node_modules/.test(files));
  const out = join(tmp, 'asar-x'); execFileSync('npx', ['asar', 'extract', asar, out], { cwd: ROOT });
  const h = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');
  check('main.cjs de l\'installateur = build local', h(join(out, 'apps/desktop/electron/dist/main.cjs')) === h(join(ROOT, 'apps/desktop/electron/dist/main.cjs')));
  const assets = readdirSync(join(ROOT, 'apps/desktop/dist/assets')); check('interface de l\'installateur = build local', assets.every((a) => h(join(out, 'apps/desktop/dist/assets', a)) === h(join(ROOT, 'apps/desktop/dist/assets', a))));
  check('pas de serveur de développement dans le paquet', !readFileSync(join(out, 'apps/desktop/electron/dist/main.cjs'), 'utf8').includes('localhost:5173'));
} finally { rmSync(tmp, { recursive: true, force: true }); }
void existsSync; void statSync;
console.log(`\n${ok} vérifications OK, ${bad.length} échec(s)`); if (bad.length) { console.log(bad.map((b) => ' - ' + b).join('\n')); process.exit(1); }
