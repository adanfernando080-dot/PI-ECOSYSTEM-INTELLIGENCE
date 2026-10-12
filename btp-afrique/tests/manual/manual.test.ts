import { describe, expect, it } from 'vitest';
import { Dec } from '../../src/core/units/decimal.js';
import { hashOf } from '../../src/core/trace/canonical.js';
import { applyOperation, stateRev, undoOperation, type Hlc, type ProjectState } from '../../src/core/ops/oplog.js';
import { validateManual, type ManualEntries, type ManualLine, type QuantityAdjustment } from '../../src/core/manual/manual.js';
import { buildDocument } from '../../src/core/docs/document.js';
import { resolveChain, verifyRun } from '../../src/core/trace/chain.js';
import { explainLine } from '../../src/core/trace/explain.js';
import { createBundle, verifyBundle } from '../../src/core/project/bundle.js';
import { emitDocument } from '../../src/core/project/pipeline.js';
import { renderMarkdown } from '../../src/adapters/render-text.js';
import { catalog, cellAssumptions, cellModel, clone, houseAssumptions, houseModel, runWith, ZONES } from '../support/env.js';
import { m } from '../../fixtures/synthetic/common.js';

const hlc = (n: number): Hlc => ({ wall: 2000 + n, counter: 0, node: 'dev-test' });
const adj = (o: Partial<QuantityAdjustment> = {}): QuantityAdjustment => ({ id: 'AJ-1', target: 'oq:OUV.MAC.BLOC20', mode: 'delta', value: '2', author: 'métreur.test', date: '2026-10-12', justification: 'Reprise du mur pignon non dessiné sur le plan', ...o });
const line = (o: Partial<ManualLine> = {}): ManualLine => ({ id: 'ML-1', lot: 'LOT01', designation: 'Installation de chantier (forfait)', unit: 'u', quantity: '1', unitPrice: '150000', author: 'métreur.test', date: '2026-10-12', justification: 'Forfait convenu avec le client, hors plan', ...o });
const price = (manual: ManualEntries, k: 'bj' | 'divergent' = 'bj') =>
  runWith(catalog.resolve(k === 'bj' ? 'pack.bj' : 'pack.test.divergent'), cellModel(), cellAssumptions(), { zoneId: ZONES[k] }, { manual });
const mason = (r: ReturnType<typeof price>) => r.estimate.lines.find((l) => l.assembly.code === 'OUV.MAC.BLOC20')!;

