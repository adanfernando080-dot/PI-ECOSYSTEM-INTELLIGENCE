import { describe, expect, it } from 'vitest';
import { Dec } from '../../src/core/units/decimal.js';
import { hashOf } from '../../src/core/trace/canonical.js';
import { buildDocument, formatDocNumber, SYNTHETIC_BANNER } from '../../src/core/docs/document.js';
import { emitDocument } from '../../src/core/project/pipeline.js';
import { fmtMoney, renderMarkdown } from '../../src/adapters/render-text.js';
import { catalog, cell, cellAssumptions, cellModel, clone, house, runWith, ZONES } from '../support/env.js';

const dqe = (k: 'bj' | 'sn' | 'divergent' = 'bj', status: 'draft' | 'final' = 'final') => {
  const run = house(k);
  const tpl = run.pack.documentTemplates.find((t) => t.layout === 'priced-lines')!;
  const rule = run.pack.numberingRules.find((n) => n.kind === tpl.kind)!;
  return { run, doc: emitDocument(run, { templateId: tpl.id, number: formatDocNumber(rule, '2026-10-08', 1), date: '2026-10-08', status }) };
};

describe('DQE (premier document, sans interface)', () => {
  const { run, doc } = dqe('bj');
  it('numérotation fournie par le pack', () => {
    expect(doc.content.number).toBe('DQE-2026-0001');
    expect(dqe('sn').doc.content.number).toBe('DQE/2026/0001');
    expect(dqe('divergent').doc.content.number).toBe('BOQ/2026/001');
  });
  it('structure : lots dans l\'ordre du pack, numérotation i.j, désignations du pack', () => {
    expect(doc.content.sections.map((s) => s.lot.code)).toEqual(['LOT01', 'LOT02', 'LOT03', 'LOT04']);
    expect(doc.content.sections[0]!.lines.map((l) => l.n)).toEqual(['1.1', '1.2', '1.3']);
    expect(doc.content.title).toBe('Détail quantitatif estimatif (DQE)');
  });
  it('CALCULS corrects : chaque montant = arrondi(quantité × prix unitaire), sous-totaux et total cohérents', () => {
    let sum = Dec.ZERO;
    for (const s of doc.content.sections) {
      let sub = Dec.ZERO;
      for (const l of s.lines) { expect(Dec.parse(l.amount!).eq(Dec.parse(l.quantity).mul(Dec.parse(l.unitPrice!)).round(0)), l.lineId).toBe(true); sub = sub.add(Dec.parse(l.amount!)); }
      expect(s.subtotal).toBe(sub.toString()); sum = sum.add(sub);
    }
    expect(doc.content.totals.linesTotal).toBe(sum.toString());
    const tax = Dec.parse(doc.content.totals.layers[0]!.amount);
    expect(tax.eq(sum.mul(Dec.parse('0.18')).round(0))).toBe(true);
    expect(doc.content.totals.total).toBe(sum.add(tax).toString());
    expect(doc.content.totals.total).toBe(run.estimate.total);
  });
  it('le document est identifié comme SYNTHÉTIQUE (bannière + avis) et signale estimation paramétrique, valeurs IA non revues et hypothèses', () => {
    expect(doc.content.syntheticBanner).toBe(SYNTHETIC_BANNER);
    expect(doc.content.notices[0]).toBe(SYNTHETIC_BANNER);
    expect(doc.content.notices.join('\n')).toMatch(/estimation paramétrique/);
    expect(doc.content.notices.join('\n')).toMatch(/2 valeur\(s\) détectée\(s\) par IA non revue\(s\)/);
    expect(doc.content.annex.unreviewed.map((u) => `${u.code}.${u.attr}:${u.validation}:${u.confidence}`)).toEqual(['W-04.height:batch_accepted:0.72', 'W-04.width:batch_accepted:0.72']);
    expect(doc.content.annex.assumptions.map((a) => a.id)).toEqual(['A-01', 'A-02', 'A-03']);
    expect(doc.content.annex.priceAlerts.map((a) => a.alert).sort()).toEqual(['confiance du prix basse', "prix issu d'une zone parente", 'prix périmé']);
  });
  it('manifeste de provenance : versions identifiables (plan, modèle, hypothèses, MarketBinding, pack résolu, PriceBook, moteur)', () => {
    const m = doc.manifest;
    expect(m.format).toBe('btp-provenance');
    expect(m.modelRev).toBe(hashOf(run.model)); expect(m.assumptionSetRev).toBe(hashOf(run.assumptions)); expect(m.geoTakeoffHash).toBe(run.takeoff.contentHash);
    expect(m.planRevision.sourceDocumentHash).toBe(run.model.planRevision.sourceDocumentHash);
    expect(m.binding).toMatchObject({ rev: run.binding.rev, packId: 'pack.bj', packResolvedHash: run.pack.resolution.resolvedHash, zoneId: 'BJ-LITTORAL-COTONOU', priceBookHash: run.binding.priceBookHash, asOf: '2026-10-08' });
    expect(m.packChain.map((c) => c.id)).toEqual(['pack.test.base-xof', 'pack.bj']);
    expect(m.quantitySetHash).toBe(run.quantitySet.contentHash); expect(m.estimateHash).toBe(run.estimate.contentHash);
    expect(m.engine).toEqual({ version: '0.0.1-m0', apiVersion: '1' }); expect(m.dataClass).toBe('synthetic/test');
    expect(m.geometryRules.length).toBeGreaterThan(10); expect(m.contentHash).toBe(doc.contentHash);
    expect(doc.contentHash).toBe(hashOf(doc.content)); expect(doc.manifestHash).toBe(hashOf(doc.manifest)); expect(doc.id).toMatch(/^doc:[0-9a-f]{12}$/);
  });
  it('déterministe : même demande => même document ; autre numéro => autre contenu mais mêmes empreintes de calcul', () => {
    const a = buildDocument(run, { templateId: 'tpl.dqe.fr', number: 'X', date: '2026-10-08', status: 'draft' });
    const b = buildDocument(run, { templateId: 'tpl.dqe.fr', number: 'X', date: '2026-10-08', status: 'draft' });
    const c = buildDocument(run, { templateId: 'tpl.dqe.fr', number: 'Y', date: '2026-10-08', status: 'draft' });
    expect(a.id).toBe(b.id); expect(a.contentHash).not.toBe(c.contentHash);
    expect(a.manifest.estimateHash).toBe(c.manifest.estimateHash);
  });
  it('émission finale refusée avec des lignes sans prix (décision explicite requise)', () => {
    const h = (() => { const hr = house('bj'); hr.estimate.lines[0]!.status = 'unpriced'; hr.estimate.lines[0]!.amount = null; hr.estimate.lines[0]!.unitPrice = null; hr.estimate.lines[0]!.unpricedItems = ['MAT.X']; return hr; })();
    expect(() => buildDocument(h, { templateId: 'tpl.dqe.fr', number: 'N', date: '2026-10-08', status: 'final' })).toThrow(/Émission finale refusée/);
    const draft = buildDocument(h, { templateId: 'tpl.dqe.fr', number: 'N', date: '2026-10-08', status: 'draft' });
    expect(draft.content.notices.join()).toMatch(/non chiffré/); expect(draft.content.annex.unpriced[0]!.items).toEqual(['MAT.X']);
    expect(buildDocument(h, { templateId: 'tpl.dqe.fr', number: 'N', date: '2026-10-08', status: 'final', allowUnpriced: true }).content.status).toBe('final');
  });
  it('gabarit inconnu ou libellé manquant => erreur ; un devis exige émetteur et client', () => {
    expect(() => buildDocument(run, { templateId: 'nope', number: 'N', date: '2026-10-08', status: 'draft' })).toThrow(/Gabarit inconnu/);
    expect(() => buildDocument(run, { templateId: 'tpl.devis.fr', number: 'N', date: '2026-10-08', status: 'draft' })).toThrow(/émetteur et client/);
    const r2 = clone(run); r2.pack.documentTemplates[0]!.labels = { ...r2.pack.documentTemplates[0]!.labels }; delete (r2.pack.documentTemplates[0]!.labels as any).title;
    expect(() => buildDocument(r2, { templateId: r2.pack.documentTemplates[0]!.id, number: 'N', date: '2026-10-08', status: 'draft' })).toThrow(/libellé « title » manquant/);
  });
});

