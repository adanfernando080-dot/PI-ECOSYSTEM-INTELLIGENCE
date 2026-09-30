import type { NormalizedMetricPoint, NormalizedTransaction } from './types';

/**
 * Helpers that turn normalized provider data into persistence candidates.
 * They live in the integration boundary so that attribution rules are applied
 * once, before data reaches the metrics engine.
 */

/** Below this confidence a transaction is stored without an app link. */
export const MIN_ATTRIBUTION_TO_LINK = 0.5;

export function attributionFor(tx: NormalizedTransaction): { appRef: string | null; confidence: number } {
  const confidence = Math.min(1, Math.max(0, tx.attributionConfidence));
  if (!tx.appRef || confidence < MIN_ATTRIBUTION_TO_LINK) return { appRef: null, confidence };
  return { appRef: tx.appRef, confidence };
}

/** A metric point is consistent when UNAVAILABLE ⇔ value is null. */
export function isConsistentPoint(point: NormalizedMetricPoint): boolean {
  return point.provenance === 'UNAVAILABLE' ? point.value === null : point.value !== null;
}
