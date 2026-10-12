import { useEffect, useMemo, useState } from 'react';
import type { ResolvedPack } from '../../../src/core/pack/types.js';
import type { BindingRequest, PriceStatistic } from '../../../src/core/pack/binding.js';
import type { Operation } from '../../../src/core/ops/oplog.js';
import { createBundle } from '../../../src/core/project/bundle.js';
import { verifyRun } from '../../../src/core/trace/chain.js';
import { readBtpx, writeBtpx } from '../../../src/adapters/btpx.js';
import { registerSource } from '../../../src/core/ai/contracts.js';
import { SYNTHETIC_BANNER } from '../../../src/core/docs/document.js';
import type { HostApi } from './host.js';
import { addDocument, apply, commit, openSession, rebind, redo, TAXONOMY, undo, type Session } from './session.js';
import { PlanEditor } from './editor/PlanEditor.js';
import { demoHouse, newRoomProject } from './projects.js';
import { defaultZone, isSynthetic } from './viewmodel.js';
import type { FileKind } from '../shared/ipc.js';
import { AssumptionsTab, DocumentsTab, EstimateTab, HistoryTab, Explain, MarketTab, MetreTab, ModelTab, PricesTab, SourcesTab } from './tabs.js';

export type Dispatch = (op: Operation) => void;
export interface Picked { name: string; bytes: Uint8Array }
/** Sélecteur de fichier : natif via l'hôte (desktop) ou <input type=file> (navigateur de développement). */
export function FilePick({ host, kind, accept, testid, label, onFile, fail }: { host: HostApi; kind: FileKind; accept: string; testid: string; label: string; onFile(f: Picked): void; fail(e: unknown): void }) {
  if (host.pickFile) return <button data-testid={testid} onClick={() => { host.pickFile!(kind).then((f) => f && onFile(f)).catch(fail); }}>{label}</button>;
  return <input type="file" accept={accept} data-testid={testid} onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.arrayBuffer().then((b) => onFile({ name: f.name, bytes: new Uint8Array(b) })); }} />;
}
const TABS = [['market', 'Marché'], ['plan', 'Plan (éditeur)'], ['model', 'Modèle'], ['assumptions', 'Hypothèses'], ['metre', 'Métré'], ['prices', 'Prix'], ['estimate', 'Chiffrage'], ['docs', 'Documents'], ['sources', 'Plans & IA'], ['history', 'Historique']] as const;
type TabId = (typeof TABS)[number][0];
const defaultBinding = (p: ResolvedPack, asOf: string): BindingRequest => ({ zoneId: defaultZone(p), asOf });

