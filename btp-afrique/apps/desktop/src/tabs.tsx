import { useMemo, useState } from 'react';
import type { ResolvedPack } from '../../../src/core/pack/types.js';
import type { BindingRequest, PriceStatistic } from '../../../src/core/pack/binding.js';
import type { Run } from '../../../src/core/project/run.js';
import { buildDocument, formatDocNumber, type Document } from '../../../src/core/docs/document.js';
import { explainLine, explainPrice, explainRequirement } from '../../../src/core/trace/explain.js';
import { verifyRun } from '../../../src/core/trace/chain.js';
import { renderMarkdown, fmtQty } from '../../../src/adapters/render-text.js';
import { renderPdf, verifyPdfDocument } from '../../../src/adapters/export-pdf.js';
import { renderXlsx } from '../../../src/adapters/export-xlsx.js';
import type { Dispatch } from './App.js';
import type { HostApi } from './host.js';
import { TAXONOMY, type Session } from './session.js';
import { assumptionRows, defaultZone, estimateRows, geoRows, modelView, ouvrageRows, priceRows, type AttrView } from './viewmodel.js';

const Attr = ({ a }: { a: AttrView }) => a.unspecified
  ? <span className="chip bad" title="valeur non spécifiée : bloque le calcul">non spécifié</span>
  : <span>{a.value ?? '—'} {a.value ? a.unit : ''} <span className="chip" title={a.assumptionId ? `hypothèse ${a.assumptionId}` : 'attribut du modèle'}>{a.assumptionId ? `hyp. ${a.assumptionId}` : a.origin}{a.validation ? ` · ${a.validation}` : ''}</span></span>;
const Explain = ({ lines, onClose }: { lines: string[]; onClose(): void }) => <div className="explain" data-testid="explain"><button onClick={onClose}>Fermer</button><pre>{lines.join('\n')}</pre></div>;

// ───────────────────────────── Marché
export function MarketTab({ session, packs, onRebind }: { session: Session; packs: ResolvedPack[]; onRebind(p: ResolvedPack, b: BindingRequest): void }) {
  const [packId, setPackId] = useState(session.pack.id);
  const pack = packs.find((p) => p.id === packId) ?? session.pack;
  const b = session.run.binding;
  const [zone, setZone] = useState(pack.zoneTree.some((z) => z.id === b.zoneId) ? b.zoneId : defaultZone(pack));
  const [asOf, setAsOf] = useState(b.asOf); const [stat, setStat] = useState<PriceStatistic>(b.priceStatistic);
  const [params, setParams] = useState<Record<string, string>>({});
  const changePack = (id: string): void => { setPackId(id); const p = packs.find((x) => x.id === id)!; setZone(defaultZone(p)); setParams({}); };
  return (
    <section>
      <h2>Marché applicable</h2>
      <p className="muted">Le marché fournit prix, taxes, devise et méthodes de métré. Changer de marché ne modifie jamais le modèle ni les hypothèses.</p>
      <div className="row">
        <label>Pack<select value={packId} onChange={(e) => changePack(e.target.value)} data-testid="market-pack">{packs.map((p) => <option key={p.id} value={p.id}>{p.id}@{p.version} — {p.currency.code}{p.dataClass !== 'commercial' ? ' (synthetic/test)' : ''}</option>)}</select></label>
        <label>Zone<select value={zone} onChange={(e) => setZone(e.target.value)} data-testid="market-zone">{pack.zoneTree.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.type})</option>)}</select></label>
        <label>Prix au<input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} data-testid="market-asof" /></label>
        <label>Statistique de prix<select value={stat} onChange={(e) => setStat(e.target.value as PriceStatistic)}>{['median', 'mean', 'min', 'max'].map((s) => <option key={s}>{s}</option>)}</select></label>
      </div>
      <h3>Paramètres du pack (surcharge possible)</h3>
      <div className="row wrap">{Object.entries(pack.params).map(([k, v]) => <label key={k}>{k}<input value={params[k] ?? (pack.id === b.packId ? b.params[k] : v) ?? v} onChange={(e) => setParams({ ...params, [k]: e.target.value })} /></label>)}</div>
      <button data-testid="market-apply" onClick={() => onRebind(pack, { zoneId: zone, asOf, priceStatistic: stat, paramOverrides: Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== pack.params[k])) })}>Appliquer ce marché</button>
      <h3>Liaison courante (révision {b.revision})</h3>
      <table><tbody>
        <tr><th>Pack résolu</th><td><code>{b.packResolvedHash.slice(0, 22)}…</code></td></tr><tr><th>Liste de prix</th><td>{b.priceBookId} <code>{b.priceBookHash.slice(0, 22)}…</code></td></tr>
        <tr><th>Devise</th><td>{session.run.pack.currency.code} ({session.run.pack.currency.name}), {session.run.pack.currency.minorUnits} décimale(s) mineure(s)</td></tr><tr><th>Classe de données</th><td>{b.dataClass}</td></tr>
        <tr><th>Réutilisation au dernier calcul</th><td data-testid="reuse">{session.reuse ? Object.entries(session.reuse).map(([k, v]) => `${k}: ${v ? 'réutilisé' : 'recalculé'}`).join(' · ') : 'calcul initial'}</td></tr>
      </tbody></table>
    </section>
  );
}

