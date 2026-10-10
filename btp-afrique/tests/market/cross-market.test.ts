/**
 * TEST D'ÉTANCHÉITÉ MARCHÉ — le même projet architectural est chiffré avec le pack Bénin, le pack Sénégal et un pack factice DIVERGENT.
 * Le moteur architectural et le moteur géométrique doivent produire EXACTEMENT le même résultat ; seules les étapes de marché changent.
 */
import { describe, expect, it } from 'vitest';
import { hashOf } from '../../src/core/trace/canonical.js';
import { signHash, TEST_KEY_ID } from '../../src/adapters/signature.js';
import { resolvePack, packContentHash } from '../../src/core/pack/resolve.js';
import { validateResolved } from '../../src/core/pack/validate.js';
import { emitDocument } from '../../src/core/project/pipeline.js';
import { verifyRun } from '../../src/core/trace/chain.js';
import { checkPackIsolation } from '../../tools/check-pack-isolation.js';
import { engineSourceHash } from '../../src/adapters/fs.js';
import type { PackData } from '../../src/core/pack/types.js';
import { ROOT, catalog, clone, house, houseAssumptions, houseModel, runWith, taxonomy, ZONES, type PackKey } from '../support/env.js';

const KEYS: PackKey[] = ['bj', 'sn', 'divergent'];
const runs = Object.fromEntries(KEYS.map((k) => [k, house(k)])) as Record<PackKey, ReturnType<typeof house>>;

describe('Même projet, trois marchés : ce qui NE change PAS', () => {
  it('modèle architectural, hypothèses et métré géométrique : identiques au hash près', () => {
    expect(new Set(KEYS.map((k) => runs[k].takeoff.modelRev)).size).toBe(1);
    expect(new Set(KEYS.map((k) => runs[k].takeoff.assumptionSetRev)).size).toBe(1);
    expect(new Set(KEYS.map((k) => runs[k].takeoff.contentHash)).size).toBe(1);
    expect(JSON.stringify(runs.bj.takeoff.quantities)).toBe(JSON.stringify(runs.divergent.takeoff.quantities));
    expect(hashOf(runs.bj.model)).toBe(hashOf(runs.sn.model));
    expect(runs.bj.engine).toEqual(runs.divergent.engine);
  });
});

describe('Même projet, trois marchés : ce qui change (et seulement cela)', () => {
  it('métré commercial, structure de coût, devise, unités, documents : propres à chaque pack', () => {
    expect(new Set(KEYS.map((k) => runs[k].quantitySet.contentHash)).size).toBe(3);
    expect(new Set(KEYS.map((k) => runs[k].estimate.contentHash)).size).toBe(3);
    expect(KEYS.map((k) => runs[k].estimate.currency)).toEqual([{ code: 'XOF', minorUnits: 0 }, { code: 'XOF', minorUnits: 0 }, { code: 'TST', minorUnits: 2 }]);
    expect(runs.bj.estimate.lines[0]!.layers.map((l) => l.id)).toEqual(['direct', 'overheads', 'margin']);
    expect(runs.divergent.estimate.lines[0]!.layers.map((l) => l.id)).toEqual(['direct', 'contingency', 'profit']);
    expect(runs.bj.estimate.totalLayers.map((l) => l.id)).toEqual(['vat']); expect(runs.divergent.estimate.totalLayers.map((l) => l.id)).toEqual(['provisional', 'taxA', 'taxB']);
    const kinds = KEYS.map((k) => emitDocument(runs[k], { templateId: runs[k].pack.documentTemplates[0]!.id, number: 'N', date: '2026-10-08', status: 'draft' }).content.kind);
    expect(kinds).toEqual(['DQE', 'DQE', 'BOQ']);
  });
  it('mêmes éléments, quantités de marché différentes : maçonnerie 20 cm (net/seuil/brut) et surcharge d\'ouvrage', () => {
    const q = (k: PackKey, code: string): string => runs[k].quantitySet.ouvrages.find((o) => o.assembly.code === code)!.quantity;
    // murs extérieurs : (5+3+3,5+2,5+3+5+6) × 3 = 84 m² bruts ; ouvertures 2,10 + 1,44×3 + 0,36 = 6,78 m²
    expect([q('bj', 'OUV.MAC.BLOC20'), q('sn', 'OUV.MAC.BLOC20')]).toEqual(['77.22', '77.58']);   // BJ : tout déduit ; SN : la fenêtre de 0,36 m² (< seuil 0,50) n'est pas déduite
    expect(q('divergent', 'D.MASONRY.8')).toBe('84');                                              // « gross » : aucune déduction
    const b = (k: PackKey): string => runs[k].quantitySet.requirements.find((r) => r.item === 'MAT.BLOC.20')?.quantity ?? '-';
    expect(Number(b('sn'))).toBeGreaterThan(Number(b('bj')));
  });
  it('le pack divergent exerce les conversions d\'unités impériales/commerciales sans toucher au moteur', () => {
    const r = runs.divergent.quantitySet.requirements;
    expect(r.find((x) => x.item === 'D.SAND')!.unit).toBe('cuyd'); expect(r.find((x) => x.item === 'D.TILE')!.unit).toBe('sqft'); expect(r.find((x) => x.item === 'D.CEMENT')!.unit).toBe('bag');
    expect(verifyRun(runs.divergent).ok).toBe(true);
  });
});

