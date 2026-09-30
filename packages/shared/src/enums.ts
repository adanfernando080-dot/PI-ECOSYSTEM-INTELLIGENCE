/**
 * Domain vocabulary shared by every layer.
 *
 * These string unions MUST stay aligned with the Prisma enums declared in
 * packages/database/prisma/schema.prisma. They are duplicated on purpose so
 * that pure business packages (scoring, ranking, validation…) never depend on
 * the persistence layer.
 */

/** Where a data point comes from. A missing value is UNAVAILABLE, never 0. */
export const PROVENANCES = ['OBSERVABLE', 'DEVELOPER_REPORTED', 'ESTIMATED', 'UNAVAILABLE'] as const;
export type Provenance = (typeof PROVENANCES)[number];

export const DATA_SOURCE_TYPES = ['BLOCKCHAIN', 'PI_API', 'DEVELOPER', 'COMMUNITY', 'SYSTEM'] as const;
export type DataSourceType = (typeof DATA_SOURCE_TYPES)[number];

/**
 * Raw metric types.
 * STAKED_PI is collected and exposed as a distinct metric but is deliberately
 * NOT used by any V1 score (see docs/scoring/README.md).
 */
export const METRIC_TYPES = [
  'TRANSACTION_COUNT',
  'TRANSACTION_VOLUME_PI',
  'ACTIVE_ADDRESSES',
  'ACTIVE_USERS',
  'STAKED_PI',
] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export const APP_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const DEVELOPER_VERIFICATION_STATUSES = ['UNVERIFIED', 'PENDING', 'VERIFIED'] as const;
export type DeveloperVerificationStatus = (typeof DEVELOPER_VERIFICATION_STATUSES)[number];

export const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const ANOMALY_STATUSES = ['NEW', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUSES)[number];

/** Neutral vocabulary only: an anomaly is a statistical signal, never a verdict. */
export const ANOMALY_TYPES = [
  'ACTIVITY_SPIKE',
  'VOLUME_SPIKE',
  'CONCENTRATION_SIGNAL',
  'REPEATED_TRANSACTION_PATTERN',
  'UNUSUAL_REVIEW_ACTIVITY',
] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export const ANOMALY_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

export const TRANSACTION_STATUSES = ['CONFIRMED', 'PENDING', 'FAILED'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const ROLES = ['USER', 'DEVELOPER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Analytical ranking types. There is intentionally no "overall"/"best" ranking. */
export const RANKING_TYPES = [
  'activity',
  'growth',
  'economic',
  'community',
  'transparency',
  'trending',
  'rising',
  'new',
] as const;
export type RankingType = (typeof RANKING_TYPES)[number];

export const CONFIDENCE_LEVELS = ['HIGH', 'GOOD', 'PARTIAL', 'LIMITED', 'VERY_LOW'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const DISCOVERY_INTENTS = ['buy', 'work', 'spend', 'sell', 'services', 'ai', 'games', 'learn'] as const;
export type DiscoveryIntent = (typeof DISCOVERY_INTENTS)[number];
