import { clamp, logNormalize } from '@pi/shared';
import { combineAvailable, type ScoreResult } from './combine';
import { ACTIVITY_CONFIG, ACTIVITY_WEIGHTS } from './config';
import type { NormalizationContext } from './context';

export type ActivityComponent = keyof typeof ACTIVITY_WEIGHTS;

export interface ActivityInput {
  /** Attributable transactions in the window. null = unavailable. */
  transactionCount: number | null;
  /** Days with at least one attributable transaction. null = unavailable. */
  activeDays: number | null;
  windowDays: number;
  /**
   * Active users / distinct addresses — ONLY when available and attributable.
   * The caller must pass null when attribution is not reliable enough.
   */
  activeAddresses: number | null;
  /** Days since the last observed activity. null = never observed / unknown. */
  daysSinceLastActivity: number | null;
}

/**
 * Activity Score (0..100)
 *   40% transaction activity (log-normalized vs ecosystem reference)
 *   25% frequency            (active days / window days)
 *   20% active addresses     (log-normalized, only when attributable)
 *   15% recency              (halves every 7 days without activity)
 * Unavailable components are excluded and weights renormalized.
 */
export function computeActivityScore(
  input: ActivityInput,
  ctx: NormalizationContext,
): ScoreResult<ActivityComponent> {
  const frequency =
    input.activeDays === null || input.windowDays <= 0
      ? null
      : (clamp(input.activeDays, 0, input.windowDays) / input.windowDays) * 100;

  const recency =
    input.daysSinceLastActivity === null
      ? null
      : 100 * 0.5 ** (Math.max(0, input.daysSinceLastActivity) / ACTIVITY_CONFIG.recencyHalfLifeDays);

  return combineAvailable<ActivityComponent>(
    {
      transactionActivity: {
        weight: ACTIVITY_WEIGHTS.transactionActivity,
        value: input.transactionCount === null ? null : logNormalize(input.transactionCount, ctx.transactionCountRef),
      },
      frequency: { weight: ACTIVITY_WEIGHTS.frequency, value: frequency },
      activeAddresses: {
        weight: ACTIVITY_WEIGHTS.activeAddresses,
        value: input.activeAddresses === null ? null : logNormalize(input.activeAddresses, ctx.activeAddressesRef),
      },
      recency: { weight: ACTIVITY_WEIGHTS.recency, value: recency },
    },
    ACTIVITY_CONFIG.minCoverage,
  );
}
