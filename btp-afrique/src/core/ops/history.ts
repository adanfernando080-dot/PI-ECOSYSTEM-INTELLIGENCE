/**
 * Historique annulable/rétablissable (ADR-0009, ADR-0021). Le JOURNAL est append-only ; la pile d'annulation référence des GROUPES
 * d'opérations (un geste = un groupe = atomique : tout ou rien, un seul recalcul). Annuler applique les inverses en ordre inverse
 * (nouvelles opérations, jamais de réécriture) ; rétablir rejoue les opérations d'origine. Toute nouvelle modification vide la pile de rétablissement.
 */
import { hashOf } from '../trace/canonical.js';
import { applyOperation, stateRev, type Hlc, type OpRecord, type Operation, type ProjectState } from './oplog.js';

export interface HistoryEntry { id: string; label: string; actor: string; /** opId des enregistrements du journal appliqués par ce groupe, dans l'ordre */ opIds: string[] }
export interface History { undo: HistoryEntry[]; redo: HistoryEntry[] }
export interface Ledger { state: ProjectState; log: OpRecord[]; history: History }
export interface GroupMeta { label: string; actor: string; hlc: Hlc }
export const EMPTY_HISTORY: History = { undo: [], redo: [] };
export type Validator = (state: ProjectState) => string[];

function run(l: Ledger, ops: Operation[], meta: GroupMeta, validate?: Validator): { state: ProjectState; records: OpRecord[] } {
  if (ops.length === 0) throw new Error('Groupe d\'opérations vide');
  let st = l.state; const records: OpRecord[] = [];
  ops.forEach((op, i) => { const r = applyOperation(st, op, { hlc: { ...meta.hlc, counter: meta.hlc.counter + i }, actor: meta.actor }); st = r.state; records.push(r.record); });
  const errs = validate ? validate(st) : [];
  if (errs.length) throw new Error('Modification refusée :\n - ' + errs.join('\n - '));
  return { state: st, records };
}
const entryOf = (label: string, actor: string, records: OpRecord[]): HistoryEntry => ({ id: hashOf({ label, ids: records.map((r) => r.opId) }).slice(7, 23), label, actor, opIds: records.map((r) => r.opId) });

/** Applique un groupe atomiquement. Si une opération échoue ou si la validation refuse, le registre d'origine est inchangé (exception). */
export function doGroup(l: Ledger, ops: Operation[], meta: GroupMeta, validate?: Validator): Ledger {
  const r = run(l, ops, meta, validate);
  return { state: r.state, log: [...l.log, ...r.records], history: { undo: [...l.history.undo, entryOf(meta.label, meta.actor, r.records)], redo: [] } };
}
const recordsOf = (l: Ledger, e: HistoryEntry): OpRecord[] => e.opIds.map((id) => { const r = l.log.find((x) => x.opId === id); if (!r) throw new Error(`Journal incomplet : enregistrement ${id} introuvable`); return r; });

export function undoLast(l: Ledger, meta: Omit<GroupMeta, 'label'>, validate?: Validator): Ledger {
  const e = l.history.undo[l.history.undo.length - 1]; if (!e) throw new Error('Rien à annuler');
  const recs = recordsOf(l, e); if (stateRev(l.state) !== recs[recs.length - 1]!.resultRev) throw new Error('Annulation impossible : l\'état courant n\'est pas celui produit par ce groupe');
  const r = run(l, recs.map((x) => x.inverse).reverse(), { ...meta, label: `Annuler : ${e.label}` }, validate);
  return { state: r.state, log: [...l.log, ...r.records], history: { undo: l.history.undo.slice(0, -1), redo: [...l.history.redo, e] } };
}
export function redoLast(l: Ledger, meta: Omit<GroupMeta, 'label'>, validate?: Validator): Ledger {
  const e = l.history.redo[l.history.redo.length - 1]; if (!e) throw new Error('Rien à rétablir');
  const recs = recordsOf(l, e); if (stateRev(l.state) !== recs[0]!.parentRev) throw new Error('Rétablissement impossible : l\'état courant n\'est pas celui précédant ce groupe');
  const r = run(l, recs.map((x) => x.op), { ...meta, label: e.label }, validate);
  return { state: r.state, log: [...l.log, ...r.records], history: { undo: [...l.history.undo, entryOf(e.label, e.actor, r.records)], redo: l.history.redo.slice(0, -1) } };
}

/** Cohérence d'un registre rouvert : le dernier enregistrement doit produire l'état courant ; les groupes référencent des enregistrements existants. */
export function verifyLedger(l: Ledger): string[] {
  const p: string[] = []; const ids = new Set(l.log.map((r) => r.opId));
  if (l.log.length && l.log[l.log.length - 1]!.resultRev !== stateRev(l.state)) p.push('le dernier enregistrement du journal ne produit pas l\'état courant');
  for (let i = 1; i < l.log.length; i++) if (l.log[i]!.parentRev !== l.log[i - 1]!.resultRev) p.push(`journal discontinu à l'enregistrement ${i}`);
  for (const e of [...l.history.undo, ...l.history.redo]) for (const id of e.opIds) if (!ids.has(id)) p.push(`groupe « ${e.label} » : enregistrement ${id} absent du journal`);
  return p;
}
