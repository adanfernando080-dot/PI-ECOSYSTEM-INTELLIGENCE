/** Créateurs de projets. Les projets de démonstration sont SYNTHÉTIQUES et marqués comme tels (aucun plan ni prix réel). */
import type { ArchitecturalModel, Attr } from '../../../src/core/model/types.js';
import type { AssumptionSet } from '../../../src/core/assumptions/assumptions.js';
import type { ProjectState } from '../../../src/core/ops/oplog.js';
import { sha256Hex } from '../../../src/core/trace/sha256.js';
import { houseAssumptions, houseModel } from '../../../fixtures/synthetic/house.js';

const units = (v: string): number => {
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(v); if (!m) throw new Error(`Dimension invalide : « ${v} » (mètres, au plus 4 décimales)`);
  const n = Number(m[1]) * 10000 + Number(((m[2] ?? '') + '0000').slice(0, 4)); if (n <= 0) throw new Error('Dimension nulle'); return n;
};
const user = (value: string): Attr => ({ value, unit: 'm', origin: 'user_entered', validation: 'accepted' });

export const demoHouse = (): { name: string; state: ProjectState } => ({ name: 'Maison de démonstration (synthetic/test)', state: { model: houseModel(), assumptions: houseAssumptions() } });

export interface RoomForm { name: string; lengthM: string; widthM: string; thicknessM: string; wallClass: string; heightM: string; author: string; date: string }
/** Pièce rectangulaire saisie par l'utilisateur. La hauteur libre est une HYPOTHÈSE explicite (proposée, à confirmer), jamais un défaut caché. */
export function newRoomProject(f: RoomForm): { name: string; state: ProjectState } {
  const L = units(f.lengthM), W = units(f.widthM); units(f.thicknessM); units(f.heightM);
  const spec = { system: f.wallClass, origin: 'user_entered' as const };
  const wall = (id: string, a: string, b: string) => ({ id, code: id.toUpperCase(), startNode: a, endNode: b, thickness: user(f.thicknessM), height: { unit: 'm', origin: 'assumption' as const, assumptionId: 'A-01' }, role: 'exterior' as const, spec });
  const model: ArchitecturalModel = {
    schemaVersion: '1', id: 'model-' + sha256Hex(f.name + f.lengthM + f.widthM).slice(0, 8), name: f.name,
    planRevision: { sourceDocumentHash: 'sha256:' + sha256Hex('MANUAL-ENTRY:' + f.name), sheetId: 'saisie-manuelle', page: 1, label: 'Saisie manuelle (aucun plan importé)', supersedes: null },
    buildings: [{ id: 'bld-1', name: f.name, levels: [{
      id: 'lvl-0', code: 'RDC', name: 'Rez-de-chaussée', elevation: user('0.00'), clearHeight: { unit: 'm', origin: 'assumption', assumptionId: 'A-01' },
      nodes: [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: L, y: 0 }, { id: 'N3', x: L, y: W }, { id: 'N4', x: 0, y: W }],
      walls: [wall('w-s', 'N1', 'N2'), wall('w-e', 'N2', 'N3'), wall('w-n', 'N3', 'N4'), wall('w-w', 'N4', 'N1')],
      openings: [], spaces: [{ id: 'sp-1', code: 'R-1', name: f.name, usage: 'generic', boundaryWallIds: ['w-s', 'w-e', 'w-n', 'w-w'], finishes: {} }], slabs: [], roofs: [],
    }] }],
  };
  const assumptions: AssumptionSet = { id: 'assumptions-' + model.id, items: [{ id: 'A-01', key: 'level.clearHeight', value: { value: f.heightM, unit: 'm' }, scope: 'project', status: 'proposed', rationale: 'Hauteur libre saisie à la création — À CONFIRMER' }] };
  return { name: f.name, state: { model, assumptions } };
}
