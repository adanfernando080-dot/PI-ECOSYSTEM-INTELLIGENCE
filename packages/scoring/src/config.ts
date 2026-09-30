/**
 * Scoring V1 configuration.
 *
 * Every weight and constant lives here so the methodology is auditable in one
 * place and documented in docs/scoring/README.md. Changing any value MUST bump
 * SCORING_VERSION: persisted scores record the version that produced them.
 */

export const SCORING_VERSION = 'scoring-v1.0.0';

/** Pi Ecosystem Score weights. Staking is deliberately absent. */
export const OVERALL_WEIGHTS = {
  activity: 0.25,
  growth: 0.2,
  economic: 0.2,
  community: 0.15,
  transparency: 0.1,
  confidence: 0.1,
} as const;

/** Below this share of available weight, the overall score is not produced. */
export const OVERALL_MIN_COVERAGE = 0.5;

export const ACTIVITY_WEIGHTS = {
  transactionActivity: 0.4,
  frequency: 0.25,
  activeAddresses: 0.2,
  recency: 0.15,
} as const;

export const ACTIVITY_CONFIG = {
  /** Minimum share of component weight that must be available to emit a score. */
  minCoverage: 0.4,
  /** Recency halves every `recencyHalfLifeDays` days without observed activity. */
  recencyHalfLifeDays: 7,
} as const;

export const GROWTH_WEIGHTS = {
  relative: 0.35,
  absolute: 0.3,
  baseSize: 0.15,
  persistence: 0.2,
} as const;

export const GROWTH_CONFIG = {
  minCoverage: 0.5,
  /** Denominator floor for relative growth: avoids 1 → 10 being "+900%". */
  relativeBaseFloor: 50,
  /**
   * Size damping: relative growth is multiplied by
   * (minFactor + (1 - minFactor) × base / (base + dampingK)).
   * A small base keeps only ~minFactor of its relative growth.
   */
  dampingK: 200,
  dampingMinFactor: 0.25,
  /** Minimum number of consecutive sub-period comparisons for persistence. */
  minPersistencePairs: 2,
} as const;

export const ECONOMIC_WEIGHTS = {
  transactions: 0.25,
  volume: 0.35,
  activeDays: 0.15,
  distinctAddresses: 0.15,
  trend: 0.1,
} as const;

export const ECONOMIC_CONFIG = {
  minCoverage: 0.4,
  /** Distinct addresses are only used when attribution confidence reaches this. */
  minAttributionConfidence: 0.7,
} as const;

export const COMMUNITY_CONFIG = {
  /** k — number of "virtual" reviews at the reference mean (Bayesian prior strength). */
  k: 10,
  /** C fallback when the ecosystem has no published review yet. */
  defaultGlobalMean: 3.5,
  minRating: 1,
  maxRating: 5,
} as const;

/** Transparency checklist weights (sum = 100). */
export const TRANSPARENCY_WEIGHTS = {
  description: 15,
  category: 10,
  developerIdentified: 15,
  developerVerified: 10,
  url: 10,
  publicInformation: 5,
  methodology: 10,
  developerReportedData: 10,
  provenanceDeclared: 15,
} as const;

export const TRANSPARENCY_CONFIG = {
  /** A description shorter than this does not count as informative. */
  minDescriptionLength: 40,
} as const;
