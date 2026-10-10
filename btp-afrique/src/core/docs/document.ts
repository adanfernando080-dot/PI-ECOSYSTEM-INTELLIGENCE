/**
 * DocumentModel NEUTRE (ADR-0008). Le core ne connaît ni « DQE » ni « devis » : les types de documents, libellés,
 * identifiants légaux et numérotation viennent des gabarits du pack. Le rendu (texte/PDF/XLSX) ne calcule rien.
 */
import { Dec } from '../units/decimal.js';
import { hashOf } from '../trace/canonical.js';
import { allGeometryRules } from '../geometry/rules.js';
import type { RuleRef } from '../trace/types.js';
import type { PlanRevision } from '../model/types.js';
import type { Run } from '../project/run.js';
import type { DocumentTemplate, NumberingRule } from '../pack/types.js';

export interface DocLine { lineId: string; n: string; designation: string; unit: string; quantity: string; unitPrice: string | null; amount: string | null; flags: string[] }
export interface DocSection { lot: { code: string; label: string }; lines: DocLine[]; subtotal: string }
export interface DocumentContent {
  templateId: string; kind: string; layout: DocumentTemplate['layout']; language: string; labels: Record<string, string>;
  title: string; number: string; date: string; status: 'draft' | 'final';
  currency: { code: string; minorUnits: number; symbol: string };
  dataClass: string; syntheticBanner: string | null;
  parties: null | { issuer: { name: string; identifiers: Array<{ label: string; value: string }> }; client: { name: string }; site: string; validityDays: number };
  sections: DocSection[];
  totals: { linesTotal: string; layers: Array<{ id: string; label: string; amount: string; effect: string }>; subtotalBeforeTax: string; total: string };
  notices: string[];
  annex: {
    unreviewed: Array<{ entityId: string; code: string; attr: string; origin: string; validation: string; confidence: string | null }>;
    assumptions: Array<{ id: string; key: string; value: string; unit: string | null; status: string; rationale: string }>;
    unmapped: Array<{ entity: string; class: string; reason: string }>;
    unpriced: Array<{ line: string; items: string[] }>;
    priceAlerts: Array<{ line: string; item: string; alert: string }>;
  };
}
export interface ProvenanceManifest {
  format: 'btp-provenance'; version: '1'; documentKind: string; templateId: string;
  engine: { version: string; apiVersion: string }; dataClass: string; taxonomyVersion: string;
  planRevision: PlanRevision; modelRev: string; assumptionSetRev: string; geoTakeoffHash: string;
  geometryRules: RuleRef[];
  binding: { id: string; rev: string; revision: number; packId: string; packVersion: string; packResolvedHash: string; zoneId: string; priceBookId: string; priceBookHash: string; asOf: string; priceStatistic: string };
  packChain: Array<{ id: string; version: string; contentHash: string }>;
  measurementMethod: { id: string; version: string };
  quantitySetHash: string; estimateHash: string; contentHash: string;
}
export interface Document { id: string; content: DocumentContent; manifest: ProvenanceManifest; contentHash: string; manifestHash: string }

export interface DocumentRequest {
  templateId: string; number: string; date: string; status: 'draft' | 'final'; allowUnpriced?: boolean;
  issuer?: { name: string; identifiers: Record<string, string> }; client?: { name: string }; site?: string; validityDays?: number;
}

export const SYNTHETIC_BANNER = 'DONNÉES SYNTHÉTIQUES / SYNTHETIC TEST DATA — NE PAS UTILISER COMME PRIX OU QUANTITÉS RÉELS';
const PARAMETRIC_NOTICE = 'Poste en estimation paramétrique : validation par un ingénieur / un professionnel qualifié requise avant toute utilisation.';

/** Format de numéro de document : motif `{YYYY}` et `{seq:N}`. */
export function formatDocNumber(rule: NumberingRule, date: string, seq: number): string {
  return rule.pattern.replace('{YYYY}', date.slice(0, 4)).replace(/\{seq:(\d+)\}/, (_m, w: string) => String(seq).padStart(Number(w), '0'));
}

