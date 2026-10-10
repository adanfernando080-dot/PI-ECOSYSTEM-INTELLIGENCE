import { describe, expect, it } from 'vitest';
import { applyOperation, stateRev, undoOperation, type Hlc, type ProjectState } from '../../src/core/ops/oplog.js';
import { validateModel } from '../../src/core/model/validate.js';
import { buildDocument } from '../../src/core/docs/document.js';
import { verifyRun } from '../../src/core/trace/chain.js';
import { emitDocument } from '../../src/core/project/pipeline.js';
import { catalog, cellAssumptions, cellModel, runWith, taxonomy, ZONES } from '../support/env.js';
import { m } from '../../fixtures/synthetic/common.js';

const hlc = (n: number): Hlc => ({ wall: 1_000 + n, counter: 0, node: 'dev-test' });
const meta = (n: number) => ({ hlc: hlc(n), actor: 'user:test' });
const state0 = (): ProjectState => ({ model: cellModel(), assumptions: cellAssumptions() });
const price = (s: ProjectState) => runWith(catalog.resolve('pack.bj'), s.model, s.assumptions, { zoneId: ZONES.bj });
const masonry = (r: ReturnType<typeof price>) => r.estimate.lines.find((l) => l.assembly.code === 'OUV.MAC.BLOC20')!;

