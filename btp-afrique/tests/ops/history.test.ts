import { describe, expect, it } from 'vitest';
import { doGroup, redoLast, undoLast, verifyLedger, EMPTY_HISTORY, type Ledger } from '../../src/core/ops/history.js';
import { applyOperation, stateRev, type Hlc, type ProjectState } from '../../src/core/ops/oplog.js';
import * as C from '../../src/core/ops/commands.js';
import { geometryProblems } from '../../src/core/model/checks.js';
import { validateModel } from '../../src/core/model/validate.js';
import { recompute } from '../../src/core/project/recompute.js';
import { hashOf } from '../../src/core/trace/canonical.js';
import { catalog, cellAssumptions, cellModel, houseAssumptions, houseModel, taxonomy, ZONES, ASOF } from '../support/env.js';
import { m } from '../../fixtures/synthetic/common.js';

let tick = 1000; const meta = (label = 'test') => ({ label, actor: 'u.test', hlc: { wall: ++tick, counter: 0, node: 'n' } as Hlc });
const um = (label?: string) => { const { label: _l, ...r } = meta(label); return r; };
const validate = (s: ProjectState): string[] => [...validateModel(s.model, taxonomy), ...geometryProblems(s.model)];
const ledger = (s: ProjectState): Ledger => ({ state: s, log: [], history: EMPTY_HISTORY });
const cell = (): Ledger => ledger({ model: cellModel(), assumptions: cellAssumptions() });
const house = (): Ledger => ledger({ model: houseModel(), assumptions: houseAssumptions() });
const props: C.WallProps = { thicknessM: '0.20', role: 'interior', system: 'masonry.block.hollow' };
const lvl = (l: Ledger) => l.state.model.buildings[0]!.levels[0]!;
const run = (l: Ledger) => recompute(null, { taxonomy, state: l.state, pack: catalog.resolve('pack.bj'), binding: { zoneId: ZONES.bj, asOf: ASOF } }).run;
const rev = (l: Ledger): string => stateRev(l.state);

