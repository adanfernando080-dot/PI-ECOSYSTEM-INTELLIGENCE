/**
 * Export PDF d'un Document (adaptateur ; le noyau n'a aucune dépendance). Le rendu ne calcule RIEN : il met en page le DocumentModel.
 *  - bannière « DONNÉES SYNTHÉTIQUES » sur chaque page quand le document en provient ;
 *  - pied de page : identifiant du document, empreinte, MarketBinding, pack, pagination ;
 *  - pièces jointes machine : `provenance.json` (manifeste) et `document.json` (document complet) → vérifiables hors ligne ;
 *  - octets DÉTERMINISTES (dates et métadonnées fixées par la date du document).
 * Police standard (WinAnsi) : les caractères hors jeu sont remplacés de façon explicite et comptés (`unsupportedChars`).
 */
import { PDFDocument, PDFName, PDFRawStream, PDFDict, PDFString, PDFHexString, PDFRef, StandardFonts, rgb, decodePDFRawStream, type PDFFont, type PDFPage } from 'pdf-lib';
import { canonicalize, hashOf } from '../core/trace/canonical.js';
import type { Document } from '../core/docs/document.js';
import { fmtMoney, fmtQty } from './render-text.js';

const REPLACE: Record<string, string> = { '−': '-', '‑': '-', '→': '->', '≥': '>=', '≤': '<=', '≠': '!=', '⚠': '(!)', '·': '·', '…': '...', ' ': ' ', ' ': ' ', '✓': 'v', '✗': 'x', '–': '-' };
/** WinAnsi (CP1252) : renvoie le texte encodable et la liste des caractères non supportés. */
export function toWinAnsi(text: string): { text: string; unsupported: string[] } {
  const bad: string[] = []; let out = '';
  for (const ch of text) {
    const r = REPLACE[ch] ?? ch; const c = r.codePointAt(0)!;
    const ok = c === 9 || (c >= 32 && c < 127) || (c >= 160 && c <= 255) || '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(r);
    if (ok) out += r; else { bad.push(ch); out += '?'; }
  }
  return { text: out, unsupported: bad };
}

const A4: [number, number] = [595.28, 841.89]; const M = 40; const W = A4[0] - 2 * M;

export interface PdfResult { bytes: Uint8Array; pageCount: number; unsupportedChars: string[] }

