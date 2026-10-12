/**
 * Journal d'opérations (ADR-0009). Toute modification est une opération immuable, inversible, horodatée (HLC fourni
 * par l'appelant : le noyau n'a pas d'horloge). Les états sont immuables : chaque opération produit une NOUVELLE révision.
 */
import type { ArchitecturalModel } from '../model/types.js';
import type { AssumptionSet } from '../assumptions/assumptions.js';
import { hashOf } from '../trace/canonical.js';
import { NO_MANUAL, type ManualEntries, type ManualLine, type QuantityAdjustment } from '../manual/manual.js';

export type Operation =
  | { type: 'moveNode'; nodeId: string; x: number; y: number }
  | { type: 'setOpeningSize'; openingId: string; width: string; height: string }
  | { type: 'setAssumptionValue'; assumptionId: string; value: string }
  | { type: 'addManualLine'; line: ManualLine }
  | { type: 'removeManualLine'; id: string }
  | { type: 'setAdjustment'; adjustment: QuantityAdjustment }
  | { type: 'removeAdjustment'; id: string };

export interface Hlc { wall: number; counter: number; node: string }
export interface ProjectState { model: ArchitecturalModel; assumptions: AssumptionSet; manual?: ManualEntries }
export interface OpRecord { opId: string; parentRev: string | null; resultRev: string; op: Operation; inverse: Operation; hlc: Hlc; actor: string }

export const stateRev = (s: ProjectState): string => hashOf({ model: hashOf(s.model), assumptions: hashOf(s.assumptions), manual: hashOf(s.manual ?? NO_MANUAL) });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function applyOperation(state: ProjectState, op: Operation, meta: { hlc: Hlc; actor: string }): { state: ProjectState; record: OpRecord } {
  const next = clone(state);
  next.manual = next.manual ?? clone(NO_MANUAL);
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
    case 'addManualLine': {
      if (next.manual!.lines.some((l) => l.id === op.line.id)) throw new Error(`Ligne manuelle déjà existante : ${op.line.id}`);
      next.manual!.lines.push(clone(op.line)); inverse = { type: 'removeManualLine', id: op.line.id }; break;
    }
    case 'removeManualLine': {
      const i = next.manual!.lines.findIndex((l) => l.id === op.id);
      if (i < 0) throw new Error(`Ligne manuelle inconnue : ${op.id}`);
      inverse = { type: 'addManualLine', line: clone(next.manual!.lines[i]!) }; next.manual!.lines.splice(i, 1); break;
    }
    case 'setAdjustment': {
      const i = next.manual!.adjustments.findIndex((a) => a.id === op.adjustment.id);
      if (i < 0) { next.manual!.adjustments.push(clone(op.adjustment)); inverse = { type: 'removeAdjustment', id: op.adjustment.id }; }
      else { inverse = { type: 'setAdjustment', adjustment: clone(next.manual!.adjustments[i]!) }; next.manual!.adjustments[i] = clone(op.adjustment); }
      break;
    }
    case 'removeAdjustment': {
      const i = next.manual!.adjustments.findIndex((a) => a.id === op.id);
      if (i < 0) throw new Error(`Ajustement inconnu : ${op.id}`);
      inverse = { type: 'setAdjustment', adjustment: clone(next.manual!.adjustments[i]!) }; next.manual!.adjustments.splice(i, 1); break;
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
