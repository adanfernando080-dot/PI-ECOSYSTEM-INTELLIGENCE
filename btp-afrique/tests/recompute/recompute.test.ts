import { describe, expect, it } from 'vitest';
import { Dec } from '../../src/core/units/decimal.js';
import { applyOperation, type Hlc, type Operation, type ProjectState } from '../../src/core/ops/oplog.js';
import { diffRuns, recompute, type RecomputeInput } from '../../src/core/project/recompute.js';
import { verifyRun } from '../../src/core/trace/chain.js';
import type { BindingRequest } from '../../src/core/pack/binding.js';
import type { Run } from '../../src/core/project/run.js';
import { catalog, cellAssumptions, cellModel, clone, houseAssumptions, houseModel, taxonomy, ZONES, ASOF } from '../support/env.js';
import { m } from '../../fixtures/synthetic/common.js';

const hlc = (n: number): Hlc => ({ wall: 5000 + n, counter: 0, node: 'dev-test' });
const bj = () => catalog.resolve('pack.bj');
const REQ: BindingRequest = { zoneId: ZONES.bj, asOf: ASOF };
const input = (state: ProjectState, binding: BindingRequest = REQ, pack = bj()): RecomputeInput => ({ taxonomy, state, pack, binding });
const cellState = (): ProjectState => ({ model: cellModel(), assumptions: cellAssumptions() });
const houseState = (): ProjectState => ({ model: houseModel(), assumptions: houseAssumptions() });
const hashes = (r: Run) => ({ takeoff: r.takeoff.contentHash, qs: r.quantitySet.contentHash, est: r.estimate.contentHash, binding: r.binding.rev });

