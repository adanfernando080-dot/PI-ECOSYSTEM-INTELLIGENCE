import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { registerSource, pxToModel, type AiProposal, type DetectorPort, type ScaleCalibration, type SourceDocument } from '../../src/core/ai/contracts.js';
import { decide, type GateContext } from '../../src/core/ai/gate.js';
import { stateRev, undoOperation, type ProjectState } from '../../src/core/ops/oplog.js';
import { validateModel } from '../../src/core/model/validate.js';
import { computeTakeoff } from '../../src/core/geometry/takeoff.js';
import { hashOf } from '../../src/core/trace/canonical.js';
import { ROOT, taxonomy } from '../support/env.js';

const png = (w: number, h: number): Uint8Array => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const v = new DataView(b.buffer); v.setUint32(16, w); v.setUint32(20, h); return b; };
const emptyState = (): ProjectState => ({
  model: { schemaVersion: '1', id: 'm-ai', name: 'AI test (synthetic/test)', planRevision: { sourceDocumentHash: 'x', sheetId: 's', page: 1, label: 'synthetic/test', supersedes: null },
    buildings: [{ id: 'b', name: 'b', levels: [{ id: 'L0', code: 'RDC', name: 'RDC', elevation: { value: '0', unit: 'm', origin: 'user_entered' }, clearHeight: { unit: 'm', origin: 'user_entered' }, nodes: [], walls: [], openings: [], spaces: [], slabs: [], roofs: [] }] }] },
  assumptions: { id: 'as', items: [] },
});
const SRC = 'sha256:' + 'ab'.repeat(32);
const cal = (): ScaleCalibration => ({ sourceId: SRC, page: 1, a: { x: 0, y: 0 }, b: { x: 100000, y: 0 }, realLengthM: '5.00', author: 'u.test', date: '2026-10-12' });   // 1000 px = 5 m
const wallP = (id = 'p1'): AiProposal => ({ id, state: 'proposed', confidence: '0.80', evidence: { sourceId: SRC, page: 1, detectorId: 'fake.detector', modelHash: 'sha256:00' }, payload: { kind: 'wall', a: { x: 0, y: 0 }, b: { x: 100000, y: 0 }, role: 'exterior' } });
const ctx = (st: ProjectState, scale: ScaleCalibration | null = cal(), accepted: Record<string, string> = {}): GateContext => ({ state: st, levelId: 'L0', scale, hlc: { wall: 1, counter: 0, node: 'n' }, accepted });

describe('Contrats IA — import de source', () => {
  it('PNG : type, dimensions, empreinte ; JPEG ; PDF (pages inconnues = null, jamais inventées)', () => {
    const r = registerSource(png(800, 600), 'plan.png'); expect(r.ok && r.source).toMatchObject({ mediaType: 'image/png', widthPx: 800, heightPx: 600, pages: 1 });
    const pdf = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n1 0 obj'); expect((registerSource(pdf, 'a.pdf') as { source: SourceDocument }).source).toMatchObject({ mediaType: 'application/pdf', pages: null, widthPx: null });
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 1, 0x2c, 2, 0x58, 3, 1, 0x22, 0, 0xff, 0xd9]);
    expect((registerSource(jpg, 'a.jpg') as { source: SourceDocument }).source).toMatchObject({ mediaType: 'image/jpeg', widthPx: 600, heightPx: 300 });
    const a = registerSource(png(8, 8), 'x'), b = registerSource(png(8, 8), 'y'); expect(a.ok && b.ok && a.source.id === b.source.id).toBe(true);
  });
  it('formats non pris en charge ou corrompus refusés (zip, texte, PNG tronqué, dimensions nulles)', () => {
    for (const d of [new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0]), new TextEncoder().encode('bonjour le monde!'), png(0, 5), new Uint8Array(5)]) expect(registerSource(d, 'f').ok).toBe(false);
  });
});

describe('Calibration d\'échelle (jamais déduite)', () => {
  it('1000 px = 5 m → 1 px = 5 mm = 50 unités ; arrondi exact, négatifs symétriques', () => {
    const f = pxToModel(cal()); expect(f({ x: 100000, y: 0 })).toEqual({ x: 50000, y: 0 }); expect(f({ x: 100, y: -100 })).toEqual({ x: 50, y: -50 });
  });
  it('points identiques / longueur nulle / trop de décimales : refus', () => {
    expect(() => pxToModel({ ...cal(), b: { x: 0, y: 0 } })).toThrow(); expect(() => pxToModel({ ...cal(), realLengthM: '0' })).toThrow(); expect(() => pxToModel({ ...cal(), realLengthM: '1.23456' })).toThrow();
  });
});