describe('Devis', () => {
  it('émetteur, client, chantier, validité, identifiants légaux du pack, HT / taxes / TTC', () => {
    const run = house('bj');
    const doc = emitDocument(run, { templateId: 'tpl.devis.fr', number: 'DEV-2026-0001', date: '2026-10-08', status: 'final',
      issuer: { name: 'ENTREPRISE TEST SARL', identifiers: { ifu: '0000000000000', rccm: 'RB/TEST/0000' } }, client: { name: 'CLIENT TEST' }, site: 'Chantier synthétique', validityDays: 45 });
    expect(doc.content.parties).toEqual({ issuer: { name: 'ENTREPRISE TEST SARL', identifiers: [{ label: 'IFU', value: '0000000000000' }, { label: 'RCCM', value: 'RB/TEST/0000' }] }, client: { name: 'CLIENT TEST' }, site: 'Chantier synthétique', validityDays: 45 });
    expect(doc.content.layout).toBe('quote');
    expect(Dec.parse(doc.content.totals.subtotalBeforeTax).add(Dec.parse(doc.content.totals.layers[0]!.amount)).toString()).toBe(doc.content.totals.total);
    expect(doc.manifest.documentKind).toBe('DEVIS'); expect(doc.manifest.binding.rev).toBe(run.binding.rev);
    const md = renderMarkdown(doc);
    expect(md).toMatch(/Total HT/); expect(md).toMatch(/Total TTC/); expect(md).toMatch(/ENTREPRISE TEST SARL/); expect(md).toMatch(/IFU 0000000000000/);
  });
  it('les identifiants légaux changent avec le pack (NINEA au lieu d\'IFU) sans toucher au moteur', () => {
    const run = house('sn');
    const doc = emitDocument(run, { templateId: 'tpl.devis.fr', number: 'DV/2026/0001', date: '2026-10-08', status: 'draft', issuer: { name: 'E', identifiers: { ninea: '000' } }, client: { name: 'C' } });
    expect(doc.content.parties!.issuer.identifiers).toEqual([{ label: 'NINEA', value: '000' }, { label: 'RCCM', value: '—' }]);
  });
  it('pack divergent : documents en anglais, taxes composées, autre devise', () => {
    const run = house('divergent');
    const doc = emitDocument(run, { templateId: 'tpl.quote.en', number: 'Q-2026-001', date: '2026-10-08', status: 'draft', issuer: { name: 'TEST LTD', identifiers: { taxId: 'T-0' } }, client: { name: 'C' } });
    expect(doc.content.title).toBe('Quotation'); expect(doc.content.language).toBe('en'); expect(doc.content.currency).toMatchObject({ code: 'TST', minorUnits: 2 });
    expect(doc.content.totals.layers.map((l) => l.id)).toEqual(['provisional', 'taxA', 'taxB']);
    expect(renderMarkdown(doc)).toMatch(/Total incl\. taxes/);
  });
});

