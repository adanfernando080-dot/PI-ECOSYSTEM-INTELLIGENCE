/**
 * Recalcul après modification des données (REQ-26, T-ENG-04) avec RÉUTILISATION des étapes inchangées, et comparaison de versions.
 * Garantie testée : le résultat avec réutilisation est IDENTIQUE (mêmes empreintes) à un recalcul complet.
 * Dépendances : géométrie ← (modèle, hypothèses) ; métré commercial ← (géométrie, pack, entrées manuelles) ; chiffrage ← (métré, prix/paramètres du binding, entrées manuelles).
 */
import { Dec } from '../units/decimal.js';
import { hashOf } from '../trace/canonical.js';
import { assertValidModel, type Taxonomy } from '../model/validate.js';
import { computeTakeoff } from '../geometry/takeoff.js';
import { computeQuantitySet, rebindQuantitySet } from '../measure/commercial.js';
import { computeEstimate } from '../pricing/estimate.js';
import { createBinding, type BindingRequest, type MarketBinding } from '../pack/binding.js';
import type { ResolvedPack } from '../pack/types.js';
import { validateResolved } from '../pack/validate.js';
import { NO_MANUAL, validateManual } from '../manual/manual.js';
import type { ProjectState } from '../ops/oplog.js';
import { DEFAULT_ENGINE } from './pipeline.js';
import type { EngineInfo, Run } from './run.js';

export interface RecomputeInput {
  taxonomy: Taxonomy; state: ProjectState; pack: ResolvedPack; binding: BindingRequest; engine?: EngineInfo;
  /** binding parent de la nouvelle révision (défaut : celui de `prev`) */
  parentBinding?: MarketBinding | null;
}
export interface ReuseReport { binding: boolean; takeoff: boolean; quantitySet: boolean; estimate: boolean }

const sameBindingContent = (a: MarketBinding, b: MarketBinding): boolean =>
  a.packResolvedHash === b.packResolvedHash && a.zoneId === b.zoneId && a.priceBookId === b.priceBookId && a.priceBookHash === b.priceBookHash
  && a.priceStatistic === b.priceStatistic && a.asOf === b.asOf && hashOf(a.params) === hashOf(b.params);

export function recompute(prev: Run | null, input: RecomputeInput, opts: { reuse?: boolean } = {}): { run: Run; reuse: ReuseReport } {
  const allowReuse = (opts.reuse ?? true) && prev !== null;
  const manual = input.state.manual ?? NO_MANUAL;
  assertValidModel(input.state.model, input.taxonomy);
  if (!(allowReuse && prev!.pack.resolution.resolvedHash === input.pack.resolution.resolvedHash)) {
    const packErrors = validateResolved(input.pack, input.taxonomy);
    if (packErrors.length) throw new Error('Pack invalide :\n - ' + packErrors.join('\n - '));
  }
  const me = validateManual(manual, input.pack);
  if (me.length) throw new Error('Entrées manuelles invalides :\n - ' + me.join('\n - '));

  const parent = input.parentBinding === undefined ? prev?.binding ?? null : input.parentBinding;
  const candidate = createBinding(input.pack, input.binding);
  const bindingSame = parent !== null && sameBindingContent(candidate, parent);
  const binding = bindingSame ? parent! : createBinding(input.pack, { ...input.binding, ...(parent ? { parent } : {}) });

  const modelRev = hashOf(input.state.model); const assumptionsRev = hashOf(input.state.assumptions); const manualHash = hashOf(manual);
  const reuseTakeoff = allowReuse && prev!.takeoff.modelRev === modelRev && prev!.takeoff.assumptionSetRev === assumptionsRev;
  const takeoff = reuseTakeoff ? prev!.takeoff : computeTakeoff(input.state.model, input.state.assumptions);

  const reuseQs = reuseTakeoff && prev!.binding.packResolvedHash === binding.packResolvedHash && prev!.quantitySet.manualHash === manualHash && prev!.quantitySet.geoTakeoffHash === takeoff.contentHash;
  const quantitySet = reuseQs
    ? (prev!.quantitySet.bindingRev === binding.rev ? prev!.quantitySet : rebindQuantitySet(prev!.quantitySet, binding.rev))
    : computeQuantitySet(input.state.model, input.state.assumptions, takeoff, input.pack, binding, manual);

  const reuseEst = reuseQs && prev!.binding.rev === binding.rev && prev!.estimate.manualHash === manualHash && prev!.estimate.quantitySetHash === quantitySet.contentHash;
  const estimate = reuseEst ? prev!.estimate : computeEstimate(input.pack, binding, quantitySet, manual);

  const run: Run = { taxonomy: input.taxonomy, model: input.state.model, assumptions: input.state.assumptions, pack: input.pack, binding, manual, takeoff, quantitySet, estimate, documents: [], engine: input.engine ?? prev?.engine ?? DEFAULT_ENGINE };
  return { run, reuse: { binding: bindingSame, takeoff: reuseTakeoff, quantitySet: reuseQs, estimate: reuseEst } };
}