describe('Porte de validation humaine (REQ-03, ADR-0017)', () => {
  it('un détecteur (bouchon de test) produit des propositions : le modèle est inchangé tant qu\'aucune décision n\'est prise', async () => {
    const st = emptyState(); const before = stateRev(st);
    const det: DetectorPort = { id: 'fake.detector', modelHash: 'sha256:00', detect: async () => [wallP()] };
    const props = await det.detect({} as SourceDocument, new Uint8Array(), 1);
    expect(props[0]!.state).toBe('proposed'); expect(stateRev(st)).toBe(before);
  });
  it('acceptation : opérations ordinaires, origine ai_detected + preuve, épaisseur NON inventée (unspecified), annulable', () => {
    const st = emptyState(); const r = decide(wallP(), { action: 'accept', actor: 'u.test' }, ctx(st));
    expect(r.proposal.state).toBe('accepted'); expect(r.records.map((x) => x.op.type)).toEqual(['addNode', 'addNode', 'addWall']);
    const w = r.state.model.buildings[0]!.levels[0]!.walls[0]!;
    expect(w.thickness.value).toBeUndefined(); expect(w.thickness).toMatchObject({ origin: 'ai_detected', validation: 'accepted', confidence: '0.80', evidence: { detectorId: 'fake.detector', sourceHash: SRC } });
    expect(r.state.model.buildings[0]!.levels[0]!.nodes[1]).toMatchObject({ x: 50000, y: 0 });
    expect(validateModel(r.state.model, taxonomy)).toEqual([]);
    let s = r.state; for (const rec of [...r.records].reverse()) s = undoOperation(s, rec, { hlc: { wall: 2, counter: 0, node: 'n' }, actor: 'u' }).state;
    expect(hashOf(s.model)).toBe(hashOf(st.model));
  });
  it('une géométrie acceptée mais sans épaisseur reste BLOQUANTE pour le métré (unspecified)', () => {
    const r = decide(wallP(), { action: 'accept', actor: 'u.test' }, ctx(emptyState()));
    const t = computeTakeoff(r.state.model, r.state.assumptions);
    expect(t.blocked.length).toBeGreaterThan(0); expect(t.blocked.map((b) => b.reason).join()).toMatch(/unspecified/);
  });
  it('modification humaine : origine user_corrected, validation edited', () => {
    const e = decide(wallP(), { action: 'edit', actor: 'u.test', edited: { kind: 'wall', a: { x: 0, y: 0 }, b: { x: 100000, y: 0 }, role: 'interior', thicknessM: '0.15' } }, ctx(emptyState()));
    const w = e.state.model.buildings[0]!.levels[0]!.walls[0]!; expect(e.proposal.state).toBe('edited'); expect(w.role).toBe('interior'); expect(w.thickness).toMatchObject({ value: '0.15', origin: 'user_corrected', validation: 'edited' });
  });
  it('rejet : modèle strictement inchangé, aucune opération ; une proposition traitée ne se retraite pas', () => {
    const st = emptyState(); const r = decide(wallP(), { action: 'reject', actor: 'u.test' }, ctx(st));
    expect(r.records).toEqual([]); expect(stateRev(r.state)).toBe(stateRev(st)); expect(r.proposal.state).toBe('rejected');
    expect(() => decide(r.proposal, { action: 'accept', actor: 'u' }, ctx(st))).toThrow(/déjà traitée/);
  });
  it('sans calibration confirmée, ou calibration d\'une autre source : géométrie refusée', () => {
    expect(() => decide(wallP(), { action: 'accept', actor: 'u' }, ctx(emptyState(), null))).toThrow(/Calibration/);
    expect(() => decide(wallP(), { action: 'accept', actor: 'u' }, ctx(emptyState(), { ...cal(), sourceId: 'sha256:' + 'cd'.repeat(32) }))).toThrow(/source\/page/);
  });
  it('ouverture : exige un mur hôte déjà accepté ; un texte détecté n\'entre jamais dans le modèle ; décision sans auteur refusée', () => {
    const op: AiProposal = { ...wallP('p2'), payload: { kind: 'opening', hostProposalId: 'p1', class: 'opening.door.single', widthM: '0.9' } };
    expect(() => decide(op, { action: 'accept', actor: 'u' }, ctx(emptyState()))).toThrow(/mur hôte/);
    const w = decide(wallP(), { action: 'accept', actor: 'u' }, ctx(emptyState())); const o = decide(op, { action: 'accept', actor: 'u' }, ctx(w.state, cal(), w.accepted));
    expect(o.state.model.buildings[0]!.levels[0]!.openings[0]).toMatchObject({ hostWallId: 'w:p1', class: 'opening.door.single' });
    expect(() => decide({ ...wallP('t'), payload: { kind: 'text', text: 'COTE 3.00' } }, { action: 'accept', actor: 'u' }, ctx(emptyState()))).toThrow(/texte/);
    expect(() => decide(wallP(), { action: 'accept', actor: '' }, ctx(emptyState()))).toThrow(/auteur/);
  });
  it('INDÉPENDANCE : le noyau (hors src/core/ai) n\'importe jamais le module ai ; src/core/ai ne contient aucun terme de marché', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = `${d}/${n}`; return statSync(p).isDirectory() ? (n === 'ai' ? [] : walk(p)) : p.endsWith('.ts') ? [p] : []; });
    const offenders = walk(`${ROOT}/src/core`).filter((f) => /from '(\.\.\/)+ai\/|core\/ai/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
    const txt = ['contracts', 'gate'].map((f) => readFileSync(`${ROOT}/src/core/ai/${f}.ts`, 'utf8')).join('\n');
    expect(txt).not.toMatch(/\b(XOF|FCFA|Bénin|Benin|Sénégal|TVA|pack\.|devise|currency)\b/i);
  });
});
