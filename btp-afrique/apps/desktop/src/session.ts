/**
 * Session de travail = ProjectState + journal + liaison marché + dernier Run. Toutes les transitions sont PURES et passent par le
 * noyau (oplog, recompute) : l'interface n'a aucun calcul propre. Un changement invalide les documents émis (ils portent l'empreinte du run).
 */
import taxonomyJson from '../../../taxonomy/spec-taxonomy.json';
import type { Taxonomy } from '../../../src/core/model/validate.js';
import type { ResolvedPack } from '../../../src/core/pack/types.js';
import type { BindingRequest, MarketBinding } from '../../../src/core/pack/binding.js';
import type { OpRecord, Operation, ProjectState } from '../../../src/core/ops/oplog.js';
import { doGroup, EMPTY_HISTORY, redoLast, undoLast, verifyLedger, type History, type Ledger } from '../../../src/core/ops/history.js';
import { geometryProblems } from '../../../src/core/model/checks.js';
import { validateModel } from '../../../src/core/model/validate.js';
import { diffRuns, recompute, type ReuseReport, type RunDiff } from '../../../src/core/project/recompute.js';
import type { Run } from '../../../src/core/project/run.js';
import type { Document } from '../../../src/core/docs/document.js';
import { NO_MANUAL } from '../../../src/core/manual/manual.js';

export const TAXONOMY = taxonomyJson as unknown as Taxonomy;
export interface SourceBlob { bytes: Uint8Array; mediaType: string; originalName: string }
export interface Session {
  name: string; state: ProjectState; oplog: OpRecord[]; pack: ResolvedPack; binding: BindingRequest; run: Run; reuse: ReuseReport | null;
  documents: Document[]; history: History; historyWarnings: string[]; bindingHistory: MarketBinding[]; sources: Record<string, SourceBlob>; clock: number; dirty: boolean; actor: string;
}

export function openSession(o: { name: string; state: ProjectState; pack: ResolvedPack; binding: BindingRequest; oplog?: OpRecord[]; sources?: Record<string, SourceBlob>; actor?: string; clock?: number; prevRun?: Run | null; history?: History; bindingHistory?: MarketBinding[]; parentBinding?: MarketBinding | null }): Session {
  const { run, reuse } = recompute(o.prevRun ?? null, { taxonomy: TAXONOMY, state: { ...o.state, manual: o.state.manual ?? NO_MANUAL }, pack: o.pack, binding: o.binding, ...(o.parentBinding !== undefined ? { parentBinding: o.parentBinding } : {}) });
  return { name: o.name, state: { ...o.state, manual: o.state.manual ?? NO_MANUAL }, oplog: o.oplog ?? [], pack: o.pack, binding: o.binding, run, reuse: o.prevRun ? reuse : null, documents: [], ...restoreHistory(o), bindingHistory: histWith(o.bindingHistory ?? [], run.binding), sources: o.sources ?? {}, clock: o.clock ?? (o.oplog?.length ? o.oplog[o.oplog.length - 1]!.hlc.wall : 0), dirty: false, actor: o.actor ?? 'user:local' };
}

const histWith = (h: MarketBinding[], b: MarketBinding): MarketBinding[] => (h.some((x) => x.rev === b.rev) ? h : [...h, b]);
/** Valide un état proposé : schéma fermé + géométrie (ouverture plus large que son mur, murs nuls/doublons…). */
export const validateState = (st: ProjectState): string[] => [...validateModel(st.model, TAXONOMY), ...geometryProblems(st.model)];
function restoreHistory(o: { state: ProjectState; oplog?: OpRecord[]; history?: History }): { history: History; historyWarnings: string[] } {
  const log = o.oplog ?? []; const h = o.history ?? EMPTY_HISTORY; if (!log.length && !h.undo.length && !h.redo.length) return { history: EMPTY_HISTORY, historyWarnings: [] };
  const problems = verifyLedger({ state: o.state, log, history: h });
  return problems.length ? { history: EMPTY_HISTORY, historyWarnings: problems } : { history: h, historyWarnings: [] };
}
const ledgerOf = (s: Session): Ledger => ({ state: s.state, log: s.oplog, history: s.history });
const withLedger = (s: Session, l: Ledger, clock: number): Session => {
  const { run, reuse } = recompute(s.run, { taxonomy: TAXONOMY, state: l.state, pack: s.pack, binding: s.binding });
  return { ...s, state: l.state, oplog: l.log, history: l.history, run, reuse, documents: [], bindingHistory: histWith(s.bindingHistory, run.binding), clock, dirty: true };
};
const hlcOf = (s: Session, nowMs: number) => { const clock = Math.max(nowMs, s.clock + 1); return { clock, hlc: { wall: clock, counter: 0, node: 'ui' } }; };

