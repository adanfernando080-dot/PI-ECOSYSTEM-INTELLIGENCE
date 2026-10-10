/**
 * MarketBinding : SEUL point où un projet rencontre un marché (ADR-0001, ADR-0004).
 * Révision IMMUABLE : toute modification crée une nouvelle révision (hash de contenu).
 */
import { hashOf } from '../trace/canonical.js';
import type { ResolvedPack } from './types.js';

export type PriceStatistic = 'median' | 'mean' | 'min' | 'max';

export interface MarketBinding {
  id: string; revision: number; parentRev: string | null;
  packId: string; packVersion: string; packResolvedHash: string; dataClass: string;
  zoneId: string; priceBookId: string; priceBookHash: string;
  params: Record<string, string>; priceStatistic: PriceStatistic;
  /** date d'évaluation des prix (fournie par l'appelant : le noyau n'a pas d'horloge) */
  asOf: string;
  rev: string;
}

export interface BindingRequest {
  zoneId: string; asOf: string; priceBookId?: string; priceStatistic?: PriceStatistic;
  paramOverrides?: Record<string, string>; parent?: MarketBinding;
}

export function createBinding(pack: ResolvedPack, req: BindingRequest): MarketBinding {
  if (!pack.zoneTree.some((z) => z.id === req.zoneId)) throw new Error(`Zone « ${req.zoneId} » absente du pack ${pack.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.asOf)) throw new Error('asOf : date AAAA-MM-JJ attendue');
  const book = req.priceBookId ? pack.priceBooks.find((b) => b.id === req.priceBookId) : pack.priceBooks[0];
  if (!book) throw new Error(`Aucun PriceBook ${req.priceBookId ?? ''} dans ${pack.id}`);
  for (const k of Object.keys(req.paramOverrides ?? {})) if (!(k in pack.params)) throw new Error(`Paramètre inconnu « ${k} » (absent du pack ${pack.id})`);
  const core = {
    id: `mb:${pack.id}:${req.zoneId}`, revision: (req.parent?.revision ?? 0) + 1, parentRev: req.parent?.rev ?? null,
    packId: pack.id, packVersion: pack.version, packResolvedHash: pack.resolution.resolvedHash, dataClass: pack.dataClass,
    zoneId: req.zoneId, priceBookId: book.id, priceBookHash: hashOf(book),
    params: { ...pack.params, ...(req.paramOverrides ?? {}) }, priceStatistic: req.priceStatistic ?? 'median', asOf: req.asOf,
  };
  return { ...core, rev: hashOf(core) };
}
