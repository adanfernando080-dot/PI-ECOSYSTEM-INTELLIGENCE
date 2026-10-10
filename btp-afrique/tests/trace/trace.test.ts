import { describe, expect, it } from 'vitest';
import { hashOf } from '../../src/core/trace/canonical.js';
import { resolveChain, verifyRun } from '../../src/core/trace/chain.js';
import { explainLine, explainPrice, explainRequirement } from '../../src/core/trace/explain.js';
import { emitDocument } from '../../src/core/project/pipeline.js';
import type { Run } from '../../src/core/project/run.js';
import { cell, clone, house, type PackKey } from '../support/env.js';

function withDocs(r: Run): Run {
  const tpl = r.pack.documentTemplates.find((t) => t.layout === 'priced-lines')!;
  emitDocument(r, { templateId: tpl.id, number: 'N-1', date: '2026-10-08', status: 'draft' });
  return r;
}
const cloneRun = (r: Run): Run => clone(r);

describe('Chaîne de traçabilité : document → ligne → prix → catalogue → ouvrage → quantité → règle → géométrie → objet → version → plan', () => {
  it('CHAQUE ligne de CHAQUE document, pour les 3 marchés, se résout sans maillon manquant (T-TRC-01)', () => {
    for (const k of ['bj', 'sn', 'divergent'] as PackKey[]) {
      const r = withDocs(house(k)); const doc = r.documents[0]!;
      const ids = doc.content.sections.flatMap((s) => s.lines.map((l) => l.lineId));
      expect(ids.length).toBeGreaterThan(10);
      for (const id of ids) expect(resolveChain(r, doc, id).missing, `${k}/${id}`).toEqual([]);
      expect(verifyRun(r)).toEqual({ ok: true, problems: [] });
    }
  });
  it('cellule : la chaîne complète de la ligne de maçonnerie', () => {
    const r = withDocs(cell('bj')); const doc = r.documents[0]!;
    const c = resolveChain(r, doc, 'el:OUV.MAC.BLOC20');
    expect(c.missing).toEqual([]);
    expect(c.document).toMatchObject({ id: doc.id, kind: 'DQE', number: 'N-1', contentHash: doc.contentHash });
    expect(c.line).toMatchObject({ n: '1.1', quantity: '51.9', unitPrice: '9810', amount: '509139', unit: 'm2' });
    expect(c.price.map((p) => [p.item, p.unitPriceMinor, p.entryId])).toEqual([
      ['MAT.BLOC.20', '450', 'pe:bj:MAT.BLOC.20:BJ-LITTORAL-COTONOU'], ['MAT.CIMENT', '6000', 'pe:bj:MAT.CIMENT:BJ-LITTORAL-COTONOU'],
      ['MAT.SABLE', '12000', 'pe:bj:MAT.SABLE:BJ-LITTORAL-COTONOU'], ['MO.MACON', '1500', 'pe:bj:MO.MACON:BJ-LITTORAL-COTONOU']]);
    expect(c.price.every((p) => p.dataClass === 'synthetic/test' && p.source?.ref === 'TEST-DATA-DO-NOT-USE' && p.version === 'pb-bj-0.0.1')).toBe(true);
    expect(c.catalogue.map((x) => x.code)).toEqual(['MAT.BLOC.20', 'MAT.CIMENT', 'MAT.SABLE', 'MO.MACON']);
    expect(c.assembly).toMatchObject({ code: 'OUV.MAC.BLOC20', version: '1.0.0', lot: 'LOT01', unit: 'm2' });
    expect(c.assembly.hash).toMatch(/^sha256:/);
    expect(c.ouvrageQuantity).toMatchObject({ id: 'oq:OUV.MAC.BLOC20', theoretical: '51.9', quantity: '51.9' });
    expect(c.contributions.map((x) => x.entity.code)).toEqual(['W-E', 'W-N', 'W-S', 'W-W']);
    const south = c.contributions.find((x) => x.entity.code === 'W-S')!;
    expect(south.mapping).toEqual({ id: 'SM.MAC.BLOC20', version: '1.0.0' });
    expect(south.method).toMatchObject({ id: 'MM.TEST.NET', deduction: 'toutes les ouvertures déduites' });
    expect(south.geo.map((g) => [g.id, g.value, g.rule.id])).toEqual([['geo:w-s:wall.area.net', '12.9', 'geom.wall.area.net']]);
    expect(c.assumptionIds).toEqual(['A-01']);
    expect(c.model.rev).toBe(hashOf(r.model)); expect(c.planRevision.label).toMatch(/PLAN SYNTHÉTIQUE/);
    expect(c.binding).toMatchObject({ rev: r.binding.rev, packId: 'pack.bj', zoneId: 'BJ-LITTORAL-COTONOU', packResolvedHash: r.pack.resolution.resolvedHash });
  });
  it('altération détectée à CHAQUE maillon', () => {
    const base = withDocs(cell('bj'));
    const lineId = 'el:OUV.MAC.BLOC20';
    const probe = (mutate: (r: Run) => void): string[] => { const r = cloneRun(base); mutate(r); return resolveChain(r, r.documents[0]!, lineId).missing; };
    expect(probe(() => {})).toEqual([]);
    expect(probe((r) => { r.pack.priceBooks[0]!.entries[0]!.stat.median = '1'; }).join()).toMatch(/PriceBook introuvable ou empreinte différente/);
    expect(probe((r) => { r.pack.assemblies.find((a) => a.code === 'OUV.MAC.BLOC20')!.components[0]!.consumption = '99'; }).join()).toMatch(/assemblage OUV.MAC.BLOC20 introuvable ou modifié/);
    expect(probe((r) => { r.pack.specMappings.find((m) => m.id === 'SM.MAC.BLOC20')!.assembly = 'OUV.X'; }).join()).toMatch(/règle de correspondance SM.MAC.BLOC20 introuvable ou modifiée/);
    expect(probe((r) => { r.pack.measurementMethod.deductions['wall.area'] = { mode: 'gross' }; }).join()).toMatch(/méthode de mesurage modifiée/);
    expect(probe((r) => { r.takeoff.quantities = r.takeoff.quantities.filter((q) => q.id !== 'geo:w-s:wall.area.net'); }).join()).toMatch(/quantité géométrique geo:w-s:wall.area.net introuvable/);
    expect(probe((r) => { r.model.buildings[0]!.levels[0]!.walls = r.model.buildings[0]!.levels[0]!.walls.filter((w) => w.id !== 'w-s'); }).join()).toMatch(/objet architectural wall:w-s introuvable/);
    expect(probe((r) => { r.model.name = 'modifié'; }).join()).toMatch(/révision du modèle différente/);
    expect(probe((r) => { r.assumptions.items[0]!.value.value = '2.80'; }).join()).toMatch(/révision des hypothèses différente/);
    expect(probe((r) => { r.estimate.lines[0]!.amount = '1'; }).join()).toMatch(/estimation altérée/);
    expect(probe((r) => { r.documents[0]!.content.number = 'FRAUDE'; }).join()).toMatch(/empreinte du contenu du document invalide/);
    expect(probe((r) => { r.binding.rev = 'sha256:00'; }).join()).toMatch(/MarketBinding différent/);
    expect(probe((r) => { r.pack.resolution.resolvedHash = 'sha256:00'; }).join()).toMatch(/pack résolu différent/);
    expect(probe((r) => { r.pack.catalogue = r.pack.catalogue.filter((c) => c.code !== 'MAT.BLOC.20'); }).join()).toMatch(/article MAT.BLOC.20 absent du catalogue/);
  });
  it('verifyRun recalcule tout et détecte une estimation falsifiée', () => {
    const r = withDocs(house('bj'));
    expect(verifyRun(r).ok).toBe(true);
    const bad = cloneRun(r); bad.estimate.lines[3]!.amount = '42';
    expect(verifyRun(bad).problems.join()).toMatch(/estimation altérée/);
    const bad2 = cloneRun(r); bad2.model.buildings[0]!.levels[0]!.walls[0]!.thickness.value = '0.25';
    expect(verifyRun(bad2).problems.join()).toMatch(/non reproductible/);
  });
});

