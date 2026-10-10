/**
 * ÉTAGE 2 — Métré commercial (fourni par le MarketBinding). Consomme les GeoQuantity par identifiant ;
 * ne recalcule jamais la géométrie (ADR-0002). Produit :
 *  - des quantités d'OUVRAGE (lignes de DQE) ;
 *  - des besoins en ARTICLES (liste de commande : blocs, sacs de ciment…), avec pertes et arrondi de commande.
 */
import { Dec } from '../units/decimal.js';
import { UnitRegistry } from '../units/units.js';
import type { ArchitecturalModel, Level } from '../model/types.js';
import { AssumptionIndex, type AssumptionSet } from '../assumptions/assumptions.js';
import type { GeometricTakeoff } from '../geometry/takeoff.js';
import { hashOf } from '../trace/canonical.js';
import type { ConfidenceFloor, EntityRef, TraceStep } from '../trace/types.js';
import type { MarketBinding } from '../pack/binding.js';
import type { Assembly, Basis, CatalogueItem, MappingTarget, ResolvedPack, Rounding, SpecMapping } from '../pack/types.js';
import { GeoIndex, resolveBasis } from './basis.js';

export interface Contribution {
  id: string; mapping: { id: string; version: string; hash: string };
  method: { id: string; version: string; hash: string; deduction: string };
  entity: EntityRef; specClass: string; target: MappingTarget; basis: Basis;
  quantity: { value: string; unit: string }; geoRefs: string[]; steps: TraceStep[];
  confidenceFloor: ConfidenceFloor | null;
}
export interface OuvrageLine {
  id: string; assembly: { code: string; version: string; hash: string; label: string; lot: string; unit: string; estimateFlag: string | null };
  theoretical: string; quantity: string; rounding: Rounding;
  contributions: Contribution[]; confidenceFloor: ConfidenceFloor | null;
}
export interface RequirementContribution { ouvrage: string; path: string[]; component: string; theoretical: string; ordered: string; unit: string }
export interface Requirement {
  id: string; item: string; label: string; kind: string; unit: string;
  theoretical: string; orderedExact: string; quantity: string; rounding: Rounding; contributions: RequirementContribution[];
}
export interface Unmapped { entity: EntityRef; target: MappingTarget; class: string; reason: string }
export interface QuantitySet {
  bindingRev: string; geoTakeoffHash: string; modelRev: string; assumptionSetRev: string;
  ouvrages: OuvrageLine[]; requirements: Requirement[];
  unmapped: Unmapped[]; blocked: Array<{ entity: EntityRef; target: MappingTarget; reason: string }>;
  coverage: { mapped: number; total: number };
  contentHash: string;
}

interface Target {
  type: MappingTarget; entityType: 'wall' | 'space' | 'slab' | 'roof' | 'opening'; entity: EntityRef; cls: string;
  side?: 'exterior' | 'interior'; thickness?: Dec; width?: Dec; height?: Dec; material?: string; layerIndex: number; basis: Basis;
}

const inRange = (v: Dec | undefined, r?: { min: string; max: string }): boolean => !r || (v !== undefined && v.gte(Dec.parse(r.min)) && v.lte(Dec.parse(r.max)));
const CONV_SCALE = 18;

export interface Leaf { item: string; component: string; path: string[]; theoretical: Dec; ordered: Dec; unit: string; kind: string }

/** Développe un ouvrage (récursif) en articles. `qty` exprimée dans l'unité de l'ouvrage. */
export function expandAssembly(pack: ResolvedPack, reg: UnitRegistry, code: string, qty: Dec, path: string[] = []): Leaf[] {
  const asm = pack.assemblies.find((a) => a.code === code)!;
  const out: Leaf[] = [];
  walk(asm, qty, qty, [...path, asm.code]);
  return out;

  function walk(a: Assembly, theo: Dec, ord: Dec, p: string[]): void {
    for (const c of a.components) {
      const cons = Dec.parse(c.consumption); const loss = Dec.ONE.add(Dec.parse(c.lossRate ?? '0'));
      if (c.kind === 'assembly') {
        const sub = pack.assemblies.find((x) => x.code === c.ref)!;
        const toSub = (d: Dec): Dec => reg.convert(d, c.unit, sub.unit);
        walk(sub, toSub(theo.mul(cons)), toSub(ord.mul(cons).mul(loss)), [...p, sub.code]);
      } else {
        const item = pack.catalogue.find((i) => i.code === c.item)!;
        const conv = (d: Dec): Dec => reg.convert(d, c.unit, item.unit);
        out.push({ item: item.code, component: `${a.code}/${c.item}`, path: p, theoretical: conv(theo.mul(cons)), ordered: conv(ord.mul(cons).mul(loss)), unit: item.unit, kind: item.kind });
      }
    }
  }
}

export function packUnits(pack: ResolvedPack): UnitRegistry { return new UnitRegistry(pack.units); }

