import { logNormalize, round } from '@pi/shared';
import { combineAvailable, signedRatioToScore, type ScoreResult } from './combine';
import { GROWTH_CONFIG, GROWTH_WEIGHTS } from './config';
import type { NormalizationContext } from './context';

export type GrowthComponent = keyof typeof GROWTH_WEIGHTS;

export interface GrowthInput {
  /** Activity measure over the current window (e.g. attributable transactions). */
  current: number | null;
  /** Same measure over the previous window of identical length. */
  previous: number | null;
  /**
   * Chronological sub-period values inside the analysis horizon (e.g. weekly
   * counts). Used to measure whether growth persists. Nulls are skipped.
   */
  subPeriods: readonly (number | null)[];
}

export interface GrowthResult extends ScoreResult<GrowthComponent> {
  relativeGrowth: number | null;
  absoluteGrowth: number | null;
}

/**
 * Growth Score (0..100, 50 = stable)
 *   35% relative growth   — damped by base size so a tiny app cannot dominate
 *   30% absolute growth   — log-normalized vs ecosystem reference
 *   15% base size         — how established the app already is
 *   20% persistence       — share of consecutive sub-periods that grew
 */
export function computeGrowthScore(input: GrowthInput, ctx: NormalizationContext): GrowthResult {
  const { current, previous } = input;
  const comparable = current !== null && previous !== null;

  let relativeGrowth: number | null = null;
  let relative: number | null = null;
  let absoluteGrowth: number | null = null;
  let absolute: number | null = null;
  let baseSize: number | null = null;

  if (comparable) {
    const base = Math.max(previous, 0);
    relativeGrowth = (current - previous) / Math.max(base, GROWTH_CONFIG.relativeBaseFloor);
    const damping =
      GROWTH_CONFIG.dampingMinFactor +
      (1 - GROWTH_CONFIG.dampingMinFactor) * (base / (base + GROWTH_CONFIG.dampingK));
    relative = signedRatioToScore(relativeGrowth * damping);

    absoluteGrowth = current - previous;
    const magnitude = logNormalize(Math.abs(absoluteGrowth), ctx.absoluteGrowthRef) / 100;
    absolute = 50 + (absoluteGrowth >= 0 ? 50 : -50) * magnitude;

    baseSize = logNormalize(base, ctx.baseSizeRef);
  }

  const result = combineAvailable<GrowthComponent>(
    {
      relative: { weight: GROWTH_WEIGHTS.relative, value: relative },
      absolute: { weight: GROWTH_WEIGHTS.absolute, value: absolute },
      baseSize: { weight: GROWTH_WEIGHTS.baseSize, value: baseSize },
      persistence: { weight: GROWTH_WEIGHTS.persistence, value: persistenceScore(input.subPeriods) },
    },
    GROWTH_CONFIG.minCoverage,
  );

  return {
    ...result,
    relativeGrowth: relativeGrowth === null ? null : round(relativeGrowth, 4),
    absoluteGrowth: absoluteGrowth === null ? null : round(absoluteGrowth, 4),
  };
}

/** Share (0..100) of consecutive available sub-period pairs showing an increase. */
export function persistenceScore(subPeriods: readonly (number | null)[]): number | null {
  const values = subPeriods.filter((v): v is number => v !== null);
  const pairs = values.length - 1;
  if (pairs < GROWTH_CONFIG.minPersistencePairs) return null;
  let increases = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! > values[i - 1]!) increases++;
  }
  return (increases / pairs) * 100;
}
