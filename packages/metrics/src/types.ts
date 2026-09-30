import type { ConfidenceLevel, Period, ReviewStatus } from '@pi/shared';
import type { RawPoint } from '@pi/validation';

/**
 * Persistence-agnostic records consumed by the metrics engine. The Prisma
 * layer (./persistence) maps database rows to these shapes, which keeps the
 * computation itself pure and unit-testable.
 */

export interface AppProfile {
  id: string;
  name: string;
  isDemo: boolean;
  description: string | null;
  categoryId: string | null;
  url: string | null;
  logoUrl: string | null;
  tags: string[];
  methodologyNote: string | null;
  developer: { verified: boolean } | null;
  firstSeenAt: Date;
}

export interface MetricPointRecord extends RawPoint {
  appId: string;
}

export interface ReviewRecord {
  appId: string;
  rating: number;
  status: ReviewStatus;
  createdAt: Date;
}

export interface TransactionRecord {
  appId: string | null;
  sender: string;
  receiver: string;
  amount: number;
  timestamp: Date;
  attributionConfidence: number;
}

/** One row of the append-only app_metrics history. */
export interface AppMetricRow {
  appId: string;
  period: Period;
  periodStart: Date;
  periodEnd: Date;
  activityScore: number | null;
  growthScore: number | null;
  economicScore: number | null;
  communityScore: number | null;
  transparencyScore: number | null;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  overallScore: number | null;
  stakedPi: number | null;
  details: Record<string, unknown>;
  scoringVersion: string;
  isDemo: boolean;
}
