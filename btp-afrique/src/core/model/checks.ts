/** Contrôles géométriques d'un modèle (en plus du schéma) : utilisés pour valider un BROUILLON avant de l'appliquer. Entiers 0,1 mm, aucun flottant. */
import { isqrt } from '../units/decimal.js';
import type { ArchitecturalModel } from './types.js';

const toUnits = (v: string | undefined): bigint | null => { const m = v === undefined ? null : /^(\d+)(?:\.(\d{1,4}))?$/.exec(v); return m ? BigInt(m[1]! + (m[2] ?? '').padEnd(4, '0')) : null; };
export function geometryProblems(model: ArchitecturalModel): string[] {
  const out: string[] = [];
  for (const lv of model.buildings.flatMap((b) => b.levels)) {
    const node = new Map(lv.nodes.map((n) => [n.id, n])); const len = new Map<string, bigint>(); const pairs = new Set<string>(); const coords = new Set<string>();
    for (const n of lv.nodes) { const k = `${n.x},${n.y}`; if (coords.has(k)) out.push(`nœuds superposés en (${n.x}, ${n.y})`); coords.add(k); }
    for (const w of lv.walls) {
      const a = node.get(w.startNode), b = node.get(w.endNode); if (!a || !b) continue;
      const dx = BigInt(b.x - a.x), dy = BigInt(b.y - a.y); const l = isqrt(dx * dx + dy * dy); len.set(w.id, l); if (l === 0n) out.push(`mur ${w.code} : longueur nulle`);
      const key = [w.startNode, w.endNode].sort().join('|'); if (pairs.has(key)) out.push(`mur ${w.code} : doublon entre les mêmes nœuds`); pairs.add(key);
      const t = toUnits(w.thickness.value); if (t !== null && l > 0n && t >= l) out.push(`mur ${w.code} : épaisseur ≥ longueur`);
    }
    for (const o of lv.openings) { const ow = toUnits(o.width.value), wl = len.get(o.hostWallId); if (ow !== null && wl !== undefined && ow > wl) out.push(`ouverture ${o.code} : largeur supérieure à la longueur du mur hôte`); }
  }
  return out;
}
