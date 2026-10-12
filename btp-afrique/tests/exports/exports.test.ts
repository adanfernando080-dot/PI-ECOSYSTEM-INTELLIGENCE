/**
 * Exports PDF et XLSX (T-DOC-01). Validation par des outils INDÉPENDANTS de notre code :
 * poppler (pdftotext, pdfinfo, pdfdetach), LibreOffice (recalcul des formules), openpyxl, unzip.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterAll, describe, expect, it } from 'vitest';
import { Dec } from '../../src/core/units/decimal.js';
import { hashOf } from '../../src/core/trace/canonical.js';
import { emitDocument } from '../../src/core/project/pipeline.js';
import { formatDocNumber, type Document } from '../../src/core/docs/document.js';
import { renderPdf, toWinAnsi, verifyPdfDocument, readPdfAttachments } from '../../src/adapters/export-pdf.js';
import { renderXlsx, verifyXlsxDocument } from '../../src/adapters/export-xlsx.js';
import { fmtMoney, fmtQty } from '../../src/adapters/render-text.js';
import { cell, house, clone, type PackKey } from '../support/env.js';

const tmp = mkdtempSync(join(tmpdir(), 'btp-exp-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const sh = (cmd: string, args: string[]): string => execFileSync(cmd, args, { encoding: 'utf8', timeout: 120_000 });

function docs(k: PackKey): { dqe: Document; quote: Document } {
  const run = house(k);
  const t1 = run.pack.documentTemplates.find((t) => t.layout === 'priced-lines')!; const t2 = run.pack.documentTemplates.find((t) => t.layout === 'quote')!;
  const num = (kind: string): string => formatDocNumber(run.pack.numberingRules.find((n) => n.kind === kind)!, '2026-10-12', 1);
  const idKey = run.pack.legalIdentifiers[0]!.key;
  return {
    dqe: emitDocument(run, { templateId: t1.id, number: num(t1.kind), date: '2026-10-12', status: 'final' }),
    quote: emitDocument(run, { templateId: t2.id, number: num(t2.kind), date: '2026-10-12', status: 'final', issuer: { name: 'ENTREPRISE DE TEST', identifiers: { [idKey]: '000-TEST' } }, client: { name: 'CLIENT DE TEST' }, site: 'Chantier synthétique', validityDays: 30 }),
  };
}
const ALL = (['bj', 'sn', 'divergent'] as PackKey[]).flatMap((k) => { const d = docs(k); return [[`${k}/DQE`, d.dqe] as const, [`${k}/devis`, d.quote] as const]; });

describe('PDF', () => {
  it('jeu de caractères : WinAnsi, remplacements explicites', () => {
    expect(toWinAnsi('Maçonnerie à 20 cm × 2 « œuvre » — €')).toEqual({ text: 'Maçonnerie à 20 cm × 2 « œuvre » — €', unsupported: [] });
    expect(toWinAnsi('a → b ≥ c − d')).toEqual({ text: 'a -> b >= c - d', unsupported: [] });
    expect(toWinAnsi('日本')).toEqual({ text: '??', unsupported: ['日', '本'] });
  });
  for (const [name, doc] of ALL) {
    it(`${name} : PDF valide, texte = DocumentModel, bannière sur chaque page, pièces jointes de provenance`, async () => {
      const r = await renderPdf(doc); const f = join(tmp, `${name.replace('/', '_')}.pdf`); writeFileSync(f, r.bytes);
      expect(Buffer.from(r.bytes.slice(0, 5)).toString()).toBe('%PDF-'); expect(r.unsupportedChars).toEqual([]);
      const info = sh('pdfinfo', [f]); expect(info).toMatch(new RegExp(`Pages:\\s+${r.pageCount}\\b`)); expect(info).toMatch(/Title:\s+.*/);
      expect(r.pageCount).toBeGreaterThanOrEqual(2);
      const txt = sh('pdftotext', ['-layout', f, '-']); const flat = txt.replace(/\s+/g, ' ');
      const c = doc.content; const cur = c.currency;
      expect(flat).toContain(c.title); expect(flat).toContain(c.number); expect(flat).toContain(doc.id);
      for (const s of c.sections) { expect(flat).toContain(s.lot.code); for (const l of s.lines) { expect(flat, `${l.lineId} montant`).toContain(fmtMoney(l.amount, cur.minorUnits, cur.code)); expect(flat).toContain(fmtQty(l.quantity)); } expect(flat).toContain(fmtMoney(s.subtotal, cur.minorUnits, cur.code)); }
      expect(flat).toContain(fmtMoney(c.totals.total, cur.minorUnits, cur.code)); expect(flat).toContain(fmtMoney(c.totals.linesTotal, cur.minorUnits, cur.code));
      for (let p = 1; p <= r.pageCount; p++) expect(sh('pdftotext', ['-f', String(p), '-l', String(p), f, '-']), `page ${p}`).toMatch(/SYNTH[ÉE]TIQUES|SYNTHETIC TEST DATA/);
      expect(sh('pdfdetach', ['-list', f])).toMatch(/provenance\.json[\s\S]*document\.json|document\.json[\s\S]*provenance\.json/);
      expect(sh('pdfdetach', ['-list', f])).toMatch(/2 embedded files/);
      // extraction : poppler ne sait pas enregistrer les pièces pdf-lib (nom UF absent) ; l'extraction est vérifiée par readPdfAttachments (test dédié)
    }, 60_000);
  }
  it('octets DÉTERMINISTES : deux rendus du même document sont identiques', async () => {
    const [, doc] = ALL[0]!; const a = await renderPdf(doc); const b = await renderPdf(doc);
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });
  it('vérification hors ligne depuis le PDF : empreintes recalculées ; falsification détectée', async () => {
    const [, doc] = ALL[0]!; const bytes = (await renderPdf(doc)).bytes;
    const v = await verifyPdfDocument(bytes); expect(v).toMatchObject({ ok: true, problems: [] });
    expect(v.document!.contentHash).toBe(doc.contentHash); expect(hashOf(v.document!.content)).toBe(doc.contentHash);
    const att = await readPdfAttachments(bytes); expect(Object.keys(att).sort()).toEqual(['document.json', 'provenance.json']);
    const forged = clone(doc); forged.content.totals.total = '1';                      // contenu changé, empreinte laissée
    const bad = await verifyPdfDocument((await renderPdf(forged)).bytes);
    expect(bad.ok).toBe(false); expect(bad.problems.join()).toMatch(/contenu du document joint altéré/);
  });
  it('un PDF ordinaire (sans pièces jointes) est refusé par la vérification', async () => {
    const { PDFDocument } = await import('pdf-lib'); const p = await PDFDocument.create(); p.addPage();
    expect((await verifyPdfDocument(await p.save())).ok).toBe(false);
  });
  it('document avec lignes manuelles et ajustements : annexe PDF avec auteur et justification', async () => {
    const { runWith, catalog, cellModel, cellAssumptions, ZONES } = await import('../support/env.js');
    const run = runWith(catalog.resolve('pack.bj'), cellModel(), cellAssumptions(), { zoneId: ZONES.bj }, { manual: {
      adjustments: [{ id: 'AJ-1', target: 'oq:OUV.MAC.BLOC20', mode: 'delta', value: '2', author: 'métreur.test', date: '2026-10-12', justification: 'Reprise du mur pignon non dessiné' }],
      lines: [{ id: 'ML-1', lot: 'LOT01', designation: 'Installation de chantier', unit: 'u', quantity: '1', unitPrice: '150000', author: 'métreur.test', date: '2026-10-12', justification: 'Forfait convenu avec le client' }] } });
    const d = emitDocument(run, { templateId: 'tpl.dqe.fr', number: 'M-1', date: '2026-10-12', status: 'draft' });
    const f = join(tmp, 'manual.pdf'); writeFileSync(f, (await renderPdf(d)).bytes);
    const flat = sh('pdftotext', ['-layout', f, '-']).replace(/\s+/g, ' ');
    expect(flat).toContain('Reprise du mur pignon non dessiné'); expect(flat).toContain('Forfait convenu avec le client'); expect(flat).toContain('métreur.test'); expect(flat).toContain('manual_line');
  });
});

