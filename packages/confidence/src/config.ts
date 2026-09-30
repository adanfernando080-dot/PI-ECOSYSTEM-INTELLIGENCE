import type { ConfidenceLevel, Provenance } from '@pi/shared';

export const CONFIDENCE_VERSION = 'confidence-v1.0.0';

/** Weights of the Data Confidence components (sum = 1). */
export const CONFIDENCE_WEIGHTS = {
  provenance: 0.3,
  freshness: 0.2,
  completeness: 0.25,
  consistency: 0.15,
  sources: 0.1,
} as const;

/** Default quality attributed to each provenance (0..100). */
export const PROVENANCE_QUALITY: Record<Provenance, number> = {
  OBSERVABLE: 100,
  DEVELOPER_REPORTED: 60,
  ESTIMATED: 40,
  UNAVAILABLE: 0,
};

export const FRESHNESS_CONFIG = {
  /** Data updated within this many days is considered fully fresh. */
  graceDays: 1,
  /** After the grace period, freshness halves every `halfLifeDays`. */
  halfLifeDays: 7,
} as const;

/**
 * Consistency cannot be assessed with a single source. A neutral value is
 * used (neither rewarded nor punished) — see docs/scoring/README.md.
 */
export const NEUTRAL_CONSISTENCY = 50;

/** Score attributed to the number of concordant sources. */
export const SOURCE_COUNT_SCORES: readonly number[] = [0, 40, 75, 100];

/** Level thresholds (inclusive lower bounds). */
export const CONFIDENCE_LEVEL_THRESHOLDS: readonly { min: number; level: ConfidenceLevel }[] = [
  { min: 90, level: 'HIGH' },
  { min: 75, level: 'GOOD' },
  { min: 50, level: 'PARTIAL' },
  { min: 25, level: 'LIMITED' },
  { min: 0, level: 'VERY_LOW' },
];
