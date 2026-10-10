/**
 * Chaîne de traçabilité (ADR-0007) :
 * document → ligne → prix → article du catalogue → ouvrage → quantité → règle → quantité géométrique → objet → version → plan.
 * Chaque maillon est résolu par identifiant ET vérifié par empreinte ; un maillon introuvable est listé dans `missing`.
 */
import { hashOf } from './canonical.js';
import type { Document } from '../docs/document.js';
import type { Run } from '../project/run.js';
import type { ArchitecturalModel, PlanRevision } from '../model/types.js';
import { computeTakeoff } from '../geometry/takeoff.js';
import { computeQuantitySet } from '../measure/commercial.js';
import { computeEstimate } from '../pricing/estimate.js';
import type { RuleRef } from './types.js';

export interface Chain {
  document: { id: string; kind: string; number: string; contentHash: string };
  line: { id: string; n: string; designation: string; unit: string; quantity: string; unitPrice: string | null; amount: string | null };
  price: Array<{ item: string; qtyPerUnit: string; unit: string; unitPriceMinor: string | null; entryId: string | null; zoneId: string | null; level: string | null;
    date: string | null; source: { type: string; ref: string } | null; version: string | null; confidence: string | null; dataClass: string | null }>;
  catalogue: Array<{ code: string; label: string; kind: string; unit: string }>;
  assembly: { code: string; version: string; hash: string; lot: string; unit: string };
  ouvrageQuantity: { id: string; theoretical: string; quantity: string; unit: string };
  contributions: Array<{
    id: string; mapping: { id: string; version: string }; method: { id: string; version: string; deduction: string };
    entity: { type: string; id: string; code: string }; specClass: string; quantity: string;
    geo: Array<{ id: string; kind: string; value: string; unit: string; rule: RuleRef }>;
  }>;
  assumptionIds: string[];
  model: { rev: string; id: string };
  planRevision: PlanRevision;
  binding: { id: string; rev: string; packId: string; packVersion: string; packResolvedHash: string; zoneId: string };
  missing: string[];
}

/** Recalcule l'empreinte de contenu de chaque artefact et la compare à celle STOCKÉE (détecte toute falsification silencieuse). */
export function integrityProblems(run: Run): string[] {
  const out: string[] = [];
  const { contentHash: th, ...tCore } = run.takeoff; if (hashOf(tCore) !== th) out.push('métré géométrique altéré (empreinte stockée ≠ contenu)');
  const { contentHash: qh, ...qCore } = run.quantitySet; if (hashOf(qCore) !== qh) out.push('métré commercial altéré (empreinte stockée ≠ contenu)');
  const { contentHash: eh, id: _id, ...eCore } = run.estimate;
  if (hashOf(eCore) !== eh) out.push('estimation altérée (empreinte stockée ≠ contenu)');
  return out;
}

function entityExists(model: ArchitecturalModel, type: string, id: string): boolean {
  for (const b of model.buildings) for (const lv of b.levels) {
    const list = type === 'wall' ? lv.walls : type === 'opening' ? lv.openings : type === 'space' ? lv.spaces : type === 'slab' ? lv.slabs : type === 'roof' ? lv.roofs : [];
    if ((list as Array<{ id: string }>).some((e) => e.id === id)) return true;
  }
  return false;
}

