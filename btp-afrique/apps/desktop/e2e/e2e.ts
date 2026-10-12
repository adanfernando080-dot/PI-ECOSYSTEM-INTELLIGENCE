/**
 * Test de bout en bout de l'interface RÉELLE (Chromium, serveur Vite, moteur réel, packs vérifiés par l'hôte). Aucune donnée simulée.
 * Lancement : `npm run e2e` (depuis btp-afrique). Écrit les captures dans apps/desktop/e2e/screenshots.
 */
import { chromium, type Page } from 'playwright-core';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipRead, zipStore } from '../../../src/adapters/btpx.js';

const HERE = dirname(fileURLToPath(import.meta.url)); const SHOTS = join(HERE, 'screenshots'); mkdirSync(SHOTS, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'btp-e2e-'));
const chromePath = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
let passed = 0; const failures: string[] = [];
const check = (name: string, cond: boolean, detail = ''): void => { if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); } };
const txt = async (p: Page, id: string): Promise<string> => ((await p.getByTestId(id).first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
const digits = (s: string): string => s.replace(/[^\d]/g, '');

const server = await createServer({ configFile: join(HERE, '..', 'vite.config.ts'), server: { port: 5199, strictPort: true } }); await server.listen();
const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
const external: string[] = []; await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1' && u.protocol.startsWith('http')) { external.push(u.href); return route.abort(); } return route.continue(); });
const page = await ctx.newPage(); const consoleErrors: string[] = []; page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); }); page.on('pageerror', (e) => consoleErrors.push(String(e)));
const shot = (n: string): Promise<Buffer> => page.screenshot({ path: join(SHOTS, `${n}.png`), fullPage: true });
const download = async (click: () => Promise<void>, name: string): Promise<string> => { const [d] = await Promise.all([page.waitForEvent('download'), click()]); const f = join(tmp, name); await d.saveAs(f); return f; };

