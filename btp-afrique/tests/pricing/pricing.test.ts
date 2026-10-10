import { describe, expect, it } from 'vitest';
import { Dec } from '../../src/core/units/decimal.js';
import { buildPriceStat } from '../../src/core/pricing/stats.js';
import { dayNumber, daysBetween } from '../../src/core/pricing/dates.js';
import { hashOf } from '../../src/core/trace/canonical.js';
import { catalog, cell, cellAssumptions, cellModel, clone, house, runWith, ZONES } from '../support/env.js';

describe('Prix — structure de données réelle, valeurs SYNTHÉTIQUES', () => {
  it('chaque entrée de prix porte article, unité, prix, devise, zone, date, source, version, confiance — et la marque synthetic/test', () => {
    for (const id of ['pack.bj', 'pack.sn', 'pack.test.divergent']) {
      const p = catalog.resolve(id);
      for (const e of p.priceBooks.flatMap((b) => b.entries)) {
        expect(e.item).toBeTruthy(); expect(e.unit).toBeTruthy(); expect(e.currency).toBe(p.currency.code); expect(e.zoneId).toBeTruthy();
        expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(e.source).toEqual({ type: 'synthetic', ref: 'TEST-DATA-DO-NOT-USE' });
        expect(e.version).toBeTruthy(); expect(Number(e.confidence)).toBeGreaterThan(0);
        expect(Object.keys(e.stat).sort()).toEqual(['max', 'mean', 'median', 'min', 'n']);
        expect(e.dataClass).toBe('synthetic/test');
      }
    }
  });
  it('cellule : prix unitaire de la maçonnerie reconstitué composant par composant (calcul à la main)', () => {
    const l = cell('bj').estimate.lines.find((x) => x.assembly.code === 'OUV.MAC.BLOC20')!;
    const byItem = Object.fromEntries(l.components.map((c) => [c.item, c]));
    expect(byItem['MAT.BLOC.20']).toMatchObject({ qtyPerUnit: '13.125', unitPriceMinor: '450', amountPerUnit: '5906.25' });          // 12,5 × 1,05 × 450
    expect(byItem['MAT.CIMENT']).toMatchObject({ qtyPerUnit: '0.10815', unit: 'sac', unitPriceMinor: '6000', amountPerUnit: '648.9' });   // 0,015 × 350 kg × 1,03 ÷ 50
    expect(byItem['MAT.SABLE']).toMatchObject({ qtyPerUnit: '0.017325', amountPerUnit: '207.9' });                                   // 0,015 × 1,1 × 1,05 × 12 000
    expect(byItem['MO.MACON']).toMatchObject({ qtyPerUnit: '0.8', amountPerUnit: '1200' });
    expect(l.directByKind).toEqual({ material: '6763.05', labour: '1200' });
    expect(l.layers.map((x) => [x.id, x.amount])).toEqual([['direct', '7963.05'], ['overheads', '955.566'], ['margin', '891.8616']]);
    expect(l.sellingUnitExact).toBe('9810.4776');
    expect(l.unitPrice).toBe('9810'); expect(l.amount).toBe('509139');                      // 51,90 × 9 810
  });
  it('cellule : totaux — porte, total des postes, TVA de test, TTC', () => {
    const e = cell('bj').estimate;
    expect(e.lines.find((x) => x.assembly.code === 'OUV.PORTE.100')).toMatchObject({ unitPrice: '109155', amount: '109155' });   // (85 000 + 2 × 1 800) × 1,12 × 1,10 = 109 155,2
    expect([e.linesTotal, e.totalLayers[0]!.amount, e.total, e.subtotalBeforeTax]).toEqual(['618294', '111293', '729587', '618294']);   // TVA 18 % = 111 292,92
  });
  it('chaque composant référence son entrée de prix (zone, date, source, version, confiance)', () => {
    const c = cell('bj').estimate.lines[0]!.components[0]!;
    expect(c.price).toMatchObject({ entryId: 'pe:bj:MAT.BLOC.20:BJ-LITTORAL-COTONOU', zoneId: 'BJ-LITTORAL-COTONOU', level: 'zone', date: '2026-09-15', version: 'pb-bj-0.0.1', confidence: '0.80', dataClass: 'synthetic/test', stat: 'median' });
  });
  it('repli de zone, péremption et confiance basse sont SIGNALÉS (acier connu seulement au niveau parent)', () => {
    const e = house('bj').estimate;
    const slab = e.lines.find((l) => l.assembly.code === 'OUV.DALLE.BA')!;
    const steel = slab.components.find((c) => c.item === 'MAT.ACIER')!;
    expect(steel.price).toMatchObject({ zoneId: 'BJ', level: 'parent', stale: true, lowConfidence: true, ageDays: 249 });
    expect(slab.flags).toEqual(['low_confidence_price', 'parametric_structural', 'price_from_parent_zone', 'stale_price']);
    expect(e.flags).toContain('stale_price');
  });
  it('prix manquant => ligne « unpriced », JAMAIS 0 ; exclue du total', () => {
    const pack = clone(catalog.resolve('pack.bj'));
    pack.priceBooks[0]!.entries = pack.priceBooks[0]!.entries.filter((e) => e.item !== 'MAT.BLOC.20');
    const r = runWith(pack, cellModel(), cellAssumptions(), { zoneId: ZONES.bj });
    const l = r.estimate.lines.find((x) => x.assembly.code === 'OUV.MAC.BLOC20')!;
    expect(l).toMatchObject({ status: 'unpriced', unitPrice: null, amount: null, unpricedItems: ['MAT.BLOC.20'] });
    expect(l.flags).toContain('unpriced');
    expect(r.estimate.linesTotal).toBe('109155');                                           // seule la porte
  });
  it('statistique de prix choisie par le MarketBinding (médiane par défaut, max sur demande)', () => {
    const med = cell('bj').estimate.lines[0]!.unitPrice!;
    const mx = runWith(catalog.resolve('pack.bj'), cellModel(), cellAssumptions(), { zoneId: ZONES.bj, priceStatistic: 'max' }).estimate.lines[0]!;
    expect(Number(mx.unitPrice)).toBeGreaterThan(Number(med));
    expect(mx.components[0]!.unitPriceMinor).toBe('495');                                    // 450 × 1,10
  });
  it('SÉPARATION quantités / prix : modifier un prix ne change AUCUNE quantité (T-PRC-03)', () => {
    const a = house('bj');
    const pack = clone(catalog.resolve('pack.bj')); pack.priceBooks[0]!.entries.forEach((e) => { e.stat.median = String(Number(e.stat.median) * 2); });
    const b = runWith(pack, houseModelClone(), houseAssumptionsClone(), { zoneId: ZONES.bj });
    expect(hashOf(b.quantitySet.ouvrages)).toBe(hashOf(a.quantitySet.ouvrages));
    expect(hashOf(b.quantitySet.requirements)).toBe(hashOf(a.quantitySet.requirements));
    expect(b.takeoff.contentHash).toBe(a.takeoff.contentHash);
    expect(b.estimate.contentHash).not.toBe(a.estimate.contentHash);
  });
  it('autre devise (2 décimales) et unités impériales/commerciales : conversions exactes, montants en unités mineures', () => {
    const d = house('divergent').estimate;
    expect(d.currency).toEqual({ code: 'TST', minorUnits: 2 });
    for (const l of d.lines) { expect(l.amount).toMatch(/^\d+$/); expect(l.unitPrice).toMatch(/^\d+$/); }
    const sand = d.lines.find((l) => l.assembly.code === 'D.MASONRY.4')!.components.find((c) => c.item === 'D.SAND')!;
    expect(sand.unit).toBe('cuyd'); expect(sand.qtyPerUnit.startsWith('0.0261')).toBe(true);        // 0,02 m³ ÷ 0,764554857984 m³/yd³
    const tile = d.lines.find((l) => l.assembly.code === 'D.TILE.FLOOR')!.components.find((c) => c.item === 'D.TILE')!;
    expect(tile.unit).toBe('sqft'); expect(tile.qtyPerUnit).toBe('11.625012');                      // 10,7639 × 1,08
  });
  it('structure de coût du pack divergent : provisions et taxes COMPOSÉES (taxe B calculée sur lignes + provision + taxe A)', () => {
    const e = house('divergent').estimate;
    const prov = Dec.parse(e.totalLayers.find((l) => l.id === 'provisional')!.amount); const taxA = Dec.parse(e.totalLayers.find((l) => l.id === 'taxA')!.amount); const taxB = Dec.parse(e.totalLayers.find((l) => l.id === 'taxB')!.amount);
    const lines = Dec.parse(e.linesTotal);
    expect(prov.toString()).toBe('250000');                                                  // 2 500,00 en unités mineures
    expect(taxA.eq(lines.add(prov).mul(Dec.parse('0.10')).round(0))).toBe(true);
    expect(taxB.eq(lines.add(prov).add(taxA).mul(Dec.parse('0.05')).round(0))).toBe(true);
    expect(Dec.parse(e.total).eq(lines.add(prov).add(taxA).add(taxB))).toBe(true);
    expect(Dec.parse(e.subtotalBeforeTax).eq(lines.add(prov).add(taxA).add(taxB))).toBe(false); // « avant taxes » exclut A et B
    expect(e.subtotalBeforeTax).toBe(lines.add(prov).toString());
  });
  it('arithmétique de chaque ligne vérifiable : montant = arrondi(quantité × prix unitaire affiché)', () => {
    for (const k of ['bj', 'sn', 'divergent'] as const) for (const l of house(k).estimate.lines) {
      expect(Dec.parse(l.amount!).eq(Dec.parse(l.quantity).mul(Dec.parse(l.unitPrice!)).round(0)), `${k}/${l.id}`).toBe(true);
    }
  });
});

