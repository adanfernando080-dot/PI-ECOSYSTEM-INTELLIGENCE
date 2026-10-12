import { describe, expect, it } from 'vitest';
import { catalog } from '../support/env.js';
import { commit, openSession, preview, redo, undo, type Session } from '../../apps/desktop/src/session.js';
import { newRoomProject } from '../../apps/desktop/src/projects.js';
import { defaultZone } from '../../apps/desktop/src/viewmodel.js';
import * as C from '../../src/core/ops/commands.js';
import { readBtpx, writeBtpx } from '../../src/adapters/btpx.js';
import { createBundle } from '../../src/core/project/bundle.js';
import { hashOf } from '../../src/core/trace/canonical.js';
import { fitView, gridUnits, hitTest, parseMetres, scaleBar, snapPoint, toScreen, toWorld, zoomAt, panBy, openingAnchor, UNITS_PER_M } from '../../apps/desktop/src/editor/viewport.js';
import { describeOp } from '../../apps/desktop/src/editor/draft.js';

const pack = catalog.resolve('pack.bj'); const props: C.WallProps = { thicknessM: '0.20', role: 'interior', system: 'masonry.block.hollow' };
const room = () => newRoomProject({ name: 'Salle (synthetic/test)', lengthM: '5.00', widthM: '4.00', thicknessM: '0.20', wallClass: 'masonry.block.hollow', heightM: '3.00', author: 'u', date: '2026-10-12' });
function start(): Session {
  const r = room(); const s = openSession({ name: r.name, state: r.state, pack, binding: { zoneId: defaultZone(pack), asOf: '2026-10-08' } });
  return commit(s, [{ type: 'confirmAssumption', assumptionId: 'A-01', by: 'u', at: '2026-10-12' }], 'Confirmer A-01', 1).session;
}
const walls = (s: Session) => s.run.model.buildings[0]!.levels[0]!.walls;
const m = (v: number): number => Math.round(v * UNITS_PER_M);

