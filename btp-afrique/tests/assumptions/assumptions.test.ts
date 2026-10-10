import { describe, expect, it } from 'vitest';
import { computeTakeoff } from '../../src/core/geometry/takeoff.js';
import { confirmAssumption, proposeAssumptions, AssumptionIndex } from '../../src/core/assumptions/assumptions.js';
import { catalog, cellAssumptions, cellModel, clone, runWith, ZONES } from '../support/env.js';

describe('Hypothèses explicites (ADR-0005, D15)', () => {
  it('aucune valeur par défaut implicite : une hauteur non renseignée est BLOQUANTE, jamais 0 ni 3', () => {
    const model = clone(cellModel());
    model.buildings[0]!.levels[0]!.walls[0]!.height = { unit: 'm', origin: 'user_entered' }; // ni valeur ni hypothèse
    const t = computeTakeoff(model, cellAssumptions());
    expect(t.quantities.find((q) => q.id === 'geo:w-s:wall.area.gross')).toBeUndefined();
    expect(t.quantities.find((q) => q.id === 'geo:w-s:wall.area.net')).toBeUndefined();
    expect(t.blocked.find((b) => b.entity.id === 'w-s' && b.quantity === 'wall.area.net')?.reason).toMatch(/unspecified/);
    // les autres murs restent calculés
    expect(t.quantities.find((q) => q.id === 'geo:w-e:wall.area.net')?.value).toBe('12');
  });
  it('une hypothèse NON CONFIRMÉE (proposée) ne produit aucune quantité', () => {
    const a = clone(cellAssumptions()); a.items[0]!.status = 'proposed';
    const t = computeTakeoff(cellModel(), a);
    expect(t.quantities.some((q) => q.kind === 'wall.area.gross')).toBe(false);
    expect(t.blocked.some((b) => /non confirmée/.test(b.reason))).toBe(true);
  });
  it('une hypothèse absente bloque aussi', () => {
    const t = computeTakeoff(cellModel(), { id: 'x', items: [] });
    expect(t.blocked.some((b) => /absente/.test(b.reason))).toBe(true);
    expect(t.quantities.some((q) => q.kind === 'wall.area.gross')).toBe(false);
  });
  it("une hypothèse confirmée est utilisée ET tracée (assumptionId dans la trace)", () => {
    const t = computeTakeoff(cellModel(), cellAssumptions());
    const g = t.quantities.find((q) => q.id === 'geo:w-s:wall.area.gross')!;
    const h = g.trace.inputs.find((i) => i.name === 'hauteur')!;
    expect(h.source.type).toBe('assumption'); expect(h.source.assumptionId).toBe('A-01'); expect(h.value).toBe('3');
  });
  it('le pack PROPOSE, rien n\'est appliqué avant confirmation ; une hypothèse existante n\'est jamais écrasée', () => {
    const bj = catalog.resolve('pack.bj');
    const empty = { id: 'a', items: [] };
    const { merged, conflicts } = proposeAssumptions(empty, bj.defaultSpecProfiles, { kind: 'market_profile', ref: 'opaque-ref' });
    expect(conflicts).toEqual([]);
    expect(merged.items[0]).toMatchObject({ id: 'A-01', status: 'proposed', seededFrom: { kind: 'market_profile' } });
    expect(new AssumptionIndex(merged).confirmed('A-01')).toMatchObject({ ok: false });
    const confirmed = confirmAssumption(merged, 'A-01', 'user:test', '2026-10-08');
    expect(new AssumptionIndex(confirmed).confirmed('A-01')).toMatchObject({ ok: true });
    // l'hypothèse confirmée à 3.00 n'est pas écrasée par une proposition à 2.80, le conflit est signalé
    const again = proposeAssumptions(cellAssumptions(), [{ id: 'A-01', key: 'level.clearHeight', value: { value: '2.80', unit: 'm' }, scope: 'project', rationale: 'autre profil' }], { kind: 'market_profile', ref: 'o2' });
    expect(again.merged.items[0]!.value.value).toBe('3.00');
    expect(again.conflicts).toEqual([{ id: 'A-01', existing: '3.00', proposed: '2.80' }]);
  });
  it('changer de pack ne modifie ni le modèle, ni les hypothèses, ni le métré géométrique', () => {
    const runs = (['bj', 'sn', 'divergent'] as const).map((k) => runWith(catalog.resolve({ bj: 'pack.bj', sn: 'pack.sn', divergent: 'pack.test.divergent' }[k]), cellModel(), cellAssumptions(), { zoneId: ZONES[k] }));
    expect(new Set(runs.map((r) => r.takeoff.modelRev)).size).toBe(1);
    expect(new Set(runs.map((r) => r.takeoff.assumptionSetRev)).size).toBe(1);
    expect(new Set(runs.map((r) => r.takeoff.contentHash)).size).toBe(1);
    expect(runs.map((r) => r.assumptions.items[0]!.value.value)).toEqual(['3.00', '3.00', '3.00']);
  });
});