describe('Statistiques et confiance des prix (formule publiée, T-PRC-05)', () => {
  const P = { nFull: 5, halfLifeDays: 180, maxDispersionPenalty: '0.5' };
  it('min / médiane / moyenne / max / n', () => {
    const s = buildPriceStat([400, 450, 450, 500, 600].map((a) => ({ amountMinor: String(a), date: '2026-10-08', sourceReliability: '1' })), '2026-10-08', P);
    expect([s.min, s.median, s.mean, s.max, s.n]).toEqual(['400', '450', '480', '600', 5]);
    const even = buildPriceStat([100, 200].map((a) => ({ amountMinor: String(a), date: '2026-10-08', sourceReliability: '1' })), '2026-10-08', P);
    expect(even.median).toBe('150');
  });
  it('confiance maximale : 5 observations identiques, même jour, source fiable', () => {
    const s = buildPriceStat(Array.from({ length: 5 }, () => ({ amountMinor: '1000', date: '2026-10-08', sourceReliability: '1' })), '2026-10-08', P);
    expect(s.confidence).toBe('1');
  });
  it('cas calculé à la main : 2 observations (900, 1100), fiabilité 0,8, âge 180 j => 0,8 × 0,4 × 0,5 × 0,8 = 0,128', () => {
    const s = buildPriceStat([900, 1100].map((a) => ({ amountMinor: String(a), date: '2026-04-11', sourceReliability: '0.8' })), '2026-10-08', P);
    expect(daysBetween('2026-04-11', '2026-10-08')).toBe(180);
    expect(s.median).toBe('1000'); expect(s.confidence).toBe('0.128');
  });
  it('la confiance décroît avec l\'âge et la dispersion ; aucune observation => erreur', () => {
    const mk = (date: string, amounts: number[]) => buildPriceStat(amounts.map((a) => ({ amountMinor: String(a), date, sourceReliability: '1' })), '2026-10-08', P);
    expect(Number(mk('2026-10-08', [1000, 1000, 1000, 1000, 1000]).confidence)).toBeGreaterThan(Number(mk('2026-01-01', [1000, 1000, 1000, 1000, 1000]).confidence));
    expect(Number(mk('2026-10-08', [1000, 1000, 1000, 1000, 1000]).confidence)).toBeGreaterThan(Number(mk('2026-10-08', [500, 800, 1000, 1500, 2000]).confidence));
    expect(() => buildPriceStat([], '2026-10-08', P)).toThrow();
  });
  it('dates calendaires pures', () => {
    expect(dayNumber('1970-01-01')).toBe(0); expect(dayNumber('2000-03-01') - dayNumber('2000-02-28')).toBe(2);   // bissextile
    expect(daysBetween('2026-02-01', '2026-10-08')).toBe(249);
    expect(() => dayNumber('2026-13-01')).toThrow();
  });
});

import { houseAssumptions, houseModel } from '../support/env.js';
const houseModelClone = () => houseModel();
const houseAssumptionsClone = () => houseAssumptions();
