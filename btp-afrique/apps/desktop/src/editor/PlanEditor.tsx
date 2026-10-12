import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type WheelEvent } from 'react';
import type { Level } from '../../../../src/core/model/types.js';
import type { Operation } from '../../../../src/core/ops/oplog.js';
import * as C from '../../../../src/core/ops/commands.js';
import { explainLine, explainPrice } from '../../../../src/core/trace/explain.js';
import { fmtMoney } from '../../../../src/adapters/render-text.js';
import { preview, TAXONOMY, type Session } from '../session.js';
import { describeOp, type Draft } from './draft.js';
import { linksFor } from './links.js';
import { fitView, fmtM, gridUnits, GRID_STEPS_M, hitTest, openingAnchor, panBy, parseMetres, scaleBar, snapPoint, toScreen, toWorld, zoomAt, UNITS_PER_M, type Hit, type View } from './viewport.js';

const W = 900, H = 560;
type Tool = 'select' | 'wall' | 'room' | 'opening';
const OPENING_CLASSES = TAXONOMY.classes.filter((c) => c.id.startsWith('opening.')).map((c) => c.id);
const WALL_CLASSES = TAXONOMY.classes.filter((c) => c.id.startsWith('masonry.')).map((c) => c.id);
const sysFor = (cls: string): string => (cls.includes('window') ? 'joinery.aluminium' : 'joinery.timber');
const TOOLS: Array<[Tool, string, string]> = [['select', 'Sélection', 'V'], ['wall', 'Mur', 'M'], ['room', 'Pièce', 'P'], ['opening', 'Ouverture', 'O']];

export interface EditorApi { onCommit(ops: Operation[], label: string): void; onUndo(): void; onRedo(): void; onExplain(lines: string[]): void }

