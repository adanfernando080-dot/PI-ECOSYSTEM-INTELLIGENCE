/**
 * Porte de validation humaine : SEUL chemin par lequel une proposition peut modifier le modèle, et uniquement par des opérations
 * ordinaires (oplog) émises APRÈS une décision explicite. Rien n'est appliqué par défaut ; refuser ne touche pas le modèle.
 */
import { applyOperation, type Hlc, type OpRecord, type Operation, type ProjectState } from '../ops/oplog.js';
import type { Wall, Opening, Attr } from '../model/types.js';
import { pxToModel, type AiProposal, type ProposalPayload, type ScaleCalibration } from './contracts.js';

export interface Decision { action: 'accept' | 'edit' | 'reject'; actor: string; edited?: ProposalPayload; reason?: string }
export interface GateContext { state: ProjectState; levelId: string; scale: ScaleCalibration | null; hlc: Hlc; /** ids déjà acceptés : proposalId → wallId */ accepted: Record<string, string> }
export interface GateResult { proposal: AiProposal; state: ProjectState; records: OpRecord[]; accepted: Record<string, string> }

const attr = (value: string | undefined, p: AiProposal, edited: boolean): Attr => ({
  ...(value !== undefined ? { value } : {}), unit: 'm', origin: edited ? 'user_corrected' : 'ai_detected', confidence: p.confidence, validation: edited ? 'edited' : 'accepted',
  evidence: { sourceHash: p.evidence.sourceId, page: p.evidence.page, ...(p.evidence.bbox ? { bbox: p.evidence.bbox } : {}), detectorId: p.evidence.detectorId, modelHash: p.evidence.modelHash },
});

export function decide(p: AiProposal, d: Decision, ctx: GateContext): GateResult {
  if (p.state !== 'proposed') throw new Error(`Proposition ${p.id} déjà traitée (${p.state})`);
  if (!d.actor) throw new Error('Décision sans auteur');
  if (d.action === 'reject') return { proposal: { ...p, state: 'rejected' }, state: ctx.state, records: [], accepted: ctx.accepted };
  const payload = d.action === 'edit' ? d.edited : p.payload;
  if (!payload) throw new Error('Modification sans contenu');
  if (payload.kind !== p.payload.kind) throw new Error('Une modification ne peut pas changer le type de proposition');
  const edited = d.action === 'edit';
  const ops: Operation[] = [];
  const accepted = { ...ctx.accepted };
  if (payload.kind === 'text') throw new Error('Un texte détecté n\'entre pas dans le modèle (information seulement)');
  if (payload.kind === 'wall') {
    if (!ctx.scale) throw new Error('Calibration d\'échelle confirmée par l\'utilisateur requise avant d\'accepter une géométrie');
    if (ctx.scale.sourceId !== p.evidence.sourceId || ctx.scale.page !== p.evidence.page) throw new Error('La calibration ne concerne pas cette source/page');
    const conv = pxToModel(ctx.scale); const a = conv(payload.a), b = conv(payload.b);
    const n1 = `n:${p.id}:a`, n2 = `n:${p.id}:b`, wid = `w:${p.id}`;
    const wall: Wall = { id: wid, code: wid, startNode: n1, endNode: n2, role: payload.role, thickness: attr(payload.thicknessM, p, edited), height: attr(payload.heightM, p, edited), spec: { origin: 'ai_detected' } };
    ops.push({ type: 'addNode', levelId: ctx.levelId, node: { id: n1, ...a } }, { type: 'addNode', levelId: ctx.levelId, node: { id: n2, ...b } }, { type: 'addWall', levelId: ctx.levelId, wall });
    accepted[p.id] = wid;
  } else {
    const host = ctx.accepted[payload.hostProposalId]; if (!host) throw new Error(`Le mur hôte (${payload.hostProposalId}) doit être accepté avant l'ouverture`);
    const oid = `o:${p.id}`;
    const op: Opening = { id: oid, code: oid, hostWallId: host, class: payload.class, width: attr(payload.widthM, p, edited), height: attr(payload.heightM, p, edited), spec: { origin: 'ai_detected' } };
    ops.push({ type: 'addOpening', levelId: ctx.levelId, opening: op });
  }
  let st = ctx.state; const records: OpRecord[] = [];
  ops.forEach((op, i) => { const r = applyOperation(st, op, { hlc: { ...ctx.hlc, counter: ctx.hlc.counter + i }, actor: d.actor }); st = r.state; records.push(r.record); });
  return { proposal: { ...p, state: edited ? 'edited' : 'accepted', payload }, state: st, records, accepted };
}