describe('Versioning : journal d\'opérations immuable, inversible (ADR-0009)', () => {
  it('une modification de plan produit une NOUVELLE révision ; l\'ancienne reste intacte', () => {
    const s0 = state0(); const before = JSON.stringify(s0);
    const a1 = applyOperation(s0, { type: 'moveNode', nodeId: 'C2', x: m('6.00'), y: 0 }, meta(1));
    expect(JSON.stringify(s0)).toBe(before);                                   // immutabilité
    expect(stateRev(a1.state)).not.toBe(stateRev(s0));
    expect(a1.record).toMatchObject({ parentRev: stateRev(s0), resultRev: stateRev(a1.state), actor: 'user:test', hlc: hlc(1) });
    expect(a1.record.inverse).toEqual({ type: 'moveNode', nodeId: 'C2', x: m('5.00'), y: 0 });
    expect(validateModel(a1.state.model, taxonomy)).toEqual([]);
  });
  it('CONTINUITÉ conception → chiffrage : élargir la cellule de 5 m à 6 m recalcule métré et coût (calcul à la main)', () => {
    const s0 = state0();
    const a1 = applyOperation(s0, { type: 'moveNode', nodeId: 'C2', x: m('6.00'), y: 0 }, meta(1));
    const a2 = applyOperation(a1.state, { type: 'moveNode', nodeId: 'C3', x: m('6.00'), y: m('4.00') }, meta(2));
    const r0 = price(s0); const r2 = price(a2.state);
    expect(masonry(r0).quantity).toBe('51.9');
    expect(masonry(r2).quantity).toBe('57.9');                                 // (6+4+6+4) × 3 − 2,10 = 57,90
    expect(masonry(r2).amount).toBe('567999');                                 // 57,90 × 9 810
    expect(r2.quantitySet.requirements.find((q) => q.item === 'MAT.BLOC.20')!.quantity).toBe('760');   // 57,9 × 12,5 × 1,05 = 759,9375
    expect(r2.estimate.lines.find((l) => l.assembly.code === 'OUV.PORTE.100')!.amount).toBe('109155');  // inchangé
    expect(Number(r2.estimate.total)).toBeGreaterThan(Number(r0.estimate.total));
    expect(r2.takeoff.modelRev).not.toBe(r0.takeoff.modelRev);
  });
  it('redimensionner la porte change l\'ouvrage appliqué (100 → 90) : conséquence de marché de la règle de correspondance', () => {
    const a = applyOperation(state0(), { type: 'setOpeningSize', openingId: 'o-d1', width: '0.90', height: '2.10' }, meta(1));
    const r = price(a.state);
    expect(r.estimate.lines.map((l) => l.assembly.code)).toEqual(['OUV.MAC.BLOC20', 'OUV.PORTE.90']);
    expect(masonry(r).quantity).toBe('52.11');                                 // 12 + 15 + (15 − 1,89) + 12
    expect(a.state.model.buildings[0]!.levels[0]!.openings[0]!.width).toMatchObject({ value: '0.90', origin: 'user_corrected', validation: 'edited' });
  });
  it('modifier une hypothèse (hauteur 3,00 → 2,80) change les quantités, jamais le modèle', () => {
    const s0 = state0();
    const a = applyOperation(s0, { type: 'setAssumptionValue', assumptionId: 'A-01', value: '2.80' }, meta(1));
    expect(a.state.model).toEqual(s0.model);
    expect(masonry(price(a.state)).quantity).toBe('48.3');                     // (18 × 2,8) − 2,10
  });
  it('annulation : appliquer l\'inverse restaure EXACTEMENT la révision précédente (hash identique)', () => {
    const s0 = state0();
    const a1 = applyOperation(s0, { type: 'moveNode', nodeId: 'C2', x: m('6.00'), y: 0 }, meta(1));
    const a2 = applyOperation(a1.state, { type: 'setAssumptionValue', assumptionId: 'A-01', value: '2.80' }, meta(2));
    const u2 = undoOperation(a2.state, a2.record, meta(3)); expect(stateRev(u2.state)).toBe(stateRev(a1.state));
    const u1 = undoOperation(u2.state, a1.record, meta(4)); expect(stateRev(u1.state)).toBe(stateRev(s0));
    expect(u1.record.parentRev).toBe(a1.record.resultRev);                     // l'historique est APPENDU, jamais réécrit
    expect(() => undoOperation(a1.state, a2.record, meta(5))).toThrow(/n'est pas celui produit/);
  });
  it('opérations invalides refusées ; identifiant d\'opération déterministe', () => {
    expect(() => applyOperation(state0(), { type: 'moveNode', nodeId: 'zz', x: 0, y: 0 }, meta(1))).toThrow(/Nœud inconnu/);
    expect(() => applyOperation(state0(), { type: 'setOpeningSize', openingId: 'zz', width: '1', height: '1' }, meta(1))).toThrow(/Ouverture inconnue/);
    expect(() => applyOperation(state0(), { type: 'setAssumptionValue', assumptionId: 'A-99', value: '1' }, meta(1))).toThrow(/Hypothèse inconnue/);
    const op = { type: 'moveNode', nodeId: 'C2', x: m('6.00'), y: 0 } as const;
    expect(applyOperation(state0(), op, meta(1)).record.opId).toBe(applyOperation(state0(), op, meta(1)).record.opId);
    expect(applyOperation(state0(), op, meta(1)).record.opId).not.toBe(applyOperation(state0(), op, meta(2)).record.opId);
  });
  it('un document émis à la révision A reste vérifiable après la révision B, et référence A', () => {
    const s0 = state0(); const r0 = price(s0);
    const doc0 = emitDocument(r0, { templateId: 'tpl.dqe.fr', number: 'V1', date: '2026-10-08', status: 'draft' });
    const a = applyOperation(s0, { type: 'moveNode', nodeId: 'C2', x: m('6.00'), y: 0 }, meta(1));
    const r1 = price(applyOperation(a.state, { type: 'moveNode', nodeId: 'C3', x: m('6.00'), y: m('4.00') }, meta(2)).state);
    const doc1 = buildDocument(r1, { templateId: 'tpl.dqe.fr', number: 'V2', date: '2026-10-08', status: 'draft' });
    expect(verifyRun(r0).ok).toBe(true);
    expect(doc0.manifest.modelRev).toBe(r0.takeoff.modelRev); expect(doc1.manifest.modelRev).toBe(r1.takeoff.modelRev);
    expect(doc0.manifest.modelRev).not.toBe(doc1.manifest.modelRev);
    expect(doc0.manifest.planRevision).toEqual(doc1.manifest.planRevision);   // même plan source, deux révisions de modèle
    // comparaison de versions : delta de quantité et de montant explicable
    const q = (r: typeof r0): number => Number(masonry(r).quantity);
    expect(q(r1) - q(r0)).toBeCloseTo(6, 10);
    expect(Number(masonry(r1).amount) - Number(masonry(r0).amount)).toBe(58860);   // 6 × 9 810
  });
});