describe('Ajouter un pack ne doit EXIGER aucune modification du moteur', () => {
  const rawDivergent = (): PackData => clone([...catalog.raw.values()].find((p) => p.id === 'pack.test.divergent')!);
  const finalize = (p: PackData): PackData => { const { contentHash: _a, signature: _b, ...rest } = p; const h = packContentHash(rest as PackData); return { ...rest, contentHash: h, signature: { keyId: TEST_KEY_ID, alg: 'ed25519', value: signHash(h) } } as PackData; };

  it('un NOUVEAU pack, construit à l\'exécution (autre devise à 3 décimales, autres zones, autres taux, autre structure), se charge et chiffre avec le moteur INCHANGÉ', () => {
    const engineBefore = engineSourceHash(ROOT);
    const p = rawDivergent();
    p.id = 'pack.dynamic'; p.version = '9.9.9-synthetic';
    p.currency = { code: 'DYN', minorUnits: 3, symbol: 'Ð', name: 'Dyn (test)' };
    const zmap: Record<string, string> = { REALM: 'Z0', 'REALM-P1': 'Z1', 'REALM-P1-D1': 'Z2', 'REALM-P1-D1-T1': 'Z3' };
    p.zoneTree = p.zoneTree!.map((z) => ({ ...z, id: zmap[z.id]!, parent: z.parent ? zmap[z.parent]! : null, type: 'level-' + zmap[z.id]! }));
    p.priceBooks = p.priceBooks!.map((b) => ({ ...b, id: 'pb.dynamic', currency: 'DYN', entries: b.entries.map((e) => ({ ...e, id: e.id.replace('pe:div', 'pe:dyn'), zoneId: zmap[e.zoneId]!, currency: 'DYN' })) }));
    p.params = { ...p.params, taxARate: '0.07', taxBRate: '0.03', provisionalSum: '1000' };
    p.costBuildUp = [...p.costBuildUp!.slice(0, 3), { id: 'levy', label: 'Levy', kind: 'percent', scope: 'total', base: ['lines'], rate: { param: 'taxARate' }, effect: 'tax' }];
    p.rounding = { ...p.rounding!, lineAmount: { scale: 0, mode: 'ceil' } };
    p.documentTemplates = p.documentTemplates!.map((t) => ({ ...t, id: t.id.replace('tpl.', 'tpl.dyn.') }));
    const signed = finalize(p);
    const raw = new Map(catalog.raw); raw.set(`${signed.id}@${signed.version}`, signed);
    const resolved = resolvePack(signed, raw);
    expect(validateResolved(resolved, taxonomy)).toEqual([]);
    const run = runWith(resolved, houseModel(), houseAssumptions(), { zoneId: 'Z3' });
    expect(run.estimate.currency).toEqual({ code: 'DYN', minorUnits: 3 });
    expect(run.takeoff.contentHash).toBe(runs.bj.takeoff.contentHash);           // la géométrie est inchangée
    expect(run.estimate.totalLayers.map((l) => l.id)).toEqual(['levy']);
    expect(engineSourceHash(ROOT)).toBe(engineBefore);                            // aucun fichier du moteur n'a changé
    expect(verifyRun(run).ok).toBe(true);
  });
  it('TOUS les packs du dépôt (sauf le socle) valident et chiffrent le projet de référence sans exception', () => {
    const ids = [...catalog.raw.values()].filter((p) => p.zoneTree && p.priceBooks).map((p) => p.id);
    expect(ids.sort()).toEqual(['pack.bj', 'pack.sn', 'pack.test.divergent']);
    for (const id of ids) {
      const resolved = catalog.resolve(id); expect(validateResolved(resolved, taxonomy), id).toEqual([]);
      const zone = resolved.zoneTree.filter((z) => !resolved.zoneTree.some((c) => c.parent === z.id))[0]!.id;
      const r = runWith(resolved, houseModel(), houseAssumptions(), { zoneId: zone });
      expect(r.estimate.lines.every((l) => l.status === 'priced'), id).toBe(true);
      expect(r.takeoff.contentHash, id).toBe(runs.bj.takeoff.contentHash);
    }
    expect(Object.values(ZONES)).toHaveLength(3);
  });
  it('un pack qui aurait BESOIN d\'une fonctionnalité absente du moteur est refusé explicitement (vocabulaire fermé) — signal qu\'une évolution du moteur, par ADR, est nécessaire', () => {
    const mutate = (f: (p: ReturnType<typeof catalog.resolve>) => void): string => { const r = clone(catalog.resolve('pack.test.divergent')); f(r); return validateResolved(r, taxonomy).join('\n'); };
    expect(mutate((r) => { (r.costBuildUp[1] as any).kind = 'compound_interest'; })).toMatch(/hors du vocabulaire declarative-1.*évolution du moteur/);
    expect(mutate((r) => { (r.costBuildUp[1] as any).scope = 'phase'; })).toMatch(/portée « phase »/);
    expect(mutate((r) => { (r.specMappings[0] as any).target = 'foundation'; })).toMatch(/cible « foundation »/);
    expect(mutate((r) => { (r.assemblies[0]!.components[0] as any).kind = 'subcontractor'; })).toMatch(/composant de nature « subcontractor »/);
    expect(mutate((r) => { (r.measurementMethod.deductions['wall.area'] as any).mode = 'volumetric'; })).toMatch(/déduction « wall.area » de mode « volumetric »/);
    expect(mutate((r) => { (r.documentTemplates[0] as any).layout = 'gantt'; })).toMatch(/disposition « gantt »/);
    expect(mutate((r) => { r.rounding.unitPrice.mode = 'bankers' as any; })).toMatch(/arrondi « unitPrice »/);
  });
  it('garde-fou de CI : un changement qui touche packs ET moteur est refusé sans ADR ; packs seuls ou moteur seul : acceptés', () => {
    const packOnly = ['market-packs/ci/pack.json', 'tests/market/ci/ci.test.ts'];
    expect(checkPackIsolation(packOnly)).toMatchObject({ ok: true, violations: [] });
    expect(checkPackIsolation(['src/core/geometry/takeoff.ts', 'docs/x.md']).ok).toBe(true);
    const both = [...packOnly, 'src/core/pricing/estimate.ts'];
    const r = checkPackIsolation(both, ['feat: pack Côte d\'Ivoire']);
    expect(r.ok).toBe(false); expect(r.violations[0]).toMatch(/ajouter un marché ne doit pas exiger de modifier le moteur/);
    expect(checkPackIsolation(both, ['feat: pack CI\n\nENGINE-CHANGE: ADR-0021']).ok).toBe(true);
    expect(checkPackIsolation(['market-packs/x/pack.json', 'taxonomy/spec-taxonomy.json']).ok).toBe(false);
    expect(checkPackIsolation(['tools/gen-packs.ts', 'src/core/units/units.ts']).ok).toBe(false);
  });
});
