/**
 * Lien traçable objet graphique → modèle → métrés → lignes de chiffrage (préparation de l'éditeur 2D, ADR-0021).
 * Un objet dessiné porte l'identifiant de son entité du modèle ; ce module retrouve, dans le Run, tout ce qui en dépend. Lecture seule.
 */
import type { Run } from '../../../../src/core/project/run.js';

export interface EntityLinks { entityId: string; geoQuantityIds: string[]; ouvrageIds: string[]; estimateLineIds: string[] }
export function linksFor(run: Run, entityId: string): EntityLinks {
  const geo = run.takeoff.quantities.filter((q) => q.entity.id === entityId).map((q) => q.id); const geoSet = new Set(geo);
  const ouvrages = run.quantitySet.ouvrages.filter((o) => o.contributions.some((c) => c.entity.id === entityId || c.geoRefs.some((g) => geoSet.has(g)))).map((o) => o.id);
  const oset = new Set(ouvrages);
  return { entityId, geoQuantityIds: geo, ouvrageIds: ouvrages, estimateLineIds: run.estimate.lines.filter((l) => l.source === 'engine' && oset.has(l.ouvrageId)).map((l) => l.id) };
}