export async function renderPdf(doc: Document): Promise<PdfResult> {
  const c = doc.content; const L = c.labels; const cur = c.currency;
  const pdf = await PDFDocument.create();
  const fixed = new Date(`${c.date}T00:00:00Z`);
  pdf.setTitle(`${c.title} ${c.number}`); pdf.setSubject(`${c.kind} — ${doc.id}`); pdf.setAuthor(c.parties?.issuer.name ?? ''); pdf.setProducer('btp-platform M0'); pdf.setCreator('btp-platform M0');
  pdf.setKeywords([doc.contentHash, doc.manifest.binding.packId, doc.manifest.binding.zoneId, c.dataClass]); pdf.setCreationDate(fixed); pdf.setModificationDate(fixed);
  const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const unsupported: string[] = [];
  const S = (t: string): string => { const r = toWinAnsi(t); unsupported.push(...r.unsupported); return r.text; };
  const money = (v: string | null): string => S(fmtMoney(v, cur.minorUnits, cur.code));

  const pages: PDFPage[] = []; let page!: PDFPage; let y = 0;
  const newPage = (): void => {
    page = pdf.addPage(A4); pages.push(page); y = A4[1] - M;
    if (c.syntheticBanner) {
      page.drawRectangle({ x: M, y: y - 16, width: W, height: 16, borderColor: rgb(0.75, 0.1, 0.1), borderWidth: 1, color: rgb(1, 0.93, 0.93) });
      page.drawText(S(c.syntheticBanner), { x: M + 4, y: y - 11, size: 6.8, font: bold, color: rgb(0.7, 0.05, 0.05) }); y -= 24;
    }
  };
  const need = (h: number): void => { if (y - h < M + 28) newPage(); };
  const wrap = (text: string, f: PDFFont, size: number, width: number): string[] => {
    const words = S(text).split(/\s+/).filter(Boolean); const lines: string[] = []; let cur2 = '';
    for (const w of words) {
      const t = cur2 ? `${cur2} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) <= width) cur2 = t;
      else { if (cur2) lines.push(cur2); let rest = w; while (f.widthOfTextAtSize(rest, size) > width) { let k = rest.length; while (k > 1 && f.widthOfTextAtSize(rest.slice(0, k), size) > width) k--; lines.push(rest.slice(0, k)); rest = rest.slice(k); } cur2 = rest; }
    }
    if (cur2) lines.push(cur2); return lines.length ? lines : [''];
  };
  const text = (t: string, size = 8.5, f: PDFFont = font, x = M, color = rgb(0, 0, 0), width = W, lead = size + 3): void => {
    for (const ln of wrap(t, f, size, width)) { need(lead); page.drawText(ln, { x, y: y - size, size, font: f, color }); y -= lead; }
  };
  const right = (t: string, xr: number, yy: number, size: number, f: PDFFont): void => { const s = S(t); page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y: yy, size, font: f }); };

  newPage();
  page.drawText(S(c.title), { x: M, y: y - 16, size: 16, font: bold }); y -= 22;
  text(`${L.number ?? 'N°'} ${c.number} · ${L.date ?? 'Date'} ${c.date} · ${c.status.toUpperCase()}`, 9, font);
  text(`${doc.manifest.binding.packId}@${doc.manifest.binding.packVersion} · zone ${doc.manifest.binding.zoneId} · prix au ${doc.manifest.binding.asOf} (${doc.manifest.binding.priceStatistic}) · devise ${cur.code}`, 8, font, M, rgb(0.35, 0.35, 0.35));
  y -= 4;
  if (c.parties) {
    text(`${L.issuer ?? 'Émetteur'} : ${c.parties.issuer.name} — ${c.parties.issuer.identifiers.map((i) => `${i.label} ${i.value}`).join(' · ')}`, 8.5, bold);
    text(`${L.client ?? 'Client'} : ${c.parties.client.name} · ${L.site ?? 'Chantier'} : ${c.parties.site} · ${L.validity ?? 'Validité'} : ${c.parties.validityDays} j`, 8.5);
    y -= 4;
  }

  const col = { n: M, des: M + 32, unit: M + 205, qty: M + 262, pu: M + 380, amt: M + W };
  const header = (): void => {
    need(20);
    page.drawRectangle({ x: M, y: y - 14, width: W, height: 14, color: rgb(0.9, 0.9, 0.9) });
    const s = 8; page.drawText(S(L.n ?? 'N°'), { x: col.n + 2, y: y - 10.5, size: s, font: bold }); page.drawText(S(L.designation ?? ''), { x: col.des, y: y - 10.5, size: s, font: bold });
    page.drawText(S(L.unit ?? ''), { x: col.unit, y: y - 10.5, size: s, font: bold }); right(L.quantity ?? '', col.qty, y - 10.5, s, bold); right(L.unitPrice ?? '', col.pu, y - 10.5, s, bold); right(L.amount ?? '', col.amt - 2, y - 10.5, s, bold);
    y -= 16;
  };
  for (const sec of c.sections) {
    need(40); text(`${sec.lot.code} — ${sec.lot.label}`, 10, bold); header();
    for (const l of sec.lines) {
      const des = wrap(l.designation, font, 8.5, col.unit - col.des - 6); const flags = l.flags.length ? wrap(`[${l.flags.join(', ')}]`, font, 6.5, col.unit - col.des - 6) : [];
      const h = des.length * 11 + flags.length * 8 + 3; need(h);
      const top = y;
      page.drawText(S(l.n), { x: col.n + 2, y: top - 9, size: 8.5, font }); des.forEach((d, i) => page.drawText(d, { x: col.des, y: top - 9 - i * 11, size: 8.5, font }));
      flags.forEach((d, i) => page.drawText(d, { x: col.des, y: top - 9 - des.length * 11 - i * 8 + 2, size: 6.5, font, color: rgb(0.45, 0.45, 0.45) }));
      page.drawText(S(l.unit), { x: col.unit, y: top - 9, size: 8.5, font }); right(fmtQty(l.quantity), col.qty, top - 9, 8.5, font);
      right(l.unitPrice === null ? '-' : fmtMoney(l.unitPrice, cur.minorUnits, cur.code), col.pu, top - 9, 8.5, font); right(l.amount === null ? '-' : fmtMoney(l.amount, cur.minorUnits, cur.code), col.amt - 2, top - 9, 8.5, font);
      page.drawLine({ start: { x: M, y: top - h + 1 }, end: { x: M + W, y: top - h + 1 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) }); y -= h;
    }
    need(16); page.drawText(S(L.subtotal ?? 'Sous-total'), { x: col.des, y: y - 10, size: 8.5, font: bold }); right(fmtMoney(sec.subtotal, cur.minorUnits, cur.code), col.amt - 2, y - 10, 8.5, bold); y -= 20;
  }
  need(18 * (3 + c.totals.layers.length)); page.drawLine({ start: { x: M + 250, y }, end: { x: M + W, y }, thickness: 0.8 }); y -= 4;
  const trow = (label: string, v: string, f: PDFFont = font): void => { need(14); page.drawText(S(label), { x: M + 250, y: y - 10, size: 9, font: f }); right(fmtMoney(v, cur.minorUnits, cur.code), col.amt - 2, y - 10, 9, f); y -= 14; };
  trow(L.linesTotal ?? 'Total des postes', c.totals.linesTotal);
  for (const t of c.totals.layers) trow(t.label, t.amount);
  if (c.layout === 'quote') trow(L.totalHT ?? 'Total HT', c.totals.subtotalBeforeTax, bold);
  trow(c.layout === 'quote' ? (L.totalTTC ?? 'Total TTC') : (L.total ?? 'Total'), c.totals.total, bold);
  y -= 8;
  if (c.notices.length) { need(30); text('Avis', 10, bold); for (const n of c.notices) text(`• ${n}`, 8, font, M + 6, rgb(0, 0, 0), W - 6); y -= 4; }

  // ---- annexe de traçabilité
  newPage(); text(`Annexe de traçabilité — ${c.number}`, 12, bold); y -= 2;
  const a = c.annex; const bullets = (title: string, items: string[]): void => { text(title, 9, bold); if (!items.length) text('• aucun', 8, font, M + 6); for (const i of items) text(`• ${i}`, 8, font, M + 6, rgb(0, 0, 0), W - 6); y -= 3; };
  bullets('Hypothèses utilisées', a.assumptions.map((x) => `${x.id} ${x.key} = ${x.value}${x.unit ? ' ' + x.unit : ''} [${x.status}] — ${x.rationale}`));
  bullets('Valeurs détectées par IA non revues individuellement', a.unreviewed.map((u) => `${u.code}.${u.attr} (${u.validation}, confiance ${u.confidence})`));
  bullets('Ajustements manuels de quantité', a.manual.adjustments.map((x) => `${x.id} sur ${x.target} : ${x.before} -> ${x.after} (${x.mode} ${x.value}) par ${x.author} le ${x.date} — ${x.justification}`));
  bullets('Lignes manuelles', a.manual.lines.map((x) => `${x.id} « ${x.designation} » (${x.lot}) ${x.quantity} ${x.unit} x ${fmtMoney(x.unitPrice, cur.minorUnits, cur.code)} par ${x.author} le ${x.date} — ${x.justification}`));
  bullets('Ajustements NON appliqués', a.manual.orphans.map((x) => `${x.id} sur ${x.target} : ${x.reason} — ${x.justification}`));
  bullets('Éléments sans correspondance dans le pack', a.unmapped.map((x) => `${x.entity} / ${x.class} : ${x.reason}`));
  bullets('Postes sans prix', a.unpriced.map((x) => `${x.line} : ${x.items.join(', ')}`));
  bullets('Alertes de prix', a.priceAlerts.map((x) => `${x.line} / ${x.item} : ${x.alert}`));
  const m = doc.manifest;
  bullets('Provenance (manifeste)', [`document ${doc.id} — contenu ${doc.contentHash}`, `manifeste ${doc.manifestHash}`, `moteur ${m.engine.version} (API ${m.engine.apiVersion}) · taxonomie ${m.taxonomyVersion}`,
    `plan ${m.planRevision.sourceDocumentHash} « ${m.planRevision.label} »`, `modèle ${m.modelRev}`, `hypothèses ${m.assumptionSetRev}`, `entrées manuelles ${m.manualEntriesHash}`, `géométrie ${m.geoTakeoffHash}`,
    `MarketBinding ${m.binding.id} rév. ${m.binding.revision} ${m.binding.rev}`, `pack résolu ${m.binding.packId}@${m.binding.packVersion} ${m.binding.packResolvedHash}`, `PriceBook ${m.binding.priceBookId} ${m.binding.priceBookHash}`,
    `métré ${m.quantitySetHash}`, `estimation ${m.estimateHash}`, 'Le manifeste complet et le document sont joints à ce PDF (provenance.json, document.json) : vérification hors ligne possible.']);

  // ---- pieds de page (pagination connue)
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 14 }, end: { x: M + W, y: M + 14 }, thickness: 0.4, color: rgb(0.6, 0.6, 0.6) });
    p.drawText(S(`${doc.id} · ${doc.contentHash.slice(0, 19)}… · ${m.binding.packId}@${m.binding.packVersion} · MB ${m.binding.rev.slice(7, 15)}`), { x: M, y: M + 4, size: 6.5, font, color: rgb(0.4, 0.4, 0.4) });
    const pg = `${i + 1} / ${pages.length}`; p.drawText(pg, { x: M + W - font.widthOfTextAtSize(pg, 7), y: M + 4, size: 7, font });
  });
  const dateISO = fixed;
  await pdf.attach(new TextEncoder().encode(canonicalize(doc.manifest)), 'provenance.json', { mimeType: 'application/json', description: 'Manifeste de provenance', creationDate: dateISO, modificationDate: dateISO });
  await pdf.attach(new TextEncoder().encode(canonicalize(doc)), 'document.json', { mimeType: 'application/json', description: 'Document complet (contenu + manifeste)', creationDate: dateISO, modificationDate: dateISO });
  const bytes = await pdf.save({ useObjectStreams: false });
  return { bytes, pageCount: pages.length, unsupportedChars: [...new Set(unsupported)] };
}

/** Lit les pièces jointes d'un PDF produit par `renderPdf`. */
export async function readPdfAttachments(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const files: Record<string, Uint8Array> = {};
  const byRef = new Map<string, Uint8Array>();
  for (const [ref, obj] of pdf.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Type')) === PDFName.of('EmbeddedFile')) byRef.set(ref.toString(), decodePDFRawStream(obj).decode());
  }
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Type')) === PDFName.of('Filespec')) {
      const f = obj.get(PDFName.of('F')); const name = f instanceof PDFString || f instanceof PDFHexString ? f.decodeText() : String(f);
      const ef = obj.get(PDFName.of('EF')); const r = ef instanceof PDFDict ? ef.get(PDFName.of('F')) : undefined;
      if (r instanceof PDFRef && byRef.has(r.toString())) files[name] = byRef.get(r.toString())!;
    }
  }
  return files;
}

/** Vérifie qu'un PDF correspond à un document du run : contenu et manifeste joints, empreintes recalculées. */
export async function verifyPdfDocument(bytes: Uint8Array): Promise<{ ok: boolean; problems: string[]; document?: Document }> {
  const problems: string[] = [];
  const files = await readPdfAttachments(bytes);
  if (!files['document.json'] || !files['provenance.json']) return { ok: false, problems: ['pièces jointes provenance.json / document.json absentes'] };
  const doc = JSON.parse(new TextDecoder().decode(files['document.json'])) as Document;
  const man = JSON.parse(new TextDecoder().decode(files['provenance.json']));
  if (hashOf(doc.content) !== doc.contentHash) problems.push('contenu du document joint altéré');
  if (hashOf(doc.manifest) !== doc.manifestHash) problems.push('manifeste du document joint altéré');
  if (canonicalize(man) !== canonicalize(doc.manifest)) problems.push('provenance.json différent du manifeste du document');
  if (doc.manifest.contentHash !== doc.contentHash) problems.push('le manifeste ne référence pas le contenu');
  return { ok: problems.length === 0, problems, document: doc };
}
