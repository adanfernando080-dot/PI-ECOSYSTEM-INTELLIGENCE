import { DEMO_DATA_NOTICE } from '@pi/shared';
import type { AppRecord, MetricRecord, ReviewRecord } from './types';

/**
 * Presenters: domain records → public JSON. The frontend never sees database
 * shapes, internal ids of moderators, raw signals or secrets.
 */

export function presentMetric(m: MetricRecord | null | undefined) {
  if (!m) return null;
  return {
    period: m.period,
    periodStart: m.periodStart.toISOString(),
    periodEnd: m.periodEnd.toISOString(),
    scores: {
      activity: m.activityScore,
      growth: m.growthScore,
      observableEconomicActivity: m.economicScore,
      community: m.communityScore,
      transparency: m.transparencyScore,
    },
    /** Composite analytical indicator — descriptive, not a verdict on the app. */
    piEcosystemScore: m.overallScore,
    confidence: { score: m.confidenceScore, level: m.confidenceLevel },
    /** Distinct metric, excluded from every V1 score. */
    staking: { stakedPi: m.stakedPi, includedInScores: false as const },
    scoringVersion: m.scoringVersion,
    computedAt: m.createdAt.toISOString(),
  };
}

export function presentAppSummary(app: AppRecord, metric: MetricRecord | null | undefined) {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    description: app.description,
    category: app.category ? { slug: app.category.slug, name: app.category.name } : null,
    url: app.url,
    logoUrl: app.logoUrl,
    status: app.status,
    tags: app.tags,
    developer: app.developer
      ? {
          piUsername: app.developer.piUsername,
          displayName: app.developer.displayName,
          verificationStatus: app.developer.verificationStatus,
        }
      : null,
    firstSeenAt: app.firstSeenAt.toISOString(),
    lastSeenAt: app.lastSeenAt?.toISOString() ?? null,
    isDemo: app.isDemo,
    metrics: presentMetric(metric),
  };
}

export function presentAppDetail(
  app: AppRecord,
  metric: MetricRecord | null | undefined,
  reviewSummary: { count: number; average: number | null },
) {
  return {
    ...presentAppSummary(app, metric),
    methodologyNote: app.methodologyNote,
    reviewSummary: {
      publishedCount: reviewSummary.count,
      averageRating: reviewSummary.average === null ? null : Math.round(reviewSummary.average * 100) / 100,
    },
    /** Per-engine breakdown: components, coverage, missing inputs and notes. */
    breakdown: metric ? metric.details : null,
  };
}

export function presentHistoryPoint(m: MetricRecord) {
  return {
    /** Last day covered by the window (periodEnd is exclusive). */
    date: new Date(m.periodEnd.getTime() - 1).toISOString().slice(0, 10),
    activity: m.activityScore,
    growth: m.growthScore,
    observableEconomicActivity: m.economicScore,
    community: m.communityScore,
    transparency: m.transparencyScore,
    piEcosystemScore: m.overallScore,
    confidence: m.confidenceScore,
    confidenceLevel: m.confidenceLevel,
    stakedPi: m.stakedPi,
  };
}

export function presentReview(r: ReviewRecord) {
  return {
    id: r.id,
    appId: r.appId,
    author: r.authorName,
    rating: r.rating,
    review: r.review,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    isDemo: r.isDemo,
  };
}

/** Adds the demo notice to `meta` whenever a response contains demo rows. */
export function demoMeta(containsDemo: boolean): { containsDemoData: boolean; demoNotice?: string } {
  return containsDemo ? { containsDemoData: true, demoNotice: DEMO_DATA_NOTICE } : { containsDemoData: false };
}
