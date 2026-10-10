/**
 * SCÉNARIO GOLDEN n°1 — « une pièce, quatre murs, une ouverture ».
 * Toutes les valeurs ci-dessous sont des DONNÉES DE TEST synthétiques calculées À LA MAIN (aucune donnée réelle de marché).
 * Le test vérifie la valeur finale ET la trace de chaque maillon.
 *
 *   Plan (axes) : 5,00 × 4,00 m ; murs 0,20 m ; hauteur 3,00 m (hypothèse A-01) ; porte 1,00 × 2,10 dans le mur sud.
 *   Surface brute  = (5 + 4 + 5 + 4) × 3,00 = 54,00 m²        Ouverture = 1,00 × 2,10 = 2,10 m²        Surface nette = 51,90 m²
 *   Règle : 12,5 blocs/m² (+5 % de pertes) ; mortier 0,015 m³/m² (350 kg de ciment/m³ +3 %, 1,1 m³ de sable/m³ +5 %) ; 0,8 h de maçon/m²
 *   Blocs : 51,90 × 12,5 = 648,75 → × 1,05 = 681,1875 → arrondi de commande au plafond : 682
 *   Prix de test : bloc 450 ; ciment 6 000/sac de 50 kg ; sable 12 000/m³ ; maçon 1 500/h ; porte 85 000 ; menuisier 1 800/h
 *   PU maçonnerie = (5 906,25 + 648,90 + 207,90 + 1 200) × 1,12 × 1,10 = 9 810,4776 → 9 810 ; montant = 51,90 × 9 810 = 509 139
 *   Porte : (85 000 + 2 × 1 800) × 1,12 × 1,10 = 109 155,2 → 109 155 ; HT = 618 294 ; TVA de test 18 % = 111 292,92 → 111 293 ; TTC = 729 587
 */
import { describe, expect, it } from 'vitest';
import { emitDocument } from '../../src/core/project/pipeline.js';
import { resolveChain, verifyRun } from '../../src/core/trace/chain.js';
import { explainLine } from '../../src/core/trace/explain.js';
import { renderMarkdown } from '../../src/adapters/render-text.js';
import { cell } from '../support/env.js';
import { pinned } from '../support/golden.js';