describe('Recalcul avec réutilisation (T-ENG-04)', () => {
  it('aucune modification : tout est réutilisé, mêmes objets', () => {
    const a = recompute(null, input(cellState())).run;
    const b = recompute(a, input(cellState()));
    expect(b.reuse).toEqual({ binding: true, takeoff: true, quantitySet: true, estimate: true });
    expect(b.run.takeoff).toBe(a.takeoff); expect(b.run.estimate).toBe(a.estimate); expect(b.run.binding).toBe(a.binding);
  });
  it('seuls les PRIX/paramètres changent (marge) : géométrie et métré réutilisés, chiffrage recalculé', () => {
    const a = recompute(null, input(cellState())).run;
    const b = recompute(a, input(cellState(), { ...REQ, paramOverrides: { marginRate: '0.12' } }));
    expect(b.reuse).toEqual({ binding: false, takeoff: true, quantitySet: true, estimate: false });
    expect(b.run.binding).toMatchObject({ revision: 2, parentRev: a.binding.rev });
    expect(b.run.quantitySet.ouvrages).toBe(a.quantitySet.ouvrages);
    expect(b.run.estimate.lines[0]!.unitPrice).not.toBe(a.estimate.lines[0]!.unitPrice);
  });
  it('seule la date de prix change : métré réutilisé, chiffrage recalculé (péremption)', () => {
    const a = recompute(null, input(houseState())).run;
    const b = recompute(a, input(houseState(), { ...REQ, asOf: '2027-06-01' }));
    expect(b.reuse).toMatchObject({ takeoff: true, quantitySet: true, estimate: false });
    expect(b.run.estimate.flags).toContain('stale_price');
  });
  it('modification du plan : tout est recalculé', () => {
    const s = cellState();
    const a = recompute(null, input(s)).run;
    const op = applyOperation(s, { type: 'moveNode', nodeId: 'C2', x: m('6.00'), y: 0 }, { hlc: hlc(1), actor: 'u' });
    const b = recompute(a, input(op.state));
    expect(b.reuse).toEqual({ binding: true, takeoff: false, quantitySet: false, estimate: false });
  });
  it('entrées manuelles seules : géométrie réutilisée, métré et chiffrage recalculés', () => {
    const s = cellState(); const a = recompute(null, input(s)).run;
    const op = applyOperation(s, { type: 'setAdjustment', adjustment: { id: 'AJ', target: 'oq:OUV.MAC.BLOC20', mode: 'delta', value: '1', author: 'u.test', date: '2026-10-12', justification: 'ajustement de test' } }, { hlc: hlc(1), actor: 'u' });
    const b = recompute(a, input(op.state));
    expect(b.reuse).toEqual({ binding: true, takeoff: true, quantitySet: false, estimate: false });
  });
  it('changement de pack : géométrie réutilisée (universelle), tout le reste recalculé', () => {
    const a = recompute(null, input(houseState())).run;
    const b = recompute(a, input(houseState(), { zoneId: ZONES.sn, asOf: ASOF }, catalog.resolve('pack.sn')));
    expect(b.reuse).toEqual({ binding: false, takeoff: true, quantitySet: false, estimate: false });
    expect(b.run.takeoff).toBe(a.takeoff);
  });
  it('PROPRIÉTÉ : sur 40 modifications aléatoires (graine fixe), recalcul avec réutilisation ≡ recalcul complet, et chaque résultat se vérifie', () => {
    let seed = 20261012;
    const rnd = (n: number): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const nodes = ['N3', 'N5', 'N6', 'N7'];
    const pick = <T,>(xs: T[]): T => xs[rnd(xs.length)]!;
    let state = houseState(); let manualN = 0; let bindingReq = REQ;
    let prev = recompute(null, input(state)).run;
    const reused = { takeoff: 0, quantitySet: 0, estimate: 0 };
    for (let i = 0; i < 40; i++) {
      const kind = rnd(8);
      if (kind === 0) state = applyOperation(state, { type: 'moveNode', nodeId: pick(nodes), x: m('8.00') + rnd(3) * 1000, y: pick([0, m('6.00')]) }, { hlc: hlc(i), actor: 'u' }).state;
      else if (kind === 1) state = applyOperation(state, { type: 'setOpeningSize', openingId: pick(['o-w1', 'o-w2', 'o-w3', 'o-w4', 'o-d1']), width: pick(['0.60', '0.90', '1.00', '1.20']), height: pick(['1.20', '2.10']) }, { hlc: hlc(i), actor: 'u' }).state;
      else if (kind === 2) state = applyOperation(state, { type: 'setAssumptionValue', assumptionId: 'A-01', value: pick(['2.60', '2.80', '3.00', '3.20']) }, { hlc: hlc(i), actor: 'u' }).state;
      else if (kind === 3) state = applyOperation(state, { type: 'addManualLine', line: { id: `ML${manualN++}`, lot: pick(['LOT01', 'LOT02', 'LOT03']), designation: 'Poste de test', unit: 'u', quantity: pick(['1', '2.5']), unitPrice: pick(['1000', '25000']), justification: 'poste de test aléatoire', author: 'u.test', date: ASOF } }, { hlc: hlc(i), actor: 'u' }).state;
      else if (kind === 4 && state.manual?.lines.length) state = applyOperation(state, { type: 'removeManualLine', id: state.manual.lines[0]!.id }, { hlc: hlc(i), actor: 'u' }).state;
      else if (kind === 5) state = applyOperation(state, { type: 'setAdjustment', adjustment: { id: 'AJ', target: pick(['oq:OUV.MAC.BLOC20', 'oq:OUV.TOLE', 'oq:OUV.MAC.BLOC10']), mode: pick(['delta', 'override'] as const), value: pick(['1', '3.5']), author: 'u.test', date: ASOF, justification: 'ajustement de test' } }, { hlc: hlc(i), actor: 'u' }).state;
      else if (kind === 6) bindingReq = { ...REQ, paramOverrides: { marginRate: pick(['0.08', '0.10', '0.12']) }, asOf: pick([ASOF, '2027-01-01']) };
      const inc = recompute(prev, input(state, bindingReq));
      const full = recompute(prev, input(state, bindingReq), { reuse: false });
      expect(hashes(inc.run), `étape ${i}`).toEqual(hashes(full.run));
      expect(inc.run.estimate.total, `étape ${i}`).toBe(full.run.estimate.total);
      expect(verifyRun(inc.run).ok, `étape ${i}`).toBe(true);
      if (inc.reuse.takeoff) reused.takeoff++; if (inc.reuse.quantitySet) reused.quantitySet++; if (inc.reuse.estimate) reused.estimate++;
      prev = inc.run;
    }
    expect(reused.takeoff).toBeGreaterThan(5); expect(reused.quantitySet).toBeGreaterThan(3);      // la réutilisation a réellement eu lieu
  });
  it('données invalides refusées avant tout calcul', () => {
    const s = cellState(); s.manual = { adjustments: [], lines: [{ id: 'X', lot: 'LOT01', designation: 'x', unit: 'u', quantity: '1', unitPrice: '1', justification: '', author: '', date: 'x' }] };
    expect(() => recompute(null, input(s))).toThrow(/Entrées manuelles invalides/);
    const bad = cellState(); bad.model.buildings[0]!.levels[0]!.walls[0]!.startNode = 'zz';
    expect(() => recompute(null, input(bad))).toThrow(/Modèle architectural invalide/);
  });
});