// ───────────────────────────── Modèle (plan, pièces, murs, ouvertures)
function PlanSvg({ run }: { run: Run }) {
  const lv = run.model.buildings[0]?.levels[0]; if (!lv || !lv.nodes.length) return <p className="muted">Aucun nœud : le plan est vide.</p>;
  const xs = lv.nodes.map((n) => n.x), ys = lv.nodes.map((n) => n.y); const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 520, H = 360, pad = 24; const k = Math.min((W - 2 * pad) / Math.max(maxX - minX, 1), (H - 2 * pad) / Math.max(maxY - minY, 1));
  const X = (x: number): number => pad + (x - minX) * k, Y = (y: number): number => H - pad - (y - minY) * k; const node = new Map(lv.nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="plan" data-testid="plan" role="img" aria-label="Plan schématique du niveau (positions des ouvertures non modélisées)">
      {lv.walls.map((w) => { const a = node.get(w.startNode)!, b = node.get(w.endNode)!; const mx = (X(a.x) + X(b.x)) / 2, my = (Y(a.y) + Y(b.y)) / 2; const ops = lv.openings.filter((o) => o.hostWallId === w.id);
        return <g key={w.id}><line x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} className={w.role === 'exterior' ? 'wall ext' : 'wall'} data-testid={`svg-wall-${w.id}`} />
          <text x={mx + 4} y={my - 4} className="lbl">{w.code}</text>{ops.map((o, i) => <circle key={o.id} cx={mx} cy={my + 10 + i * 9} r={3.5} className="op"><title>{o.code} ({o.class}) — position schématique</title></circle>)}</g>; })}
      {lv.nodes.map((n) => <circle key={n.id} cx={X(n.x)} cy={Y(n.y)} r={2.5} className="node" />)}
    </svg>
  );
}
const OPENING_CLASSES = TAXONOMY.classes.filter((c) => c.id.startsWith('opening.')).map((c) => c.id);