// ---------------------------------------------------------------- comparaison de versions
export interface LineDiff {
  id: string; label: string; unit: string; status: 'added' | 'removed' | 'changed' | 'unchanged';
  qtyBefore: string | null; qtyAfter: string | null; puBefore: string | null; puAfter: string | null; amountBefore: string; amountAfter: string;
  delta: string;
  /** (qté après − qté avant) × PU avant */ quantityEffect: string;
  /** qté après × (PU après − PU avant) */ priceEffect: string;
  /** résidu dû aux arrondis du montant de ligne : delta − effets */ roundingEffect: string;
}
export interface RunDiff {
  currency: string; lines: LineDiff[]; linesDelta: string; taxAndOtherDelta: string; totalBefore: string; totalAfter: string; totalDelta: string;
  geometry: { added: string[]; removed: string[]; changed: string[] };
}

/** Compare deux chiffrages de MÊME devise. Chaque écart de ligne est décomposé : effet quantité + effet prix + arrondi = écart exact. */
export function diffRuns(a: Run, b: Run): RunDiff {
  if (a.estimate.currency.code !== b.estimate.currency.code) throw new Error(`Comparaison impossible : devises différentes (${a.estimate.currency.code} ≠ ${b.estimate.currency.code})`);
  const byId = (r: Run) => new Map(r.estimate.lines.map((l) => [l.id, l]));
  const A = byId(a); const B = byId(b);
  const ids = [...new Set([...A.keys(), ...B.keys()])].sort();
  const lines: LineDiff[] = ids.map((id) => {
    const x = A.get(id); const y = B.get(id);
    const amtA = Dec.parse(x?.amount ?? '0'); const amtB = Dec.parse(y?.amount ?? '0');
    const qA = Dec.parse(x?.quantity ?? '0'); const qB = Dec.parse(y?.quantity ?? '0');
    const pA = Dec.parse(x?.unitPrice ?? '0'); const pB = Dec.parse(y?.unitPrice ?? '0');
    const delta = amtB.sub(amtA);
    const qe = x ? qB.sub(qA).mul(pA) : amtB;                    // ligne ajoutée : tout est effet quantité
    const pe = x ? qB.mul(pB.sub(pA)) : Dec.ZERO;
    const status: LineDiff['status'] = !x ? 'added' : !y ? 'removed' : delta.isZero() && qA.eq(qB) && pA.eq(pB) ? 'unchanged' : 'changed';
    const qeF = !y ? delta : qe; const peF = !y ? Dec.ZERO : pe;           // ligne supprimée : tout est effet quantité
    return { id, label: (y ?? x)!.assembly.label, unit: (y ?? x)!.unit, status, qtyBefore: x?.quantity ?? null, qtyAfter: y?.quantity ?? null, puBefore: x?.unitPrice ?? null, puAfter: y?.unitPrice ?? null,
      amountBefore: amtA.toString(), amountAfter: amtB.toString(), delta: delta.toString(), quantityEffect: qeF.toString(), priceEffect: peF.toString(), roundingEffect: delta.sub(qeF).sub(peF).toString() };
  });
  const linesDelta = Dec.parse(b.estimate.linesTotal).sub(Dec.parse(a.estimate.linesTotal));
  const totalDelta = Dec.parse(b.estimate.total).sub(Dec.parse(a.estimate.total));
  const ga = new Map(a.takeoff.quantities.map((q) => [q.id, q.value])); const gb = new Map(b.takeoff.quantities.map((q) => [q.id, q.value]));
  return {
    currency: a.estimate.currency.code, lines, linesDelta: linesDelta.toString(), taxAndOtherDelta: totalDelta.sub(linesDelta).toString(),
    totalBefore: a.estimate.total, totalAfter: b.estimate.total, totalDelta: totalDelta.toString(),
    geometry: { added: [...gb.keys()].filter((k) => !ga.has(k)).sort(), removed: [...ga.keys()].filter((k) => !gb.has(k)).sort(), changed: [...gb.keys()].filter((k) => ga.has(k) && ga.get(k) !== gb.get(k)).sort() },
  };
}