describe('Rendu : aucun calcul, uniquement du formatage du DocumentModel', () => {
  it('formats monétaires selon les unités mineures de la devise du pack', () => {
    expect(fmtMoney('509139', 0, 'XOF')).toBe('509 139 XOF'); expect(fmtMoney('123450', 2, 'TST')).toBe('1 234.50 TST'); expect(fmtMoney('5', 2, 'TST')).toBe('0.05 TST');
    expect(fmtMoney('-1234567', 0, 'XOF')).toBe('-1 234 567 XOF'); expect(fmtMoney(null, 0, 'XOF')).toMatch(/non chiffré/);
  });
  it('toutes les valeurs du DocumentModel apparaissent dans le rendu, avec bannière et manifeste', () => {
    const { doc } = dqe('bj');
    const md = renderMarkdown(doc);
    for (const s of doc.content.sections) for (const l of s.lines) { expect(md).toContain(l.designation); expect(md).toContain(fmtMoney(l.amount, 0, 'XOF')); }
    expect(md).toContain(fmtMoney(doc.content.totals.total, 0, 'XOF')); expect(md.startsWith('> ⚠ **DONNÉES SYNTHÉTIQUES')).toBe(true);
    expect(md).toContain(doc.id); expect(md).toContain(doc.manifest.binding.packResolvedHash);
  });
});