export function ModelTab({ run, dispatch, today }: { run: Run; dispatch: Dispatch; today: string }) {
  const v = useMemo(() => modelView(run), [run]); const lv = run.model.buildings[0]!.levels[0]!;
  const [edit, setEdit] = useState<Record<string, { w: string; h: string }>>({});
  const [nw, setNw] = useState({ host: lv.walls[0]?.id ?? '', cls: OPENING_CLASSES[0] ?? '', w: '0.90', h: '2.10' });
  void today;
  return (
    <section>
      <h2>Modèle architectural <span className="muted">({v.counts.spaces} pièce(s), {v.counts.walls} mur(s), {v.counts.openings} ouverture(s))</span></h2>
      <PlanSvg run={run} />
      {v.blocked.length > 0 && <div className="error" data-testid="blocked"><b>Calcul bloqué pour {v.blocked.length} grandeur(s)</b> — renseigner les valeurs manquantes (aucune valeur n'est inventée) :<ul>{v.blocked.map((b, i) => <li key={i}>{b.entity} · {b.quantity} : {b.reason}</li>)}</ul></div>}
      <h3>Pièces</h3>
      <table data-testid="spaces"><thead><tr><th>Code</th><th>Nom</th><th>Niveau</th><th>Usage</th><th>Surface libre (m²)</th><th>Périmètre (m)</th></tr></thead>
        <tbody>{v.spaces.map((s) => <tr key={s.id}><td>{s.code}</td><td>{s.name}</td><td>{s.level}</td><td>{s.usage}</td><td>{s.areaM2 ?? '—'}</td><td>{s.perimeterM ?? '—'}</td></tr>)}</tbody></table>
      <h3>Murs</h3>
      <table data-testid="walls"><thead><tr><th>Code</th><th>Rôle</th><th>Système</th><th>Longueur (m)</th><th>Épaisseur</th><th>Hauteur</th><th>Surface nette (m²)</th></tr></thead>
        <tbody>{v.walls.map((w) => <tr key={w.id}><td>{w.code}</td><td>{w.role}</td><td>{w.system ?? '—'}</td><td>{w.lengthM ?? '—'}</td><td><Attr a={w.thickness} /></td><td><Attr a={w.height} /></td><td>{w.netAreaM2 ?? '—'}</td></tr>)}</tbody></table>
      <h3>Ouvertures</h3>
      <table data-testid="openings"><thead><tr><th>Code</th><th>Type</th><th>Mur</th><th>Largeur</th><th>Hauteur</th><th>Surface (m²)</th><th>Modifier (m)</th></tr></thead>
        <tbody>{v.openings.map((o) => { const e = edit[o.id] ?? { w: o.width.value ?? '', h: o.height.value ?? '' }; const locked = !!o.width.assumptionId || !!o.height.assumptionId;
          return <tr key={o.id}><td>{o.code}</td><td>{o.cls}</td><td>{o.host}</td><td><Attr a={o.width} /></td><td><Attr a={o.height} /></td><td>{o.areaM2 ?? '—'}</td>
            <td>{locked ? <span className="muted">via hypothèse</span> : <span className="row"><input size={5} value={e.w} onChange={(x) => setEdit({ ...edit, [o.id]: { ...e, w: x.target.value } })} data-testid={`ow-${o.code}`} /><input size={5} value={e.h} onChange={(x) => setEdit({ ...edit, [o.id]: { ...e, h: x.target.value } })} data-testid={`oh-${o.code}`} /><button data-testid={`osave-${o.code}`} onClick={() => dispatch({ type: 'setOpeningSize', openingId: o.id, width: e.w, height: e.h })}>OK</button></span>}</td></tr>; })}</tbody></table>
      <h3>Ajouter une ouverture</h3>
      <div className="row">
        <label>Mur<select value={nw.host} onChange={(e) => setNw({ ...nw, host: e.target.value })} data-testid="new-op-wall">{lv.walls.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}</select></label>
        <label>Type<select value={nw.cls} onChange={(e) => setNw({ ...nw, cls: e.target.value })} data-testid="new-op-class">{OPENING_CLASSES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Largeur (m)<input value={nw.w} onChange={(e) => setNw({ ...nw, w: e.target.value })} data-testid="new-op-w" /></label>
        <label>Hauteur (m)<input value={nw.h} onChange={(e) => setNw({ ...nw, h: e.target.value })} data-testid="new-op-h" /></label>
        <button data-testid="new-op-add" onClick={() => { const n = lv.openings.length + 1; const id = `o-u${n}`; dispatch({ type: 'addOpening', levelId: lv.id, opening: { id, code: `U-${n}`, hostWallId: nw.host, class: nw.cls, width: { value: nw.w, unit: 'm', origin: 'user_entered', validation: 'accepted' }, height: { value: nw.h, unit: 'm', origin: 'user_entered', validation: 'accepted' }, spec: { system: nw.cls.includes('window') ? 'joinery.aluminium' : 'joinery.timber', origin: 'user_entered' } } }); }}>Ajouter</button>
      </div>
    </section>
  );
}

// ───────────────────────────── Hypothèses
export function AssumptionsTab({ run, dispatch, today, actor }: { run: Run; dispatch: Dispatch; today: string; actor: string }) {
  const rows = assumptionRows(run); const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <section>
      <h2>Hypothèses</h2>
      <p className="muted">Aucune valeur par défaut cachée : toute valeur absente du plan est une hypothèse explicite, <b>proposée</b> puis <b>confirmée</b> par une personne.</p>
      <table data-testid="assumptions"><thead><tr><th>ID</th><th>Clé</th><th>Valeur</th><th>Statut</th><th>Justification</th><th>Utilisée par</th><th></th></tr></thead>
        <tbody>{rows.map((a) => <tr key={a.id}><td>{a.id}</td><td>{a.key}</td>
          <td><input size={7} value={vals[a.id] ?? a.value} onChange={(e) => setVals({ ...vals, [a.id]: e.target.value })} data-testid={`as-val-${a.id}`} /> {a.unit}
            {vals[a.id] !== undefined && vals[a.id] !== a.value && <button data-testid={`as-set-${a.id}`} onClick={() => { dispatch({ type: 'setAssumptionValue', assumptionId: a.id, value: vals[a.id]! }); setVals({ ...vals, [a.id]: undefined as never }); }}>Appliquer</button>}</td>
          <td><span className={a.status === 'confirmed' ? 'chip ok' : 'chip warn'} data-testid={`as-status-${a.id}`}>{a.status === 'confirmed' ? `confirmée (${a.confirmedBy}, ${a.confirmedAt})` : 'PROPOSÉE — à confirmer'}</span></td>
          <td>{a.rationale}</td><td>{a.usedBy} grandeur(s)</td>
          <td>{a.status === 'proposed' ? <button data-testid={`as-confirm-${a.id}`} onClick={() => dispatch({ type: 'confirmAssumption', assumptionId: a.id, by: actor, at: today })}>Confirmer</button> : <button onClick={() => dispatch({ type: 'unconfirmAssumption', assumptionId: a.id })}>Retirer la confirmation</button>}</td></tr>)}</tbody></table>
      {run.takeoff.blocked.length > 0 && <p className="error">{run.takeoff.blocked.length} grandeur(s) bloquée(s) par une valeur non spécifiée.</p>}
    </section>
  );
}

// ───────────────────────────── Métré
export function MetreTab({ run }: { run: Run }) {
  const [filter, setFilter] = useState(''); const [ex, setEx] = useState<string[] | null>(null);
  const geo = geoRows(run).filter((g) => (g.id + g.entity).toLowerCase().includes(filter.toLowerCase())); const ouv = ouvrageRows(run);
  const lineOf = (oid: string): string | undefined => run.estimate.lines.find((l) => l.ouvrageId === oid)?.id;
  return (
    <section>
      <h2>Métré</h2>
      {ex && <Explain lines={ex} onClose={() => setEx(null)} />}
      <h3>Étage 2 — Quantités commerciales (ouvrages du marché)</h3>
      <table data-testid="ouvrages"><thead><tr><th>Ouvrage</th><th>Lot</th><th>Unité</th><th>Moteur</th><th>Retenue</th><th></th></tr></thead>
        <tbody>{ouv.map((o) => <tr key={o.id}><td>{o.label}{o.flag && <span className="chip warn" title="estimation paramétrique">{o.flag}</span>}</td><td>{o.lot}</td><td>{o.unit}</td><td>{fmtQty(o.engineQuantity)}</td>
          <td><b>{fmtQty(o.quantity)}</b>{o.adjusted && <span className="chip warn">ajusté manuellement</span>}</td>
          <td>{lineOf(o.id) && <button data-testid={`why-${o.id}`} onClick={() => setEx([...explainLine(run, lineOf(o.id)!), '', ...explainPrice(run, lineOf(o.id)!)])}>Pourquoi ?</button>}</td></tr>)}</tbody></table>
      <h3>Articles à commander</h3>
      <table><thead><tr><th>Article</th><th>Unité</th><th>Théorique</th><th>À commander</th><th></th></tr></thead>
        <tbody>{run.quantitySet.requirements.map((r) => <tr key={r.id}><td>{r.label}</td><td>{r.unit}</td><td>{fmtQty(r.theoretical)}</td><td>{fmtQty(r.quantity)}</td><td><button onClick={() => setEx(explainRequirement(run, r.item))}>Pourquoi ?</button></td></tr>)}</tbody></table>
      <h3>Étage 1 — Quantités géométriques (universelles, sans marché)</h3>
      <input placeholder="Filtrer (code, type de quantité)…" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="geo-filter" />
      <table data-testid="geo"><thead><tr><th>Entité</th><th>Grandeur</th><th>Valeur</th><th>Unité</th></tr></thead><tbody>{geo.map((g) => <tr key={g.id}><td>{g.entity}</td><td>{g.kind}</td><td>{g.value}</td><td>{g.unit}</td></tr>)}</tbody></table>
    </section>
  );
}

// ───────────────────────────── Prix
export function PricesTab({ run }: { run: Run }) {
  const [q, setQ] = useState(''); const rows = priceRows(run).filter((r) => (r.item + r.label).toLowerCase().includes(q.toLowerCase()));
  return (
    <section>
      <h2>Prix du marché <span className="muted">— {run.pack.id}, devise {run.pack.currency.code}, évalués au {run.binding.asOf} ({run.binding.priceStatistic})</span></h2>
      <p className="muted">Unités mineures : {run.pack.currency.minorUnits} décimale(s). Les prix « synthetic/test » ne sont PAS des prix réels.</p>
      <input placeholder="Filtrer un article…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="price-filter" />
      <table data-testid="prices"><thead><tr><th>Article</th><th>Unité</th><th>Médiane</th><th>Min</th><th>Max</th><th>n</th><th>Date</th><th>Source</th><th>Confiance</th><th>Classe</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{r.label}<br /><small className="muted">{r.item}</small></td><td>{r.unit}</td><td>{r.median}</td><td>{r.min}</td><td>{r.max}</td><td>{r.n}</td><td>{r.date}{r.stale && <span className="chip bad">périmé</span>}</td><td>{r.source}</td><td>{r.confidence}</td><td>{r.dataClass}</td></tr>)}</tbody></table>
    </section>
  );
}

