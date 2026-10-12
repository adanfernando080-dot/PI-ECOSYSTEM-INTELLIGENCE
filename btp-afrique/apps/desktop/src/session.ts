/**
 * Session de travail = ProjectState + journal + liaison marché + dernier Run. Toutes les transitions sont PURES et passent par le
 * noyau (oplog, recompute) : l'interface n'a aucun calcul propre. Un changement invalide les documents émis (ils portent l'empreinte du run).
 */
import taxonomyJson from '../../../taxonomy/spec-taxonomy.json';
import type { Taxonomy } from '../../../src/core/model/validate.js';
import type { ResolvedPack } from '../../../src/core/pack/types.js';
import type { BindingRequest, MarketBinding } from '../../../src/core/pack/binding.js';
import { applyOperation, undoOperation, type OpRecord, type Operation, type ProjectState } from '../../../src/core/ops/oplog.js';
import { recompute, type ReuseReport } from '../../../src/core/project/recompute.js';
import type { Run } from '../../../src/core/project/run.js';
import type { Document } from '../../../src/core/docs/document.js';
import { NO_MANUAL } from '../../../src/core/manual/manual.js';

export const TAXONOMY = taxonomyJson as unknown as Taxonomy;
export interface SourceBlob { bytes: Uint8Array; mediaType: string; originalName: string }
export interface Session {
  name: string; state: ProjectState; oplog: OpRecord[]; pack: ResolvedPack; binding: BindingRequest; run: Run; reuse: ReuseReport | null;
  documents: Document[]; bindingHistory: MarketBinding[]; sources: Record<string, SourceBlob>; clock: number; dirty: boolean; actor: string;
}

export function openSession(o: { name: string; state: ProjectState; pack: ResolvedPack; binding: BindingRequest; oplog?: OpRecord[]; sources?: Record<string, SourceBlob>; actor?: string; clock?: number; prevRun?: Run | null; bindingHistory?: MarketBinding[]; parentBinding?: MarketBinding | null }): Session {
  const { run, reuse } = recompute(o.prevRun ?? null, { taxonomy: TAXONOMY, state: { ...o.state, manual: o.state.manual ?? NO_MANUAL }, pack: o.pack, binding: o.binding, ...(o.parentBinding !== undefined ? { parentBinding: o.parentBinding } : {}) });
  return { name: o.name, state: { ...o.state, manual: o.state.manual ?? NO_MANUAL }, oplog: o.oplog ?? [], pack: o.pack, binding: o.binding, run, reuse: o.prevRun ? reuse : null, documents: [], bindingHistory: histWith(o.bindingHistory ?? [], run.binding), sources: o.sources ?? {}, clock: o.clock ?? (o.oplog?.length ? o.oplog[o.oplog.length - 1]!.hlc.wall : 0), dirty: false, actor: o.actor ?? 'user:local' };
}

const histWith = (h: MarketBinding[], b: MarketBinding): MarketBinding[] => (h.some((x) => x.rev === b.rev) ? h : [...h, b]);
const withState = (s: Session, state: ProjectState, oplog: OpRecord[], clock: number): Session => {
  const { run, reuse } = recompute(s.run, { taxonomy: TAXONOMY, state, pack: s.pack, binding: s.binding });
  return { ...s, state, oplog, run, reuse, documents: [], bindingHistory: histWith(s.bindingHistory, run.binding), clock, dirty: true };
};

/** Applique une opération ; en cas d'erreur du noyau, la session d'origine est renvoyée intacte avec le message. */
export function apply(s: Session, op: Operation, nowMs: number): { session: Session; error: string | null } {
  try {
    const clock = Math.max(nowMs, s.clock + 1);
    const r = applyOperation(s.state, op, { hlc: { wall: clock, counter: 0, node: 'ui' }, actor: s.actor });
    return { session: withState(s, r.state, [...s.oplog, r.record], clock), error: null };
  } catch (e) { return { session: s, error: (e as Error).message }; }
}
export function undo(s: Session, nowMs: number): { session: Session; error: string | null } {
  const last = s.oplog[s.oplog.length - 1]; if (!last) return { session: s, error: 'Rien à annuler' };
  try {
    const clock = Math.max(nowMs, s.clock + 1);
    const r = undoOperation(s.state, last, { hlc: { wall: clock, counter: 0, node: 'ui' }, actor: s.actor });
    return { session: withState(s, r.state, [...s.oplog, r.record], clock), error: null };
  } catch (e) { return { session: s, error: (e as Error).message }; }
}
/** Change de pack ou de paramètres de liaison : le modèle et les hypothèses ne sont JAMAIS modifiés (ADR-0004). */
export function rebind(s: Session, pack: ResolvedPack, binding: BindingRequest): { session: Session; error: string | null } {
  try {
    const { run, reuse } = recompute(s.run, { taxonomy: TAXONOMY, state: s.state, pack, binding });
    return { session: { ...s, pack, binding, run, reuse, documents: [], bindingHistory: histWith(s.bindingHistory, run.binding), dirty: true }, error: null };
  } catch (e) { return { session: s, error: (e as Error).message }; }
}
export function addDocument(s: Session, d: Document): Session { s.run.documents.push(d); return { ...s, documents: [...s.documents, d], dirty: true }; }
