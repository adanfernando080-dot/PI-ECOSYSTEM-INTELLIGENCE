/**
 * ÉTAGE 1 — Métré géométrique (UNIVERSEL). N'importe aucun pack, ne connaît ni pays ni devise ni prix.
 * Entrées : modèle@rev + hypothèses@rev. Sortie : GeoQuantity[] avec trace complète (ADR-0002, ADR-0006, ADR-0007).
 */
import { Dec, sum } from '../units/decimal.js';
import type { ArchitecturalModel, Attr, Level, Space, Wall } from '../model/types.js';
import { AssumptionIndex, type AssumptionSet, type Resolved } from '../assumptions/assumptions.js';
import { hashOf } from '../trace/canonical.js';
import type { ConfidenceFloor, EntityRef, TraceInput, TraceNode, TraceStep } from '../trace/types.js';
import { GEO_SCALE, geoRule } from './rules.js';

export interface GeoQuantity {
  id: string; kind: string; entity: EntityRef; value: string; unit: string;
  trace: TraceNode; confidenceFloor: ConfidenceFloor | null;
}
export interface BlockedItem { entity: EntityRef; quantity: string; reason: string }
export interface GeometricTakeoff {
  modelRev: string; assumptionSetRev: string; planRevision: string;
  quantities: GeoQuantity[];
  relations: {
    wallOpenings: Record<string, string[]>;
    spaceWalls: Record<string, string[]>;
    openingHost: Record<string, string>;
  };
  blocked: BlockedItem[];
  contentHash: string;
}

const HALF = Dec.parse('0.5');
const NO_OPENING: TraceInput = { name: 'aucune ouverture hébergée', value: '0', unit: 'm2', source: { type: 'literal' } };
const units4 = (n: number): Dec => Dec.of(BigInt(n), 4); // 0,1 mm -> m

