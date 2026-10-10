/**
 * Petite habitation synthétique : 3 pièces (séjour, chambre, salle d'eau), 10 murs, 7 ouvertures (3 portes, 4 fenêtres),
 * 1 dalle, 1 toiture à pente. Emprise 8,00 × 6,00 m (axes). TOUTES les valeurs sont des DONNÉES DE TEST.
 *
 *   y=6 ┌────────────┬────────┐
 *       │            │  SDB   │  SDB : (5..8) × (3.5..6)
 *       │   SÉJOUR   ├────────┤  CHAMBRE : (5..8) × (0..3.5)
 *       │            │ CHAMBRE│  SÉJOUR : (0..5) × (0..6)
 *   y=0 └────────────┴────────┘
 *      x=0           x=5      x=8
 */
import type { ArchitecturalModel, Attr } from '../../src/core/model/types.js';
import type { AssumptionSet } from '../../src/core/assumptions/assumptions.js';
import { assumed, confirmed, m, syntheticPlanRevision, userAttr } from './common.js';

export function houseModel(): ArchitecturalModel {
  const extSpec = { system: 'masonry.block.hollow', layers: [{ class: 'render.cementitious', side: 'exterior' as const }], origin: 'user_entered' as const };
  const partSpec = { origin: 'assumption' as const, assumptionId: 'A-02' };
  const ext = (id: string, code: string, a: string, b: string) => ({ id, code, startNode: a, endNode: b, thickness: userAttr('0.20'), height: assumed('A-01'), role: 'exterior' as const, spec: extSpec });
  const part = (id: string, code: string, a: string, b: string) => ({ id, code, startNode: a, endNode: b, thickness: assumed('A-03'), height: assumed('A-01'), role: 'interior' as const, spec: partSpec });
  const door = (id: string, code: string, host: string, w: string): ReturnType<typeof opening> => opening(id, code, host, 'opening.door.single', w, '2.10', 'joinery.timber');
  const win = (id: string, code: string, host: string, w: string, h: string): ReturnType<typeof opening> => opening(id, code, host, 'opening.window.casement', w, h, 'joinery.aluminium');
  function opening(id: string, code: string, host: string, cls: string, w: string, h: string, mat: string) {
    return { id, code, hostWallId: host, class: cls, width: userAttr(w), height: userAttr(h), spec: { system: mat, origin: 'user_entered' as const } };
  }
  const wallFinish = ['render.cementitious', 'paint.emulsion'];
  const aiBatch = (value: string): Attr => ({ value, unit: 'm', origin: 'ai_detected', confidence: '0.72', validation: 'batch_accepted', evidence: { sheetId: 'sheet-house', page: 1, bbox: [100, 200, 40, 40], detectorId: 'synthetic-detector@0', modelHash: 'sha256:synthetic' } });
  const w04 = win('o-w4', 'W-04', 'w-04', '0.60', '0.60');
  w04.width = aiBatch('0.60'); w04.height = aiBatch('0.60');
  return {
    schemaVersion: '1', id: 'model-house', name: 'Petite habitation de référence (synthétique)',
    planRevision: syntheticPlanRevision('house'),
    buildings: [{
      id: 'bld-1', name: 'Habitation test',
      levels: [{
        id: 'lvl-0', code: 'RDC', name: 'Rez-de-chaussée', elevation: userAttr('0.00'), clearHeight: assumed('A-01'),
        nodes: [
          { id: 'N1', x: 0, y: 0 }, { id: 'N2', x: m('5.00'), y: 0 }, { id: 'N3', x: m('8.00'), y: 0 }, { id: 'N4', x: m('8.00'), y: m('3.50') },
          { id: 'N5', x: m('8.00'), y: m('6.00') }, { id: 'N6', x: m('5.00'), y: m('6.00') }, { id: 'N7', x: 0, y: m('6.00') }, { id: 'N8', x: m('5.00'), y: m('3.50') },
          { id: 'S1', x: -m('0.10'), y: -m('0.10') }, { id: 'S2', x: m('8.10'), y: -m('0.10') }, { id: 'S3', x: m('8.10'), y: m('6.10') }, { id: 'S4', x: -m('0.10'), y: m('6.10') },
        ],
        walls: [
          ext('w-01', 'W01', 'N1', 'N2'), ext('w-02', 'W02', 'N2', 'N3'), ext('w-03', 'W03', 'N3', 'N4'), ext('w-04', 'W04', 'N4', 'N5'),
          ext('w-05', 'W05', 'N5', 'N6'), ext('w-06', 'W06', 'N6', 'N7'), ext('w-07', 'W07', 'N7', 'N1'),
          part('w-08', 'W08', 'N2', 'N8'), part('w-09', 'W09', 'N8', 'N6'), part('w-10', 'W10', 'N8', 'N4'),
        ],
        openings: [
          door('o-d1', 'D-01', 'w-01', '1.00'), win('o-w1', 'W-01', 'w-01', '1.20', '1.20'), win('o-w2', 'W-02', 'w-06', '1.20', '1.20'),
          door('o-d2', 'D-02', 'w-08', '0.90'), win('o-w3', 'W-03', 'w-03', '1.20', '1.20'), door('o-d3', 'D-03', 'w-09', '0.90'), w04,
        ],
        spaces: [
          { id: 'sp-sal', code: 'SAL', name: 'Séjour', usage: 'living', boundaryWallIds: ['w-01', 'w-08', 'w-09', 'w-06', 'w-07'], finishes: { floor: ['floor.tile.ceramic'], wall: wallFinish, ceiling: ['paint.emulsion'] } },
          { id: 'sp-cha', code: 'CHA', name: 'Chambre', usage: 'bedroom', boundaryWallIds: ['w-02', 'w-03', 'w-10', 'w-08'], finishes: { floor: ['floor.tile.ceramic'], wall: wallFinish, ceiling: ['paint.emulsion'] } },
          { id: 'sp-sdb', code: 'SDB', name: "Salle d'eau", usage: 'bathroom', boundaryWallIds: ['w-10', 'w-04', 'w-05', 'w-09'], finishes: { floor: ['floor.tile.ceramic'], wall: ['render.cementitious', 'wall.tile.ceramic'], ceiling: ['paint.emulsion'] } },
        ],
        slabs: [{ id: 'sl-1', code: 'DAL1', outlineNodeIds: ['S1', 'S2', 'S3', 'S4'], thickness: userAttr('0.12'), spec: { system: 'slab.reinforced.concrete', origin: 'user_entered' } }],
        roofs: [{ id: 'rf-1', code: 'TOI1', outlineNodeIds: ['S1', 'S2', 'S3', 'S4'], rise: userAttr('0.30', 'm'), run: userAttr('1.00', 'm'), spec: { system: 'roof.sheet.metal', origin: 'user_entered' } }],
      }],
    }],
  };
}

export function houseAssumptions(): AssumptionSet {
  return {
    id: 'assumptions-house',
    items: [
      confirmed('A-01', 'level.clearHeight', '3.00', 'm', 'DONNÉE DE TEST — hauteur libre lue sur la coupe synthétique'),
      confirmed('A-02', 'partition.system', 'masonry.block.hollow', undefined, 'DONNÉE DE TEST — nature des cloisons non cotée sur le plan'),
      confirmed('A-03', 'partition.thickness', '0.10', 'm', 'DONNÉE DE TEST — épaisseur des cloisons non cotée sur le plan'),
    ],
  };
}
