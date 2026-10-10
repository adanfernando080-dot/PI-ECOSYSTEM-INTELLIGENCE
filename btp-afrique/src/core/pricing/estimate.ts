/**
 * Chiffrage : QuantitySet × PriceBook (via MarketBinding) → Estimate. Mécanique générique : la structure de coût,
 * les arrondis, la péremption et les taxes viennent du pack (ADR-0008). Un prix manquant => ligne `unpriced`, JAMAIS 0.
 */
import { Dec } from '../units/decimal.js';
import { hashOf } from '../trace/canonical.js';
import type { MarketBinding } from '../pack/binding.js';
import type { CostKind, CostLayer, PriceEntry, ResolvedPack, Rounding } from '../pack/types.js';
import { expandAssembly, packUnits, type QuantitySet } from '../measure/commercial.js';
import { daysBetween } from './dates.js';

export interface PricedComponent {
  item: string; label: string; kind: CostKind; path: string[]; qtyPerUnit: string; unit: string;
  unitPriceMinor: string | null; amountPerUnit: string | null;
  price: null | {
    entryId: string; zoneId: string; level: 'zone' | 'parent'; date: string; source: { type: string; ref: string };
    version: string; confidence: string; dataClass: string; stat: string; ageDays: number; stale: boolean; lowConfidence: boolean;
  };
}
export interface LayerAmount { id: string; label: string; base: string[]; rate: string | null; amount: string; effect: 'add' | 'tax' }
export interface EstimateLine {
  id: string; n: number; ouvrageId: string; assembly: { code: string; version: string; hash: string; label: string; lot: string };
  unit: string; quantity: string; components: PricedComponent[]; directByKind: Record<string, string>;
  layers: LayerAmount[]; sellingUnitExact: string | null; unitPrice: string | null; amount: string | null;
  status: 'priced' | 'unpriced'; flags: string[]; unpricedItems: string[];
}
export interface Estimate {
  id: string; bindingRev: string; quantitySetHash: string; priceBookHash: string; currency: { code: string; minorUnits: number };
  lines: EstimateLine[]; linesTotal: string; totalLayers: LayerAmount[]; total: string; subtotalBeforeTax: string;
  flags: string[]; contentHash: string;
}

const pow10 = (k: number): Dec => Dec.of(10n ** BigInt(k), 0);
const rnd = (d: Dec, r: Rounding): Dec => d.round(r.scale, r.mode);

export function resolvePrice(pack: ResolvedPack, binding: MarketBinding, item: string):
  { entry: PriceEntry; level: 'zone' | 'parent'; zoneId: string } | null {
  const book = pack.priceBooks.find((b) => b.id === binding.priceBookId)!;
  const zones = new Map(pack.zoneTree.map((z) => [z.id, z]));
  let level: 'zone' | 'parent' = 'zone';
  for (let z: string | null = binding.zoneId; z; z = zones.get(z)?.parent ?? null) {
    const found = book.entries.filter((e) => e.item === item && e.zoneId === z);
    if (found.length) {
      found.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : Dec.parse(b.confidence).cmp(Dec.parse(a.confidence)) || (a.id < b.id ? -1 : 1)));
      return { entry: found[0]!, level, zoneId: z };
    }
    level = 'parent';
  }
  return null;
}