describe('« Pourquoi cette quantité vaut-elle X ? » — explication déterministe, générée uniquement depuis la trace', () => {
  const r = cell('bj');
  it('quantité d\'ouvrage : somme des murs, déduction des ouvertures, hypothèse de hauteur', () => {
    const t = explainLine(r, 'el:OUV.MAC.BLOC20').join('\n');
    expect(t).toMatch(/^Pourquoi 51.9 m2 pour « Maçonnerie de blocs creux de 20 cm » \(OUV.MAC.BLOC20@1.0.0\)/);
    expect(t).toMatch(/somme de 4 contribution\(s\) = 51.9 m2, arrondie à 2 décimale\(s\)/);
    expect(t).toMatch(/wall W-S \(classe masonry.block.hollow\) → correspondance SM.MAC.BLOC20@1.0.0 ; base « wall.area » ; méthode MM.TEST.NET@1.0.0 \(toutes les ouvertures déduites\) : 12.9 m2/);
    expect(t).toMatch(/geo:w-s:wall.area.net = 12.9 m2 {2}\[règle geom.wall.area.net@1.0.0\]/);
    expect(t).toMatch(/12.9 − 2.1|15 − 2.1/);
    expect(t).toMatch(/hauteur = 3 m \(hypothèse A-01\)/);
  });
  it('article à commander : théorique → pertes → arrondi de commande', () => {
    const t = explainRequirement(r, 'MAT.BLOC.20').join('\n');
    expect(t).toMatch(/Pourquoi 682 u de « Bloc creux 20 cm \[TEST\] »/);
    expect(t).toMatch(/Besoin théorique = 648.75 u ; avec pertes = 681.1875 u ; arrondi de commande \(ceil, 0 décimale\(s\)\) : 682 u/);
    expect(explainRequirement(r, 'MAT.CIMENT').join('\n')).toMatch(/OUV.MAC.BLOC20 → OUV.MORTIER.CIM/);
  });
  it('prix unitaire : composants, entrées de prix, couches de coût, arrondi', () => {
    const t = explainPrice(r, 'el:OUV.MAC.BLOC20').join('\n');
    expect(t).toMatch(/Prix unitaire 9810 XOF\/m2/); expect(t).toMatch(/valeur exacte avant arrondi : 9810.4776/);
    expect(t).toMatch(/MAT.BLOC.20 « Bloc creux 20 cm \[TEST\] » : 13.125 u\/m2 × 450 \(minor\) = 5906.25 {2}\[entrée pe:bj:MAT.BLOC.20:BJ-LITTORAL-COTONOU/);
    expect(t).toMatch(/Frais généraux : 955.566 \(taux 0.12 sur direct\)/); expect(t).toMatch(/Montant de ligne = 51.9 × 9810 = 509139 XOF/);
  });
  it('mêmes entrées => même texte, mot pour mot (aucun aléa, aucune IA)', () => {
    expect(explainLine(cell('bj'), 'el:OUV.MAC.BLOC20')).toEqual(explainLine(cell('bj'), 'el:OUV.MAC.BLOC20'));
    expect(explainLine(house('sn'), 'el:OUV.ENDUIT.INT')).toEqual(explainLine(house('sn'), 'el:OUV.ENDUIT.INT'));
  });
  it('seuil de déduction (SN) : l\'explication dit quelle ouverture est déduite ou conservée', () => {
    const t = explainLine(house('sn'), 'el:OUV.ENDUIT.INT').join('\n');
    expect(t).toMatch(/ouverture W-04 \(0.36 m²\) < seuil 0.5 m² : non déduite/); expect(t).toMatch(/ouverture D-03 \(1.89 m²\) ≥ seuil 0.5 m² : déduite/);
  });
  it('plancher de confiance affiché quand une entrée IA n\'est pas revue', () => {
    expect(explainLine(house('bj'), 'el:OUV.MAC.BLOC20').join('\n')).toMatch(/plancher de confiance 0.72 \(limité par o-w4.width\)/);
  });
  it('ligne ou article inconnu => erreur', () => {
    expect(() => explainLine(r, 'el:NOPE')).toThrow(); expect(() => explainRequirement(r, 'NOPE')).toThrow(); expect(() => explainPrice(r, 'el:NOPE')).toThrow();
  });
});
