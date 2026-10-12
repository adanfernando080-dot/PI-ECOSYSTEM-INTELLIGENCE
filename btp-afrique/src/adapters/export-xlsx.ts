/**
 * Export XLSX d'un Document (adaptateur). Montants de ligne et totaux = FORMULES VIVANTES (avec valeur en cache = celle du DocumentModel),
 * pour que l'utilisateur puisse modifier une quantité ou un prix dans Excel et voir les totaux suivre.
 * Taxes / provisions : valeurs du moteur (leurs règles d'arrondi sont déclarées dans le pack, pas dans Excel).
 * La feuille « Provenance » porte les empreintes et le document complet (vérifiable hors ligne).
 * Garantie de reproductibilité : de niveau R2 (contenu) — les octets d'un XLSX peuvent différer.
 */
import ExcelJS from 'exceljs';
import { Dec } from '../core/units/decimal.js';
import { canonicalize, hashOf } from '../core/trace/canonical.js';
import type { Document } from '../core/docs/document.js';

const major = (minor: string | null, minorUnits: number): number | null => minor === null ? null : Number(Dec.parse(minor).div(Dec.of(10n ** BigInt(minorUnits), 0), minorUnits).toString());
const safeSheetName = (s: string): string => s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Document';
const CHUNK = 30000;