function collectTargets(model: ArchitecturalModel, A: AssumptionIndex, blockedOut: QuantitySet['blocked']): Target[] {
  const t: Target[] = [];
  const ent = (type: string, e: { id: string; code?: string; name?: string }): EntityRef => ({ type, id: e.id, code: e.code ?? e.name ?? e.id });
  const dec = (a: any, what: string, e: EntityRef, target: MappingTarget): Dec | undefined => {
    const r = A.decimal(a, what); if (!r.ok) { blockedOut.push({ entity: e, target, reason: r.reason }); return undefined; } return r.value.dec;
  };
  for (const b of model.buildings) for (const lv of b.levels as Level[]) {
    for (const w of lv.walls) {
      const e = ent('wall', w);
      const sys = A.specSystem(w.spec, `${w.code}.spec`);
      const th = dec(w.thickness, `${w.code}.épaisseur`, e, 'wall');
      if (!sys.ok) blockedOut.push({ entity: e, target: 'wall', reason: sys.reason });
      else if (th) t.push({ type: 'wall', entityType: 'wall', entity: e, cls: sys.value, thickness: th, layerIndex: 0, basis: 'wall.area' });
      (w.spec.layers ?? []).forEach((l, i) => {
        if (l.side === 'exterior') t.push({ type: 'wall.layer', entityType: 'wall', entity: e, cls: l.class, side: 'exterior', layerIndex: i + 1, basis: 'wall.area' });
      });
    }
    for (const o of lv.openings) {
      const e = ent('opening', o);
      const w = dec(o.width, `${o.code}.largeur`, e, 'opening'); const h = dec(o.height, `${o.code}.hauteur`, e, 'opening');
      const mat = A.specSystem(o.spec, `${o.code}.spec`);
      if (w && h) t.push({ type: 'opening', entityType: 'opening', entity: e, cls: o.class, width: w, height: h, material: mat.ok ? mat.value : undefined, layerIndex: 0, basis: 'opening.count' });
    }
    for (const s of lv.spaces) {
      const e = ent('space', s);
      (s.finishes.floor ?? []).forEach((c, i) => t.push({ type: 'space.floor', entityType: 'space', entity: e, cls: c, layerIndex: i, basis: 'space.floor.area' }));
      (s.finishes.wall ?? []).forEach((c, i) => t.push({ type: 'space.wall', entityType: 'space', entity: e, cls: c, layerIndex: i, basis: 'space.wall.area' }));
      (s.finishes.ceiling ?? []).forEach((c, i) => t.push({ type: 'space.ceiling', entityType: 'space', entity: e, cls: c, layerIndex: i, basis: 'space.ceiling.area' }));
    }
    for (const sl of lv.slabs) {
      const e = ent('slab', sl); const sys = A.specSystem(sl.spec, `${sl.code}.spec`); const th = dec(sl.thickness, `${sl.code}.épaisseur`, e, 'slab');
      if (!sys.ok) blockedOut.push({ entity: e, target: 'slab', reason: sys.reason });
      else if (th) t.push({ type: 'slab', entityType: 'slab', entity: e, cls: sys.value, thickness: th, layerIndex: 0, basis: 'slab.volume' });
    }
    for (const r of lv.roofs) {
      const e = ent('roof', r); const sys = A.specSystem(r.spec, `${r.code}.spec`);
      if (!sys.ok) blockedOut.push({ entity: e, target: 'roof', reason: sys.reason });
      else t.push({ type: 'roof', entityType: 'roof', entity: e, cls: sys.value, layerIndex: 0, basis: 'roof.area' });
    }
  }
  return t;
}

function matches(m: SpecMapping, t: Target): boolean {
  return m.target === t.type && m.class === t.cls && (!m.side || m.side === t.side)
    && inRange(t.thickness, m.thickness) && inRange(t.width, m.width) && inRange(t.height, m.height)
    && (!m.material || m.material === t.material);
}