describe('Commandes → groupes d\'opérations (murs)', () => {
  it('créer un mur : nœuds créés ou RÉUTILISÉS aux mêmes coordonnées, ids libres, épaisseur obligatoire, hauteur = hypothèse du niveau', () => {
    const l = cell(); const ops = C.cmdCreateWall(l.state.model, 'lvl-0', { x: m('2.50'), y: 0 }, { x: m('2.50'), y: m('4.00') }, props);
    expect(ops.map((o) => o.type)).toEqual(['addNode', 'addNode', 'addWall']);
    const l2 = doGroup(l, ops, meta('Mur'), validate); const w = lvl(l2).walls.find((x) => x.id === 'W1')!;
    expect(w.height).toMatchObject({ origin: 'assumption', assumptionId: 'A-01' }); expect(w.thickness).toMatchObject({ value: '0.20', unit: 'm', origin: 'user_entered' });
    const again = C.cmdCreateWall(l2.state.model, 'lvl-0', { x: m('2.50'), y: m('4.00') }, { x: m('5.00'), y: m('4.00') }, props);   // (5,4) = C3 existant, (2.5,4) = nœud créé
    expect(again.map((o) => o.type)).toEqual(['addWall']); expect(JSON.stringify(again)).toContain('"endNode":"C3"');
  });
  it('refus : longueur nulle, doublon, épaisseur absente/invalide, coordonnées non entières', () => {
    const mod = cell().state.model;
    expect(() => C.cmdCreateWall(mod, 'lvl-0', { x: 0, y: 0 }, { x: 0, y: 0 }, props)).toThrow(/nulle/);
    expect(() => C.cmdCreateWall(mod, 'lvl-0', { x: 0, y: 0 }, { x: m('5.00'), y: 0 }, props)).toThrow(/existe déjà/);
    expect(() => C.cmdCreateWall(mod, 'lvl-0', { x: 0, y: 0 }, { x: 10, y: 10 }, { ...props, thicknessM: '' })).toThrow(/Épaisseur/);
    expect(() => C.cmdCreateWall(mod, 'lvl-0', { x: 0, y: 0 }, { x: 10.5, y: 10 }, props)).toThrow(/entières/);
  });
  it('déplacer un nœud : les murs liés suivent par référence ; collision refusée ; géométrie recalculée', () => {
    const l = cell(); const before = run(l).takeoff.quantities.find((q) => q.id === 'geo:w-e:wall.length.axis')!.value;
    const l2 = doGroup(l, C.cmdMoveNode(l.state.model, 'C3', { x: m('5.00'), y: m('6.00') }).concat(C.cmdMoveNode(l.state.model, 'C4', { x: 0, y: m('6.00') })), meta('Étirer'), validate);
    expect(run(l2).takeoff.quantities.find((q) => q.id === 'geo:w-e:wall.length.axis')!.value).not.toBe(before);
    expect(() => C.cmdMoveNode(l.state.model, 'C3', { x: 0, y: 0 })).toThrow(/occupe/); expect(C.cmdMoveNode(l.state.model, 'C1', { x: 0, y: 0 })).toEqual([]);
  });
  it('propriétés d\'un mur : épaisseur/rôle/système modifiés avec provenance ; annulation = état EXACT (même empreinte)', () => {
    const l = cell(); const l2 = doGroup(l, C.cmdSetWallProps(l.state.model, 'w-s', { thicknessM: '0.15', role: 'interior' }), meta('Épaisseur'), validate);
    expect(lvl(l2).walls[0]!.thickness.value).toBe('0.15'); expect(lvl(l2).walls[0]!.role).toBe('interior');
    expect(rev(undoLast(l2, um(), validate))).toBe(rev(l));
  });
  it('suppression d\'un mur EN CASCADE (ouvertures, pièce, nœuds orphelins) en UN groupe ; annuler restitue exactement le modèle', () => {
    const l = cell(); const ops = C.cmdDeleteWall(l.state.model, 'w-s');
    expect(ops.map((o) => o.type)).toEqual(['removeOpening', 'removeSpace', 'removeWall']);   // pièce supprimée (contour ouvert) ; C1/C2 encore utilisés par w-w / w-e
    const l2 = doGroup(l, ops, meta('Supprimer mur'), validate);
    expect(lvl(l2).walls.map((w) => w.id)).not.toContain('w-s'); expect(lvl(l2).openings).toHaveLength(0); expect(lvl(l2).spaces).toHaveLength(0);
    expect(l2.history.undo).toHaveLength(1); const l3 = undoLast(l2, um(), validate);
    expect(hashOf(l3.state.model)).toBe(hashOf(l.state.model)); expect(l3.history.redo).toHaveLength(1);
  });
  it('mur isolé : ses nœuds sont retirés avec lui', () => {
    const l = doGroup(cell(), C.cmdCreateWall(cell().state.model, 'lvl-0', { x: m('1.00'), y: m('1.00') }, { x: m('2.00'), y: m('1.00') }, props), meta(), validate);
    const del = C.cmdDeleteWall(l.state.model, 'W1'); expect(del.map((o) => o.type)).toEqual(['removeWall', 'removeNode', 'removeNode']);
    expect(hashOf(doGroup(l, del, meta(), validate).state.model)).toBe(hashOf(cell().state.model));
  });
});

