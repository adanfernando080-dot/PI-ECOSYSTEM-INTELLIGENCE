/**
 * Cellule « golden » : UNE pièce, QUATRE murs, UNE porte. Valeurs hand-checkables (voir tests/golden/cell.golden.test.ts).
 * Rectangle 5,00 × 4,00 m (axes), murs 0,20 m, hauteur 3,00 m (hypothèse A-01), porte 1,00 × 2,10 m dans le mur sud.
 */
import type { ArchitecturalModel } from '../../src/core/model/types.js';
import type { AssumptionSet } from '../../src/core/assumptions/assumptions.js';
import { assumed, confirmed, m, syntheticPlanRevision, userAttr } from './common.js';

export function cellModel(): ArchitecturalModel {
  const spec = { system: 'masonry.block.hollow', origin: 'user_entered' as const };
  const wall = (id: string, code: string, a: string, b: string) => ({
    id, code, startNode: a, endNode: b, thickness: userAttr('0.20'), height: assumed('A-01'), role: 'exterior' as const, spec,
  });
  return {
    schemaVersion: '1', id: 'model-cell', name: 'Cellule de référence (synthétique)',
    planRevision: syntheticPlanRevision('cell'),
    buildings: [{
      id: 'bld-1', name: 'Bâtiment test',
      levels: [{
        id: 'lvl-0', code: 'RDC', name: 'Rez-de-chaussée', elevation: userAttr('0.00'), clearHeight: assumed('A-01'),
        nodes: [{ id: 'C1', x: 0, y: 0 }, { id: 'C2', x: m('5.00'), y: 0 }, { id: 'C3', x: m('5.00'), y: m('4.00') }, { id: 'C4', x: 0, y: m('4.00') }],
        walls: [wall('w-s', 'W-S', 'C1', 'C2'), wall('w-e', 'W-E', 'C2', 'C3'), wall('w-n', 'W-N', 'C3', 'C4'), wall('w-w', 'W-W', 'C4', 'C1')],
        openings: [{ id: 'o-d1', code: 'D-1', hostWallId: 'w-s', class: 'opening.door.single', width: userAttr('1.00'), height: userAttr('2.10'), spec: { system: 'joinery.timber', origin: 'user_entered' } }],
        spaces: [{ id: 'sp-1', code: 'R-1', name: 'Cellule', usage: 'generic', boundaryWallIds: ['w-s', 'w-e', 'w-n', 'w-w'], finishes: {} }],
        slabs: [], roofs: [],
      }],
    }],
  };
}

export function cellAssumptions(): AssumptionSet {
  return { id: 'assumptions-cell', items: [confirmed('A-01', 'level.clearHeight', '3.00', 'm', 'DONNÉE DE TEST — hauteur libre')] };
}
