import { describe, expect, it } from 'vitest';
import { hashOf } from '../../src/core/trace/canonical.js';
import { validateResolved } from '../../src/core/pack/validate.js';
import { catalog, cell, cellAssumptions, cellModel, clone, house, runWith, taxonomy, ZONES, PACK_IDS } from '../support/env.js';

describe('Métré commercial — étage 2 (pack BJ de test)', () => {
  const run = cell('bj');
  const ouv = (code: string) => run.quantitySet.ouvrages.find((o) => o.assembly.code === code)!;
  const req = (item: string) => run.quantitySet.requirements.find((r) => r.item === item)!;

  it('quantités d\'ouvrage : somme des contributions par mur (surfaces nettes), arrondie à 2 décimales', () => {
    const o = ouv('OUV.MAC.BLOC20');
    expect(o.contributions.map((c) => [c.entity.code, c.quantity.value])).toEqual([['W-E', '12'], ['W-N', '15'], ['W-S', '12.9'], ['W-W', '12']]);
    expect(o.theoretical).toBe('51.9'); expect(o.quantity).toBe('51.9');
    expect(o.contributions.every((c) => c.mapping.id === 'SM.MAC.BLOC20' && c.method.deduction === 'toutes les ouvertures déduites')).toBe(true);
    expect(ouv('OUV.PORTE.100').quantity).toBe('1');
    expect(run.quantitySet.ouvrages.map((o) => o.assembly.code)).toEqual(['OUV.MAC.BLOC20', 'OUV.PORTE.100']);   // ordre : lot puis code
  });
  it('besoins en articles : pertes puis arrondi de commande déclaré (blocs : plafond à l\'unité)', () => {
    const b = req('MAT.BLOC.20');
    expect([b.theoretical, b.orderedExact, b.quantity, b.unit]).toEqual(['648.75', '681.1875', '682', 'u']);
  });
  it('plusieurs unités : mortier m³ → ciment kg → sacs de 50 kg (commande arrondie au sac)', () => {
    const c = req('MAT.CIMENT');
    expect(c.unit).toBe('sac');
    expect([c.theoretical, c.orderedExact, c.quantity]).toEqual(['5.4495', '5.612985', '6']);   // 51,9 × 0,015 × 350 kg ÷ 50 ; × 1,03
    expect(c.contributions[0]!.path).toEqual(['OUV.MAC.BLOC20', 'OUV.MORTIER.CIM']);
    const s = req('MAT.SABLE');
    expect([s.theoretical, s.orderedExact, s.quantity, s.unit]).toEqual(['0.85635', '0.8991675', '0.9', 'm3']);
  });
  it('main-d\'œuvre et menuiserie', () => {
    expect(req('MO.MACON').quantity).toBe('41.52'); expect(req('MO.MENUISIER').quantity).toBe('2');
    expect(req('MENU.PORTE.100').quantity).toBe('1');
  });
  it('maison : tous les éléments sont mappés (couverture 100 %), plusieurs ouvrages/lots', () => {
    const h = house('bj');
    expect(h.quantitySet.unmapped).toEqual([]); expect(h.quantitySet.blocked).toEqual([]);
    expect(h.quantitySet.coverage.mapped).toBe(h.quantitySet.coverage.total);
    expect(h.quantitySet.ouvrages.map((o) => o.assembly.code)).toEqual([
      'OUV.DALLE.BA', 'OUV.MAC.BLOC10', 'OUV.MAC.BLOC20', 'OUV.CARRELAGE.MUR', 'OUV.CARRELAGE.SOL', 'OUV.ENDUIT.EXT', 'OUV.ENDUIT.INT', 'OUV.PEINT.MUR', 'OUV.PEINT.PLAFOND',
      'OUV.FEN.120', 'OUV.FEN.60', 'OUV.PORTE.100', 'OUV.PORTE.90', 'OUV.TOLE']);
    const q = (c: string): string => h.quantitySet.ouvrages.find((o) => o.assembly.code === c)!.quantity;
    expect(q('OUV.FEN.120')).toBe('3'); expect(q('OUV.FEN.60')).toBe('1'); expect(q('OUV.PORTE.100')).toBe('1'); expect(q('OUV.PORTE.90')).toBe('2');
    expect(q('OUV.CARRELAGE.SOL')).toBe('44.38');             // 28,13 + 9,5475 + 6,6975 = 44,375 -> 44,38 (demi vers le haut)
    expect(q('OUV.CARRELAGE.MUR')).toBe('28.95');             // salle d'eau seulement
    expect(q('OUV.ENDUIT.INT')).toBe('117.96');               // 55,14 + 33,87 + 28,95
    expect(q('OUV.PEINT.MUR')).toBe('89.01');                 // enduit intérieur − faïence : 55,14 + 33,87
    expect(q('OUV.DALLE.BA')).toBe('6.1');                    // 6,1008 m³
    expect(q('OUV.TOLE')).toBe('53.08');
    expect(q('OUV.MAC.BLOC10')).toBe('23.22');               // W08 : 3,5×3 − 1,89 = 8,61 ; W09 : 2,5×3 − 1,89 = 5,61 ; W10 : 3,0×3 = 9,00
  });
  it('maçonnerie par épaisseur : 20 cm (murs extérieurs) vs 10 cm (cloisons issues d\'hypothèses)', () => {
    const h = house('bj');
    const o10 = h.quantitySet.ouvrages.find((o) => o.assembly.code === 'OUV.MAC.BLOC10')!;
    expect(o10.contributions.map((c) => c.entity.code)).toEqual(['W08', 'W09', 'W10']);
    expect(o10.contributions.every((c) => c.specClass === 'masonry.block.hollow')).toBe(true);
    const o20 = h.quantitySet.ouvrages.find((o) => o.assembly.code === 'OUV.MAC.BLOC20')!;
    expect(o20.contributions).toHaveLength(7);
  });
  it('élément sans correspondance => unmapped_spec explicite, jamais de substitution silencieuse', () => {
    const mdl = clone(cellModel()); mdl.buildings[0]!.levels[0]!.walls[0]!.spec.system = 'masonry.brick.fired';
    const r = runWith(catalog.resolve('pack.bj'), mdl, cellAssumptions(), { zoneId: ZONES.bj });
    expect(r.quantitySet.unmapped).toEqual([{ entity: { type: 'wall', id: 'w-s', code: 'W-S' }, target: 'wall', class: 'masonry.brick.fired', reason: expect.stringMatching(/unmapped_spec/) }]);
    expect(r.quantitySet.ouvrages.find((o) => o.assembly.code === 'OUV.MAC.BLOC20')!.quantity).toBe('39');   // 12 + 15 + 12 : le mur sud n'est PAS compté
    expect(r.quantitySet.coverage).toEqual({ mapped: 4, total: 5 });
  });
  it('correspondance ambiguë => refusée (jamais choisie au hasard)', () => {
    const pack = clone(catalog.resolve('pack.bj'));
    pack.specMappings.push({ ...pack.specMappings.find((m) => m.id === 'SM.MAC.BLOC20')!, id: 'SM.MAC.DUP' });
    const r = runWith(pack, cellModel(), cellAssumptions(), { zoneId: ZONES.bj });
    expect(r.quantitySet.unmapped.length).toBe(4);
    expect(r.quantitySet.unmapped[0]!.reason).toMatch(/ambiguë/);
  });
  it('priorité explicite : lève l\'ambiguïté', () => {
    const pack = clone(catalog.resolve('pack.bj'));
    pack.specMappings.push({ ...pack.specMappings.find((m) => m.id === 'SM.MAC.BLOC20')!, id: 'SM.MAC.PRIO', priority: 5 });
    const r = runWith(pack, cellModel(), cellAssumptions(), { zoneId: ZONES.bj });
    expect(r.quantitySet.unmapped).toEqual([]);
    expect(r.quantitySet.ouvrages[0]!.contributions[0]!.mapping.id).toBe('SM.MAC.PRIO');
  });
  it('méthode de mesurage par seuil (SN) vs nette (BJ) : la petite fenêtre (0,36 m²) n\'est déduite que dans BJ', () => {
    const sdb = (k: 'bj' | 'sn'): string => house(k).quantitySet.ouvrages.find((o) => o.assembly.code === 'OUV.ENDUIT.INT')!.contributions.find((c) => c.entity.id === 'sp-sdb')!.quantity.value;
    expect(sdb('bj')).toBe('28.95');
    expect(sdb('sn')).toBe('29.31');   // 31,20 − 1,89 (porte déduite) ; W-04 (0,36 < 0,50) conservée
    const sn = house('sn').quantitySet.ouvrages[0]!.contributions.length; expect(sn).toBeGreaterThan(0);
    const c = house('sn').quantitySet.ouvrages.flatMap((o) => o.contributions).find((x) => x.entity.id === 'sp-sdb' && x.method.deduction.startsWith('seuil'))!;
    expect(c.steps.some((s) => s.op === 'keep' && /W-04/.test(s.expr))).toBe(true);
    expect(c.steps.some((s) => s.op === 'deduct' && /D-03/.test(s.expr))).toBe(true);
  });
  it('un ouvrage du pack SN surcharge celui du parent (13 blocs/m², pas 12,5)', () => {
    const r = cell('sn');
    const b = r.quantitySet.requirements.find((x) => x.item === 'MAT.BLOC.20')!;
    expect([b.theoretical, b.orderedExact, b.quantity]).toEqual(['674.7', '708.435', '709']);
  });
  it('validation de pack : cycle de sous-ouvrages, unité incohérente, base incompatible', () => {
    const p = clone(catalog.resolve('pack.bj'));
    p.assemblies.find((a) => a.code === 'OUV.MORTIER.CIM')!.components.push({ kind: 'assembly', ref: 'OUV.MAC.BLOC20', consumption: '1', unit: 'm2', per: 'm3' });
    expect(validateResolved(p, taxonomy).join()).toMatch(/cycle de sous-ouvrages/);
    const q = clone(catalog.resolve('pack.bj'));
    q.assemblies.find((a) => a.code === 'OUV.MAC.BLOC20')!.components[0]!.per = 'm3';
    expect(validateResolved(q, taxonomy).join()).toMatch(/« per » \(m3\)/);
    const w = clone(catalog.resolve('pack.bj'));
    w.assemblies.find((a) => a.code === 'OUV.MAC.BLOC20')!.components[0]!.unit = 'kg';
    expect(validateResolved(w, taxonomy).join()).toMatch(/incompatible avec l'unité de prix/);
    const b = clone(catalog.resolve('pack.bj'));
    b.specMappings.find((m) => m.id === 'SM.TOLE')!.assembly = 'OUV.MAC.BLOC20';
    expect(validateResolved(b, taxonomy).join()).toMatch(/exige une base/);
  });
  it('catalogue : chaque article est relié à une unité connue et chaque composant à un article de nature identique', () => {
    for (const k of Object.values(PACK_IDS)) expect(validateResolved(catalog.resolve(k), taxonomy), k).toEqual([]);
    const p = clone(catalog.resolve('pack.bj')); p.assemblies.find((a) => a.code === 'OUV.MAC.BLOC20')!.components[2]!.kind = 'material';
    expect(validateResolved(p, taxonomy).join()).toMatch(/est de nature labour/);
    void hashOf;
  });
});