describe('Pièces et ouvertures', () => {
  it('pièce rectangulaire : 4 nœuds + 4 murs + pièce en un groupe ; le métré du moteur la calcule (surface libre exacte)', () => {
    const l = ledger({ model: { ...cellModel(), buildings: [{ ...cellModel().buildings[0]!, levels: [{ ...lvl(cell()), nodes: [], walls: [], openings: [], spaces: [] }] }] }, assumptions: cellAssumptions() });
    const ops = C.cmdCreateRoomRect(l.state.model, 'lvl-0', { x: 0, y: 0 }, { x: m('4.00'), y: m('3.00') }, 'Chambre', 'bedroom', { ...props, role: 'exterior' });
    expect(ops.filter((o) => o.type === 'addNode')).toHaveLength(4); expect(ops.filter((o) => o.type === 'addWall')).toHaveLength(4); expect(ops.at(-1)!.type).toBe('addSpace');
    const l2 = doGroup(l, ops, meta('Pièce'), validate); const area = run(l2).takeoff.quantities.find((q) => q.kind === 'space.clear.area')!;
    expect(area.entity.code).toBe('S1'); expect(area.value).toBe('10.64');                      // (4,00 − 0,20) × (3,00 − 0,20), épaisseur 0,20 m : calcul à la main
  });
  it('pièce depuis des murs existants / renommer / supprimer ; < 3 murs refusé', () => {
    const l = cell(); expect(() => C.cmdCreateSpaceFromWalls(l.state.model, 'lvl-0', ['w-s', 'w-e'], 'X', 'generic')).toThrow(/3 murs/);
    const l2 = doGroup(l, C.cmdCreateSpaceFromWalls(l.state.model, 'lvl-0', ['w-s', 'w-e', 'w-n', 'w-w'], 'Bureau', 'office'), meta(), validate);
    const l3 = doGroup(l2, C.cmdRenameSpace(l2.state.model, 'S1', 'Bureau 2'), meta(), validate); expect(lvl(l3).spaces.find((s) => s.id === 'S1')!.name).toBe('Bureau 2');
    expect(lvl(doGroup(l3, C.cmdDeleteSpace(l3.state.model, 'S1'), meta(), validate)).spaces.map((s) => s.id)).toEqual(['sp-1']);
    expect(rev(undoLast(l3, um(), validate))).toBe(rev(l2));
  });
  it('ouverture : ajout (mur hôte obligatoire), dimensions, suppression ; largeur > mur refusée par la validation de brouillon', () => {
    const l = cell(); const add = C.cmdAddOpening(l.state.model, 'lvl-0', 'w-e', 'opening.window.casement', 'joinery.aluminium', '1.20', '1.20');
    const l2 = doGroup(l, add, meta(), validate); expect(lvl(l2).openings.map((o) => o.id)).toEqual(['o-d1', 'O1']);
    const l3 = doGroup(l2, C.cmdSetOpening(l2.state.model, 'O1', '1.50', '1.20'), meta(), validate); expect(lvl(l3).openings[1]!.width).toMatchObject({ value: '1.50', origin: 'user_corrected', validation: 'edited' });
    expect(() => doGroup(l3, C.cmdSetOpening(l3.state.model, 'O1', '9.00', '1.20'), meta(), validate)).toThrow(/largeur supérieure/);
    expect(() => C.cmdAddOpening(l.state.model, 'lvl-0', 'inexistant', 'opening.door.single', 'joinery.timber', '1', '2')).toThrow(/hôte/);
    expect(lvl(doGroup(l3, C.cmdDeleteOpening(l3.state.model, 'O1'), meta(), validate)).openings.map((o) => o.id)).toEqual(['o-d1']);
  });
});