export function resolveChain(run: Run, doc: Document, lineId: string): Chain {
  const missing: string[] = [];
  const miss = (m: string): void => { missing.push(m); };
  for (const p of integrityProblems(run)) miss(p);
  const dl = doc.content.sections.flatMap((s) => s.lines).find((l) => l.lineId === lineId);
  const el = run.estimate.lines.find((l) => l.id === lineId);
  if (!dl) miss(`ligne ${lineId} absente du document ${doc.id}`);
  if (!el) miss(`ligne ${lineId} absente de l'estimation`);
  const oq = el ? run.quantitySet.ouvrages.find((o) => o.id === el.ouvrageId) : undefined;
  if (el && !oq) miss(`quantité d'ouvrage ${el.ouvrageId} introuvable`);

  // empreintes de bout en bout
  const m = doc.manifest;
  if (hashOf(doc.content) !== doc.contentHash) miss('empreinte du contenu du document invalide');
  if (m.contentHash !== doc.contentHash) miss('le manifeste ne référence pas l\'empreinte du document');
  if (m.estimateHash !== run.estimate.contentHash) miss('estimation différente de celle du manifeste');
  if (m.quantitySetHash !== run.quantitySet.contentHash) miss('QuantitySet différent de celui du manifeste');
  if (m.geoTakeoffHash !== run.takeoff.contentHash) miss('métré géométrique différent de celui du manifeste');
  if (m.modelRev !== hashOf(run.model)) miss('révision du modèle différente de celle du manifeste');
  if (m.assumptionSetRev !== hashOf(run.assumptions)) miss('révision des hypothèses différente de celle du manifeste');
  if (m.binding.rev !== run.binding.rev) miss('MarketBinding différent de celui du manifeste');
  if (run.binding.packResolvedHash !== run.pack.resolution.resolvedHash) miss('pack résolu différent de celui du MarketBinding');
  const book = run.pack.priceBooks.find((b) => b.id === run.binding.priceBookId);
  if (!book || hashOf(book) !== run.binding.priceBookHash) miss('PriceBook introuvable ou empreinte différente');

  const asm = oq ? run.pack.assemblies.find((a) => a.code === oq.assembly.code) : undefined;
  if (oq && (!asm || hashOf(asm) !== oq.assembly.hash)) miss(`assemblage ${oq.assembly.code} introuvable ou modifié`);

  const price: Chain['price'] = []; const catalogue: Chain['catalogue'] = [];
  for (const c of el?.components ?? []) {
    const cat = run.pack.catalogue.find((x) => x.code === c.item);
    if (!cat) miss(`article ${c.item} absent du catalogue`); else if (!catalogue.some((x) => x.code === cat.code)) catalogue.push({ code: cat.code, label: cat.label, kind: cat.kind, unit: cat.unit });
    const entry = c.price ? book?.entries.find((e) => e.id === c.price!.entryId) : undefined;
    if (c.price && !entry) miss(`entrée de prix ${c.price.entryId} introuvable`);
    if (!c.price) miss(`aucun prix pour ${c.item}`);
    price.push({ item: c.item, qtyPerUnit: c.qtyPerUnit, unit: c.unit, unitPriceMinor: c.unitPriceMinor, entryId: c.price?.entryId ?? null, zoneId: c.price?.zoneId ?? null,
      level: c.price?.level ?? null, date: c.price?.date ?? null, source: c.price?.source ?? null, version: c.price?.version ?? null, confidence: c.price?.confidence ?? null, dataClass: c.price?.dataClass ?? null });
  }

  const contributions: Chain['contributions'] = [];
  for (const ct of oq?.contributions ?? []) {
    const mp = run.pack.specMappings.find((x) => x.id === ct.mapping.id);
    if (!mp || hashOf(mp) !== ct.mapping.hash) miss(`règle de correspondance ${ct.mapping.id} introuvable ou modifiée`);
    if (hashOf(run.pack.measurementMethod) !== ct.method.hash) miss('méthode de mesurage modifiée');
    if (!entityExists(run.model, ct.entity.type, ct.entity.id)) miss(`objet architectural ${ct.entity.type}:${ct.entity.id} introuvable dans le modèle`);
    const geo = ct.geoRefs.map((id) => {
      const g = run.takeoff.quantities.find((q) => q.id === id);
      if (!g) { miss(`quantité géométrique ${id} introuvable`); return null; }
      return { id: g.id, kind: g.kind, value: g.value, unit: g.unit, rule: g.trace.rule };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    contributions.push({ id: ct.id, mapping: { id: ct.mapping.id, version: ct.mapping.version }, method: { id: ct.method.id, version: ct.method.version, deduction: ct.method.deduction },
      entity: ct.entity, specClass: ct.specClass, quantity: `${ct.quantity.value} ${ct.quantity.unit}`, geo });
  }

  // hypothèses : fermeture transitive sur les entrées « geo » (la hauteur peut être deux niveaux sous la surface nette)
  const ids = new Set<string>(); const seen = new Set<string>();
  const visit = (gid: string): void => {
    if (seen.has(gid)) return; seen.add(gid);
    const q = run.takeoff.quantities.find((x) => x.id === gid);
    for (const i of q?.trace.inputs ?? []) { if (i.source.assumptionId) ids.add(i.source.assumptionId); if (i.source.type === 'geo' && i.source.id) visit(i.source.id); }
  };
  for (const c of contributions) for (const g of c.geo) visit(g.id);
  return {
    document: { id: doc.id, kind: doc.content.kind, number: doc.content.number, contentHash: doc.contentHash },
    line: { id: lineId, n: dl?.n ?? '', designation: dl?.designation ?? '', unit: dl?.unit ?? '', quantity: dl?.quantity ?? '', unitPrice: dl?.unitPrice ?? null, amount: dl?.amount ?? null },
    price, catalogue,
    assembly: { code: oq?.assembly.code ?? '', version: oq?.assembly.version ?? '', hash: oq?.assembly.hash ?? '', lot: oq?.assembly.lot ?? '', unit: oq?.assembly.unit ?? '' },
    ouvrageQuantity: { id: oq?.id ?? '', theoretical: oq?.theoretical ?? '', quantity: oq?.quantity ?? '', unit: oq?.assembly.unit ?? '' },
    contributions, assumptionIds: [...ids].sort(),
    model: { rev: m.modelRev, id: run.model.id }, planRevision: run.model.planRevision,
    binding: { id: run.binding.id, rev: run.binding.rev, packId: run.binding.packId, packVersion: run.binding.packVersion, packResolvedHash: run.binding.packResolvedHash, zoneId: run.binding.zoneId },
    missing,
  };
}

/** Recalcule tout depuis les entrées et compare aux empreintes enregistrées (reproductibilité, T-TRC-02). */
export function verifyRun(run: Run): { ok: boolean; problems: string[] } {
  const problems: string[] = [...integrityProblems(run)];
  const takeoff = computeTakeoff(run.model, run.assumptions);
  if (takeoff.contentHash !== run.takeoff.contentHash) problems.push('métré géométrique non reproductible');
  const qs = computeQuantitySet(run.model, run.assumptions, takeoff, run.pack, run.binding);
  if (qs.contentHash !== run.quantitySet.contentHash) problems.push('métré commercial non reproductible');
  const est = computeEstimate(run.pack, run.binding, qs);
  if (est.contentHash !== run.estimate.contentHash) problems.push('estimation non reproductible');
  for (const d of run.documents) {
    if (hashOf(d.content) !== d.contentHash) problems.push(`document ${d.id} : contenu altéré`);
    if (hashOf(d.manifest) !== d.manifestHash) problems.push(`document ${d.id} : manifeste altéré`);
    for (const s of d.content.sections) for (const l of s.lines) {
      const c = resolveChain(run, d, l.lineId);
      for (const m of c.missing) problems.push(`document ${d.id} / ${l.lineId} : ${m}`);
    }
  }
  return { ok: problems.length === 0, problems };
}
