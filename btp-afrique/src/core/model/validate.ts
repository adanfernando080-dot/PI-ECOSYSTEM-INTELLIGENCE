import type { ArchitecturalModel, Level } from './types.js';

export interface Taxonomy { version: string; classes: Array<{ id: string; label: string }> }

/** Schéma fermé (ADR-0001 R2) : toute clé inconnue est une erreur, ce qui interdit pays/devise/prix… */
const ALLOWED: Record<string, string[]> = {
  model: ['schemaVersion', 'id', 'name', 'planRevision', 'buildings'],
  planRevision: ['sourceDocumentHash', 'sheetId', 'page', 'label', 'supersedes'],
  building: ['id', 'name', 'levels'],
  level: ['id', 'code', 'name', 'elevation', 'clearHeight', 'nodes', 'walls', 'openings', 'spaces', 'slabs', 'roofs'],
  node: ['id', 'x', 'y'],
  wall: ['id', 'code', 'startNode', 'endNode', 'thickness', 'height', 'role', 'spec'],
  opening: ['id', 'code', 'hostWallId', 'class', 'width', 'height', 'spec'],
  space: ['id', 'code', 'name', 'usage', 'boundaryWallIds', 'finishes'],
  slab: ['id', 'code', 'outlineNodeIds', 'thickness', 'spec'],
  roof: ['id', 'code', 'outlineNodeIds', 'rise', 'run', 'spec'],
  attr: ['value', 'unit', 'origin', 'assumptionId', 'confidence', 'validation', 'evidence'],
  spec: ['system', 'layers', 'origin', 'assumptionId'],
  finishes: ['floor', 'wall', 'ceiling'],
};

const ORIGINS = ['ai_detected', 'user_entered', 'user_corrected', 'derived', 'assumption'];

export function validateModel(model: ArchitecturalModel, taxonomy: Taxonomy): string[] {
  const errors: string[] = [];
  const classes = new Set(taxonomy.classes.map((c) => c.id));
  const keys = (obj: unknown, kind: string, path: string): void => {
    if (obj === null || typeof obj !== 'object') { errors.push(`${path} : objet attendu`); return; }
    const allowed = ALLOWED[kind]!;
    for (const k of Object.keys(obj as object)) if (!allowed.includes(k)) errors.push(`${path} : clé interdite « ${k} » (schéma fermé, aucune donnée de marché dans le modèle)`);
  };
  const attr = (a: unknown, path: string): void => {
    keys(a, 'attr', path);
    const o = a as { origin?: string };
    if (!o || !ORIGINS.includes(o.origin ?? '')) errors.push(`${path} : origine invalide`);
  };
  const cls = (c: string | undefined, path: string): void => {
    if (c !== undefined && !classes.has(c)) errors.push(`${path} : classe « ${c} » absente de la taxonomie neutre ${taxonomy.version}`);
  };
  const spec = (s: any, path: string): void => {
    keys(s, 'spec', path);
    cls(s.system, `${path}.system`);
    for (const [i, l] of (s.layers ?? []).entries()) cls(l.class, `${path}.layers[${i}]`);
  };

  keys(model, 'model', 'model');
  if (model.schemaVersion !== '1') errors.push('model.schemaVersion : « 1 » attendu');
  keys(model.planRevision, 'planRevision', 'model.planRevision');
  const ids = new Set<string>();
  const uniq = (id: string, path: string): void => { if (ids.has(id)) errors.push(`${path} : identifiant dupliqué « ${id} »`); ids.add(id); };

  for (const b of model.buildings) {
    keys(b, 'building', `building ${b.id}`); uniq(b.id, 'building');
    for (const lv of b.levels) validateLevel(lv);
  }

  function validateLevel(lv: Level): void {
    const p = `level ${lv.id}`;
    keys(lv, 'level', p); uniq(lv.id, 'level');
    attr(lv.elevation, `${p}.elevation`); attr(lv.clearHeight, `${p}.clearHeight`);
    const nodes = new Map(lv.nodes.map((n) => [n.id, n]));
    for (const n of lv.nodes) { keys(n, 'node', `node ${n.id}`); uniq(n.id, 'node'); if (!Number.isInteger(n.x) || !Number.isInteger(n.y)) errors.push(`node ${n.id} : coordonnées entières (0,1 mm) attendues`); }
    const walls = new Map(lv.walls.map((w) => [w.id, w]));
    for (const w of lv.walls) {
      keys(w, 'wall', `wall ${w.id}`); uniq(w.id, 'wall');
      if (!nodes.has(w.startNode) || !nodes.has(w.endNode)) errors.push(`wall ${w.id} : nœud inconnu`);
      else if (w.startNode === w.endNode) errors.push(`wall ${w.id} : longueur nulle`);
      attr(w.thickness, `wall ${w.id}.thickness`); attr(w.height, `wall ${w.id}.height`); spec(w.spec, `wall ${w.id}.spec`);
    }
    for (const o of lv.openings) {
      keys(o, 'opening', `opening ${o.id}`); uniq(o.id, 'opening');
      if (!walls.has(o.hostWallId)) errors.push(`opening ${o.id} : mur hôte « ${o.hostWallId} » inconnu`);
      cls(o.class, `opening ${o.id}.class`);
      attr(o.width, `opening ${o.id}.width`); attr(o.height, `opening ${o.id}.height`); spec(o.spec, `opening ${o.id}.spec`);
    }
    for (const s of lv.spaces) {
      keys(s, 'space', `space ${s.id}`); uniq(s.id, 'space'); keys(s.finishes, 'finishes', `space ${s.id}.finishes`);
      for (const w of s.boundaryWallIds) if (!walls.has(w)) errors.push(`space ${s.id} : mur « ${w} » inconnu`);
      for (const k of ['floor', 'wall', 'ceiling'] as const) for (const c of s.finishes[k] ?? []) cls(c, `space ${s.id}.finishes.${k}`);
    }
    for (const sl of lv.slabs) {
      keys(sl, 'slab', `slab ${sl.id}`); uniq(sl.id, 'slab'); attr(sl.thickness, `slab ${sl.id}.thickness`); spec(sl.spec, `slab ${sl.id}.spec`);
      for (const n of sl.outlineNodeIds) if (!nodes.has(n)) errors.push(`slab ${sl.id} : nœud « ${n} » inconnu`);
      if (sl.outlineNodeIds.length < 3) errors.push(`slab ${sl.id} : contour de 3 nœuds minimum`);
    }
    for (const r of lv.roofs) {
      keys(r, 'roof', `roof ${r.id}`); uniq(r.id, 'roof'); attr(r.rise, `roof ${r.id}.rise`); attr(r.run, `roof ${r.id}.run`); spec(r.spec, `roof ${r.id}.spec`);
      for (const n of r.outlineNodeIds) if (!nodes.has(n)) errors.push(`roof ${r.id} : nœud « ${n} » inconnu`);
    }
  }
  return errors;
}

export function assertValidModel(model: ArchitecturalModel, taxonomy: Taxonomy): void {
  const errs = validateModel(model, taxonomy);
  if (errs.length) throw new Error('Modèle architectural invalide :\n - ' + errs.join('\n - '));
}
