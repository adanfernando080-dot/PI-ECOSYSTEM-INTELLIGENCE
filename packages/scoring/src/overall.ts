import { combineAvailable, type ScoreResult } from './combine';
import { OVERALL_MIN_COVERAGE, OVERALL_WEIGHTS } from './config';

export type OverallComponent = keyof typeof OVERALL_WEIGHTS;

/**
 * Inputs of the Pi Ecosystem Score.
 *
 * The type intentionally has no staking field: staking is a distinct metric
 * that must not influence the V1 score. Adding one is a methodology change
 * that requires a new SCORING_VERSION and an ADR.
 */
export interface OverallInput {
  activity: number | null;
  growth: number | null;
  economic: number | null;
  community: number | null;
  transparency: number | null;
  confidence: number;
}

/**
 * Pi Ecosystem Score (0..100) — an analytical composite indicator.
 *   25% Activity · 20% Growth · 20% Observable Economic Activity
 *   15% Community · 10% Transparency · 10% Data Confidence
 *
 * It is a descriptive index, not a verdict. It is stored for history but the
 * platform exposes no "overall" / "best" ranking built on it.
 */
export function computePiEcosystemScore(input: OverallInput): ScoreResult<OverallComponent> {
  return combineAvailable<OverallComponent>(
    {
      activity: { weight: OVERALL_WEIGHTS.activity, value: input.activity },
      growth: { weight: OVERALL_WEIGHTS.growth, value: input.growth },
      economic: { weight: OVERALL_WEIGHTS.economic, value: input.economic },
      community: { weight: OVERALL_WEIGHTS.community, value: input.community },
      transparency: { weight: OVERALL_WEIGHTS.transparency, value: input.transparency },
      confidence: { weight: OVERALL_WEIGHTS.confidence, value: input.confidence },
    },
    OVERALL_MIN_COVERAGE,
  );
}