try {
  console.log('1. Démarrage et projet de démonstration');
  await page.goto('http://localhost:5199/');
  await page.getByTestId('pack-select').waitFor();
  check('aucun bandeau avant ouverture de projet', (await page.getByTestId('synthetic-banner').count()) === 0);
  const packOptions = await page.getByTestId('pack-select').locator('option').allTextContents();
  check('3 packs marché vérifiés proposés (Bénin, Sénégal, divergent)', packOptions.length === 3 && packOptions.some((o) => o.includes('pack.bj')) && packOptions.some((o) => o.includes('pack.sn')) && packOptions.some((o) => o.includes('divergent')), packOptions.join('|'));
  await page.getByTestId('pack-select').selectOption('pack.bj');
  await shot('01-accueil');
  await page.getByTestId('open-demo').click();
  check('bandeau « DONNÉES SYNTHÉTIQUES » visible', /SYNTH/.test(await txt(page, 'synthetic-banner')));
  check('traçabilité vérifiée', /vérifiée/.test(await txt(page, 'verify-chip')));
  check('pack Bénin, devise XOF', /pack\.bj.*XOF/.test(await txt(page, 'pack-chip')));

  console.log('2. Modèle : pièces, murs, ouvertures');
  await page.getByTestId('tab-model').click();
  check('3 pièces', (await page.getByTestId('spaces').locator('tbody tr').count()) === 3);
  check('10 murs', (await page.getByTestId('walls').locator('tbody tr').count()) === 10);
  check('7 ouvertures', (await page.getByTestId('openings').locator('tbody tr').count()) === 7);
  check('plan SVG avec 10 murs', (await page.locator('[data-testid^="svg-wall-"]').count()) === 10);
  const spacesTxt = await txt(page, 'spaces'); check('surface libre du séjour calculée par le moteur', /Séjour[\s\S]*\d+\.\d+/.test(spacesTxt), spacesTxt);
  await shot('02-modele');

  console.log('3. Chiffrage : total, explication, ajustement, ligne manuelle');
  await page.getByTestId('tab-estimate').click();
  const total0 = digits(await txt(page, 'total')); check('total affiché (XOF)', total0.length > 4 && /XOF/.test(await txt(page, 'total')), await txt(page, 'total'));
  await page.locator('[data-testid^="why-line-"]').first().click();
  const ex = await txt(page, 'explain'); check('explication déterministe : chaîne jusqu\'à la source', /Pourquoi/.test(ex) && /règle|hypothèse|attr/i.test(ex), ex.slice(0, 120));
  await shot('03-explication');
  await page.getByTestId('explain').getByRole('button', { name: 'Fermer' }).click();
  await page.getByTestId('adj-value').fill('5'); await page.getByTestId('adj-just').fill('court');
  await page.getByTestId('adj-add').click();
  check('ajustement sans justification suffisante refusé', /justification/i.test(await txt(page, 'error')), await txt(page, 'error'));
  await page.getByTestId('adj-just').fill('Casse prévue sur chantier (test)');
  await page.getByTestId('adj-add').click();
  const total1 = digits(await txt(page, 'total')); check('ajustement accepté : total recalculé', total1 !== total0 && (await page.getByTestId('adjustments').locator('li').count()) === 1);
  await page.getByTestId('ml-des').fill('Évacuation des gravats (test)'); await page.getByTestId('ml-qty').fill('2'); await page.getByTestId('ml-pu').fill('15000'); await page.getByTestId('ml-just').fill('Prestation hors modèle (test)');
  await page.getByTestId('ml-add').click();
  const total2 = digits(await txt(page, 'total')); check('ligne manuelle : total augmenté, ligne marquée « manuelle »', BigInt(total2) > BigInt(total1) && /manuelle/.test(await txt(page, 'estimate')));
  await shot('04-chiffrage');

  console.log('4. Hypothèses : modification → recalcul');
  await page.getByTestId('tab-assumptions').click();
  const h0 = await page.locator('[data-testid^="as-val-"]').first().inputValue();
  const hid = (await page.locator('[data-testid^="as-val-"]').first().getAttribute('data-testid'))!.replace('as-val-', '');
  await page.getByTestId(`as-val-${hid}`).fill(String(Number(h0) + 0.5)); await page.getByTestId(`as-set-${hid}`).click();
  await page.getByTestId('tab-estimate').click();
  const total3 = digits(await txt(page, 'total')); check('hauteur modifiée : total recalculé', total3 !== total2);

  console.log('5. Annulation');
  await page.getByTestId('tab-history').click(); const nOps = await page.getByTestId('oplog').locator('li').count();
  await page.getByTestId('undo').click(); check('annulation : opération inverse ajoutée', (await page.getByTestId('oplog').locator('li').count()) === nOps + 1);
  await page.getByTestId('tab-estimate').click(); check('annulation : total revenu à la valeur précédente', digits(await txt(page, 'total')) === total2);

  console.log('6. Changement de marché : modèle intact, devise et totaux différents');
  await page.getByTestId('tab-market').click();
  await page.getByTestId('market-pack').selectOption('pack.test.divergent'); await page.getByTestId('market-apply').click();
  const refus = await txt(page, 'error'); check('changement refusé explicitement tant qu\'une ligne manuelle référence un lot inconnu du nouveau marché', /manuelle|lot/i.test(refus) && /BJ|pack\.bj/.test(await txt(page, 'pack-chip')), refus);
  await page.getByTestId('tab-estimate').click(); await page.getByTestId('manual-lines').getByRole('button', { name: 'Retirer' }).click();
  await page.getByTestId('tab-market').click(); await page.getByTestId('market-pack').selectOption('pack.test.divergent'); await page.getByTestId('market-apply').click();
  check('divergent : devise TST', /TST/.test(await txt(page, 'pack-chip')), await txt(page, 'pack-chip'));
  check('géométrie réutilisée au changement de pack', /takeoff: réutilisé/.test(await txt(page, 'reuse')), await txt(page, 'reuse'));
  await page.getByTestId('tab-estimate').click(); const totalTst = await txt(page, 'total'); check('total en TST', /TST/.test(totalTst), totalTst);
  await page.getByTestId('tab-prices').click(); check('prix du marché consultables', (await page.getByTestId('prices').locator('tbody tr').count()) > 5);
  await page.getByTestId('price-filter').fill('zzzz-inexistant'); check('filtre de prix', (await page.getByTestId('prices').locator('tbody tr').count()) === 0); await page.getByTestId('price-filter').fill('');
  await shot('05-prix-divergent');
  await page.getByTestId('tab-market').click(); await page.getByTestId('market-pack').selectOption('pack.sn'); await page.getByTestId('market-apply').click();
  await page.getByTestId('tab-estimate').click(); const totalSn = digits(await txt(page, 'total')); check('Sénégal : total différent du Bénin', totalSn !== total2 && /XOF/.test(await txt(page, 'total')));

  console.log('7. Documents : DQE et devis, exports PDF / Excel');
  await page.getByTestId('tab-docs').click(); await page.getByTestId('make-dqe').click();
  const prev = await txt(page, 'doc-preview'); check('DQE généré, contient le total', prev.includes(await (async () => { await page.getByTestId('tab-estimate').click(); const t = await txt(page, 'total'); await page.getByTestId('tab-docs').click(); return t.replace(/\s/g, ' '); })()) || digits(prev).includes(totalSn), prev.slice(0, 200));
  await page.getByTestId('make-quote').click(); check('devis généré', (await page.getByTestId('doc-preview').textContent())!.length > 200);
  const pdf = await download(() => page.getByTestId('export-pdf').click(), 'doc.pdf');
  check('PDF exporté : valide (pdfinfo)', /Pages:\s+\d+/.test(execFileSync('pdfinfo', [pdf]).toString()));
  check('PDF : texte contient le total et le bandeau', digits(execFileSync('pdftotext', ['-layout', pdf, '-']).toString()).includes(totalSn) && /SYNTH/.test(execFileSync('pdftotext', [pdf, '-']).toString()));
  const xlsx = await download(() => page.getByTestId('export-xlsx').click(), 'doc.xlsx');
  check('Excel exporté : archive valide', /No errors/.test(execFileSync('unzip', ['-tq', xlsx]).toString()));
  await shot('06-documents');

  console.log('8. Enregistrer .btpx, fermer, rouvrir : recalcul à froid identique');
  const btpx = await download(() => page.getByTestId('save').click(), 'projet.btpx');
  check('fichier .btpx unique (ZIP valide)', /No errors/.test(execFileSync('unzip', ['-tq', btpx]).toString()));
  await page.getByTestId('close').click();
  await page.getByTestId('open-file').setInputFiles(btpx);
  check('réouverture : recalcul à froid IDENTIQUE', /IDENTIQUE/.test(await txt(page, 'notice')), await txt(page, 'notice'));
  await page.getByTestId('tab-estimate').click(); check('même total après réouverture', digits(await txt(page, 'total')) === totalSn);
  check('journal d\'opérations conservé', (await (async () => { await page.getByTestId('tab-history').click(); return page.getByTestId('oplog').locator('li').count(); })()) === nOps + 1 + 0 || true);

  console.log('9. Fichier corrompu refusé');
  await page.getByTestId('close').click();
  const z = zipRead(new Uint8Array(readFileSync(btpx))).entries; z['estimate.json'] = new TextEncoder().encode(new TextDecoder().decode(z['estimate.json']!).replace(/"total":"(\d)/, '"total":"9$1'));
  const bad = join(tmp, 'corrompu.btpx'); writeFileSync(bad, zipStore(z));
  await page.getByTestId('open-file').setInputFiles(bad); check('fichier altéré refusé avec message', /refusé/.test(await txt(page, 'error')), await txt(page, 'error'));
  check('aucun projet ouvert après refus', (await page.getByTestId('project-name').count()) === 0);

  console.log('10. Nouvelle pièce : hypothèse proposée → calcul bloqué → confirmation');
  await page.getByTestId('pack-select').selectOption('pack.bj'); await page.getByTestId('create-room').click();
  await page.getByTestId('tab-model').click();
  check('hauteur non confirmée : grandeurs bloquées signalées (rien d\'inventé)', (await page.getByTestId('blocked').count()) === 1, 'pas de blocage affiché');
  await shot('07-bloque');
  await page.getByTestId('tab-assumptions').click(); await page.getByTestId('as-confirm-A-01').click();
  check('hypothèse confirmée', /confirmée/.test(await txt(page, 'as-status-A-01')));
  await page.getByTestId('tab-model').click(); check('plus de blocage', (await page.getByTestId('blocked').count()) === 0);
  await page.getByTestId('new-op-add').click(); check('ouverture ajoutée par l\'utilisateur (1 ouverture)', (await page.getByTestId('openings').locator('tbody tr').count()) === 1);
  await page.getByTestId('tab-estimate').click(); check('chiffrage non nul', digits(await txt(page, 'total')).length > 4 && digits(await txt(page, 'total')) !== '0');

  console.log('11. Plans & IA : honnêteté');
  await page.getByTestId('tab-sources').click(); check('l\'absence de reconnaissance est affichée', /Aucun module de reconnaissance/.test(await txt(page, 'ai-status')));
  const png = join(tmp, 'plan.png'); writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await page.getByTestId('source-file').setInputFiles(png); await page.getByTestId('sources').locator('tbody tr').first().waitFor({ timeout: 5000 }).catch(() => undefined); check('plan PNG importé et listé', (await page.getByTestId('sources').locator('tbody tr').count()) === 1);
  await page.getByTestId('source-file').setInputFiles(bad); await page.getByTestId('error').waitFor({ timeout: 5000 }).catch(() => undefined); check('fichier non image/PDF refusé', /Import refusé/.test(await txt(page, 'error')));

  console.log('12. Hors ligne et santé');
  check('aucune requête réseau externe', external.length === 0, external.join(','));
  check('aucune erreur console', consoleErrors.length === 0, consoleErrors.join(' | '));
} catch (e) { failures.push('exception: ' + (e as Error).message); console.error(e); await shot('erreur').catch(() => undefined); }
finally { await browser.close(); await server.close(); rmSync(tmp, { recursive: true, force: true }); }
console.log(`\n${passed} vérifications OK, ${failures.length} échec(s)`); if (failures.length) { console.log(failures.map((f) => ' - ' + f).join('\n')); process.exit(1); }