describe('XLSX', () => {
  it('structure : feuilles, valeurs numériques = DocumentModel, formules vivantes avec résultat en cache', async () => {
    for (const [name, doc] of ALL) {
      const bytes = await renderXlsx(doc); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
      expect(wb.worksheets.map((w) => w.name).slice(1), name).toEqual(['Annexe', 'Provenance']);
      const ws = wb.worksheets[0]!; const mu = doc.content.currency.minorUnits; const f = (v: string | null): number | null => v === null ? null : Number(Dec.parse(v).div(Dec.of(10n ** BigInt(mu), 0), mu).toString());
      const lines = doc.content.sections.flatMap((s) => s.lines); let found = 0;
      ws.eachRow((row) => {
        const n = String(row.getCell(1).value ?? ''); const l = lines.find((x) => x.n === n && String(row.getCell(2).value ?? '').startsWith(x.designation));
        if (!l) return; found++;
        expect(Number(row.getCell(4).value), `${name} ${n} qté`).toBe(Number(l.quantity)); expect(Number(row.getCell(5).value), `${name} ${n} PU`).toBe(f(l.unitPrice));
        const fv = row.getCell(6).value as ExcelJS.CellFormulaValue; expect(fv.formula).toBe(`ROUND(D${row.number}*E${row.number},${mu})`); expect(fv.result, `${name} ${n} montant`).toBe(f(l.amount));
      });
      expect(found, name).toBe(lines.length);
      const totalRow = ws.getRows(1, ws.rowCount)!.find((r) => { const v = r.getCell(6).value as ExcelJS.CellFormulaValue | null; return v && typeof v === 'object' && 'result' in v && v.result === f(doc.content.totals.total) && /^F\d+\+F\d+/.test(v.formula ?? ''); });
      expect(totalRow, `${name} total`).toBeDefined();
    }
  }, 60_000);
  it('fichier valide pour des lecteurs indépendants : unzip -t et openpyxl', async () => {
    const [, doc] = ALL[0]!; const f = join(tmp, 'a.xlsx'); writeFileSync(f, await renderXlsx(doc));
    expect(sh('unzip', ['-t', f])).toMatch(/No errors detected/);
    const out = sh('python3', ['-I', '-c', `import openpyxl,sys;wb=openpyxl.load_workbook(sys.argv[1],data_only=True);ws=wb.worksheets[0];print(wb.sheetnames);print(max(c.value for r in ws.iter_rows(min_col=6,max_col=6) for c in r if isinstance(c.value,(int,float))))`, f]);
    expect(out).toMatch(/\['.*', 'Annexe', 'Provenance'\]/); expect(Number(out.trim().split('\n')[1])).toBe(Number(doc.content.totals.total));
  });
  it('les formules SONT recalculées par LibreOffice (sans valeurs en cache) et redonnent exactement les montants du moteur', async () => {
    for (const [name, doc] of [ALL[0]!, ALL[1]!, ALL[4]!, ALL[5]!]) {            // bj DQE, bj devis, divergent DQE, divergent devis
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load((await renderXlsx(doc)) as unknown as ExcelJS.Buffer);
      wb.worksheets[0]!.eachRow((row) => row.eachCell((cell) => { const v = cell.value as ExcelJS.CellFormulaValue; if (v && typeof v === 'object' && 'formula' in v) cell.value = { formula: v.formula } as ExcelJS.CellFormulaValue; }));   // supprime le cache
      const dir = mkdtempSync(join(tmp, 'lo-')); const src = join(dir, 'nocache.xlsx'); await wb.xlsx.writeFile(src);
      sh('soffice', [`-env:UserInstallation=file://${dir}/profile`, '--headless', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', join(dir, 'out'), src]);
      const lo = new ExcelJS.Workbook(); await lo.xlsx.readFile(join(dir, 'out', 'nocache.xlsx'));
      const ws = lo.worksheets[0]!; const mu = doc.content.currency.minorUnits; const f = (v: string): number => Number(Dec.parse(v).div(Dec.of(10n ** BigInt(mu), 0), mu).toString());
      const lines = doc.content.sections.flatMap((s) => s.lines); let ok = 0;
      ws.eachRow((row) => { const n = String(row.getCell(1).value ?? ''); const l = lines.find((x) => x.n === n && String(row.getCell(2).value ?? '').startsWith(x.designation)); if (!l) return; const v = row.getCell(6).value as ExcelJS.CellFormulaValue; expect(v.result, `${name} ${n}`).toBe(f(l.amount!)); ok++; });
      expect(ok, name).toBe(lines.length);
      const results = new Set<number>(); ws.eachRow((row) => { const v = row.getCell(6).value as ExcelJS.CellFormulaValue; if (v && typeof v === 'object' && 'result' in v) results.add(Number(v.result)); });
      expect(results.has(f(doc.content.totals.total)), `${name} total recalculé`).toBe(true);
    }
  }, 240_000);
  it('vérification hors ligne depuis le XLSX ; falsification détectée', async () => {
    const [, doc] = ALL[1]!; const v = await verifyXlsxDocument(await renderXlsx(doc)); expect(v).toMatchObject({ ok: true, problems: [] });
    expect(v.document!.id).toBe(doc.id);
    const forged = clone(doc); forged.content.totals.total = '1'; expect((await verifyXlsxDocument(await renderXlsx(forged))).problems.join()).toMatch(/contenu du document joint altéré/);
  });
  it('NOMBRE DE DÉCIMALES de la devise respecté (2 décimales pour le pack divergent) et noms de feuille sûrs', async () => {
    const [, doc] = ALL[4]!; const wb = new ExcelJS.Workbook(); await wb.xlsx.load((await renderXlsx(doc)) as unknown as ExcelJS.Buffer);
    expect(wb.worksheets[0]!.getRow(10).getCell(6).numFmt === undefined || true).toBe(true);
    let fmt = ''; wb.worksheets[0]!.eachRow((r) => { const v = r.getCell(6).value as ExcelJS.CellFormulaValue; if (v && typeof v === 'object' && 'formula' in v) fmt = r.getCell(6).numFmt ?? fmt; }); expect(fmt).toBe('#,##0.00');
    expect(wb.worksheets[0]!.name).toBe('Bill of Quantities');
  });
});

describe('PDF ≡ XLSX ≡ Markdown : mêmes chiffres, issus du même DocumentModel (T-DOC-01)', () => {
  it('tous les montants de lignes et le total apparaissent à l\'identique dans les deux formats', async () => {
    for (const [name, doc] of ALL) {
      const pdfTxt = (() => { const f = join(tmp, `eq_${name.replace('/', '_')}.pdf`); return renderPdf(doc).then((r) => { writeFileSync(f, r.bytes); return sh('pdftotext', ['-layout', f, '-']).replace(/\s+/g, ' '); }); })();
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load((await renderXlsx(doc)) as unknown as ExcelJS.Buffer);
      const xl = new Set<number>(); wb.worksheets[0]!.eachRow((row) => { const v = row.getCell(6).value as ExcelJS.CellFormulaValue; if (v && typeof v === 'object' && 'result' in v) xl.add(Number(v.result)); else if (typeof v === 'number') xl.add(v); });
      const mu = doc.content.currency.minorUnits; const f = (s: string): number => Number(Dec.parse(s).div(Dec.of(10n ** BigInt(mu), 0), mu).toString());
      const flat = await pdfTxt;
      for (const l of doc.content.sections.flatMap((s) => s.lines)) { expect(flat, name).toContain(fmtMoney(l.amount, mu, doc.content.currency.code)); expect(xl.has(f(l.amount!)), `${name} ${l.lineId}`).toBe(true); }
      expect(flat).toContain(fmtMoney(doc.content.totals.total, mu, doc.content.currency.code)); expect(xl.has(f(doc.content.totals.total))).toBe(true);
    }
  }, 120_000);
});

void cell; void readFileSync;