describe('Groupes, annulation, rétablissement', () => {
  it('ATOMICITÉ : si une opération du groupe échoue, rien n\'est appliqué (registre inchangé)', () => {
    const l = cell(); const ops = [...C.cmdAddOpening(l.state.model, 'lvl-0', 'w-s', 'opening.door.single', 'joinery.timber', '0.9', '2.1'), { type: 'removeWall', wallId: 'inexistant' } as const];
    expect(() => doGroup(l, ops, meta(), validate)).toThrow(/inconnu/); expect(l.log).toHaveLength(0); expect(lvl(l).openings).toHaveLength(1);
  });
  it('un groupe = UNE entrée d\'historique ; annuler/rétablir exacts (empreintes) sur plusieurs groupes ; nouvelle modification vide le rétablissement', () => {
    let l = cell(); const r0 = rev(l);
    l = doGroup(l, C.cmdCreateWall(l.state.model, 'lvl-0', { x: m('2.00'), y: 0 }, { x: m('2.00'), y: m('4.00') }, props), meta('G1'), validate); const r1 = rev(l);
    l = doGroup(l, C.cmdSetWallProps(l.state.model, 'W1', { thicknessM: '0.10' }), meta('G2'), validate); const r2 = rev(l);
    expect(l.history.undo.map((e) => e.label)).toEqual(['G1', 'G2']); expect(l.history.undo[0]!.opIds).toHaveLength(3);
    l = undoLast(l, um(), validate); expect(rev(l)).toBe(r1); l = undoLast(l, um(), validate); expect(rev(l)).toBe(r0);
    expect(l.history.redo.map((e) => e.label)).toEqual(['G2', 'G1']);
    l = redoLast(l, um(), validate); expect(rev(l)).toBe(r1); l = redoLast(l, um(), validate); expect(rev(l)).toBe(r2);
    l = undoLast(l, um(), validate); l = doGroup(l, C.cmdSetWallProps(l.state.model, 'W1', { role: 'exterior' }), meta('G3'), validate);
    expect(l.history.redo).toEqual([]); expect(() => redoLast(l, um(), validate)).toThrow(/Rien à rétablir/); expect(() => undoLast(ledger(cell().state), um())).toThrow(/Rien à annuler/);
    expect(l.log.length).toBeGreaterThan(l.history.undo.reduce((s, e) => s + e.opIds.length, 0));            // le journal garde TOUT (audit), la pile seulement les groupes actifs
  });
  it('un état modifié hors historique rend l\'annulation impossible (garde d\'intégrité)', () => {
    const l = doGroup(cell(), C.cmdSetOpening(cell().state.model, 'o-d1', '0.90', '2.00'), meta(), validate);
    const tampered = { ...l, state: applyOperation(l.state, { type: 'moveNode', nodeId: 'C1', x: 5, y: 5 }, { hlc: { wall: 1, counter: 0, node: 'x' }, actor: 'x' }).state };
    expect(() => undoLast(tampered, um(), validate)).toThrow(/n'est pas celui produit/);
  });
  it('HYPOTHÈSES PRÉSERVÉES : aucun geste de dessin ne touche l\'ensemble d\'hypothèses ; confirmer puis annuler restitue le statut', () => {
    let l = ledger({ model: cellModel(), assumptions: { id: 'a', items: [{ ...cellAssumptions().items[0]!, status: 'proposed' as const, confirmedBy: undefined, confirmedAt: undefined }] } });
    const h0 = hashOf(l.state.assumptions);
    l = doGroup(l, C.cmdCreateWall(l.state.model, 'lvl-0', { x: m('2.00'), y: 0 }, { x: m('2.00'), y: m('4.00') }, props), meta(), validate);
    l = doGroup(l, C.cmdAddOpening(l.state.model, 'lvl-0', 'w-e', 'opening.door.single', 'joinery.timber', '0.9', '2.1'), meta(), validate);
    expect(hashOf(l.state.assumptions)).toBe(h0);
    const c = doGroup(l, [{ type: 'confirmAssumption', assumptionId: 'A-01', by: 'u.test', at: '2026-10-12' }], meta('Confirmer'), validate); expect(c.state.assumptions.items[0]!.status).toBe('confirmed');
    expect(hashOf(undoLast(c, um(), validate).state.assumptions)).toBe(h0);
  });
  it('REJEU DÉTERMINISTE : rejouer le journal depuis le modèle initial redonne le même état ; les métrés recalculés sont identiques', () => {
    let l = house(); const init = l.state;
    l = doGroup(l, C.cmdAddOpening(l.state.model, 'lvl-0', l.state.model.buildings[0]!.levels[0]!.walls[0]!.id, 'opening.window.casement', 'joinery.aluminium', '0.80', '0.80'), meta('A'), validate);
    l = doGroup(l, C.cmdCreateWall(l.state.model, lvl(l).id, { x: m('9.00'), y: 0 }, { x: m('9.00'), y: m('2.00') }, props), meta('B'), validate); l = undoLast(l, um(), validate); l = redoLast(l, um(), validate);
    let s = init; for (const r of l.log) s = applyOperation(s, r.op, { hlc: r.hlc, actor: r.actor }).state;
    expect(rev({ ...l, state: s })).toBe(rev(l)); expect(run({ ...l, state: s }).estimate.contentHash).toBe(run(l).estimate.contentHash); expect(verifyLedger(l)).toEqual([]);
  });
  it('verifyLedger détecte : journal tronqué, état incohérent, groupe orphelin', () => {
    const l = doGroup(cell(), C.cmdSetOpening(cell().state.model, 'o-d1', '0.90', '2.00'), meta(), validate);
    expect(verifyLedger({ ...l, log: [] }).join()).toMatch(/absent du journal/); expect(verifyLedger({ ...l, state: cell().state }).join()).toMatch(/ne produit pas l'état courant/);
  });
});