describe('GOLDEN cellule — valeurs, puis trace, maillon par maillon', () => {
  const run = cell('bj');
  const doc = emitDocument(run, { templateId: 'tpl.dqe.fr', number: 'DQE-2026-0001', date: '2026-10-08', status: 'final' });
  const geo = (id: string) => run.takeoff.quantities.find((q) => q.id === id)!;

  it('1. MODÈLE → HYPOTHÈSE → GÉOMÉTRIE : surface brute, ouverture, surface nette du mur sud (valeurs ET trace)', () => {
    const gross = geo('geo:w-s:wall.area.gross'); const ops = geo('geo:w-s:wall.openings.area'); const net = geo('geo:w-s:wall.area.net'); const door = geo('geo:o-d1:opening.area');
    expect(gross.value).toBe('15'); expect(ops.value).toBe('2.1'); expect(net.value).toBe('12.9'); expect(door.value).toBe('2.1');
    expect(gross.trace.rule.id).toBe('geom.wall.area.gross'); expect(gross.trace.steps).toEqual([{ op: 'mul', expr: '5 × 3', result: '15', unit: 'm2' }]);
    expect(gross.trace.inputs.map((i) => [i.name, i.value, i.unit, i.source.type, i.source.assumptionId ?? null])).toEqual([['longueur', '5', 'm', 'geo', null], ['hauteur', '3', 'm', 'assumption', 'A-01']]);
    expect(door.trace.steps).toEqual([{ op: 'mul', expr: '1 × 2.1', result: '2.1', unit: 'm2' }]);
    expect(ops.trace.steps).toEqual([{ op: 'sum', expr: '2.1', result: '2.1', unit: 'm2' }]);
    expect(net.trace.rule.id).toBe('geom.wall.area.net'); expect(net.trace.steps).toEqual([{ op: 'sub', expr: '15 − 2.1', result: '12.9', unit: 'm2' }]);
    expect(net.trace.inputs.map((i) => i.source.id)).toEqual(['geo:w-s:wall.area.gross', 'geo:w-s:wall.openings.area']);
    expect(geo('geo:w-s:wall.length.axis').trace.steps.map((s) => s.result)).toEqual(['25', '5', '5']);
    // surface totale des 4 murs
    const sum = ['w-s', 'w-e', 'w-n', 'w-w'].map((w) => geo(`geo:${w}:wall.area.gross`).value);
    expect(sum).toEqual(['15', '12', '15', '12']);                                     // brut total 54
    expect(['w-s', 'w-e', 'w-n', 'w-w'].map((w) => geo(`geo:${w}:wall.area.net`).value)).toEqual(['12.9', '12', '15', '12']);   // net total 51,90
  });
  it('1b. la pièce (4 murs fermés) : surface libre, périmètre, surface murale', () => {
    expect(geo('geo:sp-1:space.clear.area').value).toBe('18.24');          // (5 − 0,20) × (4 − 0,20) = 4,8 × 3,8
    expect(geo('geo:sp-1:space.clear.perimeter').value).toBe('17.2');
    expect(geo('geo:sp-1:space.wall.area.gross').value).toBe('51.6');      // 17,2 × 3
    expect(geo('geo:sp-1:space.wall.area.net').value).toBe('49.5');        // − 2,10
  });
  it('2. SPÉCIFICATION NEUTRE → MÉTRÉ COMMERCIAL : règle de transformation, quantité d\'ouvrage, quantité commerciale', () => {
    const o = run.quantitySet.ouvrages[0]!;
    expect(o.assembly).toMatchObject({ code: 'OUV.MAC.BLOC20', version: '1.0.0' });
    expect(o.contributions.map((c) => [c.mapping.id, c.specClass, c.basis, c.quantity.value])).toEqual([
      ['SM.MAC.BLOC20', 'masonry.block.hollow', 'wall.area', '12'], ['SM.MAC.BLOC20', 'masonry.block.hollow', 'wall.area', '15'],
      ['SM.MAC.BLOC20', 'masonry.block.hollow', 'wall.area', '12.9'], ['SM.MAC.BLOC20', 'masonry.block.hollow', 'wall.area', '12']]);
    expect(o.quantity).toBe('51.9');
    const blocks = run.quantitySet.requirements.find((r) => r.item === 'MAT.BLOC.20')!;
    expect([blocks.theoretical, blocks.orderedExact, blocks.quantity]).toEqual(['648.75', '681.1875', '682']);
    expect(run.quantitySet.requirements.map((r) => [r.item, r.quantity, r.unit])).toEqual([
      ['MAT.BLOC.20', '682', 'u'], ['MAT.CIMENT', '6', 'sac'], ['MAT.SABLE', '0.9', 'm3'], ['MENU.PORTE.100', '1', 'u'], ['MO.MACON', '41.52', 'h'], ['MO.MENUISIER', '2', 'h']]);
  });
  it('3. MARKET BINDING → CATALOGUE → PRIX → DQE : prix unitaire, montant, totaux', () => {
    expect(run.binding).toMatchObject({ packId: 'pack.bj', zoneId: 'BJ-LITTORAL-COTONOU', priceBookId: 'pb.bj.test', asOf: '2026-10-08', priceStatistic: 'median', dataClass: 'synthetic/test' });
    const l = doc.content.sections[0]!.lines[0]!;
    expect(l).toMatchObject({ n: '1.1', designation: 'Maçonnerie de blocs creux de 20 cm', unit: 'm2', quantity: '51.9', unitPrice: '9810', amount: '509139' });
    expect(doc.content.sections[1]!.lines[0]).toMatchObject({ designation: 'Porte bois 100×210, pose comprise', quantity: '1', unitPrice: '109155', amount: '109155' });
    expect(doc.content.totals).toMatchObject({ linesTotal: '618294', subtotalBeforeTax: '618294', total: '729587' });
    expect(doc.content.totals.layers).toEqual([{ id: 'vat', label: 'TVA (taux de TEST)', amount: '111293', effect: 'tax' }]);
  });
  it('4. DOCUMENT FINAL → … → PLAN : chaîne complète, aucune rupture', () => {
    const c = resolveChain(run, doc, 'el:OUV.MAC.BLOC20');
    expect(c.missing).toEqual([]);
    expect([c.document.id, c.line.n, c.price.length, c.assembly.code, c.ouvrageQuantity.quantity, c.contributions.length, c.contributions[0]!.geo[0]!.rule.id, c.model.id, c.planRevision.sourceDocumentHash.slice(0, 7)])
      .toEqual([doc.id, '1.1', 4, 'OUV.MAC.BLOC20', '51.9', 4, 'geom.wall.area.net', 'model-cell', 'sha256:']);
    expect(verifyRun(run)).toEqual({ ok: true, problems: [] });
  });
  it('5. « Pourquoi cette quantité vaut-elle X ? » — explication déterministe jusqu\'aux attributs', () => {
    const t = explainLine(run, 'el:OUV.MAC.BLOC20').join('\n');
    for (const frag of ['Pourquoi 51.9 m2', 'W-S', '5 × 3 = 15 m2', '15 − 2.1 = 12.9 m2', 'hauteur = 3 m (hypothèse A-01)', 'SM.MAC.BLOC20@1.0.0', 'MM.TEST.NET@1.0.0']) expect(t).toContain(frag);
  });
  it('6. le document est marqué SYNTHÉTIQUE de bout en bout (document, manifeste, prix)', () => {
    expect(doc.content.syntheticBanner).toMatch(/SYNTHETIC TEST DATA/); expect(doc.manifest.dataClass).toBe('synthetic/test');
    expect(resolveChain(run, doc, 'el:OUV.MAC.BLOC20').price.every((p) => p.dataClass === 'synthetic/test')).toBe(true);
    expect(renderMarkdown(doc)).toContain('DONNÉES SYNTHÉTIQUES');
  });
  it('7. EMPREINTES épinglées (régression : toute dérive numérique ou de trace est détectée)', () => {
    pinned('cell.bj', { takeoff: run.takeoff.contentHash, quantitySet: run.quantitySet.contentHash, estimate: run.estimate.contentHash, dqe: doc.contentHash, manifest: doc.manifestHash,
      bindingRev: run.binding.rev, packResolved: run.pack.resolution.resolvedHash });
  });
});