/** Applique UN GROUPE d'opérations (un geste) : validation → opérations → recalcul. En cas d'erreur, la session d'origine est renvoyée intacte. */
export function commit(s: Session, ops: Operation[], label: string, nowMs: number): { session: Session; error: string | null } {
  try { const { clock, hlc } = hlcOf(s, nowMs); return { session: withLedger(s, doGroup(ledgerOf(s), ops, { label, actor: s.actor, hlc }, validateState), clock + ops.length), error: null }; }
  catch (e) { return { session: s, error: (e as Error).message }; }
}
/** Opération unique (formulaires des onglets) : un groupe d'une opération. */
export const apply = (s: Session, op: Operation, nowMs: number) => commit(s, [op], op.type, nowMs);
export function undo(s: Session, nowMs: number): { session: Session; error: string | null } {
  try { const { clock, hlc } = hlcOf(s, nowMs); return { session: withLedger(s, undoLast(ledgerOf(s), { actor: s.actor, hlc }, validateState), clock + 64), error: null }; } catch (e) { return { session: s, error: (e as Error).message }; }
}
export function redo(s: Session, nowMs: number): { session: Session; error: string | null } {
  try { const { clock, hlc } = hlcOf(s, nowMs); return { session: withLedger(s, redoLast(ledgerOf(s), { actor: s.actor, hlc }), clock + 64), error: null }; } catch (e) { return { session: s, error: (e as Error).message }; }
}
export interface Preview { ok: boolean; errors: string[]; run: Run | null; diff: RunDiff | null; blocked: number }
/** BROUILLON : applique le groupe sur une COPIE, valide, recalcule et compare — sans rien modifier dans la session. */
export function preview(s: Session, ops: Operation[], nowMs: number): Preview {
  try {
    const { hlc } = hlcOf(s, nowMs); const l = doGroup(ledgerOf(s), ops, { label: 'brouillon', actor: s.actor, hlc }, validateState);
    const { run } = recompute(s.run, { taxonomy: TAXONOMY, state: l.state, pack: s.pack, binding: s.binding });
    return { ok: true, errors: [], run, diff: diffRuns(s.run, run), blocked: run.takeoff.blocked.length };
  } catch (e) { return { ok: false, errors: (e as Error).message.split('\n').map((x) => x.replace(/^ - /, '')).filter(Boolean), run: null, diff: null, blocked: 0 }; }
}
/** Change de pack ou de paramètres de liaison : le modèle et les hypothèses ne sont JAMAIS modifiés (ADR-0004). */
export function rebind(s: Session, pack: ResolvedPack, binding: BindingRequest): { session: Session; error: string | null } {
  try {
    const { run, reuse } = recompute(s.run, { taxonomy: TAXONOMY, state: s.state, pack, binding });
    return { session: { ...s, pack, binding, run, reuse, documents: [], bindingHistory: histWith(s.bindingHistory, run.binding), dirty: true }, error: null };
  } catch (e) { return { session: s, error: (e as Error).message }; }
}
export function addDocument(s: Session, d: Document): Session { s.run.documents.push(d); return { ...s, documents: [...s.documents, d], dirty: true }; }
