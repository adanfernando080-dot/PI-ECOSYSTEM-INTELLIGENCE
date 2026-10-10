// Sortie JSON des empreintes d'un chiffrage, pour comparer avec un AUTRE processus Node (reproductibilité inter-processus).
import { cell, house } from './env.js';
import { emitDocument } from '../../src/core/project/pipeline.js';
const out: Record<string, string> = {};
for (const [name, r] of [['cell-bj', cell('bj')], ['house-bj', house('bj')], ['house-sn', house('sn')], ['house-divergent', house('divergent')]] as const) {
  const d = emitDocument(r, { templateId: r.pack.documentTemplates[0]!.id, number: 'N', date: '2026-10-08', status: 'draft' });
  out[`${name}.takeoff`] = r.takeoff.contentHash; out[`${name}.quantitySet`] = r.quantitySet.contentHash; out[`${name}.estimate`] = r.estimate.contentHash; out[`${name}.document`] = d.contentHash;
}
process.stdout.write(JSON.stringify(out));
