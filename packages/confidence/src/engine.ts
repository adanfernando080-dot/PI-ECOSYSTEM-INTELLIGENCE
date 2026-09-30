import { clamp, round, type ConfidenceLevel, type Provenance } from '@pi/shared';
import {
  CONFIDENCE_LEVEL_THRESHOLDS,
  CONFIDENCE_WEIGHTS,
  FRESHNESS_CONFIG,
  NEUTRAL_CONSISTENCY,
  PROVENANCE_QUALITY,
  SOURCE_COUNT_SCORES,
} from './config';

export interface ConfidenceInput {
  /** Number of data points used, by provenance. */
  provenanceCounts: Partial<Record<Provenance, number>>;
  /** Days since the most recent data point. null = no data at all. */
  daysSinceLastUpdate: number | null;
  /** Inputs the scoring engines expect, and how many were actually available (0..1 each). */
  completeness: number;
  /**
   * Agreement (0..1) between sources reporting the same metric/day.
   * null when no overlapping data exists (single source).
   */
  consistency: number | null;
  /** Number of distinct sources whose data agrees (or the only source). */
  concordantSources: number;
}

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  components: {
    provenance: number;
    freshness: number;
    completeness: number;
    consistency: number;
    sources: number;
  };
  notes: string[];
}

/**
 * Data Confidence engine (0..100).
 *
 * Independent from the scoring engines: it only describes how much the data
 * behind a score can be trusted.
 *   30% provenance · 20% freshness · 25% completeness
 *   15% consistency · 10% number of concordant sources
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const notes: string[] = [];

  const provenance = provenanceQuality(input.provenanceCounts);
  const freshness = freshnessScore(input.daysSinceLastUpdate);
  const completeness = clamp(input.completeness, 0, 1) * 100;

  let consistency: number;
  if (input.consistency === null) {
    consistency = NEUTRAL_CONSISTENCY;
    notes.push('Consistency not assessable (no overlapping sources): neutral value used.');
  } else {
    consistency = clamp(input.consistency, 0, 1) * 100;
  }

  const sources = sourceCountScore(input.concordantSources);

  if (input.daysSinceLastUpdate === null) notes.push('No data point available.');

  const score = round(
    CONFIDENCE_WEIGHTS.provenance * provenance +
      CONFIDENCE_WEIGHTS.freshness * freshness +
      CONFIDENCE_WEIGHTS.completeness * completeness +
      CONFIDENCE_WEIGHTS.consistency * consistency +
      CONFIDENCE_WEIGHTS.sources * sources,
  );

  return {
    score,
    level: confidenceLevel(score),
    components: {
      provenance: round(provenance),
      freshness: round(freshness),
      completeness: round(completeness),
      consistency: round(consistency),
      sources: round(sources),
    },
    notes,
  };
}

/** Weighted mean quality of the data points' provenances (0 when none). */
export function provenanceQuality(counts: Partial<Record<Provenance, number>>): number {
  let total = 0;
  let weighted = 0;
  for (const [p, n] of Object.entries(counts) as [Provenance, number][]) {
    if (!n || n <= 0) continue;
    total += n;
    weighted += n * PROVENANCE_QUALITY[p];
  }
  return total === 0 ? 0 : weighted / total;
}

export function freshnessScore(daysSinceLastUpdate: number | null): number {
  if (daysSinceLastUpdate === null) return 0;
  const late = Math.max(0, daysSinceLastUpdate - FRESHNESS_CONFIG.graceDays);
  return 100 * 0.5 ** (late / FRESHNESS_CONFIG.halfLifeDays);
}

export function sourceCountScore(count: number): number {
  if (count <= 0) return 0;
  const idx = Math.min(Math.floor(count), SOURCE_COUNT_SCORES.length - 1);
  return SOURCE_COUNT_SCORES[idx]!;
}

export function confidenceLevel(score: number): ConfidenceLevel {
  for (const { min, level } of CONFIDENCE_LEVEL_THRESHOLDS) {
    if (score >= min) return level;
  }
  return 'VERY_LOW';
}

/**
 * Agreement between two values reported for the same metric and period:
 * 1 when identical, decreasing with the relative difference, 0 at ≥100% apart.
 */
export function pairAgreement(a: number, b: number): number {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return 1;
  return clamp(1 - Math.abs(a - b) / scale, 0, 1);
}

/** Mean agreement over overlapping pairs; null when there is no overlap. */
export function consistencyFromPairs(pairs: readonly (readonly [number, number])[]): number | null {
  if (pairs.length === 0) return null;
  const total = pairs.reduce((acc, [a, b]) => acc + pairAgreement(a, b), 0);
  return round(total / pairs.length, 4);
}