export function PlanEditor({ session, api }: { session: Session; api: EditorApi }) {
  const run = session.run; const level: Level = run.model.buildings[0]!.levels[0]!; const wrap = useRef<HTMLDivElement>(null); const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(() => fitView(level, W, H));
  const [tool, setTool] = useState<Tool>('select'); const [sel, setSel] = useState<Hit>(null); const [gridStep, setGridStep] = useState<string>('0.10'); const [snapOn, setSnapOn] = useState(true);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null); const [cursor, setCursor] = useState<{ x: number; y: number; kind: string } | null>(null);
  const [drag, setDrag] = useState<{ nodeId: string; to: { x: number; y: number } } | null>(null); const [pan, setPan] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [wallForm, setWallForm] = useState({ thickness: '0.20', height: '', role: 'interior' as 'interior' | 'exterior', system: WALL_CLASSES[0] ?? '' });
  const [roomForm, setRoomForm] = useState({ name: 'Pièce', usage: 'generic' }); const [opForm, setOpForm] = useState({ cls: OPENING_CLASSES[0] ?? '', w: '0.90', h: '2.10' });
  const [coords, setCoords] = useState({ x1: '0.00', y1: '0.00', x2: '3.00', y2: '0.00' }); const [edit, setEdit] = useState<Record<string, string>>({});
  const grid = gridUnits(gridStep);

  // Brouillon → aperçu (copie, validation, recalcul, comparaison) : JAMAIS d'écriture dans le modèle validé.
  const prev = useMemo(() => (draft ? preview(session, draft.ops, 0) : null), [draft, session]);
  useEffect(() => { setDraft(null); setAnchor(null); }, [session.state]);          // un changement validé (ou annulé) invalide tout brouillon en cours
  useEffect(() => { if (sel && !hitExists(level, sel)) setSel(null); }, [level, sel]);
  useEffect(() => { setEdit({}); }, [sel?.id, session.state]);                  // les champs de la sélection repartent des valeurs du modèle

  const propose = (label: string, build: () => Operation[]): void => {
    try { const ops = build(); if (!ops.length) { setMsg('Aucun changement à proposer.'); return; } setDraft({ label, ops }); setMsg(null); } catch (e) { setDraft(null); setMsg((e as Error).message); }
  };
  const wp = (): C.WallProps => ({ thicknessM: wallForm.thickness, ...(wallForm.height ? { heightM: wallForm.height } : {}), role: wallForm.role, system: wallForm.system });
  const pos = (e: MouseEvent): { px: number; py: number } => { const r = svg.current!.getBoundingClientRect(); return { px: ((e.clientX - r.left) / r.width) * W, py: ((e.clientY - r.top) / r.height) * H }; };

  const onDown = (e: MouseEvent): void => {
    const { px, py } = pos(e); wrap.current?.focus();
    if (e.button === 1 || e.altKey || (e.shiftKey && tool === 'select')) { setPan({ x: px, y: py }); return; }
    if (e.button !== 0) return;
    if (tool === 'select') { const h = hitTest(view, level, px, py); setSel(h); if (h?.kind === 'node') setDrag({ nodeId: h.id, to: { x: level.nodes.find((n) => n.id === h.id)!.x, y: level.nodes.find((n) => n.id === h.id)!.y } }); return; }
    if (tool === 'wall' || tool === 'room') {
      const s = snapPoint(view, level, px, py, grid, 10, snapOn);
      if (!anchor) { setAnchor(s.pt); return; }
      const a = anchor; setAnchor(null);
      propose(tool === 'wall' ? 'Créer un mur' : 'Créer une pièce rectangulaire', () => tool === 'wall' ? C.cmdCreateWall(run.model, level.id, a, s.pt, wp()) : C.cmdCreateRoomRect(run.model, level.id, a, s.pt, roomForm.name, roomForm.usage, wp()));
      return;
    }
    if (tool === 'opening') {
      const h = hitTest(view, level, px, py);
      if (h?.kind !== 'wall') { setMsg('Cliquez sur un mur pour y placer l\'ouverture.'); return; }
      propose('Ajouter une ouverture', () => C.cmdAddOpening(run.model, level.id, h.id, opForm.cls, sysFor(opForm.cls), opForm.w, opForm.h));
    }
  };
  const onMove = (e: MouseEvent): void => {
    const { px, py } = pos(e);
    if (pan) { setView(panBy(view, px - pan.x, py - pan.y)); setPan({ x: px, y: py }); return; }
    const s = snapPoint(view, level, px, py, grid, 10, snapOn); setCursor({ ...s.pt, kind: s.kind });
    if (drag) setDrag({ ...drag, to: s.pt });
  };
  const onUp = (): void => {
    setPan(null);
    if (drag) { const d = drag; setDrag(null); propose('Déplacer un point', () => C.cmdMoveNode(run.model, d.nodeId, d.to)); }
  };
  const onWheel = (e: WheelEvent): void => { const { px, py } = pos(e as unknown as MouseEvent); setView(zoomAt(view, e.deltaY < 0 ? 1.15 : 1 / 1.15, px, py)); };
  const deleteSel = (): void => {
    if (!sel) return;
    propose('Supprimer', () => sel.kind === 'wall' ? C.cmdDeleteWall(run.model, sel.id) : sel.kind === 'opening' ? C.cmdDeleteOpening(run.model, sel.id) : sel.kind === 'space' ? C.cmdDeleteSpace(run.model, sel.id) : (() => { throw new Error('Un point se supprime avec son dernier mur.'); })());
  };
  const validate = (): void => { if (draft && prev?.ok) { api.onCommit(draft.ops, draft.label); setDraft(null); } };
  const onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement; if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
    if (e.key === 'Escape') { setDraft(null); setAnchor(null); setDrag(null); setMsg(null); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
    else if (e.key === 'Enter') validate();
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); api.onUndo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); api.onRedo(); }
    else if (!e.ctrlKey && !e.metaKey) { const k = TOOLS.find(([, , key]) => key.toLowerCase() === e.key.toLowerCase()); if (k) { setTool(k[0]); setAnchor(null); } }
  };

  const node = new Map(level.nodes.map((n) => [n.id, n])); const S = (x: number, y: number) => toScreen(view, x, y);
  const gridPx = (grid / UNITS_PER_M) * view.ppm; const sb = scaleBar(view);
  const lines: JSX.Element[] = [];
  if (gridPx >= 6) { const w0 = toWorld(view, 0, H), w1 = toWorld(view, W, 0); for (let x = Math.floor(w0.x / grid) * grid; x <= w1.x; x += grid) { const s = S(x, 0).x; lines.push(<line key={`gx${x}`} x1={s} y1={0} x2={s} y2={H} className={x % UNITS_PER_M === 0 ? 'g major' : 'g'} />); } for (let y = Math.floor(w0.y / grid) * grid; y <= w1.y; y += grid) { const s = S(0, y).y; lines.push(<line key={`gy${y}`} x1={0} y1={s} x2={W} y2={s} className={y % UNITS_PER_M === 0 ? 'g major' : 'g'} />); } }
  const dn = (n: { id: string; x: number; y: number }) => (drag && drag.nodeId === n.id ? { ...n, ...drag.to } : n);
  const draftLevel = prev?.ok && prev.run ? prev.run.model.buildings[0]!.levels[0]! : null;
  const newWalls = draftLevel ? draftLevel.walls.filter((w) => !level.walls.some((x) => x.id === w.id)) : []; const goneWalls = draftLevel ? level.walls.filter((w) => !draftLevel.walls.some((x) => x.id === w.id)) : [];
  const dNode = new Map((draftLevel?.nodes ?? []).map((n) => [n.id, n]));
  const links = sel ? linksFor(run, sel.id) : null; const cur = run.estimate.currency; const money = (v: string): string => fmtMoney(v, cur.minorUnits, cur.code);
  const selWall = sel?.kind === 'wall' ? level.walls.find((w) => w.id === sel.id) : undefined; const selOp = sel?.kind === 'opening' ? level.openings.find((o) => o.id === sel.id) : undefined;
  const selSp = sel?.kind === 'space' ? level.spaces.find((s) => s.id === sel.id) : undefined; const selNode = sel?.kind === 'node' ? node.get(sel.id) : undefined;
  const thick = (w: Level['walls'][number]): string | undefined => w.thickness.value ?? (w.thickness.assumptionId ? run.assumptions.items.find((i) => i.id === w.thickness.assumptionId)?.value.value : undefined);
  const lenOf = (id: string): string | undefined => run.takeoff.quantities.find((q) => q.id === `geo:${id}:wall.length.axis`)?.value;
  const field = (k: string, dflt: string): string => edit[k] ?? dflt;

  return (
    <section>
      <h2>Éditeur de plan <span className="muted">— niveau {level.code}, unités : mètres (coordonnées internes entières en 0,1 mm)</span></h2>
      <div className="ed-bar" role="toolbar" aria-label="Outils de l'éditeur">
        {TOOLS.map(([t, label, key]) => <button key={t} className={tool === t ? 'active' : ''} onClick={() => { setTool(t); setAnchor(null); }} data-testid={`ed-tool-${t}`} title={`${label} (${key})`}>{label}</button>)}
        <span className="sep" />
        <button onClick={api.onUndo} disabled={!session.history.undo.length} data-testid="ed-undo" title="Annuler (Ctrl+Z)">↶ Annuler</button>
        <button onClick={api.onRedo} disabled={!session.history.redo.length} data-testid="ed-redo" title="Rétablir (Ctrl+Y)">↷ Rétablir</button>
        <span className="sep" />
        <label className="inline">Grille<select value={gridStep} onChange={(e) => setGridStep(e.target.value)} data-testid="ed-grid">{GRID_STEPS_M.map((g) => <option key={g} value={g}>{g} m</option>)}</select></label>
        <label className="inline"><input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} /> Aimantation</label>
        <button onClick={() => setView(zoomAt(view, 1.25, W / 2, H / 2))} aria-label="Zoom avant">＋</button><button onClick={() => setView(zoomAt(view, 0.8, W / 2, H / 2))} aria-label="Zoom arrière">－</button><button onClick={() => setView(fitView(level, W, H))} data-testid="ed-fit">Ajuster</button>
      </div>
      <div className="ed-tooloptions">
        {tool === 'wall' && <><label>Épaisseur (m)<input size={5} value={wallForm.thickness} onChange={(e) => setWallForm({ ...wallForm, thickness: e.target.value })} data-testid="ed-wall-thickness" /></label><label>Hauteur (m) — vide = niveau<input size={5} value={wallForm.height} onChange={(e) => setWallForm({ ...wallForm, height: e.target.value })} /></label>
          <label>Rôle<select value={wallForm.role} onChange={(e) => setWallForm({ ...wallForm, role: e.target.value as 'interior' | 'exterior' })}><option value="interior">intérieur</option><option value="exterior">extérieur</option></select></label>
          <label>Système<select value={wallForm.system} onChange={(e) => setWallForm({ ...wallForm, system: e.target.value })}>{WALL_CLASSES.map((c) => <option key={c}>{c}</option>)}</select></label></>}
        {tool === 'room' && <><label>Nom<input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} data-testid="ed-room-name" /></label><label>Épaisseur des murs (m)<input size={5} value={wallForm.thickness} onChange={(e) => setWallForm({ ...wallForm, thickness: e.target.value })} /></label>
          <label>Rôle des murs<select value={wallForm.role} onChange={(e) => setWallForm({ ...wallForm, role: e.target.value as 'interior' | 'exterior' })}><option value="interior">intérieur</option><option value="exterior">extérieur</option></select></label></>}
        {tool === 'opening' && <><label>Type<select value={opForm.cls} onChange={(e) => setOpForm({ ...opForm, cls: e.target.value })}>{OPENING_CLASSES.map((c) => <option key={c}>{c}</option>)}</select></label><label>Largeur (m)<input size={5} value={opForm.w} onChange={(e) => setOpForm({ ...opForm, w: e.target.value })} /></label><label>Hauteur (m)<input size={5} value={opForm.h} onChange={(e) => setOpForm({ ...opForm, h: e.target.value })} /></label></>}
        <span className="muted hint">{tool === 'select' ? 'Cliquer pour sélectionner ; glisser un point pour le déplacer ; Maj+glisser ou molette pour naviguer ; Suppr pour supprimer.' : tool === 'wall' ? (anchor ? 'Cliquer le point d\'arrivée (Échap : annuler).' : 'Cliquer le point de départ.') : tool === 'room' ? (anchor ? 'Cliquer le coin opposé.' : 'Cliquer un coin.') : 'Cliquer sur un mur.'}</span>
      </div>
      <div className="ed-main">
        <div ref={wrap} className="ed-canvaswrap" tabIndex={0} onKeyDown={onKey} data-testid="ed-focus">
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className={`ed-canvas tool-${tool}`} data-testid="ed-canvas" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { setCursor(null); setPan(null); if (drag) setDrag(null); }} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} role="application" aria-label="Plan éditable">
            {lines}
            {level.spaces.map((s) => { const pts = s.boundaryWallIds.flatMap((id) => { const w = level.walls.find((x) => x.id === id); return w ? [node.get(w.startNode), node.get(w.endNode)] : []; }).filter(Boolean) as { x: number; y: number }[]; if (!pts.length) return null;
              const a = S(Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))), b = S(Math.max(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)));
              return <g key={s.id}><rect x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y} className={sel?.id === s.id ? 'space sel' : 'space'} data-testid={`ed-space-${s.id}`} /><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} className="spacelbl" textAnchor="middle">{s.name}</text></g>; })}
            {level.walls.map((w) => { const a0 = node.get(w.startNode), b0 = node.get(w.endNode); if (!a0 || !b0) return null; const a = S(dn(a0).x, dn(a0).y), b = S(dn(b0).x, dn(b0).y); const tv = thick(w); const t = tv ? Number(tv) * view.ppm : 4; const gone = goneWalls.some((x) => x.id === w.id);
              return <g key={w.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={Math.max(2, t)} className={`wall${w.role === 'exterior' ? ' ext' : ''}${tv ? '' : ' unspec'}${sel?.id === w.id ? ' sel' : ''}${gone ? ' gone' : ''}`} data-testid={`ed-wall-${w.id}`} /><text x={(a.x + b.x) / 2 + 6} y={(a.y + b.y) / 2 - 6} className="lbl">{w.code}</text></g>; })}
            {newWalls.map((w) => { const a = dNode.get(w.startNode), b = dNode.get(w.endNode); if (!a || !b) return null; const s1 = S(a.x, a.y), s2 = S(b.x, b.y); return <line key={w.id} x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} className="wall ghost" strokeWidth={Math.max(3, Number(w.thickness.value ?? 0.1) * view.ppm)} data-testid="ed-ghost-wall" />; })}
            {level.openings.map((o) => { const p = openingAnchor(view, level, o.id); if (!p) return null; return <g key={o.id}><circle cx={p.x} cy={p.y} r={6} className={sel?.id === o.id ? 'op sel' : 'op'} data-testid={`ed-opening-${o.id}`}><title>{o.code} — position schématique au milieu du mur (le modèle ne porte pas de position)</title></circle></g>; })}
            {level.nodes.map((n) => { const p = S(dn(n).x, dn(n).y); return <rect key={n.id} x={p.x - 4} y={p.y - 4} width={8} height={8} className={sel?.id === n.id ? 'node sel' : 'node'} data-testid={`ed-node-${n.id}`} />; })}
            {anchor && cursor && (() => { const a = S(anchor.x, anchor.y), c = S(cursor.x, cursor.y); return tool === 'room' ? <rect x={Math.min(a.x, c.x)} y={Math.min(a.y, c.y)} width={Math.abs(c.x - a.x)} height={Math.abs(c.y - a.y)} className="ghost-rect" /> : <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} className="wall ghost" strokeWidth={3} />; })()}
            {cursor && <circle cx={S(cursor.x, cursor.y).x} cy={S(cursor.x, cursor.y).y} r={4} className={cursor.kind === 'node' ? 'cur node' : 'cur'} />}
            <g transform={`translate(16 ${H - 18})`}><line x1={0} y1={0} x2={sb.px} y2={0} className="scalebar" /><line x1={0} y1={-4} x2={0} y2={4} className="scalebar" /><line x1={sb.px} y1={-4} x2={sb.px} y2={4} className="scalebar" /><text x={sb.px + 8} y={4} className="lbl" data-testid="ed-scale">{sb.label}</text></g>
          </svg>
          <div className="ed-status" data-testid="ed-status">{cursor ? `x = ${fmtM(cursor.x)} m · y = ${fmtM(cursor.y)} m (${cursor.kind === 'node' ? 'point existant' : snapOn ? `grille ${gridStep} m` : 'libre'})` : 'Survolez le plan pour lire les coordonnées'} · échelle 1 m = {Math.round(view.ppm)} px</div>
        </div>
        <aside className="ed-side">
          {msg && <div className="error" data-testid="ed-error">{msg}</div>}
          {draft && prev && (
            <div className="ed-draft" data-testid="ed-draft"><h3>Brouillon : {draft.label}</h3>
              <ol data-testid="ed-draft-ops">{draft.ops.map((o, i) => <li key={i}>{describeOp(o, run.model)}</li>)}</ol>
              {!prev.ok && <div className="error" data-testid="ed-draft-errors"><b>Validation refusée :</b><ul>{prev.errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {prev.ok && prev.diff && <div data-testid="ed-impact"><b>Conséquences (recalcul réel sur copie) :</b>
                <div>Total : {money(prev.diff.totalBefore)} → {money(prev.diff.totalAfter)} (<b>{BigInt(prev.diff.totalDelta) >= 0n ? '+' : ''}{money(prev.diff.totalDelta)}</b>)</div>
                {prev.blocked > 0 && <div className="chip bad">{prev.blocked} grandeur(s) bloquée(s) (valeur non spécifiée)</div>}
                <ul>{prev.diff.lines.filter((l) => l.status !== 'unchanged').slice(0, 8).map((l) => <li key={l.id}>{l.label} : {l.qtyBefore ?? '—'} → {l.qtyAfter ?? '—'} {l.unit} ({BigInt(l.delta) >= 0n ? '+' : ''}{money(l.delta)})</li>)}{prev.diff.lines.every((l) => l.status === 'unchanged') && <li>Aucun effet sur le chiffrage.</li>}</ul>
                {prev.diff.geometry.added.length + prev.diff.geometry.removed.length + prev.diff.geometry.changed.length > 0 && <div className="muted">Quantités géométriques : +{prev.diff.geometry.added.length} / −{prev.diff.geometry.removed.length} / ~{prev.diff.geometry.changed.length}</div>}</div>}
              <div className="row"><button onClick={validate} disabled={!prev.ok} data-testid="ed-draft-validate">Valider (Entrée)</button><button onClick={() => { setDraft(null); setMsg(null); }} data-testid="ed-draft-cancel">Annuler le brouillon (Échap)</button></div>
            </div>)}
          <div className="ed-sel" data-testid="ed-selection"><h3>Sélection</h3>
            {!sel && <p className="muted">Aucune. Outil « Sélection » : cliquer un objet.</p>}
            {selNode && <><p>Point <b>{selNode.id}</b> — x = {fmtM(selNode.x)} m, y = {fmtM(selNode.y)} m</p><div className="row"><label>x (m)<input size={7} value={field('nx', fmtM(selNode.x))} onChange={(e) => setEdit({ ...edit, nx: e.target.value })} data-testid="ed-node-x" /></label><label>y (m)<input size={7} value={field('ny', fmtM(selNode.y))} onChange={(e) => setEdit({ ...edit, ny: e.target.value })} data-testid="ed-node-y" /></label>
              <button data-testid="ed-node-apply" onClick={() => propose('Déplacer un point', () => { const x = parseMetres(field('nx', fmtM(selNode.x))), y = parseMetres(field('ny', fmtM(selNode.y))); if (x === null || y === null) throw new Error('Coordonnées : mètres décimaux attendus (ex. 2.50)'); return C.cmdMoveNode(run.model, selNode.id, { x, y }); })}>Proposer</button></div></>}
            {selWall && <><p>Mur <b>{selWall.code}</b> · longueur (moteur) <b>{lenOf(selWall.id) ?? '—'} m</b> · {selWall.role === 'exterior' ? 'extérieur' : 'intérieur'}</p>
              <div className="row"><label>Épaisseur (m)<input size={5} value={field('wt', selWall.thickness.value ?? '')} onChange={(e) => setEdit({ ...edit, wt: e.target.value })} data-testid="ed-sel-thickness" /></label><label>Hauteur (m)<input size={5} value={field('wh', selWall.height.value ?? '')} placeholder={selWall.height.assumptionId ? `hyp. ${selWall.height.assumptionId}` : ''} onChange={(e) => setEdit({ ...edit, wh: e.target.value })} /></label>
                <button data-testid="ed-wall-apply" onClick={() => propose('Modifier un mur', () => C.cmdSetWallProps(run.model, selWall.id, { ...(edit['wt'] !== undefined ? { thicknessM: edit['wt'] } : {}), ...(edit['wh'] ? { heightM: edit['wh'] } : {}) }))}>Proposer</button></div></>}
            {selOp && <><p>Ouverture <b>{selOp.code}</b> ({selOp.class})</p><div className="row"><label>Largeur (m)<input size={5} value={field('ow', selOp.width.value ?? '')} onChange={(e) => setEdit({ ...edit, ow: e.target.value })} data-testid="ed-op-w" /></label><label>Hauteur (m)<input size={5} value={field('oh', selOp.height.value ?? '')} onChange={(e) => setEdit({ ...edit, oh: e.target.value })} data-testid="ed-op-h" /></label>
              <button data-testid="ed-op-apply" onClick={() => propose('Redimensionner une ouverture', () => C.cmdSetOpening(run.model, selOp.id, field('ow', selOp.width.value ?? ''), field('oh', selOp.height.value ?? '')))}>Proposer</button></div></>}
            {selSp && <><p>Pièce <b>{selSp.code}</b> — {selSp.name}</p><div className="row"><label>Nom<input value={field('sn', selSp.name)} onChange={(e) => setEdit({ ...edit, sn: e.target.value })} data-testid="ed-space-name" /></label><button data-testid="ed-space-apply" onClick={() => propose('Renommer une pièce', () => C.cmdRenameSpace(run.model, selSp.id, field('sn', selSp.name)))}>Proposer</button></div></>}
            {sel && <div className="row"><button onClick={deleteSel} data-testid="ed-delete" disabled={sel.kind === 'node'}>Supprimer…</button></div>}
            {links && sel && (links.geoQuantityIds.length + links.ouvrageIds.length + links.estimateLineIds.length > 0) && <div data-testid="ed-links"><h4>Liens traçables</h4>
              <div className="muted">Quantités géométriques ({links.geoQuantityIds.length}) :</div><ul>{links.geoQuantityIds.slice(0, 6).map((g) => { const q = run.takeoff.quantities.find((x) => x.id === g)!; return <li key={g}>{q.kind} = {q.value} {q.unit}</li>; })}</ul>
              <div className="muted">Ouvrages ({links.ouvrageIds.length}) :</div><ul>{links.ouvrageIds.map((id) => { const o = run.quantitySet.ouvrages.find((x) => x.id === id)!; return <li key={id}>{o.assembly.label} : {o.quantity} {o.assembly.unit}</li>; })}</ul>
              <div className="muted">Lignes de chiffrage :</div><ul>{links.estimateLineIds.map((id) => { const l = run.estimate.lines.find((x) => x.id === id)!; return <li key={id}>{l.n}. {l.assembly.label} — {l.amount ? money(l.amount) : 'sans prix'} <button data-testid={`ed-why-${id}`} onClick={() => api.onExplain([...explainLine(run, id), '', ...explainPrice(run, id)])}>Pourquoi ?</button></li>; })}</ul></div>}
          </div>
          <div className="ed-create"><h3>Créer un mur par coordonnées (m)</h3>
            <div className="row">{(['x1', 'y1', 'x2', 'y2'] as const).map((k) => <label key={k}>{k}<input size={5} value={coords[k]} onChange={(e) => setCoords({ ...coords, [k]: e.target.value })} data-testid={`ed-c-${k}`} /></label>)}
              <button data-testid="ed-c-apply" onClick={() => propose('Créer un mur', () => { const p = ([coords.x1, coords.y1, coords.x2, coords.y2]).map(parseMetres); if (p.some((v) => v === null)) throw new Error('Coordonnées : mètres décimaux attendus'); return C.cmdCreateWall(run.model, level.id, { x: p[0]!, y: p[1]! }, { x: p[2]!, y: p[3]! }, wp()); })}>Proposer</button></div>
            <p className="muted">Épaisseur et rôle : voir l'outil « Mur ». Rien n'est appliqué avant « Valider ».</p></div>
        </aside>
      </div>
    </section>
  );
}
function hitExists(level: Level, h: NonNullable<Hit>): boolean {
  return h.kind === 'node' ? level.nodes.some((n) => n.id === h.id) : h.kind === 'wall' ? level.walls.some((n) => n.id === h.id) : h.kind === 'opening' ? level.openings.some((n) => n.id === h.id) : level.spaces.some((n) => n.id === h.id);
}