export function listUnreviewed(run: Pick<Run, 'model'>): DocumentContent['annex']['unreviewed'] {
  const out: DocumentContent['annex']['unreviewed'] = [];
  const scan = (id: string, code: string, attrs: Record<string, any>): void => {
    for (const [k, a] of Object.entries(attrs)) {
      if (a && a.origin === 'ai_detected' && a.validation !== 'accepted' && a.validation !== 'edited') {
        out.push({ entityId: id, code, attr: k, origin: a.origin, validation: a.validation ?? 'pending', confidence: a.confidence ?? null });
      }
    }
  };
  for (const b of run.model.buildings) for (const lv of b.levels) {
    scan(lv.id, lv.code, { elevation: lv.elevation, clearHeight: lv.clearHeight });
    for (const w of lv.walls) scan(w.id, w.code, { thickness: w.thickness, height: w.height });
    for (const o of lv.openings) scan(o.id, o.code, { width: o.width, height: o.height });
    for (const s of lv.slabs) scan(s.id, s.code, { thickness: s.thickness });
    for (const r of lv.roofs) scan(r.id, r.code, { rise: r.rise, run: r.run });
  }
  return out.sort((a, b) => (a.entityId + a.attr < b.entityId + b.attr ? -1 : 1));
}

function usedAssumptionIds(run: Pick<Run, 'model'>): Set<string> {
  const ids = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'assumptionId' && typeof v === 'string') ids.add(v); else walk(v); }
  };
  walk(run.model);
  return ids;
}

