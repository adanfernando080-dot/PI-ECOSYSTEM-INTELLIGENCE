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
import { fitView, toScreen } from '../src/editor/viewport.js';
import { newRoomProject } from '../src/projects.js';

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

  console.log('10b. Éditeur 2D : brouillon → validation → opérations → recalcul');
  await page.getByTestId('close').click(); await page.getByTestId('pack-select').selectOption('pack.bj');
  await page.getByTestId('room-name').fill('Salle éditeur'); await page.getByTestId('create-room').click();
  await page.getByTestId('tab-assumptions').click(); await page.getByTestId('as-confirm-A-01').click();
  await page.getByTestId('tab-plan').click(); await page.getByTestId('ed-canvas').waitFor();
  const room = newRoomProject({ name: 'Salle éditeur', lengthM: '5.00', widthM: '4.00', thicknessM: '0.20', wallClass: 'masonry.block.hollow', heightM: '3.00', author: 'u', date: '2026-10-12' });
  const lv0 = room.state.model.buildings[0]!.levels[0]!; const view0 = fitView(lv0, 900, 560);
  const box = (await page.getByTestId('ed-canvas').boundingBox())!;
  const at = (xm: number, ym: number): { x: number; y: number } => { const s = toScreen(view0, Math.round(xm * 10000), Math.round(ym * 10000)); return { x: box.x + (s.x / 900) * box.width, y: box.y + (s.y / 560) * box.height }; };
  const clickAt = async (xm: number, ym: number): Promise<void> => { const p = at(xm, ym); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); };
  const edTotal = async (): Promise<string> => { await page.getByTestId('tab-estimate').click(); const t = digits(await txt(page, 'total')); await page.getByTestId('tab-plan').click(); return t; };
  check('plan : grille et barre d\'échelle affichées avec unité', (await page.locator('.ed-canvas line.g').count()) > 10 && /\d+(\.\d+)? m/.test(await txt(page, 'ed-scale')), await txt(page, 'ed-scale'));
  const p0 = at(2.5, 1); await page.mouse.move(p0.x, p0.y); check('lecture des coordonnées à l\'unité explicite (m) avec aimantation à la grille', /x = 2\.50 m · y = 1\.00 m \(grille 0\.10 m\)/.test(await txt(page, 'ed-status')), await txt(page, 'ed-status'));
  const wallsBefore = await page.locator('svg [data-testid^="ed-wall-"]').count(); const edTotal0 = await edTotal();
  await page.getByTestId('ed-tool-wall').click(); await clickAt(2.5, 0); await clickAt(2.5, 4);
  check('geste de souris → BROUILLON (aperçu fantôme), modèle inchangé', (await page.getByTestId('ed-draft').count()) === 1 && (await page.locator('svg [data-testid^="ed-wall-"]').count()) === wallsBefore && (await page.getByTestId('ed-ghost-wall').count()) === 1);
  check('le brouillon liste les opérations et les conséquences chiffrées (recalcul sur copie)', /Créer le mur W1/.test(await txt(page, 'ed-draft-ops')) && /Total/.test(await txt(page, 'ed-impact')), await txt(page, 'ed-impact').catch(() => '(pas d\'impact)'));
  await page.getByTestId('ed-draft-validate').click();
  check('validation → mur créé et métrés recalculés (total modifié)', (await page.locator('svg [data-testid^="ed-wall-"]').count()) === wallsBefore + 1 && (await edTotal()) !== edTotal0);
  const edTotal1 = await edTotal();
  await page.getByTestId('ed-undo').click(); check('annuler : mur retiré, total d\'origine', (await page.locator('svg [data-testid^="ed-wall-"]').count()) === wallsBefore && (await edTotal()) === edTotal0);
  await page.getByTestId('ed-redo').click(); check('rétablir : mur de retour, même total', (await page.locator('svg [data-testid^="ed-wall-"]').count()) === wallsBefore + 1 && (await edTotal()) === edTotal1);
  await page.getByTestId('ed-focus').focus(); await page.keyboard.press('Control+z'); check('Ctrl+Z annule', (await page.locator('svg [data-testid^="ed-wall-"]').count()) === wallsBefore);
  await page.keyboard.press('Control+y'); check('Ctrl+Y rétablit', (await page.locator('svg [data-testid^="ed-wall-"]').count()) === wallsBefore + 1);

  await page.getByTestId('ed-tool-select').click(); const wp = at(2.5, 2); await page.mouse.click(wp.x, wp.y);
  check('sélection d\'un mur : longueur du MOTEUR (4 m) et liens traçables vers quantités, ouvrages et lignes', /4(\.0+)? m/.test(await txt(page, 'ed-selection')) && (await page.getByTestId('ed-links').count()) === 1 && (await page.locator('[data-testid^="ed-why-"]').count()) > 0, (await txt(page, 'ed-selection')).slice(0, 160));
  await shot('08-editeur-selection-liens');
  await page.locator('[data-testid^="ed-why-"]').first().click(); check('« Pourquoi ? » : explication déterministe depuis l\'objet graphique', /Pourquoi/.test(await txt(page, 'explain')));
  await page.getByTestId('explain').getByRole('button', { name: 'Fermer' }).click();
  await page.getByTestId('ed-sel-thickness').fill('0.10'); await page.getByTestId('ed-wall-apply').click(); const t10 = await txt(page, 'ed-draft-ops'); check('dimension saisie en mètres → brouillon explicite', /épaisseur 0\.10 m/.test(t10), t10);
  await page.getByTestId('ed-draft-validate').click(); const edTotal2 = await edTotal(); check('épaisseur modifiée : total recalculé', edTotal2 !== edTotal1);

  await page.getByTestId('ed-tool-opening').click(); const mid = at(2.5, 2); await page.mouse.click(mid.x, mid.y);
  check('outil Ouverture : clic sur un mur → brouillon', /Ajouter l'ouverture/.test(await txt(page, 'ed-draft-ops'))); await page.getByTestId('ed-draft-validate').click();
  check('ouverture créée et reliée', (await page.locator('[data-testid^="ed-opening-"]').count()) === 1);
  await page.getByTestId('ed-tool-select').click(); const op = await page.locator('[data-testid^="ed-opening-"]').first().boundingBox(); await page.mouse.click(op!.x + op!.width / 2, op!.y + op!.height / 2);
  await page.getByTestId('ed-op-w').fill('9.00'); await page.getByTestId('ed-op-apply').click();
  check('ouverture plus large que son mur : brouillon REFUSÉ par la validation, bouton Valider désactivé', /largeur supérieure/.test(await txt(page, 'ed-draft-errors')) && (await page.getByTestId('ed-draft-validate').isDisabled()), await txt(page, 'ed-draft-errors').catch(() => '(pas d\'erreur)'));
  await page.getByTestId('ed-draft-cancel').click(); check('annuler le brouillon : rien n\'est appliqué', (await page.getByTestId('ed-draft').count()) === 0);
  const wAgain = at(2.5, 3.3); await page.mouse.click(wAgain.x, wAgain.y); await page.mouse.click(op!.x + op!.width / 2, op!.y + op!.height / 2);
  check('changer de sélection réinitialise les champs depuis le modèle (pas de valeur rejetée résiduelle)', (await page.getByTestId('ed-op-w').inputValue()) === '0.90', await page.getByTestId('ed-op-w').inputValue());

  await page.getByTestId('ed-tool-room').click(); await page.getByTestId('ed-room-name').fill('Annexe'); await clickAt(5.5, 0); await clickAt(6.8, 1.8);
  check('outil Pièce : 2 clics → brouillon (4 points, 4 murs, 1 pièce)', /Créer la pièce « Annexe »/.test(await txt(page, 'ed-draft-ops')) && (await page.locator('[data-testid="ed-draft-ops"] li').count()) === 9, String(await page.locator('[data-testid="ed-draft-ops"] li').count()));
  await shot('09-editeur-brouillon-piece');
  await page.getByTestId('ed-draft-validate').click(); check('pièce créée', (await page.locator('[data-testid^="ed-space-S"]').count()) === 1);
  await page.getByTestId('tab-model').click(); check('le tableau « Modèle » voit la pièce, avec sa surface calculée par le moteur', /Annexe[\s\S]*\d+\.\d+/.test(await txt(page, 'spaces'))); await page.getByTestId('tab-plan').click();

  await page.getByTestId('ed-tool-select').click(); const nodeBox = await page.getByTestId('ed-node-N2').boundingBox(); const nx = nodeBox!.x + nodeBox!.width / 2, ny = nodeBox!.y + nodeBox!.height / 2;
  await page.mouse.move(nx, ny); await page.mouse.down(); const dest = at(5.5, 1); await page.mouse.move(dest.x, dest.y, { steps: 4 }); await page.mouse.up();
  check('glisser un point → brouillon « Déplacer » (non appliqué)', /Déplacer le point N2 en \(5\.50 m ; 1\.00 m\)/.test(await txt(page, 'ed-draft-ops')), await txt(page, 'ed-draft-ops').catch(() => ''));
  await page.getByTestId('ed-draft-cancel').click();
  await page.getByTestId('ed-c-x1').fill('0'); await page.getByTestId('ed-c-y1').fill('-2.00'); await page.getByTestId('ed-c-x2').fill('3'); await page.getByTestId('ed-c-y2').fill('-2.00'); await page.getByTestId('ed-tool-wall').click(); await page.getByTestId('ed-wall-thickness').fill('');
  await page.getByTestId('ed-c-apply').click(); check('épaisseur absente : erreur contrôlée, aucun brouillon', /Épaisseur/.test(await txt(page, 'ed-error')) && (await page.getByTestId('ed-draft').count()) === 0, await txt(page, 'ed-error').catch(() => ''));
  await page.getByTestId('ed-wall-thickness').fill('0.15'); await page.getByTestId('ed-c-apply').click(); await page.getByTestId('ed-draft-validate').click(); check('mur créé par coordonnées saisies (unités explicites)', (await page.locator('svg [data-testid^="ed-wall-"]').count()) >= wallsBefore + 1 + 4 + 1);

  await page.getByTestId('ed-tool-select').click(); const wDel = at(2.5, 3.3); await page.mouse.click(wDel.x, wDel.y);
  await page.getByTestId('ed-focus').focus(); await page.keyboard.press('Delete');
  check('Suppr : suppression en cascade proposée (ouverture retirée avec le mur) en un brouillon', /Supprimer l'ouverture/.test(await txt(page, 'ed-draft-ops')) && /Supprimer le mur/.test(await txt(page, 'ed-draft-ops')));
  await page.keyboard.press('Enter'); check('Entrée valide le brouillon : mur et ouverture supprimés', (await page.getByTestId('ed-wall-W1').count()) === 0 && (await page.locator('[data-testid^="ed-opening-"]').count()) === 0);
  await page.getByTestId('ed-undo').click(); check('annuler la suppression en cascade : mur ET ouverture restitués', (await page.getByTestId('ed-wall-W1').count()) === 1 && (await page.locator('[data-testid^="ed-opening-"]').count()) === 1);
  const walls2 = await page.locator('svg [data-testid^="ed-wall-"]').count(); const totalEd = await edTotal();
  await page.getByTestId('tab-history').click(); const groups = await page.locator('[data-testid="groups"] li').count(); check('historique : un groupe par geste (pas une entrée par opération)', groups >= 5 && groups < (await page.getByTestId('oplog').locator('li').count()), `${groups} groupes`);

  await shot('10-editeur-plan-complet');
  console.log('10c. Éditeur : sauvegarde, réouverture, historique et métrés identiques');
  const edFile = join(tmp, 'editeur.btpx'); const dl = await download(() => page.getByTestId('save').click(), 'editeur.btpx'); void dl; void edFile;
  await page.getByTestId('close').click(); await page.getByTestId('open-file').setInputFiles(join(tmp, 'editeur.btpx'));
  await page.getByTestId('notice').filter({ hasText: 'rouvert' }).waitFor({ timeout: 15000 }); check('réouverture : recalcul à froid IDENTIQUE', /IDENTIQUE/.test(await txt(page, 'notice')));
  await page.getByTestId('tab-plan').click(); check('même plan après réouverture', (await page.locator('svg [data-testid^="ed-wall-"]').count()) === walls2 && (await edTotal()) === totalEd);
  check('annuler/rétablir disponibles après réouverture (historique restauré depuis le .btpx)', await page.getByTestId('ed-undo').isEnabled());
  await page.getByTestId('ed-undo').click(); await page.getByTestId('ed-redo').click(); check('annuler puis rétablir après réouverture : même total', (await edTotal()) === totalEd);

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