export async function renderXlsx(doc: Document): Promise<Uint8Array> {
  const c = doc.content; const L = c.labels; const mu = c.currency.minorUnits;
  const wb = new ExcelJS.Workbook(); const fixed = new Date(`${c.date}T00:00:00Z`);
  wb.creator = 'btp-platform M0'; wb.created = fixed; wb.modified = fixed; wb.title = `${c.title} ${c.number}`; wb.keywords = doc.contentHash;
  const moneyFmt = mu > 0 ? `#,##0.${'0'.repeat(mu)}` : '#,##0';
  const ws = wb.addWorksheet(safeSheetName(c.title), { views: [{ state: 'frozen', ySplit: 0 }] });
  ws.columns = [{ width: 7 }, { width: 58 }, { width: 8 }, { width: 14 }, { width: 18 }, { width: 20 }];
  const put = (r: number, vals: Array<string | number | null>, bold = false): ExcelJS.Row => { const row = ws.getRow(r); vals.forEach((v, i) => { if (v !== null) row.getCell(i + 1).value = v; }); if (bold) row.font = { bold: true }; return row; };
  let r = 1;
  put(r, [c.title], true).font = { bold: true, size: 14 }; r++;
  put(r, [`${L.number ?? 'N°'} ${c.number}`, `${L.date ?? 'Date'} ${c.date} · statut ${c.status} · devise ${c.currency.code}`]); r++;
  if (c.syntheticBanner) { const row = put(r, [c.syntheticBanner], true); row.font = { bold: true, color: { argb: 'FFB00020' } }; r++; }
  put(r, [`${doc.manifest.binding.packId}@${doc.manifest.binding.packVersion} · zone ${doc.manifest.binding.zoneId} · prix au ${doc.manifest.binding.asOf} (${doc.manifest.binding.priceStatistic})`]); r++;
  if (c.parties) {
    put(r, [`${L.issuer ?? 'Émetteur'} : ${c.parties.issuer.name} — ${c.parties.issuer.identifiers.map((i) => `${i.label} ${i.value}`).join(' · ')}`]); r++;
    put(r, [`${L.client ?? 'Client'} : ${c.parties.client.name} · ${L.site ?? 'Chantier'} : ${c.parties.site} · ${L.validity ?? 'Validité'} : ${c.parties.validityDays} j`]); r++;
  }
  r++;
  const subtotalCells: string[] = [];
  for (const sec of c.sections) {
    put(r, [`${sec.lot.code} — ${sec.lot.label}`], true); r++;
    const h = put(r, [L.n ?? 'N°', L.designation ?? '', L.unit ?? '', L.quantity ?? '', `${L.unitPrice ?? ''} (${c.currency.code})`, `${L.amount ?? ''} (${c.currency.code})`], true);
    h.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }; }); r++;
    const first = r;
    for (const l of sec.lines) {
      const row = put(r, [l.n, l.designation + (l.flags.length ? `  [${l.flags.join(', ')}]` : ''), l.unit, Number(l.quantity), major(l.unitPrice, mu)]);
      row.getCell(4).numFmt = '#,##0.00##'; row.getCell(5).numFmt = moneyFmt;
      if (l.amount !== null) row.getCell(6).value = { formula: `ROUND(D${r}*E${r},${mu})`, result: major(l.amount, mu)! } as ExcelJS.CellFormulaValue; else row.getCell(6).value = 'non chiffré';
      row.getCell(6).numFmt = moneyFmt; r++;
    }
    const sub = put(r, [null, L.subtotal ?? 'Sous-total'], true);
    sub.getCell(6).value = { formula: `SUM(F${first}:F${r - 1})`, result: major(sec.subtotal, mu)! } as ExcelJS.CellFormulaValue; sub.getCell(6).numFmt = moneyFmt; subtotalCells.push(`F${r}`); r += 2;
  }
  const lt = put(r, [null, L.linesTotal ?? 'Total des postes']); lt.getCell(6).value = { formula: subtotalCells.join('+') || '0', result: major(c.totals.linesTotal, mu)! } as ExcelJS.CellFormulaValue; lt.getCell(6).numFmt = moneyFmt; const ltRow = r; r++;
  const layerRows: number[] = [];
  for (const t of c.totals.layers) { const row = put(r, [null, t.label + (t.effect === 'tax' ? ' (taxe)' : '')]); row.getCell(6).value = major(t.amount, mu)!; row.getCell(6).numFmt = moneyFmt; layerRows.push(r); r++; }
  if (c.layout === 'quote') { const ht = put(r, [null, L.totalHT ?? 'Total HT'], true); ht.getCell(6).value = major(c.totals.subtotalBeforeTax, mu)!; ht.getCell(6).numFmt = moneyFmt; r++; }
  const tot = put(r, [null, c.layout === 'quote' ? (L.totalTTC ?? 'Total TTC') : (L.total ?? 'Total')], true);
  tot.getCell(6).value = { formula: `F${ltRow}${layerRows.map((x) => `+F${x}`).join('')}`, result: major(c.totals.total, mu)! } as ExcelJS.CellFormulaValue; tot.getCell(6).numFmt = moneyFmt; r += 2;
  if (c.notices.length) { put(r, ['Avis'], true); r++; for (const n of c.notices) { put(r, [`• ${n}`]); r++; } }

  // ---- Annexe
  const an = wb.addWorksheet('Annexe'); an.columns = [{ width: 34 }, { width: 120 }]; let ar = 1;
  const sec = (title: string, items: string[]): void => { an.getRow(ar).getCell(1).value = title; an.getRow(ar).font = { bold: true }; ar++; if (!items.length) { an.getRow(ar).getCell(2).value = 'aucun'; ar++; } for (const i of items) { an.getRow(ar).getCell(2).value = i; ar++; } ar++; };
  const a = c.annex;
  sec('Hypothèses utilisées', a.assumptions.map((x) => `${x.id} ${x.key} = ${x.value}${x.unit ? ' ' + x.unit : ''} [${x.status}] — ${x.rationale}`));
  sec('Valeurs IA non revues', a.unreviewed.map((u) => `${u.code}.${u.attr} (${u.validation}, confiance ${u.confidence})`));
  sec('Ajustements manuels de quantité', a.manual.adjustments.map((x) => `${x.id} sur ${x.target} : ${x.before} → ${x.after} (${x.mode} ${x.value}) par ${x.author} le ${x.date} — ${x.justification}`));
  sec('Lignes manuelles', a.manual.lines.map((x) => `${x.id} « ${x.designation} » (${x.lot}) ${x.quantity} ${x.unit} × ${x.unitPrice} (unité mineure) par ${x.author} le ${x.date} — ${x.justification}`));
  sec('Ajustements NON appliqués', a.manual.orphans.map((x) => `${x.id} sur ${x.target} : ${x.reason} — ${x.justification}`));
  sec('Éléments sans correspondance', a.unmapped.map((x) => `${x.entity} / ${x.class} : ${x.reason}`));
  sec('Postes sans prix', a.unpriced.map((x) => `${x.line} : ${x.items.join(', ')}`));
  sec('Alertes de prix', a.priceAlerts.map((x) => `${x.line} / ${x.item} : ${x.alert}`));

  // ---- Provenance
  const pv = wb.addWorksheet('Provenance'); pv.columns = [{ width: 30 }, { width: 140 }]; const m = doc.manifest;
  const kv: Array<[string, string]> = [['document', doc.id], ['contentHash', doc.contentHash], ['manifestHash', doc.manifestHash], ['dataClass', m.dataClass], ['engine', `${m.engine.version} (API ${m.engine.apiVersion})`],
    ['planRevision', m.planRevision.sourceDocumentHash], ['modelRev', m.modelRev], ['assumptionSetRev', m.assumptionSetRev], ['manualEntriesHash', m.manualEntriesHash], ['geoTakeoffHash', m.geoTakeoffHash],
    ['marketBinding', `${m.binding.id} rev ${m.binding.revision} ${m.binding.rev}`], ['packResolvedHash', `${m.binding.packId}@${m.binding.packVersion} ${m.binding.packResolvedHash}`], ['priceBook', `${m.binding.priceBookId} ${m.binding.priceBookHash}`], ['quantitySetHash', m.quantitySetHash], ['estimateHash', m.estimateHash]];
  kv.forEach(([k, v], i) => { pv.getRow(i + 1).getCell(1).value = k; pv.getRow(i + 1).getCell(2).value = v; });
  const json = canonicalize(doc); const n = Math.ceil(json.length / CHUNK); let pr = kv.length + 2;
  pv.getRow(pr).getCell(1).value = 'document.json (chunks)'; pv.getRow(pr).getCell(2).value = String(n); pr++;
  for (let i = 0; i < n; i++) { pv.getRow(pr).getCell(1).value = `chunk ${i}`; pv.getRow(pr).getCell(2).value = json.slice(i * CHUNK, (i + 1) * CHUNK); pr++; }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

export async function verifyXlsxDocument(bytes: Uint8Array): Promise<{ ok: boolean; problems: string[]; document?: Document }> {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const pv = wb.getWorksheet('Provenance'); const problems: string[] = [];
  if (!pv) return { ok: false, problems: ['feuille Provenance absente'] };
  const chunks: string[] = [];
  pv.eachRow((row) => { const k = String(row.getCell(1).value ?? ''); if (/^chunk \d+$/.test(k)) chunks[Number(k.slice(6))] = String(row.getCell(2).value ?? ''); });
  if (!chunks.length) return { ok: false, problems: ['document.json absent de la feuille Provenance'] };
  const doc = JSON.parse(chunks.join('')) as Document;
  if (hashOf(doc.content) !== doc.contentHash) problems.push('contenu du document joint altéré');
  if (hashOf(doc.manifest) !== doc.manifestHash) problems.push('manifeste du document joint altéré');
  return { ok: problems.length === 0, problems, document: doc };
}