export function buildDocument(run: Omit<Run, 'documents'>, req: DocumentRequest): Document {
  const { pack, binding, estimate, quantitySet, takeoff } = run;
  const tpl = pack.documentTemplates.find((t) => t.id === req.templateId);
  if (!tpl) throw new Error(`Gabarit inconnu : ${req.templateId}`);
  const need = (k: string): string => { const v = tpl.labels[k]; if (v === undefined) throw new Error(`Gabarit ${tpl.id} : libellé « ${k} » manquant`); return v; };
  const unpriced = estimate.lines.filter((l) => l.status === 'unpriced');
  if (req.status === 'final' && unpriced.length && !req.allowUnpriced) {
    throw new Error(`Émission finale refusée : ${unpriced.length} ligne(s) sans prix (${unpriced.map((l) => l.assembly.code).join(', ')}). Décision explicite requise (allowUnpriced).`);
  }
  if (tpl.layout === 'quote' && (!req.issuer || !req.client)) throw new Error('Un devis exige émetteur et client');

  const lots = new Map(pack.workBreakdown.map((l) => [l.code, l]));
  const bySection = new Map<string, DocSection>();
  const sorted = [...estimate.lines];
  for (const l of sorted) {
    const lot = lots.get(l.assembly.lot)!;
    const sec = bySection.get(lot.code) ?? { lot: { code: lot.code, label: lot.label }, lines: [], subtotal: '0' };
    sec.lines.push({ lineId: l.id, n: '', designation: l.assembly.label, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount, flags: l.flags });
    bySection.set(lot.code, sec);
  }
  const sections = [...bySection.values()].sort((a, b) => lots.get(a.lot.code)!.order - lots.get(b.lot.code)!.order);
  sections.forEach((s, si) => {
    s.lines.forEach((ln, li) => { ln.n = `${si + 1}.${li + 1}`; });
    s.subtotal = s.lines.reduce((a, ln) => a.add(ln.amount ? Dec.parse(ln.amount) : Dec.ZERO), Dec.ZERO).toString();
  });

  const notices: string[] = [];
  const syntheticBanner = run.pack.dataClass === 'synthetic/test' || run.binding.dataClass === 'synthetic/test' ? SYNTHETIC_BANNER : null;
  if (syntheticBanner) notices.push(syntheticBanner);
  if (estimate.lines.some((l) => l.flags.includes('parametric_structural'))) notices.push(PARAMETRIC_NOTICE);
  if (unpriced.length) notices.push(`${unpriced.length} poste(s) non chiffré(s) (prix manquant) — total incomplet.`);
  if (quantitySetUnmapped(run)) notices.push(`${quantitySet.unmapped.length} élément(s) sans correspondance dans le pack — non chiffrés.`);
  const unreviewed = listUnreviewed(run);
  if (unreviewed.length) notices.push(`${unreviewed.length} valeur(s) détectée(s) par IA non revue(s) individuellement (voir annexe).`);

  const usedIds = usedAssumptionIds(run);
  const alerts: DocumentContent['annex']['priceAlerts'] = [];
  for (const l of estimate.lines) for (const c of l.components) {
    if (c.price?.stale) alerts.push({ line: l.id, item: c.item, alert: 'prix périmé' });
    if (c.price?.lowConfidence) alerts.push({ line: l.id, item: c.item, alert: 'confiance du prix basse' });
    if (c.price?.level === 'parent') alerts.push({ line: l.id, item: c.item, alert: 'prix issu d\'une zone parente' });
  }

  const content: DocumentContent = {
    templateId: tpl.id, kind: tpl.kind, layout: tpl.layout, language: tpl.language, labels: tpl.labels,
    title: need('title'), number: req.number, date: req.date, status: req.status,
    currency: { code: pack.currency.code, minorUnits: pack.currency.minorUnits, symbol: pack.currency.symbol },
    dataClass: run.pack.dataClass, syntheticBanner,
    parties: tpl.layout === 'quote' ? {
      issuer: { name: req.issuer!.name, identifiers: pack.legalIdentifiers.map((li) => ({ label: li.label, value: req.issuer!.identifiers[li.key] ?? '—' })) },
      client: { name: req.client!.name }, site: req.site ?? '', validityDays: req.validityDays ?? 30,
    } : null,
    sections,
    totals: { linesTotal: estimate.linesTotal, layers: estimate.totalLayers.map((l) => ({ id: l.id, label: l.label, amount: l.amount, effect: l.effect })), subtotalBeforeTax: estimate.subtotalBeforeTax, total: estimate.total },
    notices,
    annex: {
      unreviewed,
      assumptions: run.assumptions.items.filter((i) => usedIds.has(i.id)).map((i) => ({ id: i.id, key: i.key, value: i.value.value, unit: i.value.unit ?? null, status: i.status, rationale: i.rationale })),
      unmapped: quantitySet.unmapped.map((u) => ({ entity: u.entity.code, class: u.class, reason: u.reason })),
      unpriced: unpriced.map((l) => ({ line: l.id, items: l.unpricedItems })),
      priceAlerts: alerts,
    },
  };
  const contentHash = hashOf(content);
  const manifestCore: Omit<ProvenanceManifest, 'contentHash'> = {
    format: 'btp-provenance', version: '1', documentKind: tpl.kind, templateId: tpl.id,
    engine: { version: run.engine.version, apiVersion: run.engine.apiVersion }, dataClass: pack.dataClass, taxonomyVersion: run.taxonomy.version,
    planRevision: run.model.planRevision, modelRev: takeoff.modelRev, assumptionSetRev: takeoff.assumptionSetRev, geoTakeoffHash: takeoff.contentHash,
    geometryRules: allGeometryRules().sort((a, b) => (a.id < b.id ? -1 : 1)),
    binding: { id: binding.id, rev: binding.rev, revision: binding.revision, packId: binding.packId, packVersion: binding.packVersion, packResolvedHash: binding.packResolvedHash,
      zoneId: binding.zoneId, priceBookId: binding.priceBookId, priceBookHash: binding.priceBookHash, asOf: binding.asOf, priceStatistic: binding.priceStatistic },
    packChain: pack.resolution.chain, measurementMethod: { id: pack.measurementMethod.id, version: pack.measurementMethod.version },
    quantitySetHash: quantitySet.contentHash, estimateHash: estimate.contentHash,
  };
  const manifest: ProvenanceManifest = { ...manifestCore, contentHash };
  const manifestHash = hashOf(manifest);
  return { id: `doc:${hashOf({ contentHash, manifestHash }).slice(7, 19)}`, content, manifest, contentHash, manifestHash };
}

const quantitySetUnmapped = (run: Omit<Run, 'documents'>): boolean => run.quantitySet.unmapped.length > 0;