// ───────────────────────────── Chiffrage + entrées manuelles
export function EstimateTab({ run, dispatch, today, actor }: { run: Run; dispatch: Dispatch; today: string; actor: string }) {
  const v = estimateRows(run); const [ex, setEx] = useState<string[] | null>(null);
  const [adj, setAdj] = useState({ target: run.quantitySet.ouvrages[0]?.id ?? '', mode: 'delta' as 'delta' | 'override', value: '1', justification: '' });
  const [ml, setMl] = useState({ lot: run.pack.workBreakdown[0]?.code ?? '', designation: '', unit: 'u', quantity: '1', unitPrice: '1000', justification: '' });
  return (
    <section>
      <h2>Chiffrage <span className="muted">({v.currency})</span></h2>
      {ex && <Explain lines={ex} onClose={() => setEx(null)} />}
      <table data-testid="estimate"><thead><tr><th>N°</th><th>Lot</th><th>Désignation</th><th>Unité</th><th className="num">Quantité</th><th className="num">Prix unitaire</th><th className="num">Montant</th><th></th></tr></thead>
        <tbody>{v.rows.map((l) => <tr key={l.id} data-testid={`line-${l.id}`}><td>{l.n}</td><td>{l.lot}</td><td>{l.label}{l.source === 'manual' && <span className="chip warn">manuelle</span>}{l.flags.filter((f) => f !== 'manual_line').map((f) => <span key={f} className="chip warn">{f}</span>)}{l.status === 'unpriced' && <span className="chip bad">sans prix</span>}</td><td>{l.unit}</td><td className="num">{l.quantity}</td><td className="num">{l.unitPrice ?? '—'}</td><td className="num">{l.amount ?? '—'}</td>
          <td><button onClick={() => setEx([...explainLine(run, l.id), '', ...explainPrice(run, l.id)])} data-testid={`why-line-${l.id}`}>Pourquoi ?</button></td></tr>)}</tbody>
        <tfoot><tr><th colSpan={6}>Total lignes</th><td className="num">{v.money(run.estimate.linesTotal)}</td><td /></tr>
          {run.estimate.totalLayers.map((l) => <tr key={l.id}><td colSpan={6}>{l.label}</td><td className="num">{v.money(l.amount)}</td><td /></tr>)}
          <tr><th colSpan={6}>TOTAL</th><td className="num" data-testid="total"><b>{v.total}</b></td><td /></tr></tfoot></table>
      {v.flags.length > 0 && <p>{v.flags.map((f) => <span key={f} className="chip warn">{f}</span>)}</p>}
      <h3>Ajustement de quantité (traçable)</h3>
      <p className="muted">S'applique à la quantité d'ouvrage, après arrondi ; la géométrie n'est jamais modifiée. Justification (≥ 8 caractères), auteur et date obligatoires.</p>
      <div className="row wrap">
        <label>Ouvrage<select value={adj.target} onChange={(e) => setAdj({ ...adj, target: e.target.value })} data-testid="adj-target">{run.quantitySet.ouvrages.map((o) => <option key={o.id} value={o.id}>{o.assembly.label}</option>)}</select></label>
        <label>Mode<select value={adj.mode} onChange={(e) => setAdj({ ...adj, mode: e.target.value as 'delta' | 'override' })} data-testid="adj-mode"><option value="delta">delta (+/−)</option><option value="override">remplacement</option></select></label>
        <label>Valeur<input value={adj.value} onChange={(e) => setAdj({ ...adj, value: e.target.value })} data-testid="adj-value" /></label>
        <label>Justification<input size={30} value={adj.justification} onChange={(e) => setAdj({ ...adj, justification: e.target.value })} data-testid="adj-just" /></label>
        <button data-testid="adj-add" onClick={() => dispatch({ type: 'setAdjustment', adjustment: { id: `AJ-${run.manual.adjustments.length + 1}`, target: adj.target, mode: adj.mode, value: adj.value, justification: adj.justification, author: actor, date: today } })}>Ajouter</button>
      </div>
      <ul data-testid="adjustments">{run.manual.adjustments.map((a) => <li key={a.id}>{a.id} · {a.target} · {a.mode} {a.value} — « {a.justification} » ({a.author}, {a.date}) <button onClick={() => dispatch({ type: 'removeAdjustment', id: a.id })}>Retirer</button></li>)}</ul>
      {run.quantitySet.orphanAdjustments.length > 0 && <p className="error">Ajustements orphelins (cible disparue) : {run.quantitySet.orphanAdjustments.map((o) => o.adjustment.id).join(', ')}</p>}
      <h3>Ligne manuelle (hors modèle)</h3>
      <p className="muted">Prix unitaire de vente en <b>unité mineure</b> de la devise ({run.pack.currency.minorUnits === 0 ? 'entier' : `×10^${run.pack.currency.minorUnits}`}).</p>
      <div className="row wrap">
        <label>Lot<select value={ml.lot} onChange={(e) => setMl({ ...ml, lot: e.target.value })}>{run.pack.workBreakdown.map((l) => <option key={l.code} value={l.code}>{l.code} {l.label}</option>)}</select></label>
        <label>Désignation<input value={ml.designation} onChange={(e) => setMl({ ...ml, designation: e.target.value })} data-testid="ml-des" /></label>
        <label>Unité<input size={4} value={ml.unit} onChange={(e) => setMl({ ...ml, unit: e.target.value })} /></label>
        <label>Quantité<input size={6} value={ml.quantity} onChange={(e) => setMl({ ...ml, quantity: e.target.value })} data-testid="ml-qty" /></label>
        <label>PU (unité mineure)<input size={8} value={ml.unitPrice} onChange={(e) => setMl({ ...ml, unitPrice: e.target.value })} data-testid="ml-pu" /></label>
        <label>Justification<input size={26} value={ml.justification} onChange={(e) => setMl({ ...ml, justification: e.target.value })} data-testid="ml-just" /></label>
        <button data-testid="ml-add" onClick={() => dispatch({ type: 'addManualLine', line: { id: `L${run.manual.lines.length + 1}`, ...ml, author: actor, date: today } })}>Ajouter la ligne</button>
      </div>
      <ul data-testid="manual-lines">{run.manual.lines.map((l) => <li key={l.id}>{l.id} · {l.designation} · {l.quantity} {l.unit} × {l.unitPrice} <button onClick={() => dispatch({ type: 'removeManualLine', id: l.id })}>Retirer</button></li>)}</ul>
    </section>
  );
}

