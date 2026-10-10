/**
 * Journal d'opérations (ADR-0009). Toute modification est une opération immuable, inversible, horodatée (HLC fourni
 * par l'appelant : le noyau n'a pas d'horloge). Les états sont immuables : chaque opération produit une NOUVELLE révision.
 */
import type { ArchitecturalModel } from '../model/types.js';
import type { AssumptionSet } from '../assumptions/assumptions.js';
import { hashOf } from '../trace/canonical.js';

export type Operation =
  | { type: 'moveNode'; nodeId: string; x: number; y: number }
  | { type: 'setOpeningSize'; openingId: string; width: string; height: string }
  | { type: 'setAssumptionValue'; assumptionId: string; value: string };

export interface Hlc { wall: number; counter: number; node: string }
export interface ProjectState { model: ArchitecturalModel; assumptions: AssumptionSet }
export interface OpRecord { opId: string; parentRev: string | null; resultRev: string; op: Operation; inverse: Operation; hlc: Hlc; actor: string }

export const stateRev = (s: ProjectState): string => hashOf({ model: hashOf(s.model), assumptions: hashOf(s.assumptions) });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function applyOperation(state: ProjectState, op: Operation, meta: { hlc: Hlc; actor: string }): { state: ProjectState; record: OpRecord } {
  const next = clone(state);
  let inverse: Operation;
  switch (op.type) {
    case 'moveNode': {
      const node = next.model.buildings.flatMap((b) => b.levels.flatMap((l) => l.nodes)).find((n) => n.id === op.nodeId);
      if (!node) throw new Error(`Nœud inconnu : ${op.nodeId}`);
      inverse = { type: 'moveNode', nodeId: op.nodeId, x: node.x, y: node.y };
      node.x = op.x; node.y = op.y; break;
    }
    case 'setOpeningSize': {
      const o = next.model.buildings.flatMap((b) => b.levels.flatMap((l) => l.openings)).find((x) => x.id === op.openingId);
      if (!o) throw new Error(`Ouverture inconnue : ${op.openingId}`);
      if (o.width.origin === 'assumption' || o.height.origin === 'assumption') throw new Error('setOpeningSize : dimension issue d\'une hypothèse — modifier l\'hypothèse');
      inverse = { type: 'setOpeningSize', openingId: op.openingId, width: o.width.value!, height: o.height.value! };
      o.width = { ...o.width, value: op.width, origin: 'user_corrected', validation: 'edited', confidence: null };
      o.height = { ...o.height, value: op.height, origin: 'user_corrected', validation: 'edited', confidence: null }; break;
    }
    case 'setAssumptionValue': {
      const it = next.assumptions.items.find((i) => i.id === op.assumptionId);
      if (!it) throw new Error(`Hypothèse inconnue : ${op.assumptionId}`);
      inverse = { type: 'setAssumptionValue', assumptionId: op.assumptionId, value: it.value.value };
      it.value = { ...it.value, value: op.value }; break;
    }
  }
  const parentRev = stateRev(state); const resultRev = stateRev(next);
  const record: OpRecord = { opId: hashOf({ parentRev, op, hlc: meta.hlc, actor: meta.actor }).slice(7, 23), parentRev, resultRev, op, inverse, hlc: meta.hlc, actor: meta.actor };
  return { state: next, record };
}

/** Annule une opération en appliquant son inverse (nouvelle opération, jamais une réécriture de l'historique). */
export function undoOperation(state: ProjectState, record: OpRecord, meta: { hlc: Hlc; actor: string }): { state: ProjectState; record: OpRecord } {
  if (stateRev(state) !== record.resultRev) throw new Error('undo : l\'état courant n\'est pas celui produit par cette opération');
  return applyOperation(state, record.inverse, meta);
}