export function App({ host }: { host: HostApi }) {
  const [packs, setPacks] = useState<ResolvedPack[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('market');
  const [packId, setPackId] = useState<string>('');
  const [explain, setExplain] = useState<string[] | null>(null);
  useEffect(() => { host.listPacks().then((p) => { setPacks(p); setPackId(p[0]?.id ?? ''); }).catch((e: Error) => setError(e.message)); }, [host]);
  const pack = packs.find((p) => p.id === packId);
  const fail = (e: unknown): void => { setError((e as Error).message); setNotice(null); };

  const dispatch: Dispatch = (op) => { if (!session) return; const r = apply(session, op, host.nowMs()); setSession(r.session); setError(r.error); };
  const open = (name: string, state: Parameters<typeof openSession>[0]['state']): void => {
    if (!pack) return fail(new Error('Aucun pack marché disponible'));
    try { setSession(openSession({ name, state, pack, binding: defaultBinding(pack, host.today()) })); setError(null); setNotice(`Projet « ${name} » ouvert`); setTab('model'); } catch (e) { fail(e); }
  };

  const openFile = (f: Picked): void => {
    try {
      const r = readBtpx(f.bytes);
      if (!r.ok || !r.run || !r.project) { setError(`Fichier .btpx refusé (${r.problems.length} anomalie(s)) : ${r.problems.slice(0, 3).join(' ; ')}${r.problems.length > 3 ? ' …' : ''}`); return; }
      const run = r.run; const sources: Session['sources'] = {};
      for (const [id, m] of Object.entries(r.project.meta.sources)) sources[id] = { bytes: r.project.sources[id]!, mediaType: m.mediaType, originalName: m.originalName };
      const s = openSession({ name: r.project.meta.name, state: { model: run.model, assumptions: run.assumptions, manual: run.manual }, pack: run.pack,
        binding: { zoneId: run.binding.zoneId, asOf: run.binding.asOf, priceBookId: run.binding.priceBookId, priceStatistic: run.binding.priceStatistic, paramOverrides: run.binding.params }, oplog: r.project.meta.oplog, ...(r.project.meta.history ? { history: r.project.meta.history } : {}), sources,
        bindingHistory: r.project.meta.bindingHistory, parentBinding: r.project.meta.bindingHistory.find((b) => b.rev === run.binding.parentRev) ?? null });
      const same = s.run.estimate.contentHash === run.estimate.contentHash && s.run.takeoff.contentHash === run.takeoff.contentHash;
      setSession(s); setError(same ? null : 'ATTENTION : le recalcul à froid ne redonne pas les empreintes enregistrées');
      setNotice(`« ${f.name} » rouvert — fichier vérifié, recalcul à froid ${same ? 'IDENTIQUE (mêmes empreintes)' : 'DIFFÉRENT'}`); setTab('model');
    } catch (e) { fail(e); }
  };
  const save = async (): Promise<void> => {
    if (!session) return;
    try {
      const bytes = writeBtpx(session.run, createBundle(session.run), { name: session.name, oplog: session.oplog, history: session.history, bindingHistory: session.bindingHistory, sources: session.sources });
      await host.saveFile(`${session.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'projet'}.btpx`, bytes, 'application/zip');
      setSession({ ...session, dirty: false }); setNotice('Projet enregistré (fichier .btpx autonome)');
    } catch (e) { fail(e); }
  };
  const doRebind = (p: ResolvedPack, b: BindingRequest): void => { if (!session) return; const r = rebind(session, p, b); setSession(r.session); setError(r.error); if (!r.error) setNotice(`Marché appliqué : ${p.id} — le modèle et les hypothèses sont inchangés`); };
  const addSource = (f: Picked): void => {
    if (!session) return; const bytes = f.bytes; const r = registerSource(bytes, f.name);
    if (!r.ok) return fail(new Error(`Import refusé : ${r.reason}`));
    setSession({ ...session, sources: { ...session.sources, [r.source.id.slice(7, 23)]: { bytes, mediaType: r.source.mediaType, originalName: f.name } }, dirty: true }); setError(null);
  };
  useEffect(() => { host.setDirty?.(!!session?.dirty); }, [host, session?.dirty]);
  const verification = useMemo(() => (session ? verifyRun(session.run) : null), [session]);
  const run = session?.run;

  return (
    <div className="app">
      {run && isSynthetic(run) && <div className="banner" data-testid="synthetic-banner">{SYNTHETIC_BANNER}</div>}
      <header>
        <h1>Poste de métré BTP</h1>
        {session ? <>
          <span className="project" data-testid="project-name">{session.name}{session.dirty ? ' •' : ''}</span>
          <span className="chip" data-testid="pack-chip">{run!.pack.id}@{run!.pack.version} · {run!.pack.currency.code}</span>
          <span className={verification?.ok ? 'chip ok' : 'chip bad'} data-testid="verify-chip">{verification?.ok ? 'traçabilité vérifiée' : 'TRAÇABILITÉ INVALIDE'}</span>
          <button onClick={() => void save()} data-testid="save">Enregistrer .btpx</button>
          <button onClick={() => { setSession(null); setNotice(null); }} data-testid="close">Fermer</button>
        </> : <span className="muted">Aucun projet ouvert</span>}
      </header>
      {error && <div className="error" role="alert" data-testid="error">{error}</div>}
      {notice && <div className="notice" data-testid="notice">{notice}</div>}
      {!session ? <Home packs={packs} packId={packId} setPackId={setPackId} onDemo={() => { const d = demoHouse(); open(d.name, d.state); }}
        onRoom={(f) => { try { const p = newRoomProject(f); open(p.name, p.state); } catch (e) { fail(e); } }} host={host} fail={fail} onFile={openFile} today={host.today()} /> : (
        <>
          <nav>{TABS.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)} data-testid={`tab-${id}`}>{label}</button>)}</nav>
          <main>
            {tab === 'market' && <MarketTab session={session} packs={packs} onRebind={doRebind} />}
            {tab === 'plan' && <>{explain && <Explain lines={explain} onClose={() => setExplain(null)} />}<PlanEditor session={session} api={{
              onCommit: (ops, label) => { const r = commit(session, ops, label, host.nowMs()); setSession(r.session); setError(r.error); if (!r.error) setNotice(`« ${label} » appliqué — métrés recalculés`); },
              onUndo: () => { const r = undo(session, host.nowMs()); setSession(r.session); setError(r.error); },
              onRedo: () => { const r = redo(session, host.nowMs()); setSession(r.session); setError(r.error); }, onExplain: setExplain }} /></>}
            {tab === 'model' && <ModelTab run={run!} dispatch={dispatch} today={host.today()} />}
            {tab === 'assumptions' && <AssumptionsTab run={run!} dispatch={dispatch} today={host.today()} actor={session.actor} />}
            {tab === 'metre' && <MetreTab run={run!} />}
            {tab === 'prices' && <PricesTab run={run!} />}
            {tab === 'estimate' && <EstimateTab run={run!} dispatch={dispatch} today={host.today()} actor={session.actor} />}
            {tab === 'docs' && <DocumentsTab session={session} host={host} onDoc={(d) => setSession(addDocument(session, d))} fail={fail} />}
            {tab === 'sources' && <SourcesTab session={session} host={host} fail={fail} onFile={addSource} />}
            {tab === 'history' && <HistoryTab session={session} onUndo={() => { const r = undo(session, host.nowMs()); setSession(r.session); setError(r.error); }} onRedo={() => { const r = redo(session, host.nowMs()); setSession(r.session); setError(r.error); }} />}
          </main>
        </>)}
      <footer>Moteur {run?.engine.version ?? ''} · taxonomie {TAXONOMY.version} · calculs 100 % locaux, aucune donnée envoyée</footer>
    </div>
  );
}

