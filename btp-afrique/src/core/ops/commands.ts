/**
 * Commandes d'édition : un geste de l'utilisateur → une LISTE d'opérations (un groupe). Fonctions pures qui LISENT le modèle et ne le modifient jamais ;
 * seules les opérations, appliquées après validation (history.doGroup), changent l'état. Coordonnées entières (0,1 mm) ; dimensions saisies en mètres décimaux (chaîne).
 * Aucune donnée de marché ; aucune valeur par défaut implicite (l'épaisseur est obligatoire, la hauteur vient du niveau ou de la saisie).
 */
import type { Attr, ArchitecturalModel, Level, Space, Wall } from '../model/types.js';
import type { Operation } from './oplog.js';

export interface Pt { x: number; y: number }
export interface WallProps { thicknessM: string; heightM?: string; role: 'exterior' | 'interior'; system: string }

const levelById = (m: ArchitecturalModel, id: string): Level => { const l = m.buildings.flatMap((b) => b.levels).find((x) => x.id === id); if (!l) throw new Error(`Niveau inconnu : ${id}`); return l; };
const allIds = (m: ArchitecturalModel): string[] => m.buildings.flatMap((b) => b.levels.flatMap((l) => [l.id, ...l.nodes.map((n) => n.id), ...l.walls.map((w) => w.id), ...l.openings.map((o) => o.id), ...l.spaces.map((s) => s.id), ...l.slabs.map((s) => s.id), ...l.roofs.map((r) => r.id)]));
/** Identifiant libre `<préfixe><n>` (plus grand n existant + 1), en tenant compte des ids déjà réservés par la commande en cours. */
export function freeId(m: ArchitecturalModel, prefix: string, reserved: string[] = []): string {
  let max = 0; for (const id of [...allIds(m), ...reserved]) { const r = new RegExp(`^${prefix}(\\d+)$`).exec(id); if (r) max = Math.max(max, Number(r[1])); } return `${prefix}${max + 1}`;
}
const decimalM = (v: string, what: string): string => { if (!/^\d+(\.\d{1,4})?$/.test(v) || Number(v) <= 0) throw new Error(`${what} : mètres décimaux > 0 attendus (au plus 4 décimales), reçu « ${v} »`); return v; };
const intPt = (p: Pt, what: string): Pt => { if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) throw new Error(`${what} : coordonnées entières (0,1 mm) attendues`); return p; };
const userAttr = (value: string): Attr => ({ value, unit: 'm', origin: 'user_entered', validation: 'accepted' });

/** Hauteur d'un nouveau mur : valeur saisie, sinon celle du niveau (hypothèse référencée ou valeur) ; jamais inventée. */
function wallHeight(lv: Level, heightM?: string): Attr {
  if (heightM !== undefined) return userAttr(decimalM(heightM, 'Hauteur'));
  const h = lv.clearHeight; return h.assumptionId ? { unit: 'm', origin: 'assumption', assumptionId: h.assumptionId } : h.value !== undefined ? userAttr(h.value) : { unit: 'm', origin: 'user_entered' };
}
function nodeAt(lv: Level, p: Pt): string | null { return lv.nodes.find((n) => n.x === p.x && n.y === p.y)?.id ?? null; }

interface Plan { ops: Operation[]; nodes: Map<string, string>; reserved: string[] }
function ensureNode(m: ArchitecturalModel, lv: Level, plan: Plan, p: Pt): string {
  const key = `${p.x},${p.y}`; const have = nodeAt(lv, p) ?? plan.nodes.get(key); if (have) return have;
  const id = freeId(m, 'N', plan.reserved); plan.reserved.push(id); plan.nodes.set(key, id); plan.ops.push({ type: 'addNode', levelId: lv.id, node: { id, x: p.x, y: p.y } }); return id;
}
function ensureWall(m: ArchitecturalModel, lv: Level, plan: Plan, a: string, b: string, props: WallProps): string {
  const ex = lv.walls.find((w) => (w.startNode === a && w.endNode === b) || (w.startNode === b && w.endNode === a)); if (ex) return ex.id;
  const planned = plan.ops.find((o): o is Extract<Operation, { type: 'addWall' }> => o.type === 'addWall' && ((o.wall.startNode === a && o.wall.endNode === b) || (o.wall.startNode === b && o.wall.endNode === a))); if (planned) return planned.wall.id;
  const id = freeId(m, 'W', plan.reserved); plan.reserved.push(id);
  const wall: Wall = { id, code: id, startNode: a, endNode: b, thickness: userAttr(decimalM(props.thicknessM, 'Épaisseur')), height: wallHeight(lv, props.heightM), role: props.role, spec: { system: props.system, origin: 'user_entered' } };
  plan.ops.push({ type: 'addWall', levelId: lv.id, wall }); return id;
}

