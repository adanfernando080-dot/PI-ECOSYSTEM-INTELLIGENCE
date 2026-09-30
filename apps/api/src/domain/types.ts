import type {
  AnomalySeverity,
  AnomalyStatus,
  AnomalyType,
  AppStatus,
  ClaimStatus,
  ConfidenceLevel,
  DeveloperVerificationStatus,
  MetricType,
  Period,
  Provenance,
  RankingType,
  ReviewStatus,
} from '@pi/shared';

/** Domain records handled by services. Repositories map Prisma rows to these. */

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface DeveloperRecord {
  id: string;
  piUsername: string;
  displayName: string | null;
  verificationStatus: DeveloperVerificationStatus;
}

export interface AppRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  url: string | null;
  logoUrl: string | null;
  status: AppStatus;
  tags: string[];
  methodologyNote: string | null;
  isDemo: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  developerId: string | null;
  category: CategoryRecord | null;
  developer: DeveloperRecord | null;
}

export interface MetricRecord {
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
  createdAt: Date;
}

export interface RankingRow {
  appId: string;
  rank: number;
  score: number;
  confidence: number;
  isDemo: boolean;
}

export interface RankingBatch {
  type: RankingType;
  period: Period;
  computedAt: Date;
  rows: RankingRow[];
}

export interface ReviewRecord {
  id: string;
  appId: string;
  userId: string;
  authorName: string | null;
  rating: number;
  review: string;
  status: ReviewStatus;
  moderationNote: string | null;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimRecord {
  id: string;
  appId: string;
  developerId: string;
  status: ClaimStatus;
  evidence: string | null;
  createdAt: Date;
}

export interface AnomalyRecord {
  id: string;
  appId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  score: number;
  description: string;
  detectedAt: Date;
  status: AnomalyStatus;
  metadata: Record<string, unknown>;
  isDemo: boolean;
}

export interface DeclaredMetric {
  metricType: MetricType;
  value: number | null;
  periodStart: Date;
  periodEnd: Date;
  provenance: Provenance;
  note?: string;
}