describe('Éditeur — flux brouillon → validation → opérations → recalcul (session)', () => {
  it('l\'aperçu (brouillon) ne modifie NI la session NI le journal ; il calcule l\'impact réel sur une copie', () => {
    const s = start(); const ops = C.cmdCreateWall(s.run.model, 'lvl-0', { x: m(2.5), y: 0 }, { x: m(2.5), y: m(4) }, props);
    const hash = hashOf(s.state.model); const log = s.oplog.length; const p = preview(s, ops, 5);
    expect(p.ok).toBe(true); expect(p.diff!.totalDelta).not.toBe('0'); expect(BigInt(p.diff!.totalAfter)).toBeGreaterThan(BigInt(p.diff!.totalBefore));
    expect(hashOf(s.state.model)).toBe(hash); expect(s.oplog).toHaveLength(log); expect(walls(s)).toHaveLength(4);
  });
  it('un brouillon invalide est refusé AVANT toute écriture (aperçu ok=false, commit renvoie la session intacte)', () => {
    const s = start(); const bad = C.cmdAddOpening(s.run.model, 'lvl-0', 'w-s', 'opening.door.single', 'joinery.timber', '9.00', '2.10');
    const p = preview(s, bad, 5); expect(p.ok).toBe(false); expect(p.errors.join()).toMatch(/largeur supérieure/);
    const r = commit(s, bad, 'Ouverture', 6); expect(r.error).toMatch(/largeur supérieure/); expect(r.session).toBe(s);
  });
  it('commit d\'un geste = UN groupe ; annuler/rétablir via la session ; les métrés suivent exactement', () => {
    const s0 = start(); const t0 = s0.run.estimate.total;
    const ops = C.cmdCreateRoomRect(s0.run.model, 'lvl-0', { x: m(5.5), y: 0 }, { x: m(7), y: m(2) }, 'Annexe', 'generic', props);
    const s1 = commit(s0, ops, 'Créer une pièce', 10).session; expect(s1.history.undo.map((g) => g.label)).toEqual(['Confirmer A-01', 'Créer une pièce']);
    expect(s1.run.estimate.total).not.toBe(t0); expect(s1.run.takeoff.quantities.some((q) => q.kind === 'space.clear.area' && q.entity.code === 'S1')).toBe(true);
    const s2 = undo(s1, 20).session; expect(s2.run.estimate.contentHash).toBe(s0.run.estimate.contentHash); expect(s2.history.redo).toHaveLength(1);
    const s3 = redo(s2, 30).session; expect(s3.run.estimate.contentHash).toBe(s1.run.estimate.contentHash); expect(s3.history.redo).toHaveLength(0);
  });
  it('SAUVEGARDE → RÉOUVERTURE : historique restauré, annulation possible, métrés identiques, journal complet conservé', () => {
    let s = start();
    s = commit(s, C.cmdCreateWall(s.run.model, 'lvl-0', { x: m(2.5), y: 0 }, { x: m(2.5), y: m(4) }, props), 'Mur', 10).session;
    s = commit(s, C.cmdAddOpening(s.run.model, 'lvl-0', 'W1', 'opening.door.single', 'joinery.timber', '0.90', '2.10'), 'Porte', 20).session;
    s = undo(s, 30).session;                                               // porte annulée (dans la pile de rétablissement)
    const bytes = writeBtpx(s.run, createBundle(s.run), { name: s.name, oplog: s.oplog, history: s.history, bindingHistory: s.bindingHistory });
    const o = readBtpx(bytes); expect(o.ok).toBe(true); const run = o.run!;
    const re = openSession({ name: o.project!.meta.name, state: { model: run.model, assumptions: run.assumptions, manual: run.manual }, pack: run.pack, binding: { zoneId: run.binding.zoneId, asOf: run.binding.asOf, priceBookId: run.binding.priceBookId, priceStatistic: run.binding.priceStatistic, paramOverrides: run.binding.params },
      oplog: o.project!.meta.oplog, history: o.project!.meta.history!, bindingHistory: o.project!.meta.bindingHistory, parentBinding: o.project!.meta.bindingHistory.find((b) => b.rev === run.binding.parentRev) ?? null });
    expect(re.historyWarnings).toEqual([]); expect(re.history).toEqual(s.history); expect(re.oplog).toHaveLength(s.oplog.length);
    expect(re.run.estimate.contentHash).toBe(s.run.estimate.contentHash); expect(re.run.takeoff.contentHash).toBe(s.run.takeoff.contentHash);
    const back = redo(re, 40).session; expect(walls(back)).toHaveLength(5); expect(back.run.model.buildings[0]!.levels[0]!.openings).toHaveLength(1);       // rétablir la porte APRÈS réouverture
    const twice = undo(undo(back, 50).session, 60).session; expect(walls(twice)).toHaveLength(4);                                                              // puis annuler jusqu'au mur
  });
  it('INTÉGRITÉ : un historique incohérent avec le modèle est écarté avec un avertissement (pas de restauration silencieuse)', () => {
    let s = start(); s = commit(s, C.cmdCreateWall(s.run.model, 'lvl-0', { x: m(2.5), y: 0 }, { x: m(2.5), y: m(4) }, props), 'Mur', 10).session;
    const alt = commit(s, C.cmdSetWallProps(s.run.model, 'W1', { thicknessM: '0.10' }), 'Épaisseur', 20).session;
    const re = openSession({ name: 'x', state: alt.state, pack, binding: s.binding, oplog: s.oplog, history: s.history });       // journal ancien + modèle plus récent
    expect(re.historyWarnings.length).toBeGreaterThan(0); expect(re.history.undo).toEqual([]);
  });
  it('les hypothèses confirmées ne sont pas modifiées par les gestes graphiques', () => {
    const s0 = start(); const h = hashOf(s0.state.assumptions);
    let s = commit(s0, C.cmdCreateWall(s0.run.model, 'lvl-0', { x: m(2.5), y: 0 }, { x: m(2.5), y: m(4) }, props), 'Mur', 10).session; s = commit(s, C.cmdMoveNode(s.run.model, 'N3', { x: m(5), y: m(3.5) }), 'Déplacer', 20).session;
    expect(hashOf(s.state.assumptions)).toBe(h); expect(s.state.assumptions.items[0]!.status).toBe('confirmed');
  });
  it('descriptions de brouillon en français', () => {
    const s = start(); const t = C.cmdDeleteWall(s.run.model, 'w-s').map((o) => describeOp(o, s.run.model)); expect(t.at(-1)).toMatch(/Supprimer (le mur|le point)/);
    expect(describeOp(C.cmdCreateWall(s.run.model, 'lvl-0', { x: m(2.5), y: 0 }, { x: m(2.5), y: m(4) }, props)[2]!, s.run.model)).toMatch(/Créer le mur W1.*épaisseur 0\.20 m/);
  });
});

