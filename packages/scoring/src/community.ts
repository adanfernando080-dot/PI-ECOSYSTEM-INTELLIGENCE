import { clamp, round } from '@pi/shared';
import { COMMUNITY_CONFIG } from './config';

export interface CommunityInput {
  /** n — number of PUBLISHED reviews for the app. */
  reviewCount: number;
  /** R — mean rating of those reviews (null when n = 0). */
  averageRating: number | null;
  /** C — reference mean across the ecosystem's published reviews. */
  globalMean: number | null;
  /** k — prior strength; defaults to COMMUNITY_CONFIG.k. */
  k?: number;
}

export interface CommunityResult {
  /** 0..100, or null when the app has no published review. */
  score: number | null;
  adjustedRating: number | null;
  parameters: { n: number; R: number | null; C: number; k: number };
  coverage: number;
  notes: string[];
}

/**
 * Bayesian average:
 *   AdjustedRating = (n / (n + k)) × R + (k / (n + k)) × C
 * then mapped from [1..5] to [0..100].
 *
 * With n = 0 there is no community data: the score is null (UNAVAILABLE),
 * not the prior C and not 0.
 */
export function computeCommunityScore(input: CommunityInput): CommunityResult {
  const k = input.k ?? COMMUNITY_CONFIG.k;
  const C = input.globalMean ?? COMMUNITY_CONFIG.defaultGlobalMean;
  const n = Math.max(0, Math.floor(input.reviewCount));
  const R = input.averageRating;

  if (n === 0 || R === null) {
    return {
      score: null,
      adjustedRating: null,
      parameters: { n: 0, R: null, C: round(C, 4), k },
      coverage: 0,
      notes: ['No published review: community score unavailable.'],
    };
  }

  const adjusted = bayesianAverage(n, clamp(R, COMMUNITY_CONFIG.minRating, COMMUNITY_CONFIG.maxRating), k, C);
  const span = COMMUNITY_CONFIG.maxRating - COMMUNITY_CONFIG.minRating;
  const score = ((adjusted - COMMUNITY_CONFIG.minRating) / span) * 100;

  return {
    score: round(clamp(score, 0, 100)),
    adjustedRating: round(adjusted, 4),
    parameters: { n, R: round(R, 4), C: round(C, 4), k },
    // Share of the estimate that comes from the app's own reviews.
    coverage: round(n / (n + k), 4),
    notes: [],
  };
}

export function bayesianAverage(n: number, R: number, k: number, C: number): number {
  if (n + k === 0) return C;
  return (n / (n + k)) * R + (k / (n + k)) * C;
}