export function cmdCreateWall(m: ArchitecturalModel, levelId: string, a: Pt, b: Pt, props: WallProps): Operation[] {
  const lv = levelById(m, levelId); intPt(a, 'Départ'); intPt(b, 'Arrivée'); if (a.x === b.x && a.y === b.y) throw new Error('Mur de longueur nulle');
  const plan: Plan = { ops: [], nodes: new Map(), reserved: [] }; const na = ensureNode(m, lv, plan, a), nb = ensureNode(m, lv, plan, b);
  const exists = lv.walls.some((w) => (w.startNode === na && w.endNode === nb) || (w.startNode === nb && w.endNode === na)); if (exists) throw new Error('Un mur existe déjà entre ces deux points');
  ensureWall(m, lv, plan, na, nb, props); return plan.ops;
}
export function cmdMoveNode(m: ArchitecturalModel, nodeId: string, to: Pt): Operation[] {
  intPt(to, 'Destination'); const n = m.buildings.flatMap((b) => b.levels.flatMap((l) => l.nodes)).find((x) => x.id === nodeId); if (!n) throw new Error(`Nœud inconnu : ${nodeId}`);
  const lv = m.buildings.flatMap((b) => b.levels).find((l) => l.nodes.some((x) => x.id === nodeId))!; const clash = nodeAt(lv, to); if (clash && clash !== nodeId) throw new Error('Un autre nœud occupe déjà cette position');
  return n.x === to.x && n.y === to.y ? [] : [{ type: 'moveNode', nodeId, x: to.x, y: to.y }];
}
export function cmdSetWallProps(m: ArchitecturalModel, wallId: string, p: Partial<WallProps>): Operation[] {
  if (!m.buildings.flatMap((b) => b.levels.flatMap((l) => l.walls)).some((w) => w.id === wallId)) throw new Error(`Mur inconnu : ${wallId}`);
  const op: Extract<Operation, { type: 'setWallProps' }> = { type: 'setWallProps', wallId };
  if (p.thicknessM !== undefined) op.thicknessM = decimalM(p.thicknessM, 'Épaisseur'); if (p.heightM !== undefined) op.heightM = decimalM(p.heightM, 'Hauteur');
  if (p.role !== undefined) op.role = p.role; if (p.system !== undefined) op.system = p.system; return [op];
}
export function cmdAddOpening(m: ArchitecturalModel, levelId: string, hostWallId: string, cls: string, system: string, widthM: string, heightM: string): Operation[] {
  const lv = levelById(m, levelId); if (!lv.walls.some((w) => w.id === hostWallId)) throw new Error(`Mur hôte inconnu : ${hostWallId}`);
  const id = freeId(m, 'O'); return [{ type: 'addOpening', levelId, opening: { id, code: id, hostWallId, class: cls, width: userAttr(decimalM(widthM, 'Largeur')), height: userAttr(decimalM(heightM, 'Hauteur')), spec: { system, origin: 'user_entered' } } }];
}
export function cmdSetOpening(m: ArchitecturalModel, openingId: string, widthM: string, heightM: string): Operation[] {
  if (!m.buildings.flatMap((b) => b.levels.flatMap((l) => l.openings)).some((o) => o.id === openingId)) throw new Error(`Ouverture inconnue : ${openingId}`);
  return [{ type: 'setOpeningSize', openingId, width: decimalM(widthM, 'Largeur'), height: decimalM(heightM, 'Hauteur') }];
}
export function cmdDeleteOpening(m: ArchitecturalModel, openingId: string): Operation[] {
  if (!m.buildings.flatMap((b) => b.levels.flatMap((l) => l.openings)).some((o) => o.id === openingId)) throw new Error(`Ouverture inconnue : ${openingId}`);
  return [{ type: 'removeOpening', openingId }];
}
export function cmdDeleteSpace(m: ArchitecturalModel, spaceId: string): Operation[] {
  if (!m.buildings.flatMap((b) => b.levels.flatMap((l) => l.spaces)).some((s) => s.id === spaceId)) throw new Error(`Pièce inconnue : ${spaceId}`);
  return [{ type: 'removeSpace', spaceId }];
}
/** Suppression d'un mur EN CASCADE explicite : ouvertures hébergées, suppression des pièces dont il est un côté (leur contour n'est plus fermé), mur, puis nœuds devenus orphelins. */
export function cmdDeleteWall(m: ArchitecturalModel, wallId: string): Operation[] {
  const lv = m.buildings.flatMap((b) => b.levels).find((l) => l.walls.some((w) => w.id === wallId)); if (!lv) throw new Error(`Mur inconnu : ${wallId}`);
  const wall = lv.walls.find((w) => w.id === wallId)!; const ops: Operation[] = [];
  for (const o of lv.openings.filter((x) => x.hostWallId === wallId)) ops.push({ type: 'removeOpening', openingId: o.id });
  for (const s of lv.spaces.filter((x) => x.boundaryWallIds.includes(wallId))) ops.push({ type: 'removeSpace', spaceId: s.id });   // un contour fermé privé d'un mur n'est plus fermé : la pièce disparaît (annulable)
  ops.push({ type: 'removeWall', wallId });
  for (const nid of new Set([wall.startNode, wall.endNode])) {
    const still = lv.walls.some((w) => w.id !== wallId && (w.startNode === nid || w.endNode === nid)) || lv.slabs.some((x) => x.outlineNodeIds.includes(nid)) || lv.roofs.some((x) => x.outlineNodeIds.includes(nid));
    if (!still) ops.push({ type: 'removeNode', nodeId: nid });
  }
  return ops;
}
/** Pièce rectangulaire : réutilise les nœuds et murs existants aux mêmes positions, crée le reste, puis la pièce. */
export function cmdCreateRoomRect(m: ArchitecturalModel, levelId: string, p0: Pt, p1: Pt, name: string, usage: string, props: WallProps): Operation[] {
  const lv = levelById(m, levelId); intPt(p0, 'Coin 1'); intPt(p1, 'Coin 2'); if (!name.trim()) throw new Error('Nom de pièce obligatoire');
  const x0 = Math.min(p0.x, p1.x), x1 = Math.max(p0.x, p1.x), y0 = Math.min(p0.y, p1.y), y1 = Math.max(p0.y, p1.y); if (x0 === x1 || y0 === y1) throw new Error('Pièce de surface nulle');
  const plan: Plan = { ops: [], nodes: new Map(), reserved: [] };
  const corners = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }].map((p) => ensureNode(m, lv, plan, p));
  const walls = corners.map((c, i) => ensureWall(m, lv, plan, c, corners[(i + 1) % 4]!, props));
  const id = freeId(m, 'S'); const space: Space = { id, code: id, name: name.trim(), usage, boundaryWallIds: walls, finishes: {} };
  plan.ops.push({ type: 'addSpace', levelId, space }); return plan.ops;
}
export function cmdCreateSpaceFromWalls(m: ArchitecturalModel, levelId: string, wallIds: string[], name: string, usage: string): Operation[] {
  const lv = levelById(m, levelId); if (new Set(wallIds).size < 3) throw new Error('Une pièce exige au moins 3 murs distincts'); if (!name.trim()) throw new Error('Nom de pièce obligatoire');
  for (const w of wallIds) if (!lv.walls.some((x) => x.id === w)) throw new Error(`Mur inconnu : ${w}`);
  const id = freeId(m, 'S'); return [{ type: 'addSpace', levelId, space: { id, code: id, name: name.trim(), usage, boundaryWallIds: [...new Set(wallIds)], finishes: {} } }];
}
export function cmdRenameSpace(m: ArchitecturalModel, spaceId: string, name: string, usage?: string): Operation[] {
  if (!m.buildings.flatMap((b) => b.levels.flatMap((l) => l.spaces)).some((s) => s.id === spaceId)) throw new Error(`Pièce inconnue : ${spaceId}`); if (!name.trim()) throw new Error('Nom de pièce obligatoire');
  return [{ type: 'setSpace', spaceId, name: name.trim(), ...(usage !== undefined ? { usage } : {}) }];
}