// ───────────────────────────── Documents (DQE, devis) et exports
export function DocumentsTab({ session, host, onDoc, fail }: { session: Session; host: HostApi; onDoc(d: Document): void; fail(e: unknown): void }) {
  const run = session.run; const [issuer, setIssuer] = useState('ENTREPRISE DE TEST'); const [client, setClient] = useState('CLIENT DE TEST'); const [site, setSite] = useState('Chantier synthétique');
  const [ids, setIds] = useState<Record<string, string>>({}); const [status, setStatus] = useState<'draft' | 'final'>('draft'); const [sel, setSel] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const doc = session.documents.find((d) => d.id === sel) ?? session.documents[session.documents.length - 1] ?? null;
  const make = (layout: 'priced-lines' | 'quote'): void => {
    try {
      const tpl = run.pack.documentTemplates.find((t) => t.layout === layout); if (!tpl) throw new Error(`Ce marché n'a pas de modèle de document « ${layout} »`);
      const rule = run.pack.numberingRules.find((n) => n.kind === tpl.kind)!; const seq = session.documents.filter((d) => d.manifest.templateId === tpl.id).length + 1;
      const d = buildDocument(run, { templateId: tpl.id, number: formatDocNumber(rule, host.today(), seq), date: host.today(), status, allowUnpriced: status === 'draft',
        ...(layout === 'quote' ? { issuer: { name: issuer, identifiers: Object.fromEntries(run.pack.legalIdentifiers.map((l) => [l.key, ids[l.key] ?? ''])) }, client: { name: client }, site, validityDays: 30 } : {}) });
      onDoc(d); setSel(d.id); setMsg(null);
    } catch (e) { fail(e); }
  };
  const base = (d: Document): string => `${d.content.number.replace(/[^\w.-]+/g, '_')}`;
  const exp = async (kind: 'md' | 'pdf' | 'xlsx'): Promise<void> => {
    if (!doc) return;
    try {
      if (kind === 'md') await host.saveFile(`${base(doc)}.md`, new TextEncoder().encode(renderMarkdown(doc)), 'text/markdown');
      if (kind === 'pdf') { const r = await renderPdf(doc); const v = await verifyPdfDocument(r.bytes); if (!v.ok) throw new Error('PDF non vérifiable : ' + v.problems.join('; ')); await host.saveFile(`${base(doc)}.pdf`, r.bytes, 'application/pdf'); setMsg(`PDF exporté (${r.pageCount} page(s)), provenance jointe et vérifiée${r.unsupportedChars.length ? `; caractères non représentables remplacés : ${r.unsupportedChars.join(' ')}` : ''}`); }
      if (kind === 'xlsx') { const b = await renderXlsx(doc); await host.saveFile(`${base(doc)}.xlsx`, b, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); setMsg('Excel exporté (formules de montant actives, provenance dans les feuilles « Annexe » et « Provenance »)'); }
    } catch (e) { fail(e); }
  };
  const v = verifyRun(run);
  return (
    <section>
      <h2>Documents</h2>
      <p className="muted">Un document est un instantané figé (empreintes de contenu et de provenance). Toute modification du projet invalide les documents émis : il faut les régénérer.</p>
      <div className="row wrap">
        <label>Statut<select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'final')} data-testid="doc-status"><option value="draft">brouillon (lignes sans prix tolérées)</option><option value="final">final (refusé si prix manquant)</option></select></label>
        <button onClick={() => make('priced-lines')} data-testid="make-dqe">Générer le DQE</button>
      </div>
      <h3>Devis</h3>
      <div className="row wrap">
        <label>Émetteur<input value={issuer} onChange={(e) => setIssuer(e.target.value)} /></label>
        {run.pack.legalIdentifiers.map((l) => <label key={l.key}>{l.label}<input value={ids[l.key] ?? ''} onChange={(e) => setIds({ ...ids, [l.key]: e.target.value })} /></label>)}
        <label>Client<input value={client} onChange={(e) => setClient(e.target.value)} /></label><label>Chantier<input value={site} onChange={(e) => setSite(e.target.value)} /></label>
        <button onClick={() => make('quote')} data-testid="make-quote">Générer le devis</button>
      </div>
      {msg && <div className="notice" data-testid="doc-msg">{msg}</div>}
      <p>Vérification de la chaîne de traçabilité : <span className={v.ok ? 'chip ok' : 'chip bad'}>{v.ok ? `OK (${run.estimate.lines.length} ligne(s) résolue(s))` : v.problems.join(' ; ')}</span></p>
      {session.documents.length > 0 && <>
        <div className="row">{session.documents.map((d) => <button key={d.id} className={doc?.id === d.id ? 'active' : ''} onClick={() => setSel(d.id)}>{d.content.number}</button>)}</div>
        {doc && <><div className="row"><button onClick={() => void exp('pdf')} data-testid="export-pdf">Exporter PDF</button><button onClick={() => void exp('xlsx')} data-testid="export-xlsx">Exporter Excel</button><button onClick={() => void exp('md')} data-testid="export-md">Exporter Markdown</button></div>
          <pre className="doc" data-testid="doc-preview">{renderMarkdown(doc)}</pre></>}
      </>}
    </section>
  );
}