export function computeTakeoff(model: ArchitecturalModel, assumptions: AssumptionSet): GeometricTakeoff {
  const A = new AssumptionIndex(assumptions);
  const quantities: GeoQuantity[] = [];
  const blocked: BlockedItem[] = [];
  const geoById = new Map<string, GeoQuantity>();
  const relations: GeometricTakeoff['relations'] = { wallOpenings: {}, spaceWalls: {}, openingHost: {} };

  const entityOf = (type: string, e: { id: string; code?: string; name?: string }): EntityRef => ({ type, id: e.id, code: e.code ?? e.name ?? e.id });

  const attrInput = (name: string, ent: EntityRef, attrName: string, r: Extract<Resolved<{ dec: Dec; unit: string }>, { ok: true }>): TraceInput => ({
    name, value: r.value.dec.toString(), unit: r.value.unit,
    source: {
      type: r.source.type === 'assumption' ? 'assumption' : 'attr', id: ent.id, attr: attrName,
      origin: r.source.origin, assumptionId: r.source.assumptionId,
      confidence: r.source.confidence ?? null, validation: r.source.validation,
    },
  });
  const geoInput = (name: string, g: GeoQuantity): TraceInput => ({
    name, value: g.value, unit: g.unit, source: { type: 'geo', id: g.id },
  });

  function floorOf(inputs: TraceInput[]): ConfidenceFloor | null {
    let best: ConfidenceFloor | null = null;
    const consider = (v: string, by: string): void => { if (!best || Dec.parse(v).lt(Dec.parse(best.value))) best = { value: v, limitedBy: by }; };
    for (const i of inputs) {
      if (i.source.type === 'attr' && i.source.origin === 'ai_detected' && i.source.confidence
        && i.source.validation !== 'accepted' && i.source.validation !== 'edited') consider(i.source.confidence, `${i.source.id}.${i.source.attr}`);
      if (i.source.type === 'geo' && i.source.id) {
        const g = geoById.get(i.source.id);
        if (g?.confidenceFloor) consider(g.confidenceFloor.value, g.confidenceFloor.limitedBy);
      }
    }
    return best;
  }

  function emit(kind: string, ruleId: string, ent: EntityRef, inputs: TraceInput[], steps: TraceStep[], value: Dec, unit: string): GeoQuantity {
    const v = value.round(GEO_SCALE, 'half_up');
    const g: GeoQuantity = {
      id: `geo:${ent.id}:${kind}`, kind, entity: ent, value: v.toString(), unit,
      trace: { rule: geoRule(ruleId), inputs, steps, result: { value: v.toString(), unit } },
      confidenceFloor: null,
    };
    g.confidenceFloor = floorOf(inputs);
    quantities.push(g); geoById.set(g.id, g);
    return g;
  }
  const block = (ent: EntityRef, quantity: string, reason: string): void => { blocked.push({ entity: ent, quantity, reason }); };

  for (const b of model.buildings) for (const lv of b.levels) processLevel(lv);

  function processLevel(lv: Level): void {
    const nodes = new Map(lv.nodes.map((n) => [n.id, n]));
    const walls = new Map(lv.walls.map((w) => [w.id, w]));

    // ---- Ouvertures
    for (const o of lv.openings) {
      const ent = entityOf('opening', o);
      relations.openingHost[o.id] = o.hostWallId;
      (relations.wallOpenings[o.hostWallId] ??= []).push(o.id);
      const w = A.decimal(o.width, `${o.code}.largeur`); const h = A.decimal(o.height, `${o.code}.hauteur`);
      if (!w.ok || !h.ok) { block(ent, 'opening.area', (!w.ok ? w.reason : (h as { reason: string }).reason)); continue; }
      const area = w.value.dec.mul(h.value.dec);
      const inputs = [attrInput('largeur', ent, 'width', w), attrInput('hauteur', ent, 'height', h)];
      emit('opening.area', 'geom.opening.area', ent, inputs,
        [{ op: 'mul', expr: `${w.value.dec} × ${h.value.dec}`, result: area.toString(), unit: 'm2' }], area, 'm2');
      emit('opening.count', 'geom.opening.count', ent, [{ name: 'unité', value: '1', unit: 'u', source: { type: 'literal' } }],
        [{ op: 'const', expr: '1 ouverture', result: '1', unit: 'u' }], Dec.ONE, 'u');
    }

    // ---- Murs
    for (const w of lv.walls) {
      const ent = entityOf('wall', w);
      const n1 = nodes.get(w.startNode)!; const n2 = nodes.get(w.endNode)!;
      const dx = n2.x - n1.x; const dy = n2.y - n1.y;
      const sumsq = BigInt(dx) * BigInt(dx) + BigInt(dy) * BigInt(dy);
      const sq = Dec.of(sumsq, 8);
      const exact = sq.sqrt(8, 'half_up');
      const lenInputs: TraceInput[] = [
        { name: 'dx', value: units4(Math.abs(dx)).toString(), unit: 'm', source: { type: 'attr', id: w.id, attr: 'startNode→endNode' } },
        { name: 'dy', value: units4(Math.abs(dy)).toString(), unit: 'm', source: { type: 'attr', id: w.id, attr: 'startNode→endNode' } },
      ];
      const len = emit('wall.length.axis', 'geom.wall.length.axis', ent, lenInputs, [
        { op: 'add', expr: 'dx² + dy²', result: sq.toString(), unit: 'm2' },
        { op: 'sqrt', expr: 'racine(dx² + dy²) [échelle 8]', result: exact.toString(), unit: 'm' },
        { op: 'round', expr: `arrondi demi-haut à ${GEO_SCALE} décimales`, result: exact.round(GEO_SCALE).toString(), unit: 'm' },
      ], exact, 'm');

      const hgt = A.decimal(w.height, `${w.code}.hauteur`);
      if (!hgt.ok) { block(ent, 'wall.area.gross', hgt.reason); block(ent, 'wall.area.net', hgt.reason); continue; }
      const lenD = Dec.parse(len.value);
      const gross = lenD.mul(hgt.value.dec);
      const grossQ = emit('wall.area.gross', 'geom.wall.area.gross', ent, [geoInput('longueur', len), attrInput('hauteur', ent, 'height', hgt)],
        [{ op: 'mul', expr: `${lenD} × ${hgt.value.dec}`, result: gross.toString(), unit: 'm2' }], gross, 'm2');

      const hosted = relations.wallOpenings[w.id] ?? [];
      const hostedGeo = hosted.map((id) => geoById.get(`geo:${id}:opening.area`));
      if (hostedGeo.some((g) => !g)) { block(ent, 'wall.area.net', 'une ouverture hébergée est bloquée'); continue; }
      const gs = hostedGeo as GeoQuantity[];
      const opSum = sum(gs.map((g) => Dec.parse(g.value)));
      const opQ = emit('wall.openings.area', 'geom.wall.openings.area', ent, gs.length ? gs.map((g) => geoInput(`ouverture ${g.entity.code}`, g)) : [NO_OPENING],
        [{ op: 'sum', expr: gs.length ? gs.map((g) => g.value).join(' + ') : '(aucune ouverture)', result: opSum.toString(), unit: 'm2' }], opSum, 'm2');
      const net = Dec.parse(grossQ.value).sub(Dec.parse(opQ.value));
      emit('wall.area.net', 'geom.wall.area.net', ent, [geoInput('surface brute', grossQ), geoInput('ouvertures', opQ)],
        [{ op: 'sub', expr: `${grossQ.value} − ${opQ.value}`, result: net.toString(), unit: 'm2' }], net, 'm2');
    }

    // ---- Pièces
    for (const s of lv.spaces) processSpace(lv, s, walls, nodes);

    // ---- Dalles et toitures
    for (const sl of lv.slabs) {
      const ent = entityOf('slab', sl);
      const area = planArea(sl.outlineNodeIds, nodes);
      const aQ = emit('slab.area', 'geom.slab.area', ent, [{ name: 'contour', value: sl.outlineNodeIds.join(','), unit: '-', source: { type: 'attr', id: sl.id, attr: 'outlineNodeIds' } }],
        [{ op: 'shoelace', expr: 'formule du lacet (entiers 0,1 mm)', result: area.toString(), unit: 'm2' }], area, 'm2');
      const th = A.decimal(sl.thickness, `${sl.code}.épaisseur`);
      if (!th.ok) { block(ent, 'slab.volume', th.reason); continue; }
      const vol = Dec.parse(aQ.value).mul(th.value.dec);
      emit('slab.volume', 'geom.slab.volume', ent, [geoInput('surface', aQ), attrInput('épaisseur', ent, 'thickness', th)],
        [{ op: 'mul', expr: `${aQ.value} × ${th.value.dec}`, result: vol.toString(), unit: 'm3' }], vol, 'm3');
    }
    for (const r of lv.roofs) {
      const ent = entityOf('roof', r);
      const plan = planArea(r.outlineNodeIds, nodes);
      const pQ = emit('roof.area.plan', 'geom.roof.area.plan', ent, [{ name: 'contour', value: r.outlineNodeIds.join(','), unit: '-', source: { type: 'attr', id: r.id, attr: 'outlineNodeIds' } }],
        [{ op: 'shoelace', expr: 'formule du lacet (entiers 0,1 mm)', result: plan.toString(), unit: 'm2' }], plan, 'm2');
      const rise = A.decimal(r.rise, `${r.code}.montée`); const run = A.decimal(r.run, `${r.code}.portée`);
      if (!rise.ok || !run.ok) { block(ent, 'roof.area.developed', !rise.ok ? rise.reason : (run as { reason: string }).reason); continue; }
      const ratio = rise.value.dec.div(run.value.dec, 8, 'half_up');
      const radicand = Dec.ONE.add(ratio.mul(ratio));
      const factor = radicand.sqrt(8, 'half_up');
      const dev = Dec.parse(pQ.value).mul(factor);
      emit('roof.area.developed', 'geom.roof.area.developed', ent, [geoInput('surface en plan', pQ), attrInput('montée', ent, 'rise', rise), attrInput('portée', ent, 'run', run)], [
        { op: 'div', expr: `montée/portée = ${rise.value.dec}/${run.value.dec}`, result: ratio.toString(), unit: '-' },
        { op: 'sqrt', expr: '√(1 + rapport²) [échelle 8]', result: factor.toString(), unit: '-' },
        { op: 'mul', expr: `${pQ.value} × ${factor}`, result: dev.toString(), unit: 'm2' },
      ], dev, 'm2');
    }
  }

  function planArea(ids: string[], nodes: Map<string, { x: number; y: number }>): Dec {
    let a2 = 0n;
    for (let i = 0; i < ids.length; i++) {
      const p = nodes.get(ids[i]!)!; const q = nodes.get(ids[(i + 1) % ids.length]!)!;
      a2 += BigInt(p.x) * BigInt(q.y) - BigInt(q.x) * BigInt(p.y);
    }
    if (a2 < 0n) a2 = -a2;
    return Dec.of(a2, 8).mul(HALF);
  }

  function processSpace(lv: Level, s: Space, walls: Map<string, Wall>, nodes: Map<string, { id: string; x: number; y: number }>): void {
    const ent = entityOf('space', s);
    relations.spaceWalls[s.id] = [...s.boundaryWallIds];
    const bw = s.boundaryWallIds.map((id) => walls.get(id)!);
    const pts = bw.flatMap((w) => [nodes.get(w.startNode)!, nodes.get(w.endNode)!]);
    const minX = Math.min(...pts.map((p) => p.x)); const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y)); const maxY = Math.max(...pts.map((p) => p.y));
    const side: Record<'left' | 'right' | 'bottom' | 'top', Wall[]> = { left: [], right: [], bottom: [], top: [] };
    for (const w of bw) {
      const a = nodes.get(w.startNode)!; const b = nodes.get(w.endNode)!;
      if (a.x === b.x && a.x === minX) side.left.push(w);
      else if (a.x === b.x && a.x === maxX) side.right.push(w);
      else if (a.y === b.y && a.y === minY) side.bottom.push(w);
      else if (a.y === b.y && a.y === maxY) side.top.push(w);
      else { for (const q of ['space.clear.area', 'space.clear.perimeter', 'space.wall.area.net', 'space.ceiling.area']) block(ent, q, 'pièce non rectangulaire orthogonale (limite M0)'); return; }
    }
    const spanLen = (ws: Wall[]): number => ws.reduce((acc, w) => { const a = nodes.get(w.startNode)!; const b = nodes.get(w.endNode)!; return acc + Math.abs(b.x - a.x) + Math.abs(b.y - a.y); }, 0);
    if (spanLen(side.left) !== maxY - minY || spanLen(side.right) !== maxY - minY || spanLen(side.bottom) !== maxX - minX || spanLen(side.top) !== maxX - minX) {
      for (const q of ['space.clear.area', 'space.clear.perimeter', 'space.wall.area.net', 'space.ceiling.area']) block(ent, q, 'contour de pièce non fermé par les murs limites');
      return;
    }
    const thick = (ws: Wall[], label: string): { dec: Dec; inputs: TraceInput[] } | string => {
      const inputs: TraceInput[] = []; let t: Dec | null = null;
      for (const w of ws) {
        const r = A.decimal(w.thickness, `${w.code}.épaisseur`);
        if (!r.ok) return r.reason;
        if (t && !t.eq(r.value.dec)) return `épaisseurs différentes côté ${label} (limite M0)`;
        t = r.value.dec; inputs.push(attrInput(`épaisseur ${w.code}`, entityOf('wall', w), 'thickness', r));
      }
      return { dec: t!, inputs };
    };
    const tl = thick(side.left, 'gauche'); const tr = thick(side.right, 'droit'); const tb = thick(side.bottom, 'bas'); const tt = thick(side.top, 'haut');
    const bad = [tl, tr, tb, tt].find((x) => typeof x === 'string');
    if (typeof bad === 'string') { for (const q of ['space.clear.area', 'space.clear.perimeter', 'space.wall.area.net', 'space.ceiling.area']) block(ent, q, bad); return; }
    const [L, R, B, T] = [tl, tr, tb, tt] as Array<{ dec: Dec; inputs: TraceInput[] }>;
    const width = units4(maxX - minX).sub(L!.dec.add(R!.dec).mul(HALF));
    const depth = units4(maxY - minY).sub(B!.dec.add(T!.dec).mul(HALF));
    const inputs = [
      { name: 'Δx axes', value: units4(maxX - minX).toString(), unit: 'm', source: { type: 'attr' as const, id: s.id, attr: 'boundaryWallIds' } },
      { name: 'Δy axes', value: units4(maxY - minY).toString(), unit: 'm', source: { type: 'attr' as const, id: s.id, attr: 'boundaryWallIds' } },
      ...L!.inputs, ...R!.inputs, ...B!.inputs, ...T!.inputs,
    ];
    const area = width.mul(depth);
    const areaQ = emit('space.clear.area', 'geom.space.clear.area', ent, inputs, [
      { op: 'sub', expr: `largeur libre = ${units4(maxX - minX)} − (${L!.dec} + ${R!.dec})/2`, result: width.toString(), unit: 'm' },
      { op: 'sub', expr: `profondeur libre = ${units4(maxY - minY)} − (${B!.dec} + ${T!.dec})/2`, result: depth.toString(), unit: 'm' },
      { op: 'mul', expr: `${width} × ${depth}`, result: area.toString(), unit: 'm2' },
    ], area, 'm2');
    const per = width.add(depth).mul(Dec.int(2));
    const perQ = emit('space.clear.perimeter', 'geom.space.clear.perimeter', ent, inputs, [
      { op: 'mul', expr: `2 × (${width} + ${depth})`, result: per.toString(), unit: 'm' },
    ], per, 'm');
    emit('space.ceiling.area', 'geom.space.ceiling.area', ent, [geoInput('surface libre', areaQ)],
      [{ op: 'copy', expr: 'surface de plafond = surface libre', result: areaQ.value, unit: 'm2' }], Dec.parse(areaQ.value), 'm2');

    const ch = A.decimal(lv.clearHeight, `${lv.code}.hauteur libre`);
    if (!ch.ok) { block(ent, 'space.wall.area.net', ch.reason); return; }
    const grossW = Dec.parse(perQ.value).mul(ch.value.dec);
    const grossQ = emit('space.wall.area.gross', 'geom.space.wall.area.gross', ent, [geoInput('périmètre libre', perQ), attrInput('hauteur libre', entityOf('level', lv), 'clearHeight', ch)],
      [{ op: 'mul', expr: `${perQ.value} × ${ch.value.dec}`, result: grossW.toString(), unit: 'm2' }], grossW, 'm2');
    const opIds = s.boundaryWallIds.flatMap((id) => relations.wallOpenings[id] ?? []);
    const opGeo = opIds.map((id) => geoById.get(`geo:${id}:opening.area`));
    if (opGeo.some((g) => !g)) { block(ent, 'space.wall.area.net', 'une ouverture des murs de la pièce est bloquée'); return; }
    const og = opGeo as GeoQuantity[];
    const opSum = sum(og.map((g) => Dec.parse(g.value)));
    const opQ = emit('space.wall.openings.area', 'geom.space.wall.openings.area', ent, og.length ? og.map((g) => geoInput(`ouverture ${g.entity.code}`, g)) : [NO_OPENING],
      [{ op: 'sum', expr: og.length ? og.map((g) => g.value).join(' + ') : '(aucune ouverture)', result: opSum.toString(), unit: 'm2' }], opSum, 'm2');
    const net = Dec.parse(grossQ.value).sub(Dec.parse(opQ.value));
    emit('space.wall.area.net', 'geom.space.wall.area.net', ent, [geoInput('surface murale brute', grossQ), geoInput('ouvertures', opQ)],
      [{ op: 'sub', expr: `${grossQ.value} − ${opQ.value}`, result: net.toString(), unit: 'm2' }], net, 'm2');
  }

  quantities.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const k of Object.keys(relations.wallOpenings)) relations.wallOpenings[k]!.sort();
  const core = {
    modelRev: hashOf(model), assumptionSetRev: hashOf(assumptions), planRevision: hashOf(model.planRevision),
    quantities, relations, blocked,
  };
  return { ...core, contentHash: hashOf(core) };
}

export type { Attr };