describe('Éditeur — géométrie d\'affichage (entiers, aimantation, sélection)', () => {
  const lv = start().run.model.buildings[0]!.levels[0]!; const v = fitView(lv, 900, 560);
  it('écran ↔ monde : aller-retour exact à l\'arrondi près ; axe Y vers le haut', () => {
    const s = toScreen(v, m(2.5), m(1)); const w = toWorld(v, s.x, s.y); expect(Math.round(w.x)).toBe(m(2.5)); expect(Math.round(w.y)).toBe(m(1));
    expect(toScreen(v, 0, m(4)).y).toBeLessThan(toScreen(v, 0, 0).y);
  });
  it('aimantation : TOUJOURS des entiers ; nœud existant prioritaire ; grille 0,10 m = 1 000 unités', () => {
    const near = toScreen(v, m(2.52), m(1.03)); const s = snapPoint(v, lv, near.x, near.y, gridUnits('0.10'));
    expect(s.kind).toBe('grid'); expect(s.pt).toEqual({ x: m(2.5), y: m(1) }); expect(Number.isInteger(s.pt.x) && Number.isInteger(s.pt.y)).toBe(true);
    const n = toScreen(v, lv.nodes[1]!.x, lv.nodes[1]!.y); expect(snapPoint(v, lv, n.x + 3, n.y - 2, 1000)).toMatchObject({ kind: 'node', nodeId: lv.nodes[1]!.id });
    expect(snapPoint(v, lv, near.x, near.y, 1000, 10, false).kind).toBe('none');
  });
  it('sélection : nœud > mur > pièce ; vide hors plan', () => {
    const n = toScreen(v, lv.nodes[0]!.x, lv.nodes[0]!.y); expect(hitTest(v, lv, n.x, n.y)).toEqual({ kind: 'node', id: lv.nodes[0]!.id });
    const wm = toScreen(v, m(2.5), 0); expect(hitTest(v, lv, wm.x, wm.y)).toEqual({ kind: 'wall', id: 'w-s' });
    const c = toScreen(v, m(2.5), m(2)); expect(hitTest(v, lv, c.x, c.y)).toEqual({ kind: 'space', id: 'sp-1' }); expect(hitTest(v, lv, 2, 2)).toBeNull();
  });
  it('zoom autour du curseur conserve le point visé ; panoramique ; barre d\'échelle ronde en mètres', () => {
    const p = toScreen(v, m(2), m(2)); const z = zoomAt(v, 1.5, p.x, p.y); const q = toScreen(z, m(2), m(2)); expect(Math.abs(q.x - p.x)).toBeLessThan(0.01); expect(z.ppm).toBeGreaterThan(v.ppm);
    const pn = panBy(v, 30, 0); expect(pn.ox).toBeLessThan(v.ox); expect(scaleBar(v).label).toMatch(/^\d+(\.\d+)? m$/); expect(scaleBar(v).px).toBeGreaterThan(0);
  });
  it('saisie en mètres : entiers exacts sans flottant ; formats invalides refusés', () => {
    expect(parseMetres('2.5')).toBe(25000); expect(parseMetres('2,50')).toBe(25000); expect(parseMetres('-0.0001')).toBe(-1); expect(parseMetres('0.12345')).toBeNull(); expect(parseMetres('abc')).toBeNull(); expect(parseMetres('')).toBeNull();
  });
  it('ouverture sans position dans le modèle : ancrage au milieu du mur', () => {
    const s = commit(start(), C.cmdAddOpening(start().run.model, 'lvl-0', 'w-s', 'opening.door.single', 'joinery.timber', '0.9', '2.1'), 'Porte', 5).session; const l = s.run.model.buildings[0]!.levels[0]!;
    const a = openingAnchor(v, l, 'O1')!; const mid = toScreen(v, m(2.5), 0); expect(Math.abs(a.x - mid.x)).toBeLessThan(0.01);
  });
});