// ───────────────────────────── Plans sources & IA
export function SourcesTab({ session, onFile }: { session: Session; onFile(f: File): void }) {
  return (
    <section>
      <h2>Plans sources & assistance IA</h2>
      <div className="notice" data-testid="ai-status"><b>Aucun module de reconnaissance n'est installé.</b> La détection automatique des murs, pièces et ouvertures n'existe pas encore : tout le modèle se saisit manuellement. Les contrats (import, calibration d'échelle, propositions à valider, porte de validation humaine) sont définis et testés (ADR-0015) ; une proposition n'entrerait jamais dans le modèle sans validation explicite.</div>
      <label>Importer un plan (PDF, PNG, JPEG) — conservé dans le fichier projet<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} data-testid="source-file" /></label>
      <table data-testid="sources"><thead><tr><th>Empreinte</th><th>Nom</th><th>Type</th><th>Taille</th></tr></thead>
        <tbody>{Object.entries(session.sources).map(([id, s]) => <tr key={id}><td><code>{id}</code></td><td>{s.originalName}</td><td>{s.mediaType}</td><td>{s.bytes.length} o</td></tr>)}</tbody></table>
    </section>
  );
}

// ───────────────────────────── Historique
export function HistoryTab({ session, onUndo }: { session: Session; onUndo(): void }) {
  return (
    <section>
      <h2>Historique des opérations</h2>
      <button onClick={onUndo} disabled={!session.oplog.length} data-testid="undo">Annuler la dernière opération</button>
      <p className="muted">L'annulation ajoute une opération inverse : l'historique n'est jamais réécrit.</p>
      <ol data-testid="oplog">{session.oplog.map((r) => <li key={r.opId}><code>{r.op.type}</code> · {r.actor} · <small>{r.resultRev.slice(0, 18)}…</small></li>)}</ol>
    </section>
  );
}
