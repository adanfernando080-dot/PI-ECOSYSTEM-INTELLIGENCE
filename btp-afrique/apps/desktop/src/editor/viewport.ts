/**
 * Géométrie d'affichage de l'éditeur (pure, testable). Monde = entiers 0,1 mm (axe Y vers le haut) ; écran = pixels (flottants, AFFICHAGE seulement).
 * Rien de ce qui sort d'ici n'est un résultat de calcul : seuls les points ARRONDIS à l'entier (monde) peuvent devenir des commandes.
 */
import type { Level } from '../../../../src/core/model/types.js';

export const UNITS_PER_M = 10_000;
export interface View { /** pixels par mètre */ ppm: number; /** coin bas-gauche visible, en unités du modèle */ ox: number; oy: number; w: number; h: number }
export const toScreen = (v: View, x: number, y: number): { x: number; y: number } => ({ x: ((x - v.ox) / UNITS_PER_M) * v.ppm, y: v.h - ((y - v.oy) / UNITS_PER_M) * v.ppm });
export const toWorld = (v: View, px: number, py: number): { x: number; y: number } => ({ x: v.ox + (px / v.ppm) * UNITS_PER_M, y: v.oy + ((v.h - py) / v.ppm) * UNITS_PER_M });
export const GRID_STEPS_M = ['0.05', '0.10', '0.25', '0.50', '1.00'] as const;
export const gridUnits = (stepM: string): number => Math.round(Number(stepM) * UNITS_PER_M);

export function fitView(level: Level, w: number, h: number, padPx = 40): View {
  if (!level.nodes.length) return { ppm: 60, ox: -UNITS_PER_M, oy: -UNITS_PER_M, w, h };
  const xs = level.nodes.map((n) => n.x), ys = level.nodes.map((n) => n.y); const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanM = Math.max((maxX - minX) / UNITS_PER_M, 1), spanY = Math.max((maxY - minY) / UNITS_PER_M, 1);
  const ppm = Math.max(5, Math.min((w - 2 * padPx) / spanM, (h - 2 * padPx) / spanY));
  return { ppm, ox: minX - (padPx / ppm) * UNITS_PER_M, oy: minY - (padPx / ppm) * UNITS_PER_M, w, h };
}
export function zoomAt(v: View, factor: number, px: number, py: number): View {
  const f = Math.max(0.2, Math.min(5, factor)); const ppm = Math.max(4, Math.min(2000, v.ppm * f)); const before = toWorld(v, px, py);
  const nv = { ...v, ppm }; const after = toWorld(nv, px, py); return { ...nv, ox: v.ox + (before.x - after.x), oy: v.oy + (before.y - after.y) };
}
export const panBy = (v: View, dpx: number, dpy: number): View => ({ ...v, ox: v.ox - (dpx / v.ppm) * UNITS_PER_M, oy: v.oy + (dpy / v.ppm) * UNITS_PER_M });

export type Snap = { pt: { x: number; y: number }; kind: 'node' | 'grid' | 'none'; nodeId?: string };
/** Aimantation : nœud existant dans un rayon en pixels, sinon grille (entiers). Résultat TOUJOURS entier. */
export function snapPoint(v: View, level: Level, px: number, py: number, grid: number, radiusPx = 10, useGrid = true): Snap {
  const w = toWorld(v, px, py);
  let best: { id: string; d: number } | null = null;
  for (const n of level.nodes) { const s = toScreen(v, n.x, n.y); const d = Math.hypot(s.x - px, s.y - py); if (d <= radiusPx && (!best || d < best.d)) best = { id: n.id, d }; }
  if (best) { const n = level.nodes.find((x) => x.id === best!.id)!; return { pt: { x: n.x, y: n.y }, kind: 'node', nodeId: n.id }; }
  if (useGrid && grid > 0) return { pt: { x: Math.round(w.x / grid) * grid, y: Math.round(w.y / grid) * grid }, kind: 'grid' };
  return { pt: { x: Math.round(w.x), y: Math.round(w.y) }, kind: 'none' };
}

export type Hit = { kind: 'node' | 'opening' | 'wall' | 'space'; id: string } | null;
const distSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): { d: number; t: number } => {
  const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy; const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
};
/** Sélection à la position écran : nœud > ouverture > mur > pièce (intérieur du rectangle des nœuds de ses murs). */
export function hitTest(v: View, level: Level, px: number, py: number, tolPx = 7): Hit {
  const node = new Map(level.nodes.map((n) => [n.id, n]));
  for (const n of level.nodes) { const s = toScreen(v, n.x, n.y); if (Math.hypot(s.x - px, s.y - py) <= tolPx + 2) return { kind: 'node', id: n.id }; }
  for (const o of level.openings) { const m = openingAnchor(v, level, o.id); if (m && Math.hypot(m.x - px, m.y - py) <= tolPx + 3) return { kind: 'opening', id: o.id }; }
  let bestW: { id: string; d: number } | null = null;
  for (const w of level.walls) { const a = node.get(w.startNode), b = node.get(w.endNode); if (!a || !b) continue; const sa = toScreen(v, a.x, a.y), sb = toScreen(v, b.x, b.y); const { d } = distSeg(px, py, sa.x, sa.y, sb.x, sb.y); if (d <= tolPx && (!bestW || d < bestW.d)) bestW = { id: w.id, d }; }
  if (bestW) return { kind: 'wall', id: bestW.id };
  for (const s of level.spaces) {
    const pts = s.boundaryWallIds.flatMap((id) => { const w = level.walls.find((x) => x.id === id); return w ? [node.get(w.startNode), node.get(w.endNode)] : []; }).filter(Boolean) as { x: number; y: number }[];
    if (!pts.length) continue; const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x)), y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
    const w = toWorld(v, px, py); if (w.x > x0 && w.x < x1 && w.y > y0 && w.y < y1) return { kind: 'space', id: s.id };
  }
  return null;
}
/** Les ouvertures n'ont pas de position dans le modèle : elles sont représentées au milieu de leur mur (schématique), décalées si plusieurs. */
export function openingAnchor(v: View, level: Level, openingId: string): { x: number; y: number } | null {
  const o = level.openings.find((x) => x.id === openingId); if (!o) return null; const w = level.walls.find((x) => x.id === o.hostWallId); if (!w) return null;
  const a = level.nodes.find((n) => n.id === w.startNode), b = level.nodes.find((n) => n.id === w.endNode); if (!a || !b) return null;
  const siblings = level.openings.filter((x) => x.hostWallId === w.id); const k = siblings.findIndex((x) => x.id === openingId); const t = (k + 1) / (siblings.length + 1);
  return toScreen(v, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}
/** Barre d'échelle : longueur ronde en mètres, largeur en pixels, libellé avec unité explicite. */
export function scaleBar(v: View): { px: number; label: string } {
  const target = 120 / v.ppm; const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].find((n) => n >= target) ?? 100; return { px: nice * v.ppm, label: `${nice} m` };
}
export const fmtM = (units: number): string => (units / UNITS_PER_M).toFixed(2);
/** Saisie « mètres » → unités entières (sans flottant ; au plus 4 décimales). */
export function parseMetres(s: string): number | null { const m = /^(-?)(\d+)(?:[.,](\d{1,4}))?$/.exec(s.trim()); return m ? (m[1] ? -1 : 1) * Number(m[2] + (m[3] ?? '').padEnd(4, '0')) : null; }
