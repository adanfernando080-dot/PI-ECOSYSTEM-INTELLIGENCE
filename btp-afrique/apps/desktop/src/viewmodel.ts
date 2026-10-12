/** Vues dérivées du Run : AUCUN calcul métier ici (seulement lecture/regroupement/formatage de ce que le noyau a produit). */
import type { Run } from '../../../src/core/project/run.js';
import type { Attr } from '../../../src/core/model/types.js';
import { fmtMoney, fmtQty } from '../../../src/adapters/render-text.js';

const geo = (run: Run, id: string, kind: string): string | null => run.takeoff.quantities.find((q) => q.id === `geo:${id}:${kind}`)?.value ?? null;
export interface AttrView { value: string | null; unit: string; origin: string; validation: string | null; assumptionId: string | null; unspecified: boolean }
const attrView = (a: Attr): AttrView => ({ value: a.value ?? null, unit: a.unit, origin: a.origin, validation: a.validation ?? null, assumptionId: a.assumptionId ?? null, unspecified: a.value === undefined && !a.assumptionId });

export interface WallRow { id: string; code: string; level: string; role: string; lengthM: string | null; netAreaM2: string | null; thickness: AttrView; height: AttrView; system: string | null }
export interface OpeningRow { id: string; code: string; level: string; host: string; cls: string; width: AttrView; height: AttrView; areaM2: string | null }
export interface SpaceRow { id: string; code: string; name: string; level: string; usage: string; areaM2: string | null; perimeterM: string | null }
export interface ModelView { walls: WallRow[]; openings: OpeningRow[]; spaces: SpaceRow[]; blocked: Array<{ entity: string; quantity: string; reason: string }>; counts: { walls: number; openings: number; spaces: number } }

export function modelView(run: Run): ModelView {
  const levels = run.model.buildings.flatMap((b) => b.levels);
  const walls = levels.flatMap((l) => l.walls.map((w): WallRow => ({ id: w.id, code: w.code, level: l.code, role: w.role, lengthM: geo(run, w.id, 'wall.length.axis'), netAreaM2: geo(run, w.id, 'wall.area.net'), thickness: attrView(w.thickness), height: attrView(w.height), system: w.spec.system ?? null })));
  const openings = levels.flatMap((l) => l.openings.map((o): OpeningRow => ({ id: o.id, code: o.code, level: l.code, host: l.walls.find((w) => w.id === o.hostWallId)?.code ?? o.hostWallId, cls: o.class, width: attrView(o.width), height: attrView(o.height), areaM2: geo(run, o.id, 'opening.area') })));
  const spaces = levels.flatMap((l) => l.spaces.map((s): SpaceRow => ({ id: s.id, code: s.code, name: s.name, level: l.code, usage: s.usage, areaM2: geo(run, s.id, 'space.clear.area'), perimeterM: geo(run, s.id, 'space.clear.perimeter') })));
  return { walls, openings, spaces, blocked: run.takeoff.blocked.map((b) => ({ entity: b.entity.code, quantity: b.quantity, reason: b.reason })), counts: { walls: walls.length, openings: openings.length, spaces: spaces.length } };
}

export interface GeoRow { id: string; kind: string; entity: string; value: string; unit: string }
export const geoRows = (run: Run): GeoRow[] => run.takeoff.quantities.map((q) => ({ id: q.id, kind: q.kind, entity: q.entity.code, value: q.value, unit: q.unit }));

export interface OuvrageRow { id: string; label: string; lot: string; unit: string; engineQuantity: string; quantity: string; adjusted: boolean; flag: string | null; contributions: number }
export const ouvrageRows = (run: Run): OuvrageRow[] => run.quantitySet.ouvrages.map((o) => ({ id: o.id, label: o.assembly.label, lot: o.assembly.lot, unit: o.assembly.unit, engineQuantity: o.engineQuantity, quantity: o.quantity, adjusted: o.adjustments.length > 0, flag: o.assembly.estimateFlag, contributions: o.contributions.length }));

export interface PriceRow { id: string; item: string; label: string; unit: string; zone: string; date: string; source: string; median: string; min: string; max: string; n: number; confidence: string; dataClass: string; stale: boolean }
export function priceRows(run: Run): PriceRow[] {
  const label = new Map(run.pack.catalogue.map((c) => [c.code, c.label]));
  const stale = Number(run.pack.params['staleAfterDays'] ?? '0'); const asOf = Date.parse(run.binding.asOf + 'T00:00:00Z');
  return run.pack.priceBooks.flatMap((b) => b.entries.map((e): PriceRow => ({
    id: e.id, item: e.item, label: label.get(e.item) ?? e.item, unit: e.unit, zone: e.zoneId, date: e.date, source: `${e.source.type} ${e.source.ref}`,
    median: e.stat.median, min: e.stat.min, max: e.stat.max, n: e.stat.n, confidence: e.confidence, dataClass: e.dataClass,
    stale: stale > 0 && (asOf - Date.parse(e.date + 'T00:00:00Z')) / 86_400_000 > stale,
  })));
}

export interface EstimateRow { id: string; n: number; lot: string; label: string; unit: string; quantity: string; unitPrice: string | null; amount: string | null; source: 'engine' | 'manual'; status: string; flags: string[] }
export const estimateRows = (run: Run): { rows: EstimateRow[]; money: (v: string | null) => string; total: string; subtotalBeforeTax: string; currency: string; flags: string[] } => {
  const cur = run.estimate.currency; const money = (v: string | null): string => (v === null ? '—' : fmtMoney(v, cur.minorUnits, cur.code));
  return { rows: run.estimate.lines.map((l) => ({ id: l.id, n: l.n, lot: l.assembly.lot, label: l.assembly.label, unit: l.unit, quantity: fmtQty(l.quantity), unitPrice: l.unitPrice === null ? null : money(l.unitPrice), amount: l.amount === null ? null : money(l.amount), source: l.source, status: l.status, flags: l.flags })),
    money, total: money(run.estimate.total), subtotalBeforeTax: money(run.estimate.subtotalBeforeTax), currency: cur.code, flags: run.estimate.flags };
};

export interface AssumptionRow { id: string; key: string; value: string; unit: string; status: 'proposed' | 'confirmed'; rationale: string; confirmedBy: string | null; confirmedAt: string | null; usedBy: number }
export function assumptionRows(run: Run): AssumptionRow[] {
  const used = new Map<string, number>();
  for (const q of run.takeoff.quantities) for (const i of q.trace.inputs) if (i.source.type === 'assumption' && i.source.assumptionId) used.set(i.source.assumptionId, (used.get(i.source.assumptionId) ?? 0) + 1);
  return run.assumptions.items.map((a) => ({ id: a.id, key: a.key, value: a.value.value, unit: a.value.unit ?? '', status: a.status, rationale: a.rationale, confirmedBy: a.confirmedBy ?? null, confirmedAt: a.confirmedAt ?? null, usedBy: used.get(a.id) ?? 0 }));
}
export const isSynthetic = (run: Run): boolean => run.pack.dataClass !== 'commercial';

/** Zone par défaut proposée : la plus fine (feuille de l'arbre des zones) ; l'utilisateur peut la changer. */
export const defaultZone = (pack: { zoneTree: Array<{ id: string; parent: string | null }> }): string =>
  (pack.zoneTree.find((z) => !pack.zoneTree.some((c) => c.parent === z.id)) ?? pack.zoneTree[0]!).id;
