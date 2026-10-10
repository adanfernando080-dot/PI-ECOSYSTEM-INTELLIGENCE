import { hashOf } from '../trace/canonical.js';
import type { CollectionName, PackData, ResolvedPack } from './types.js';

/** Collections fusionnées par clé (override / add / remove) ; les autres champs sont remplacés ou fusionnés (objets). */
const KEYED: Record<Exclude<CollectionName, 'priceBooks'> | 'priceBooks', string> = {
  catalogue: 'code', specMappings: 'id', assemblies: 'code', zoneTree: 'id', units: 'code', workBreakdown: 'code',
  documentTemplates: 'id', legalIdentifiers: 'key', numberingRules: 'kind', defaultSpecProfiles: 'id', priceBooks: 'id',
};
const MERGED_OBJECTS = ['params', 'rounding'] as const;
const REPLACED = ['currency', 'measurementMethod', 'costBuildUp'] as const;

/** Contenu signé d'un pack = tout sauf `contentHash` et `signature`. */
export function packContentHash(p: PackData): string {
  const { contentHash: _h, signature: _s, ...rest } = p;
  return hashOf(rest);
}

/**
 * Résolution à PARENT UNIQUE (ADR-0004). Le pack résolu est aplati ; son hash canonique est enregistré dans le MarketBinding.
 * `catalog` : packs disponibles par « id@version ».
 */
export function resolvePack(root: PackData, catalog: Map<string, PackData>): ResolvedPack {
  const chain: PackData[] = [];
  const seen = new Set<string>();
  for (let cur: PackData | undefined = root; cur;) {
    const key = `${cur.id}@${cur.version}`;
    if (seen.has(key)) throw new Error(`Héritage cyclique : ${key}`);
    seen.add(key); chain.unshift(cur);
    if (!cur.extends) break;
    const parent = catalog.get(`${cur.extends.id}@${cur.extends.version}`);
    if (!parent) throw new Error(`Pack parent introuvable : ${cur.extends.id}@${cur.extends.version}`);
    if (packContentHash(parent) !== cur.extends.contentHash) throw new Error(`Empreinte du parent ${cur.extends.id} différente de celle déclarée par ${cur.id} (parent modifié ?)`);
    cur = parent;
  }

  const out: Record<string, any> = {};
  for (const layer of chain) {
    for (const [col, keyField] of Object.entries(KEYED)) {
      const items = (layer as any)[col] as any[] | undefined;
      const removed = layer.remove?.[col as CollectionName] ?? [];
      let cur: any[] = (out[col] as any[] | undefined) ?? [];
      if (removed.length) {
        for (const k of removed) if (!cur.some((e) => e[keyField] === k)) throw new Error(`${layer.id} : « remove » vise une clé absente ${col}/${k}`);
        cur = cur.filter((e) => !removed.includes(e[keyField]));
      }
      if (items) {
        for (const it of items) {
          if (removed.includes(it[keyField])) throw new Error(`${layer.id} : clé retirée puis réintroduite ${col}/${it[keyField]}`);
          const idx = cur.findIndex((e) => e[keyField] === it[keyField]);
          if (idx >= 0) cur[idx] = it; else cur.push(it);
        }
      }
      out[col] = cur;
    }
    for (const f of MERGED_OBJECTS) if ((layer as any)[f]) out[f] = { ...(out[f] ?? {}), ...(layer as any)[f] };
    for (const f of REPLACED) if ((layer as any)[f]) out[f] = (layer as any)[f];
  }
  const leaf = chain[chain.length - 1]!;
  const resolvedBase = {
    packSchemaVersion: leaf.packSchemaVersion, id: leaf.id, version: leaf.version,
    dataClass: chain.some((c) => c.dataClass === 'synthetic/test') ? 'synthetic/test' : 'commercial',
    description: leaf.description, requires: leaf.requires, ...out,
  };
  const chainRefs = chain.map((c) => ({ id: c.id, version: c.version, contentHash: packContentHash(c) }));
  const resolvedHash = hashOf({ ...resolvedBase, chain: chainRefs });
  return { ...(resolvedBase as any), resolution: { chain: chainRefs, resolvedHash } } as ResolvedPack;
}
