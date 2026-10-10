/** Rendu texte (Markdown) d'un Document. Ne calcule RIEN : tout vient du DocumentModel (T-DOC-01). PDF/XLSX : adaptateurs futurs. */
import { Dec } from '../core/units/decimal.js';
import type { Document } from '../core/docs/document.js';

const group = (s: string): string => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export function fmtMoney(minor: string | null, minorUnits: number, code: string): string {
  if (minor === null) return '— (non chiffré)';
  const v = Dec.parse(minor).div(Dec.of(10n ** BigInt(minorUnits), 0), minorUnits).toFixed(minorUnits);
  const [i, f] = v.split('.');
  const neg = i!.startsWith('-');
  return `${neg ? '-' : ''}${group(neg ? i!.slice(1) : i!)}${f ? '.' + f : ''} ${code}`;
}
export function fmtQty(q: string): string { const [i, f] = q.split('.'); return group(i!) + (f ? '.' + f : ''); }

export function renderMarkdown(doc: Document): string {
  const c = doc.content; const L = c.labels; const cur = c.currency;
  const money = (v: string | null): string => fmtMoney(v, cur.minorUnits, cur.code);
  const o: string[] = [];
  if (c.syntheticBanner) o.push(`> ⚠ **${c.syntheticBanner}**`, '');
  o.push(`# ${c.title} — ${L.number ?? 'N°'} ${c.number}`, '', `${L.date ?? 'Date'} : ${c.date} · Statut : **${c.status}** · Gabarit : ${c.templateId} (${c.language})`, '');
  if (c.parties) {
    o.push(`**${L.issuer ?? 'Émetteur'}** : ${c.parties.issuer.name} — ${c.parties.issuer.identifiers.map((i) => `${i.label} ${i.value}`).join(' · ')}`);
    o.push(`**${L.client ?? 'Client'}** : ${c.parties.client.name} · **${L.site ?? 'Chantier'}** : ${c.parties.site} · ${L.validity ?? 'Validité'} : ${c.parties.validityDays} j`, '');
  }
  for (const s of c.sections) {
    o.push(`## ${s.lot.code} — ${s.lot.label}`, '', `| ${L.n ?? 'N°'} | ${L.designation} | ${L.unit} | ${L.quantity} | ${L.unitPrice} | ${L.amount} |`, '|---|---|---|---:|---:|---:|');
    for (const l of s.lines) o.push(`| ${l.n} | ${l.designation}${l.flags.length ? ` _(${l.flags.join(', ')})_` : ''} | ${l.unit} | ${fmtQty(l.quantity)} | ${money(l.unitPrice)} | ${money(l.amount)} |`);
    o.push(`| | **${L.subtotal}** | | | | **${money(s.subtotal)}** |`, '');
  }
  o.push(`## ${L.total ?? 'Total'}`, '', `- ${L.linesTotal ?? 'Total des postes'} : ${money(c.totals.linesTotal)}`);
  for (const t of c.totals.layers) o.push(`- ${t.label} : ${money(t.amount)}${t.effect === 'tax' ? ' (taxe)' : ''}`);
  if (c.layout === 'quote') o.push(`- **${L.totalHT ?? 'Total HT'}** : ${money(c.totals.subtotalBeforeTax)}`);
  o.push(`- **${c.layout === 'quote' ? (L.totalTTC ?? 'Total TTC') : (L.total ?? 'Total')}** : ${money(c.totals.total)}`, '');
  if (c.notices.length) { o.push('## Avis', '', ...c.notices.map((n) => `- ${n}`), ''); }
  const a = c.annex;
  o.push('## Annexe de traçabilité', '');
  o.push(`- Hypothèses utilisées : ${a.assumptions.length ? a.assumptions.map((x) => `${x.id} ${x.key}=${x.value}${x.unit ? ' ' + x.unit : ''} [${x.status}] (${x.rationale})`).join(' ; ') : 'aucune'}`);
  o.push(`- Valeurs IA non revues : ${a.unreviewed.length ? a.unreviewed.map((u) => `${u.code}.${u.attr} (${u.validation}, confiance ${u.confidence})`).join(' ; ') : 'aucune'}`);
  o.push(`- Éléments sans correspondance : ${a.unmapped.length ? a.unmapped.map((u) => `${u.entity}/${u.class}`).join(' ; ') : 'aucun'}`);
  o.push(`- Alertes de prix : ${a.priceAlerts.length ? a.priceAlerts.map((p) => `${p.item} (${p.alert})`).join(' ; ') : 'aucune'}`, '');
  const m = doc.manifest;
  o.push('## Provenance (manifeste)', '', '```',
    `document      ${doc.id}  contenu ${doc.contentHash}`, `manifeste     ${doc.manifestHash}`,
    `moteur        ${m.engine.version} (API ${m.engine.apiVersion})  taxonomie ${m.taxonomyVersion}`,
    `plan          ${m.planRevision.sourceDocumentHash}  « ${m.planRevision.label} »`,
    `modèle        ${m.modelRev}`, `hypothèses    ${m.assumptionSetRev}`, `géométrie     ${m.geoTakeoffHash}`,
    `MarketBinding ${m.binding.id} rev ${m.binding.revision} ${m.binding.rev}`, `pack résolu    ${m.binding.packId}@${m.binding.packVersion} ${m.binding.packResolvedHash}`,
    `PriceBook     ${m.binding.priceBookId} ${m.binding.priceBookHash}  zone ${m.binding.zoneId}  au ${m.binding.asOf} (${m.binding.priceStatistic})`,
    `métré         ${m.quantitySetHash}`, `estimation    ${m.estimateHash}`, '```');
  return o.join('\n') + '\n';
}