describe('Ajustements de quantité traçables', () => {
  it('delta : la quantité du moteur est CONSERVÉE, la quantité retenue pilote prix, articles et document', () => {
    const r = price({ adjustments: [adj()], lines: [] });
    const o = r.quantitySet.ouvrages.find((x) => x.assembly.code === 'OUV.MAC.BLOC20')!;
    expect([o.engineQuantity, o.quantity, o.theoretical]).toEqual(['51.9', '53.9', '51.9']);
    expect(o.adjustments[0]).toMatchObject({ id: 'AJ-1', before: '51.9', after: '53.9', author: 'métreur.test' });
    expect(mason(r)).toMatchObject({ quantity: '53.9', amount: '528759', flags: ['manual_adjustment'] });      // 53,9 × 9 810
    expect(r.quantitySet.requirements.find((x) => x.item === 'MAT.BLOC.20')!.quantity).toBe('708');            // 53,9 × 12,5 = 673,75 ; × 1,05 = 707,4375 ; plafond = 708
  });
  it('override : remplace la quantité ; arrondi de l\'ouvrage appliqué', () => {
    const r = price({ adjustments: [adj({ mode: 'override', value: '60.126' })], lines: [] });
    const o = r.quantitySet.ouvrages[0]!;
    expect([o.engineQuantity, o.quantity]).toEqual(['51.9', '60.13']);
  });
  it('plusieurs ajustements s\'enchaînent dans l\'ordre de saisie', () => {
    const r = price({ adjustments: [adj({ id: 'A1', value: '2' }), adj({ id: 'A2', mode: 'override', value: '40' }), adj({ id: 'A3', value: '-0.5' })], lines: [] });
    const o = r.quantitySet.ouvrages[0]!;
    expect(o.adjustments.map((a) => [a.id, a.before, a.after])).toEqual([['A1', '51.9', '53.9'], ['A2', '53.9', '40'], ['A3', '40', '39.5']]);
    expect(o.quantity).toBe('39.5');
  });
  it('la géométrie n\'est JAMAIS modifiée par un ajustement', () => {
    const base = price({ adjustments: [], lines: [] }); const r = price({ adjustments: [adj()], lines: [] });
    expect(r.takeoff.contentHash).toBe(base.takeoff.contentHash);
    expect(r.takeoff.quantities.find((q) => q.id === 'geo:w-s:wall.area.net')!.value).toBe('12.9');
  });
  it('ajustement orphelin (ouvrage absent) ou négatif : NON appliqué mais signalé, jamais perdu', () => {
    const r = price({ adjustments: [adj({ id: 'AJ-X', target: 'oq:OUV.TOLE' }), adj({ id: 'AJ-N', mode: 'override', value: '-3' })], lines: [] });
    expect(r.quantitySet.orphanAdjustments.map((o) => [o.adjustment.id, o.reason])).toEqual([['AJ-X', expect.stringMatching(/absent du métré/)], ['AJ-N', expect.stringMatching(/négative/)]]);
    expect(mason(r).quantity).toBe('51.9');
    const d = buildDocument(r, { templateId: 'tpl.dqe.fr', number: 'N', date: '2026-10-12', status: 'draft' });
    expect(d.content.notices.join()).toMatch(/2 ajustement\(s\) manuel\(s\) NON appliqué\(s\)/);
    expect(d.content.annex.manual.orphans.map((o) => o.id)).toEqual(['AJ-X', 'AJ-N']);
  });
  it('justification, auteur et date OBLIGATOIRES ; cible et valeur valides', () => {
    const e = validateManual({ adjustments: [adj({ justification: 'ok', author: ' ', date: '12/10/2026', target: 'x', value: 'abc', mode: 'zzz' as any })], lines: [] }).join('\n');
    expect(e).toMatch(/justification obligatoire/); expect(e).toMatch(/auteur obligatoire/); expect(e).toMatch(/date AAAA-MM-JJ/);
    expect(e).toMatch(/cible « x » invalide/); expect(e).toMatch(/valeur décimale invalide/); expect(e).toMatch(/mode « zzz »/);
    expect(validateManual({ adjustments: [adj(), adj()], lines: [] }).join()).toMatch(/identifiant dupliqué/);
    expect(() => price({ adjustments: [adj({ justification: '' })], lines: [] })).toThrow(/Entrées manuelles invalides/);
  });
});