export function computeEstimate(pack: ResolvedPack, binding: MarketBinding, qs: QuantitySet): Estimate {
  const reg = packUnits(pack);
  const stale = Number(binding.params.staleAfterDays!); const lowConf = Dec.parse(binding.params.lowConfidenceBelow!);
  const cur = pack.currency; const minor = pow10(cur.minorUnits);
  const lines: EstimateLine[] = [];
  const lineLayers = pack.costBuildUp.filter((l) => l.scope === 'line');
  const totalLayers = pack.costBuildUp.filter((l) => l.scope === 'total');
  const rate = (l: CostLayer): Dec => Dec.parse(binding.params[l.rate!.param]!);

  qs.ouvrages.forEach((o, i) => {
    const comps: PricedComponent[] = []; const flags: string[] = []; const unpriced: string[] = [];
    const direct: Record<string, Dec> = {};
    for (const leaf of expandAssembly(pack, reg, o.assembly.code, Dec.ONE)) {
      const cat = pack.catalogue.find((c) => c.code === leaf.item)!;
      const pr = resolvePrice(pack, binding, leaf.item);
      if (!pr) {
        unpriced.push(leaf.item);
        comps.push({ item: leaf.item, label: cat.label, kind: cat.kind, path: leaf.path, qtyPerUnit: leaf.ordered.toString(), unit: leaf.unit, unitPriceMinor: null, amountPerUnit: null, price: null });
        continue;
      }
      const stat = Dec.parse(pr.entry.stat[binding.priceStatistic]);
      const amount = leaf.ordered.mul(stat);
      direct[leaf.kind] = (direct[leaf.kind] ?? Dec.ZERO).add(amount);
      const age = daysBetween(pr.entry.date, binding.asOf);
      const isStale = age > stale; const isLow = Dec.parse(pr.entry.confidence).lt(lowConf);
      if (isStale) flags.push('stale_price'); if (isLow) flags.push('low_confidence_price'); if (pr.level === 'parent') flags.push('price_from_parent_zone');
      comps.push({
        item: leaf.item, label: cat.label, kind: cat.kind, path: leaf.path, qtyPerUnit: leaf.ordered.toString(), unit: leaf.unit,
        unitPriceMinor: stat.toString(), amountPerUnit: amount.toString(),
        price: { entryId: pr.entry.id, zoneId: pr.zoneId, level: pr.level, date: pr.entry.date, source: pr.entry.source, version: pr.entry.version,
          confidence: pr.entry.confidence, dataClass: pr.entry.dataClass, stat: binding.priceStatistic, ageDays: age, stale: isStale, lowConfidence: isLow },
      });
    }
    if (o.assembly.estimateFlag) flags.push(o.assembly.estimateFlag);
    if (o.confidenceFloor && Dec.parse(o.confidenceFloor.value).lt(lowConf)) flags.push('input_low_confidence');

    let layers: LayerAmount[] = []; let selling: Dec | null = null; let unitPrice: Dec | null = null; let amount: Dec | null = null;
    if (unpriced.length === 0) {
      const acc = new Map<string, Dec>(); let sellingAcc = Dec.ZERO;
      for (const l of lineLayers) {
        let amt: Dec;
        if (l.kind === 'sum') amt = (l.of ?? []).reduce((s, k) => s.add(direct[k] ?? Dec.ZERO), Dec.ZERO);
        else if (l.kind === 'percent') amt = (l.base ?? []).reduce((s, b) => s.add(acc.get(b) ?? Dec.ZERO), Dec.ZERO).mul(rate(l));
        else amt = Dec.parse(binding.params[l.amount!.param]!).mul(minor);
        acc.set(l.id, amt); sellingAcc = sellingAcc.add(amt);
        layers.push({ id: l.id, label: l.label, base: l.base ?? l.of ?? [], rate: l.kind === 'percent' ? rate(l).toString() : null, amount: amt.toString(), effect: l.effect ?? 'add' });
      }
      selling = sellingAcc;
      unitPrice = rnd(selling, pack.rounding.unitPrice);
      amount = rnd(Dec.parse(o.quantity).mul(unitPrice), pack.rounding.lineAmount);
    } else flags.push('unpriced');

    lines.push({
      id: `el:${o.assembly.code}`, n: i + 1, ouvrageId: o.id, assembly: { code: o.assembly.code, version: o.assembly.version, hash: o.assembly.hash, label: o.assembly.label, lot: o.assembly.lot },
      unit: o.assembly.unit, quantity: o.quantity, components: comps,
      directByKind: Object.fromEntries(Object.entries(direct).map(([k, v]) => [k, v.toString()])),
      layers, sellingUnitExact: selling?.toString() ?? null, unitPrice: unitPrice?.toString() ?? null, amount: amount?.toString() ?? null,
      status: unpriced.length ? 'unpriced' : 'priced', flags: [...new Set(flags)].sort(), unpricedItems: unpriced,
    });
  });

  const linesTotal = lines.reduce((s, l) => s.add(l.amount ? Dec.parse(l.amount) : Dec.ZERO), Dec.ZERO);
  const acc = new Map<string, Dec>([['lines', linesTotal]]);
  const tl: LayerAmount[] = []; let total = linesTotal; let beforeTax = linesTotal;
  for (const l of totalLayers) {
    let amt: Dec;
    if (l.kind === 'percent') amt = rnd((l.base ?? []).reduce((s, b) => s.add(acc.get(b) ?? Dec.ZERO), Dec.ZERO).mul(rate(l)), pack.rounding.totalLayer);
    else if (l.kind === 'fixed') amt = rnd(Dec.parse(binding.params[l.amount!.param]!).mul(minor), pack.rounding.totalLayer);
    else throw new Error(`Couche « ${l.kind} » non supportée à la portée total`);
    acc.set(l.id, amt); total = total.add(amt);
    if ((l.effect ?? 'add') === 'add') beforeTax = beforeTax.add(amt);
    tl.push({ id: l.id, label: l.label, base: l.base ?? [], rate: l.kind === 'percent' ? rate(l).toString() : null, amount: amt.toString(), effect: l.effect ?? 'add' });
  }
  const flags = [...new Set(lines.flatMap((l) => l.flags))].sort();
  const core = {
    bindingRev: binding.rev, quantitySetHash: qs.contentHash, priceBookHash: binding.priceBookHash, currency: { code: cur.code, minorUnits: cur.minorUnits },
    lines, linesTotal: linesTotal.toString(), totalLayers: tl, total: total.toString(), subtotalBeforeTax: beforeTax.toString(), flags,
  };
  const contentHash = hashOf(core);
  return { id: `est:${contentHash.slice(7, 19)}`, ...core, contentHash };
}