describe('Comparaison de versions : l\'écart est décomposé (quantité + prix + arrondi = écart exact)', () => {
  it('élargir la cellule de 5 à 6 m : tout l\'écart vient de la QUANTITÉ (calcul à la main)', () => {
    const s0 = cellState(); const a = recompute(null, input(s0)).run;
    const s1 = applyOperation(applyOperation(s0, { type: 'moveNode', nodeId: 'C2', x: m('6.00'), y: 0 }, { hlc: hlc(1), actor: 'u' }).state, { type: 'moveNode', nodeId: 'C3', x: m('6.00'), y: m('4.00') }, { hlc: hlc(2), actor: 'u' }).state;
    const b = recompute(a, input(s1)).run; const d = diffRuns(a, b);
    const l = d.lines.find((x) => x.id === 'el:OUV.MAC.BLOC20')!;
    expect(l).toMatchObject({ status: 'changed', qtyBefore: '51.9', qtyAfter: '57.9', amountBefore: '509139', amountAfter: '567999', delta: '58860', quantityEffect: '58860', priceEffect: '0', roundingEffect: '0' });   // 6 × 9 810
    expect(d.lines.find((x) => x.id === 'el:OUV.PORTE.100')!.status).toBe('unchanged');
    expect(d).toMatchObject({ linesDelta: '58860', taxAndOtherDelta: '10595', totalBefore: '729587', totalAfter: '799042', totalDelta: '69455' });      // TVA 121 888 − 111 293
    expect(d.geometry.changed).toContain('geo:w-s:wall.length.axis'); expect(d.geometry.changed).not.toContain('geo:w-e:wall.length.axis');
  });
  it('seul le prix change (marge 10 % → 12 %) : tout l\'écart vient du PRIX', () => {
    const a = recompute(null, input(cellState())).run;
    const b = recompute(a, input(cellState(), { ...REQ, paramOverrides: { marginRate: '0.12' } })).run; const d = diffRuns(a, b);
    for (const l of d.lines) { expect(l.quantityEffect).toBe('0'); expect(Dec.parse(l.priceEffect).add(Dec.parse(l.roundingEffect)).eq(Dec.parse(l.delta))).toBe(true); expect(Number(l.priceEffect)).toBeGreaterThan(0); }
    expect(d.geometry).toEqual({ added: [], removed: [], changed: [] });
  });
  it('identité exacte pour toute comparaison : quantité + prix + arrondi = écart, et somme des lignes = écart des postes', () => {
    const a = recompute(null, input(houseState())).run;
    const s = applyOperation(houseState(), { type: 'setAssumptionValue', assumptionId: 'A-01', value: '2.80' }, { hlc: hlc(1), actor: 'u' }).state;
    const b = recompute(a, input(s, { ...REQ, paramOverrides: { overheadRate: '0.14' } })).run; const d = diffRuns(a, b);
    let sum = Dec.ZERO;
    for (const l of d.lines) { expect(Dec.parse(l.quantityEffect).add(Dec.parse(l.priceEffect)).add(Dec.parse(l.roundingEffect)).eq(Dec.parse(l.delta)), l.id).toBe(true); sum = sum.add(Dec.parse(l.delta)); }
    expect(sum.toString()).toBe(d.linesDelta);
    expect(Dec.parse(d.linesDelta).add(Dec.parse(d.taxAndOtherDelta)).toString()).toBe(d.totalDelta);
  });
  it('ligne ajoutée / supprimée', () => {
    const s0 = houseState(); const a = recompute(null, input(s0)).run;
    const noRoof = clone(s0); noRoof.model.buildings[0]!.levels[0]!.roofs = [];
    const b = recompute(a, input(noRoof)).run; const d = diffRuns(a, b);
    const roof = d.lines.find((x) => x.id === 'el:OUV.TOLE')!;
    expect(roof).toMatchObject({ status: 'removed', qtyAfter: null, amountAfter: '0' }); expect(roof.delta).toBe(`-${a.estimate.lines.find((l) => l.id === 'el:OUV.TOLE')!.amount}`);
    const back = diffRuns(b, a).lines.find((x) => x.id === 'el:OUV.TOLE')!; expect(back.status).toBe('added'); expect(back.quantityEffect).toBe(back.delta);
  });
  it('entre deux marchés de même devise : comparable ; de devises différentes : refusée', () => {
    const a = recompute(null, input(houseState())).run;
    const sn = recompute(null, input(houseState(), { zoneId: ZONES.sn, asOf: ASOF }, catalog.resolve('pack.sn'))).run;
    expect(diffRuns(a, sn).currency).toBe('XOF');
    const dv = recompute(null, input(houseState(), { zoneId: ZONES.divergent, asOf: ASOF }, catalog.resolve('pack.test.divergent'))).run;
    expect(() => diffRuns(a, dv)).toThrow(/devises différentes/);
  });
});