describe('Lignes manuelles', () => {
  it('une ligne manuelle entre dans le DQE, le total et les taxes, avec le marquage « manuel »', () => {
    const r = price({ adjustments: [], lines: [line()] });
    const l = r.estimate.lines.find((x) => x.source === 'manual')!;
    expect(l).toMatchObject({ id: 'ml:ML-1', quantity: '1', unitPrice: '150000', amount: '150000', status: 'priced', flags: ['manual_line'], components: [], layers: [] });
    expect(r.estimate.linesTotal).toBe('768294');                          // 618 294 + 150 000
    expect(r.estimate.totalLayers[0]!.amount).toBe('138293');              // 18 % de 768 294 = 138 292,92
    expect(r.estimate.total).toBe('906587');
    const doc = emitDocument(r, { templateId: 'tpl.dqe.fr', number: 'N', date: '2026-10-12', status: 'final' });
    expect(doc.content.sections[0]!.lines.map((x) => x.designation)).toEqual(['Maçonnerie de blocs creux de 20 cm', 'Installation de chantier (forfait)']);
    expect(doc.content.notices.join()).toMatch(/0 ajustement\(s\) manuel\(s\) de quantité et 1 ligne\(s\) manuelle\(s\)/);
    expect(doc.content.annex.manual.lines[0]).toMatchObject({ id: 'ML-1', author: 'métreur.test', justification: 'Forfait convenu avec le client, hors plan' });
    expect(renderMarkdown(doc)).toContain('manual_line');
  });
  it('lot inconnu du pack, unité inconnue, prix non entier, quantité négative : refusés', () => {
    const e = validateManual({ adjustments: [], lines: [line({ lot: 'LOTX', unit: 'zz', unitPrice: '1.5', quantity: '-1', designation: ' ' })] }, catalog.resolve('pack.bj')).join('\n');
    expect(e).toMatch(/lot « LOTX » absent du pack/); expect(e).toMatch(/unité « zz » inconnue/); expect(e).toMatch(/entier de l'unité mineure/); expect(e).toMatch(/quantité décimale ≥ 0/); expect(e).toMatch(/désignation obligatoire/);
  });
  it('autre marché, autre devise (2 décimales) : le prix saisi est en unités mineures', () => {
    const r = price({ adjustments: [], lines: [line({ lot: 'A', unit: 'u', unitPrice: '250000' })] }, 'divergent');
    expect(r.estimate.lines.find((x) => x.source === 'manual')!.amount).toBe('250000');          // 2 500,00 TST
  });
});

describe('Traçabilité des entrées manuelles (T-TRC-03)', () => {
  const run = () => { const r = price({ adjustments: [adj()], lines: [line()] }); emitDocument(r, { templateId: 'tpl.dqe.fr', number: 'N', date: '2026-10-12', status: 'draft' }); return r; };
  it('la chaîne d\'une ligne ajustée expose quantité du moteur, ajustement, auteur et justification', () => {
    const r = run(); const c = resolveChain(r, r.documents[0]!, 'el:OUV.MAC.BLOC20');
    expect(c.missing).toEqual([]);
    expect(c.manual.engineQuantity).toBe('51.9');
    expect(c.manual.adjustments[0]).toMatchObject({ id: 'AJ-1', after: '53.9', author: 'métreur.test', justification: expect.stringMatching(/pignon/) });
    expect(c.ouvrageQuantity.quantity).toBe('53.9'); expect(c.contributions).toHaveLength(4);       // la chaîne géométrique reste complète
  });
  it('la chaîne d\'une ligne manuelle remonte à son enregistrement (auteur, date, justification)', () => {
    const r = run(); const c = resolveChain(r, r.documents[0]!, 'ml:ML-1');
    expect(c.missing).toEqual([]); expect(c.manual.line).toMatchObject({ id: 'ML-1', author: 'métreur.test', date: '2026-10-12' });
    expect(c.contributions).toEqual([]); expect(c.price).toEqual([]);
  });
  it('altération détectée : justification modifiée, ligne supprimée, ajustement supprimé', () => {
    const probe = (f: (r: ReturnType<typeof run>) => void, id: string): string => { const r = clone(run()); f(r); return resolveChain(r, r.documents[0]!, id).missing.join('\n'); };
    expect(probe((r) => { r.manual.lines[0]!.unitPrice = '1'; }, 'ml:ML-1')).toMatch(/ligne manuelle ml:ML-1 introuvable ou modifiée/);
    expect(probe((r) => { r.manual.lines = []; }, 'ml:ML-1')).toMatch(/introuvable ou modifiée/);
    expect(probe((r) => { r.manual.adjustments = []; }, 'el:OUV.MAC.BLOC20')).toMatch(/ajustement AJ-1 introuvable ou modifié/);
    expect(probe((r) => { r.manual.adjustments[0]!.justification = 'autre texte'; }, 'el:OUV.MAC.BLOC20')).toMatch(/ajustement AJ-1 introuvable ou modifié/);
    expect(probe((r) => { r.manual.lines[0]!.justification = ''; }, 'ml:ML-1')).toMatch(/sans justification ou auteur|introuvable ou modifiée/);
  });
  it('le manifeste référence les entrées manuelles ; verifyRun et verifyBundle les couvrent', () => {
    const r = run();
    expect(r.documents[0]!.manifest.manualEntriesHash).toBe(hashOf(r.manual));
    expect(verifyRun(r)).toEqual({ ok: true, problems: [] });
    const b = createBundle(r); expect(b.files['manual.json']).toBeDefined(); expect(verifyBundle(b).ok).toBe(true);
    const bad = clone(b); bad.files['manual.json'] = bad.files['manual.json']!.replace('150000', '1'); expect(verifyBundle(bad).ok).toBe(false);
  });
  it('explication déterministe : ajustement et ligne manuelle expliqués avec leur justification', () => {
    const r = run();
    expect(explainLine(r, 'el:OUV.MAC.BLOC20').join('\n')).toMatch(/AJUSTEMENT MANUEL AJ-1 \(ajout de 2 m2\) par métreur\.test le 2026-10-12 : Reprise du mur pignon.*51\.9 → quantité retenue 53\.9 m2/);
    expect(explainLine(r, 'el:OUV.MAC.BLOC20').join('\n')).toMatch(/\(quantité du moteur, avant ajustements\)/);
    expect(explainLine(r, 'ml:ML-1').join('\n')).toMatch(/Ligne MANUELLE \(hors modèle\) saisie par métreur\.test le 2026-10-12 : Forfait convenu/);
  });
  it('un ajustement n\'est pas une quantité anonyme : sans justification le chiffrage est refusé', () => {
    expect(() => price({ adjustments: [], lines: [line({ author: '' })] })).toThrow(/auteur obligatoire/);
  });
});

describe('Opérations manuelles dans le journal (annulables, versionnées)', () => {
  const s0 = (): ProjectState => ({ model: cellModel(), assumptions: cellAssumptions() });
  it('ajout / suppression / annulation : retour exact à la révision précédente', () => {
    const a = applyOperation(s0(), { type: 'addManualLine', line: line() }, { hlc: hlc(1), actor: 'u' });
    const b = applyOperation(a.state, { type: 'setAdjustment', adjustment: adj() }, { hlc: hlc(2), actor: 'u' });
    expect(b.state.manual!.lines).toHaveLength(1); expect(b.state.manual!.adjustments).toHaveLength(1);
    expect(stateRev(b.state)).not.toBe(stateRev(a.state));
    const u2 = undoOperation(b.state, b.record, { hlc: hlc(3), actor: 'u' }); expect(stateRev(u2.state)).toBe(stateRev(a.state));
    const u1 = undoOperation(u2.state, a.record, { hlc: hlc(4), actor: 'u' }); expect(stateRev(u1.state)).toBe(stateRev(s0()));
  });
  it('remplacer un ajustement : l\'inverse restaure l\'ancien ; supprimer : l\'inverse le recrée', () => {
    const a = applyOperation(s0(), { type: 'setAdjustment', adjustment: adj() }, { hlc: hlc(1), actor: 'u' });
    const b = applyOperation(a.state, { type: 'setAdjustment', adjustment: adj({ value: '5' }) }, { hlc: hlc(2), actor: 'u' });
    expect(b.state.manual!.adjustments[0]!.value).toBe('5');
    expect(undoOperation(b.state, b.record, { hlc: hlc(3), actor: 'u' }).state.manual!.adjustments[0]!.value).toBe('2');
    const c = applyOperation(a.state, { type: 'removeAdjustment', id: 'AJ-1' }, { hlc: hlc(4), actor: 'u' });
    expect(c.state.manual!.adjustments).toEqual([]);
    expect(stateRev(undoOperation(c.state, c.record, { hlc: hlc(5), actor: 'u' }).state)).toBe(stateRev(a.state));
  });
  it('opérations invalides refusées', () => {
    expect(() => applyOperation(s0(), { type: 'removeManualLine', id: 'zz' }, { hlc: hlc(1), actor: 'u' })).toThrow(/inconnue/);
    expect(() => applyOperation(s0(), { type: 'removeAdjustment', id: 'zz' }, { hlc: hlc(1), actor: 'u' })).toThrow(/inconnu/);
    const a = applyOperation(s0(), { type: 'addManualLine', line: line() }, { hlc: hlc(1), actor: 'u' });
    expect(() => applyOperation(a.state, { type: 'addManualLine', line: line() }, { hlc: hlc(2), actor: 'u' })).toThrow(/déjà existante/);
  });
  it('un ajustement saisi puis un changement de plan : il suit l\'ouvrage ; si l\'ouvrage disparaît il devient orphelin (non perdu)', () => {
    const w = (mod: (mm: ReturnType<typeof houseModel>) => void) => { const mm = houseModel(); mod(mm); return runWith(catalog.resolve('pack.bj'), mm, houseAssumptions(), { zoneId: ZONES.bj }, { manual: { adjustments: [adj({ target: 'oq:OUV.TOLE', value: '1' })], lines: [] } }); };
    expect(w(() => {}).quantitySet.ouvrages.find((o) => o.id === 'oq:OUV.TOLE')!.adjustments).toHaveLength(1);
    const noRoof = w((mm) => { mm.buildings[0]!.levels[0]!.roofs = []; });
    expect(noRoof.quantitySet.orphanAdjustments).toHaveLength(1);
    void m; void Dec;
  });
});