export function computeQuantitySet(model: ArchitecturalModel, assumptions: AssumptionSet, takeoff: GeometricTakeoff,
  pack: ResolvedPack, binding: MarketBinding): QuantitySet {
  const reg = packUnits(pack);
  const A = new AssumptionIndex(assumptions);
  const idx = new GeoIndex(takeoff);
  const blocked: QuantitySet['blocked'] = [];
  const unmapped: Unmapped[] = [];
  const targets = collectTargets(model, A, blocked);
  const methodHash = hashOf(pack.measurementMethod);
  const asmByCode = new Map(pack.assemblies.map((a) => [a.code, a]));
  const contribs = new Map<string, Contribution[]>();
  let mappedCount = 0;

  for (const t of targets) {
    const cands = pack.specMappings.filter((m) => matches(m, t));
    if (cands.length === 0) { unmapped.push({ entity: t.entity, target: t.type, class: t.cls, reason: 'aucune correspondance dans le pack (unmapped_spec)' }); continue; }
    const top = Math.max(...cands.map((m) => m.priority ?? 0));
    const best = cands.filter((m) => (m.priority ?? 0) === top);
    if (best.length > 1) { unmapped.push({ entity: t.entity, target: t.type, class: t.cls, reason: `correspondance ambiguë : ${best.map((m) => m.id).join(', ')}` }); continue; }
    const m = best[0]!; const asm = asmByCode.get(m.assembly)!;
    const b = resolveBasis(t.basis, t.entityType, t.entity.id, idx, pack.measurementMethod);
    if (!b.ok) { blocked.push({ entity: t.entity, target: t.type, reason: b.reason }); continue; }
    mappedCount++;
    let qty: Dec; try { qty = reg.convert(b.value, b.unit, asm.unit); } catch (e) { blocked.push({ entity: t.entity, target: t.type, reason: (e as Error).message }); continue; }
    const c: Contribution = {
      id: `ctb:${m.id}:${t.entity.id}${t.layerIndex ? ':' + t.layerIndex : ''}`,
      mapping: { id: m.id, version: m.version, hash: hashOf(m) },
      method: { id: pack.measurementMethod.id, version: pack.measurementMethod.version, hash: methodHash, deduction: b.deduction },
      entity: t.entity, specClass: t.cls, target: t.type, basis: t.basis,
      quantity: { value: qty.toString(), unit: asm.unit }, geoRefs: b.geoRefs, steps: b.steps, confidenceFloor: b.confidenceFloor,
    };
    (contribs.get(asm.code) ?? contribs.set(asm.code, []).get(asm.code)!).push(c);
  }

  // ---- quantités d'ouvrage
  const lotOrder = new Map(pack.workBreakdown.map((l) => [l.code, l.order]));
  const ouvrages: OuvrageLine[] = [...contribs.entries()].map(([code, cs]) => {
    const asm = asmByCode.get(code)!;
    cs.sort((a, b) => (a.id < b.id ? -1 : 1));
    const theo = cs.reduce((acc, c) => acc.add(Dec.parse(c.quantity.value)), Dec.ZERO);
    const q = theo.round(asm.quantityRounding.scale, asm.quantityRounding.mode);
    let floor: ConfidenceFloor | null = null;
    for (const c of cs) if (c.confidenceFloor && (!floor || Dec.parse(c.confidenceFloor.value).lt(Dec.parse(floor.value)))) floor = c.confidenceFloor;
    return {
      id: `oq:${code}`,
      assembly: { code, version: asm.version, hash: hashOf(asm), label: asm.label, lot: asm.lot, unit: asm.unit, estimateFlag: asm.estimateFlag ?? null },
      theoretical: theo.toString(), quantity: q.toString(), rounding: asm.quantityRounding, contributions: cs, confidenceFloor: floor,
    };
  }).sort((a, b) => {
    const la = lotOrder.get(a.assembly.lot) ?? 0; const lb = lotOrder.get(b.assembly.lot) ?? 0;
    return la !== lb ? la - lb : a.assembly.code < b.assembly.code ? -1 : 1;
  });

  // ---- besoins en articles (liste de commande), à partir des quantités d'ouvrage ARRONDIES (ce que le DQE affiche)
  const acc = new Map<string, { theo: Dec; ord: Dec; item: CatalogueItem; cs: RequirementContribution[] }>();
  for (const o of ouvrages) {
    for (const leaf of expandAssembly(pack, reg, o.assembly.code, Dec.parse(o.quantity))) {
      const item = pack.catalogue.find((i) => i.code === leaf.item)!;
      const cur = acc.get(leaf.item) ?? { theo: Dec.ZERO, ord: Dec.ZERO, item, cs: [] };
      cur.theo = cur.theo.add(leaf.theoretical); cur.ord = cur.ord.add(leaf.ordered);
      cur.cs.push({ ouvrage: o.id, path: leaf.path, component: leaf.component, theoretical: leaf.theoretical.toString(), ordered: leaf.ordered.toString(), unit: leaf.unit });
      acc.set(leaf.item, cur);
    }
  }
  const requirements: Requirement[] = [...acc.entries()].map(([code, v]): Requirement => {
    const rnd = v.item.orderRounding ?? pack.rounding.quantity;
    return {
      id: `req:${code}`, item: code, label: v.item.label, kind: v.item.kind, unit: v.item.unit,
      theoretical: v.theo.round(CONV_SCALE).toString(), orderedExact: v.ord.round(CONV_SCALE).toString(),
      quantity: v.ord.round(rnd.scale, rnd.mode).toString(), rounding: rnd, contributions: v.cs,
    };
  }).sort((a, b) => (a.id < b.id ? -1 : 1));

  unmapped.sort((a, b) => (a.entity.id + a.class < b.entity.id + b.class ? -1 : 1));
  blocked.sort((a, b) => (a.entity.id + a.target < b.entity.id + b.target ? -1 : 1));
  const core = {
    bindingRev: binding.rev, geoTakeoffHash: takeoff.contentHash, modelRev: takeoff.modelRev, assumptionSetRev: takeoff.assumptionSetRev,
    ouvrages, requirements, unmapped, blocked, coverage: { mapped: mappedCount, total: mappedCount + unmapped.length },
  };
  return { ...core, contentHash: hashOf(core) };
}
