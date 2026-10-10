/**
 * Résolution d'une BASE de métré (vocabulaire fermé declarative-1) en quantité, à partir des GeoQuantity.
 * La MeasurementMethod du pack choisit brute/nette/seuil ; la géométrie n'est JAMAIS recalculée ici (ADR-0002).
 */
import { Dec, sum } from '../units/decimal.js';
import type { GeometricTakeoff, GeoQuantity } from '../geometry/takeoff.js';
import type { Basis, MeasurementMethod } from '../pack/types.js';
import type { ConfidenceFloor, TraceStep } from '../trace/types.js';

export interface BasisResult {
  ok: true; value: Dec; unit: string; geoRefs: string[]; steps: TraceStep[];
  deduction: string; confidenceFloor: ConfidenceFloor | null;
}
export type BasisOutcome = BasisResult | { ok: false; reason: string };

export class GeoIndex {
  private readonly by = new Map<string, GeoQuantity>();
  constructor(readonly takeoff: GeometricTakeoff) { for (const q of takeoff.quantities) this.by.set(q.id, q); }
  get(entityId: string, kind: string): GeoQuantity | undefined { return this.by.get(`geo:${entityId}:${kind}`); }
}

const minFloor = (qs: GeoQuantity[]): ConfidenceFloor | null => {
  let best: ConfidenceFloor | null = null;
  for (const q of qs) if (q.confidenceFloor && (!best || Dec.parse(q.confidenceFloor.value).lt(Dec.parse(best.value)))) best = q.confidenceFloor;
  return best;
};

export function resolveBasis(basis: Basis, entityType: 'wall' | 'space' | 'slab' | 'roof' | 'opening', entityId: string,
  idx: GeoIndex, method: MeasurementMethod): BasisOutcome {
  const need = (kind: string): GeoQuantity | undefined => idx.get(entityId, kind);
  const direct = (kind: string, what: string, deduction = 'aucune'): BasisOutcome => {
    const g = need(kind);
    if (!g) return { ok: false, reason: `${what} indisponible (bloqué ou absent) pour ${entityId}` };
    return { ok: true, value: Dec.parse(g.value), unit: g.unit, geoRefs: [g.id], deduction, confidenceFloor: g.confidenceFloor,
      steps: [{ op: 'use', expr: `${what} = ${g.id}`, result: g.value, unit: g.unit }] };
  };

  switch (basis) {
    case 'space.floor.area': return direct('space.clear.area', 'surface libre');
    case 'space.ceiling.area': return direct('space.ceiling.area', 'surface de plafond');
    case 'slab.volume': return direct('slab.volume', 'volume de dalle');
    case 'roof.area': return direct('roof.area.developed', 'surface de toiture développée');
    case 'opening.count': return direct('opening.count', 'nombre d\'ouvertures');
    case 'wall.area':
    case 'space.wall.area': {
      const isWall = basis === 'wall.area';
      if (entityType !== (isWall ? 'wall' : 'space')) return { ok: false, reason: `base ${basis} incompatible avec ${entityType}` };
      const rule = method.deductions[basis];
      const grossKind = isWall ? 'wall.area.gross' : 'space.wall.area.gross';
      const netKind = isWall ? 'wall.area.net' : 'space.wall.area.net';
      if (rule.mode === 'net') return direct(netKind, 'surface nette', 'toutes les ouvertures déduites');
      if (rule.mode === 'gross') return direct(grossKind, 'surface brute', 'aucune déduction');
      // seuil : on déduit uniquement les ouvertures dont l'aire ≥ seuil
      const gross = need(grossKind);
      if (!gross) return { ok: false, reason: `surface brute indisponible pour ${entityId}` };
      const wallIds = isWall ? [entityId] : idx.takeoff.relations.spaceWalls[entityId] ?? [];
      const opIds = wallIds.flatMap((w) => idx.takeoff.relations.wallOpenings[w] ?? []);
      const ops = opIds.map((id) => idx.get(id, 'opening.area'));
      if (ops.some((o) => !o)) return { ok: false, reason: `ouverture bloquée parmi celles de ${entityId}` };
      const thr = Dec.parse(rule.thresholdM2!);
      const o = ops as GeoQuantity[];
      const deducted = o.filter((q) => Dec.parse(q.value).gte(thr));
      const kept = o.filter((q) => Dec.parse(q.value).lt(thr));
      const ded = sum(deducted.map((q) => Dec.parse(q.value)));
      const value = Dec.parse(gross.value).sub(ded);
      const steps: TraceStep[] = [
        { op: 'use', expr: `surface brute = ${gross.id}`, result: gross.value, unit: 'm2' },
        ...deducted.map((q): TraceStep => ({ op: 'deduct', expr: `ouverture ${q.entity.code} (${q.value} m²) ≥ seuil ${thr} m² : déduite`, result: q.value, unit: 'm2' })),
        ...kept.map((q): TraceStep => ({ op: 'keep', expr: `ouverture ${q.entity.code} (${q.value} m²) < seuil ${thr} m² : non déduite`, result: '0', unit: 'm2' })),
        { op: 'sub', expr: `${gross.value} − ${ded}`, result: value.toString(), unit: 'm2' },
      ];
      return { ok: true, value, unit: 'm2', geoRefs: [gross.id, ...o.map((q) => q.id)], steps, deduction: `seuil ${thr} m²`, confidenceFloor: minFloor([gross, ...o]) };
    }
  }
}