function Home(p: { host: HostApi; fail(e: unknown): void; packs: ResolvedPack[]; packId: string; setPackId(id: string): void; onDemo(): void; onRoom(f: Parameters<typeof newRoomProject>[0]): void; onFile(f: Picked): void; today: string }) {
  const [f, setF] = useState({ name: 'Ma pièce', lengthM: '5.00', widthM: '4.00', thicknessM: '0.20', wallClass: 'masonry.block.hollow', heightM: '3.00', author: 'user:local', date: p.today });
  const wallClasses = TAXONOMY.classes.filter((c) => c.id.startsWith('masonry.')).map((c) => c.id);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }): void => setF({ ...f, [k]: e.target.value });
  return (
    <section className="home">
      <h2>Démarrer</h2>
      <label>Marché (pack)
        <select value={p.packId} onChange={(e) => p.setPackId(e.target.value)} data-testid="pack-select">
          {p.packs.map((x) => <option key={x.id} value={x.id}>{x.id} — {x.currency.code} {x.dataClass !== 'commercial' ? '(synthetic/test)' : ''}</option>)}
        </select></label>
      <p className="muted">Le marché ne change ni le modèle ni les hypothèses : il pourra être changé à tout moment dans l'onglet « Marché ».</p>
      <div className="cards">
        <div className="card"><h3>Projet de démonstration</h3><p>Petite habitation <b>synthétique</b> (3 pièces, 10 murs, 7 ouvertures). Aucune donnée réelle.</p><button onClick={p.onDemo} data-testid="open-demo">Ouvrir la démonstration</button></div>
        <div className="card"><h3>Nouvelle pièce</h3>
          <label>Nom<input value={f.name} onChange={set('name')} data-testid="room-name" /></label>
          <div className="row"><label>Longueur (m)<input value={f.lengthM} onChange={set('lengthM')} data-testid="room-length" /></label><label>Largeur (m)<input value={f.widthM} onChange={set('widthM')} data-testid="room-width" /></label></div>
          <div className="row"><label>Épaisseur murs (m)<input value={f.thicknessM} onChange={set('thicknessM')} /></label><label>Hauteur libre (m) — hypothèse<input value={f.heightM} onChange={set('heightM')} /></label></div>
          <label>Type de mur<select value={f.wallClass} onChange={set('wallClass')}>{wallClasses.map((c) => <option key={c}>{c}</option>)}</select></label>
          <button onClick={() => p.onRoom(f)} data-testid="create-room">Créer le projet</button></div>
        <div className="card"><h3>Ouvrir un fichier .btpx</h3><p>Le fichier est vérifié (empreintes) puis recalculé à froid avec les packs qu'il embarque.</p>
          <FilePick host={p.host} kind="btpx" accept=".btpx" testid="open-file" label="Choisir un fichier .btpx…" onFile={p.onFile} fail={p.fail} /></div>
      </div>
    </section>
  );
}
