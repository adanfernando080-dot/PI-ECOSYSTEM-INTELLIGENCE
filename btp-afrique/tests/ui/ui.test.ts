import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { catalog, ROOT } from '../support/env.js';
import { apply, openSession, rebind, undo } from '../../apps/desktop/src/session.js';
import { demoHouse, newRoomProject } from '../../apps/desktop/src/projects.js';
import { assumptionRows, defaultZone, estimateRows, modelView, ouvrageRows, priceRows } from '../../apps/desktop/src/viewmodel.js';
import { readBtpx, writeBtpx } from '../../src/adapters/btpx.js';
import { createBundle } from '../../src/core/project/bundle.js';
import { recompute } from '../../src/core/project/recompute.js';
import { TAXONOMY } from '../../apps/desktop/src/session.js';

const bj = () => catalog.resolve('pack.bj'); const sn = () => catalog.resolve('pack.sn');
const demo = () => { const d = demoHouse(); return openSession({ name: d.name, state: d.state, pack: bj(), binding: { zoneId: defaultZone(bj()), asOf: '2026-10-08' } }); };

describe('Interface — session et vues (le noyau fait tous les calculs)', () => {
  it('la zone par défaut est la plus fine ; le projet de démonstration est SYNTHÉTIQUE et son total est celui du noyau', () => {
    expect(defaultZone(bj())).toBe('BJ-LITTORAL-COTONOU'); const s = demo(); expect(s.name).toMatch(/synthetic\/test/);
    const direct = recompute(null, { taxonomy: TAXONOMY, state: s.state, pack: bj(), binding: { zoneId: 'BJ-LITTORAL-COTONOU', asOf: '2026-10-08' } }).run;
    expect(s.run.estimate.total).toBe(direct.estimate.total); expect(estimateRows(s.run).rows.length).toBe(s.run.estimate.lines.length);
  });
  it('vue du modèle : 3 pièces, 10 murs, 7 ouvertures, quantités lues dans le métré', () => {
    const v = modelView(demo().run); expect(v.counts).toEqual({ walls: 10, openings: 7, spaces: 3 });
    expect(v.spaces.every((s) => s.areaM2 !== null)).toBe(true); expect(v.walls.every((w) => w.lengthM !== null)).toBe(true);
  });
  it('modification d\'une ouverture → recalcul réel ; annulation → retour exact au résultat précédent (mêmes empreintes)', () => {
    const s0 = demo(); const o = s0.run.model.buildings[0]!.levels[0]!.openings.find((x) => !x.width.assumptionId)!;
    const r = apply(s0, { type: 'setOpeningSize', openingId: o.id, width: '2.00', height: '2.10' }, 1000); expect(r.error).toBeNull();
    expect(r.session.run.estimate.total).not.toBe(s0.run.estimate.total); expect(r.session.oplog).toHaveLength(1);
    const u = undo(r.session, 2000); expect(u.session.run.estimate.contentHash).toBe(s0.run.estimate.contentHash); expect(u.session.oplog).toHaveLength(2);
  });
  it('une opération invalide laisse la session INTACTE avec un message', () => {
    const s0 = demo(); const r = apply(s0, { type: 'setOpeningSize', openingId: 'inexistant', width: '1', height: '1' }, 1); expect(r.error).toMatch(/inconnue/); expect(r.session).toBe(s0);
    const r2 = apply(s0, { type: 'setAdjustment', adjustment: { id: 'X', target: 'oq:OUV.MAC.BLOC20', mode: 'delta', value: '1', justification: 'court', author: 'u', date: '2026-10-12' } }, 2); expect(r2.error).toMatch(/justification/i); expect(r2.session).toBe(s0);
  });
  it('changement de marché : modèle et hypothèses INCHANGÉS, géométrie réutilisée, historique de liaison conservé', () => {
    const s0 = demo(); const r = rebind(s0, sn(), { zoneId: defaultZone(sn()), asOf: '2026-10-08' }); expect(r.error).toBeNull();
    expect(r.session.state.model).toBe(s0.state.model); expect(r.session.run.takeoff).toBe(s0.run.takeoff); expect(r.session.reuse).toMatchObject({ takeoff: true, quantitySet: false });
    expect(r.session.bindingHistory.map((b) => b.revision)).toEqual([1, 2]);
  });
  it('REPRODUCTIBILITÉ APRÈS CHANGEMENT DE MARCHÉ : sauvegarde → réouverture avec historique de liaison → mêmes empreintes', () => {
    const s0 = demo(); const s1 = rebind(s0, sn(), { zoneId: defaultZone(sn()), asOf: '2026-10-08' }).session;
    const bytes = writeBtpx(s1.run, createBundle(s1.run), { name: s1.name, oplog: s1.oplog, bindingHistory: s1.bindingHistory });
    const o = readBtpx(bytes); expect(o.ok).toBe(true); const run = o.run!;
    const re = openSession({ name: 'x', state: { model: run.model, assumptions: run.assumptions, manual: run.manual }, pack: run.pack, binding: { zoneId: run.binding.zoneId, asOf: run.binding.asOf, priceBookId: run.binding.priceBookId, priceStatistic: run.binding.priceStatistic, paramOverrides: run.binding.params },
      bindingHistory: o.project!.meta.bindingHistory, parentBinding: o.project!.meta.bindingHistory.find((b) => b.rev === run.binding.parentRev) ?? null });
    expect(re.run.estimate.contentHash).toBe(run.estimate.contentHash); expect(re.run.binding.rev).toBe(run.binding.rev);
  });
  it('nouvelle pièce : hauteur = hypothèse PROPOSÉE, grandeurs bloquées jusqu\'à confirmation (rien d\'inventé)', () => {
    const p = newRoomProject({ name: 'Pièce test', lengthM: '5.00', widthM: '4.00', thicknessM: '0.20', wallClass: 'masonry.block.hollow', heightM: '3.00', author: 'u', date: '2026-10-12' });
    const s = openSession({ name: p.name, state: p.state, pack: bj(), binding: { zoneId: defaultZone(bj()), asOf: '2026-10-08' } });
    expect(assumptionRows(s.run)[0]).toMatchObject({ id: 'A-01', status: 'proposed' }); expect(modelView(s.run).blocked.length).toBeGreaterThan(0);
    const c = apply(s, { type: 'confirmAssumption', assumptionId: 'A-01', by: 'u', at: '2026-10-12' }, 5); expect(c.error).toBeNull();
    expect(modelView(c.session.run).blocked).toEqual([]); expect(BigInt(c.session.run.estimate.total)).toBeGreaterThan(0n);
    expect(() => newRoomProject({ ...{ name: 'x', lengthM: '0', widthM: '4', thicknessM: '0.2', wallClass: 'masonry.block.hollow', heightM: '3', author: 'u', date: '2026-10-12' } })).toThrow();
  });
  it('vues prix et ouvrages : lecture fidèle du pack et du métré', () => {
    const s = demo(); expect(priceRows(s.run).length).toBe(s.run.pack.priceBooks.flatMap((b) => b.entries).length); expect(ouvrageRows(s.run).length).toBe(s.run.quantitySet.ouvrages.length);
  });
});

describe('Interface — étanchéité marché (REQ-18) : le code de l\'interface ne contient aucune donnée de marché', () => {
  it('aucun terme de marché dans apps/desktop/src (hors textes génériques)', () => {
    const files = readdirSync(`${ROOT}/apps/desktop/src`).filter((f) => /\.(ts|tsx)$/.test(f));
    for (const f of files) { const t = readFileSync(`${ROOT}/apps/desktop/src/${f}`, 'utf8'); expect(t, f).not.toMatch(/\b(XOF|FCFA|TVA|Bénin|Benin|Sénégal|Senegal|Cotonou|Dakar|BJ-|SN-)\b/); }
  });
  it('l\'interface n\'importe aucun module Node ni réseau externe (renderer sûr, ADR-0010)', () => {
    for (const f of readdirSync(`${ROOT}/apps/desktop/src`).filter((x) => /\.(ts|tsx)$/.test(x))) { const t = readFileSync(`${ROOT}/apps/desktop/src/${f}`, 'utf8'); expect(t, f).not.toMatch(/from 'node:|require\(|XMLHttpRequest|https?:\/\//); }
  });
});
