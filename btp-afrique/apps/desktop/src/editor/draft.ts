/** Brouillon d'édition : des opérations PROPOSÉES, jamais appliquées tant que l'utilisateur ne valide pas (brouillon → validation → opérations → recalcul). */
import type { ArchitecturalModel } from '../../../../src/core/model/types.js';
import type { Operation } from '../../../../src/core/ops/oplog.js';
import { UNITS_PER_M } from './viewport.js';

export interface Draft { label: string; ops: Operation[] }
const m = (u: number): string => (u / UNITS_PER_M).toFixed(2);
const codeOf = (model: ArchitecturalModel, id: string): string => { for (const l of model.buildings.flatMap((b) => b.levels)) for (const e of [...l.walls, ...l.openings, ...l.spaces]) if (e.id === id) return e.code; return id; };

/** Description en français d'une opération (lisible par l'utilisateur dans le panneau de brouillon). */
export function describeOp(op: Operation, model: ArchitecturalModel): string {
  switch (op.type) {
    case 'addNode': return `Ajouter le point ${op.node.id} en (${m(op.node.x)} m ; ${m(op.node.y)} m)`;
    case 'removeNode': return `Supprimer le point ${op.nodeId}`;
    case 'moveNode': return `Déplacer le point ${op.nodeId} en (${m(op.x)} m ; ${m(op.y)} m)`;
    case 'addWall': return `Créer le mur ${op.wall.code} (${op.wall.startNode} → ${op.wall.endNode}), épaisseur ${op.wall.thickness.value ?? 'NON SPÉCIFIÉE'} m, ${op.wall.role === 'exterior' ? 'extérieur' : 'intérieur'}`;
    case 'removeWall': return `Supprimer le mur ${codeOf(model, op.wallId)}`;
    case 'setWallProps': return `Modifier le mur ${codeOf(model, op.wallId)} : ${[op.thicknessM && `épaisseur ${op.thicknessM} m`, op.heightM && `hauteur ${op.heightM} m`, op.role && `rôle ${op.role}`, op.system && `système ${op.system}`].filter(Boolean).join(', ')}`;
    case 'addOpening': return `Ajouter l'ouverture ${op.opening.code} (${op.opening.class}) ${op.opening.width.value} m × ${op.opening.height.value} m sur le mur ${codeOf(model, op.opening.hostWallId)}`;
    case 'removeOpening': return `Supprimer l'ouverture ${codeOf(model, op.openingId)}`;
    case 'setOpeningSize': return `Redimensionner l'ouverture ${codeOf(model, op.openingId)} : ${op.width} m × ${op.height} m`;
    case 'addSpace': return `Créer la pièce « ${op.space.name} » (${op.space.boundaryWallIds.length} murs)`;
    case 'removeSpace': return `Supprimer la pièce ${codeOf(model, op.spaceId)}`;
    case 'setSpace': return `Modifier la pièce ${codeOf(model, op.spaceId)}${op.name ? ` : nom « ${op.name} »` : ''}`;
    default: return op.type;
  }
}
