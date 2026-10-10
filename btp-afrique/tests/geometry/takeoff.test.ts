import { describe, expect, it } from 'vitest';
import { computeTakeoff } from '../../src/core/geometry/takeoff.js';
import { allGeometryRules } from '../../src/core/geometry/rules.js';
import { clone, cellAssumptions, cellModel, houseAssumptions, houseModel } from '../support/env.js';
import { expectedHouse } from '../support/analytic-house.js';

const values = (t: ReturnType<typeof computeTakeoff>): Record<string, string> => Object.fromEntries(t.quantities.map((q) => [q.id, q.value]));

describe('Métré géométrique — étage 1 universel', () => {
  it('maison : TOUTES les quantités géométriques égalent le calcul analytique indépendant (T-SYN-01)', () => {
    const t = computeTakeoff(houseModel(), houseAssumptions());
    expect(t.blocked).toEqual([]);
    const got = values(t); const exp = expectedHouse();
    for (const [id, v] of Object.entries(exp)) expect(got[id], id).toBe(v);
    // aucune quantité en plus ou en moins que celles attendues (hors roof.area.developed vérifiée séparément)
    expect(Object.keys(got).filter((k) => !k.includes('roof.area.developed')).sort()).toEqual(Object.keys(exp).sort());
  });
  it('valeurs clés vérifiables à la main', () => {
    const v = values(computeTakeoff(houseModel(), houseAssumptions()));
    expect(v['geo:w-01:wall.area.net']).toBe('11.46');        // 5,00 × 3,00 − (2,10 + 1,44)
    expect(v['geo:sp-sal:space.clear.area']).toBe('28.13');   // (5,00−0,10−0,05) × (6,00−0,10−0,10) = 4,85 × 5,80
    expect(v['geo:sp-cha:space.clear.area']).toBe('9.5475');  // 2,85 × 3,35
    expect(v['geo:sp-sdb:space.clear.area']).toBe('6.6975');  // 2,85 × 2,35
    expect(v['geo:sp-sal:space.wall.area.net']).toBe('55.14');// 21,30 × 3,00 − 8,76
    expect(v['geo:sl-1:slab.area']).toBe('50.84');            // 8,20 × 6,20
    expect(v['geo:sl-1:slab.volume']).toBe('6.1008');         // × 0,12
  });
  it('toiture à pente : surface développée = plan × √(1 + (0,30/1,00)²), sqrt décimal déterministe', () => {
    const t = computeTakeoff(houseModel(), houseAssumptions());
    const dev = t.quantities.find((q) => q.id === 'geo:rf-1:roof.area.developed')!;
    expect(dev.value).toBe('53.078518');   // 50,84 × 1,04403065 = 53,078518246 -> 6 décimales
    expect(dev.trace.steps.map((s) => s.op)).toEqual(['div', 'sqrt', 'mul']);
    expect(dev.trace.steps[1]!.result).toBe('1.04403065');
  });
  it('mur oblique : longueur par racine décimale (3-4-5 exact ; 1-1 arrondi à 6 décimales)', () => {
    const mdl = clone(cellModel()); const lv = mdl.buildings[0]!.levels[0]!;
    lv.nodes[2] = { id: 'C3', x: 80000, y: 60000 };       // C2(5,0) -> C3(8,6) : dx=3, dy=6
    lv.nodes[3] = { id: 'C4', x: 80000, y: 90000 };
    lv.nodes[1] = { id: 'C2', x: 30000, y: 40000 };       // C1(0,0) -> C2(3,4) : 3-4-5
    const t = computeTakeoff(mdl, cellAssumptions());
    expect(t.quantities.find((q) => q.id === 'geo:w-s:wall.length.axis')!.value).toBe('5');
    const mdl2 = clone(cellModel()); mdl2.buildings[0]!.levels[0]!.nodes[1] = { id: 'C2', x: 10000, y: 10000 };
    const l = computeTakeoff(mdl2, cellAssumptions()).quantities.find((q) => q.id === 'geo:w-s:wall.length.axis')!;
    expect(l.value).toBe('1.414214'); expect(l.trace.steps[1]!.result).toBe('1.41421356');
  });
  it('déduction : surface nette = brute − ouvertures hébergées (cellule)', () => {
    const v = values(computeTakeoff(cellModel(), cellAssumptions()));
    expect(v['geo:w-s:wall.area.gross']).toBe('15'); expect(v['geo:w-s:wall.openings.area']).toBe('2.1'); expect(v['geo:w-s:wall.area.net']).toBe('12.9');
    expect(v['geo:w-e:wall.area.net']).toBe('12'); expect(v['geo:w-n:wall.area.net']).toBe('15'); expect(v['geo:w-w:wall.area.net']).toBe('12');
  });
  it('chaque quantité porte une trace : règle versionnée + hash, entrées, étapes, résultat cohérent', () => {
    const t = computeTakeoff(houseModel(), houseAssumptions());
    const ruleIds = new Set(allGeometryRules().map((r) => r.id));
    for (const q of t.quantities) {
      expect(ruleIds.has(q.trace.rule.id), q.id).toBe(true);
      expect(q.trace.rule.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(q.trace.result.value).toBe(q.value);
      expect(q.trace.steps.length).toBeGreaterThan(0);
      expect(q.trace.inputs.length).toBeGreaterThan(0);
    }
  });
  it('déterminisme et indépendance vis-à-vis de l\'ordre des éléments', () => {
    const a = computeTakeoff(houseModel(), houseAssumptions()); const b = computeTakeoff(houseModel(), houseAssumptions());
    expect(a.contentHash).toBe(b.contentHash);
    const shuffled = clone(houseModel()); const lv = shuffled.buildings[0]!.levels[0]!;
    lv.walls.reverse(); lv.openings.reverse(); lv.nodes.reverse();
    expect(values(computeTakeoff(shuffled, houseAssumptions()))).toEqual(values(a));
  });
  it('plancher de confiance : une ouverture IA acceptée en lot (0,72) limite les grandeurs qui en dépendent', () => {
    const t = computeTakeoff(houseModel(), houseAssumptions());
    const net = t.quantities.find((q) => q.id === 'geo:w-04:wall.area.net')!;
    expect(net.confidenceFloor).toEqual({ value: '0.72', limitedBy: 'o-w4.width' });
    expect(t.quantities.find((q) => q.id === 'geo:w-01:wall.area.net')!.confidenceFloor).toBeNull();
  });
  it('limite M0 explicite : pièce non rectangulaire => bloquée avec raison, pas de valeur inventée', () => {
    const mdl = clone(cellModel()); mdl.buildings[0]!.levels[0]!.nodes[1] = { id: 'C2', x: 50000, y: 5000 }; // mur sud incliné
    const t = computeTakeoff(mdl, cellAssumptions());
    expect(t.blocked.some((b) => b.entity.id === 'sp-1' && /non rectangulaire/.test(b.reason))).toBe(true);
    expect(t.quantities.some((q) => q.entity.id === 'sp-1')).toBe(false);
  });
});
