import { computeConfidence, CONFIDENCE_VERSION } from '@pi/confidence';
import {
  computeActivityScore,
  computeCommunityScore,
  computeGrowthScore,
  computeObservableEconomicActivity,
  computePiEcosystemScore,
  computeTransparencyScore,
  SCORING_VERSION,
  type NormalizationContext,
} from '@pi/scoring';
import { addDays, mean, round, startOfUtcDay, type Period, type Provenance } from '@pi/shared';
import { buildNormalizationContext, extractMeasures, type AppMeasures } from './measures';
import type { AppMetricRow, AppProfile, MetricPointRecord, ReviewRecord } from './types';

export interface SnapshotInput {
  apps: readonly AppProfile[];
  /** Raw points grouped by app id (at least current + previous window). */
  pointsByApp: ReadonlyMap<string, readonly MetricPointRecord[]>;
  reviews: readonly ReviewRecord[];
  asOf: Date;
  period: Period;
}

/**
 * METRICS → SCORING for every app at one date and period.
 * Pure function: returns the rows to append to app_metrics.
 */
export function computeSnapshot(input: SnapshotInput): AppMetricRow[] {
  const measures = input.apps.map((app) => ({
    app,
    m: extractMeasures(input.pointsByApp.get(app.id) ?? [], input.asOf, input.period, app.firstSeenAt),
  }));
  const ctx = buildNormalizationContext(measures.map((x) => x.m));
  const reviewStats = summarizeReviews(input.reviews, input.asOf);

  return measures.map(({ app, m }) => scoreApp(app, m, ctx, reviewStats, input.period));
}

interface ReviewStats {
  byApp: Map<string, { n: number; mean: number }>;
  globalMean: number | null;
}

/** Published reviews known at the end of `asOf`'s UTC day. */
export function summarizeReviews(reviews: readonly ReviewRecord[], asOf: Date): ReviewStats {
  const cutoff = addDays(startOfUtcDay(asOf), 1);
  const byApp = new Map<string, number[]>();
  const all: number[] = [];
  for (const r of reviews) {
    if (r.status !== 'PUBLISHED' || r.createdAt >= cutoff) continue;
    all.push(r.rating);
    const list = byApp.get(r.appId);
    if (list) list.push(r.rating);
    else byApp.set(r.appId, [r.rating]);
  }
  const stats = new Map<string, { n: number; mean: number }>();
  for (const [appId, ratings] of byApp) stats.set(appId, { n: ratings.length, mean: mean(ratings)! });
  return { byApp: stats, globalMean: mean(all) };
}

function scoreApp(
  app: AppProfile,
  m: AppMeasures,
  ctx: NormalizationContext,
  reviews: ReviewStats,
  period: Period,
): AppMetricRow {
  const activity = computeActivityScore(
    {
      transactionCount: m.transactionCount,
      activeDays: m.activeDays,
      windowDays: m.window.days,
      activeAddresses: m.activeAddresses,
      daysSinceLastActivity: m.daysSinceLastActivity,
    },
    ctx,
  );

  const growth = computeGrowthScore(
    { current: m.transactionCount, previous: m.previousTransactionCount, subPeriods: m.subPeriods },
    ctx,
  );

  const economic = computeObservableEconomicActivity(
    {
      transactionCount: m.transactionCount,
      volumePi: m.volumePi,
      previousVolumePi: m.previousVolumePi,
      activeDays: m.activeDays,
      windowDays: m.window.days,
      distinctAddresses: m.activeAddresses,
      addressAttributionConfidence: m.addressAttributionConfidence,
    },
    ctx,
  );

  const reviewStat = reviews.byApp.get(app.id);
  const community = computeCommunityScore({
    reviewCount: reviewStat?.n ?? 0,
    averageRating: reviewStat?.mean ?? null,
    globalMean: reviews.globalMean,
  });

  const transparency = computeTransparencyScore({
    description: app.description,
    hasCategory: app.categoryId !== null,
    hasDeveloper: app.developer !== null,
    developerVerified: app.developer?.verified ?? false,
    url: app.url,
    hasPublicInformation: Boolean(app.logoUrl) || app.tags.length > 0,
    methodologyNote: app.methodologyNote,
    hasDeveloperReportedData: m.hasDeveloperReportedData,
    provenanceKnownShare: m.provenanceKnownShare,
  });

  // Completeness = how much of what the engines need was actually available.
  const completeness = mean([activity.coverage, growth.coverage, economic.coverage, m.dayCoverage]) ?? 0;
  const confidence = computeConfidence({
    provenanceCounts: m.provenanceCounts as Partial<Record<Provenance, number>>,
    daysSinceLastUpdate: m.daysSinceLastUpdate,
    completeness,
    consistency: m.consistency,
    concordantSources: m.concordantSources,
  });

  const overall = computePiEcosystemScore({
    activity: activity.score,
    growth: growth.score,
    economic: economic.score,
    community: community.score,
    transparency: transparency.score,
    confidence: confidence.score,
  });

  return {
    appId: app.id,
    period,
    periodStart: m.window.start,
    periodEnd: m.window.end,
    activityScore: activity.score,
    growthScore: growth.score,
    economicScore: economic.score,
    communityScore: community.score,
    transparencyScore: transparency.score,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    overallScore: overall.score,
    stakedPi: m.stakedPi,
    scoringVersion: `${SCORING_VERSION}+${CONFIDENCE_VERSION}`,
    isDemo: app.isDemo,
    details: {
      measures: {
        transactionCount: m.transactionCount,
        transactionCountExtrapolated: m.transactionCountExtrapolated,
        previousTransactionCount: m.previousTransactionCount,
        activeDays: m.activeDays,
        averageDailyActiveAddresses: m.activeAddresses,
        addressAttributionConfidence: m.addressAttributionConfidence,
        observableVolumePi: m.volumePi,
        observableVolumeExtrapolated: m.volumeExtrapolated,
        previousObservableVolumePi: m.previousVolumePi,
        daysSinceLastActivity: m.daysSinceLastActivity,
        stakedPi: m.stakedPi,
        dayCoverage: m.dayCoverage,
      },
      activity: pick(activity),
      growth: { ...pick(growth), relativeGrowth: growth.relativeGrowth, absoluteGrowth: growth.absoluteGrowth },
      observableEconomicActivity: {
        ...pick(economic),
        label: economic.label,
        volumeTrend: economic.volumeTrend,
      },
      community: {
        adjustedRating: community.adjustedRating,
        parameters: community.parameters,
        coverage: community.coverage,
        notes: community.notes,
      },
      transparency: { satisfied: transparency.satisfied, missing: transparency.missing, items: transparency.items },
      confidence: {
        components: confidence.components,
        notes: confidence.notes,
        inputs: {
          provenanceCounts: m.provenanceCounts,
          completeness: round(completeness, 4),
          consistency: m.consistency,
          concordantSources: m.concordantSources,
          daysSinceLastUpdate: m.daysSinceLastUpdate,
        },
      },
      overall: { coverage: overall.coverage, missing: overall.missing, notes: overall.notes },
      staking: { note: 'Staking is shown as a distinct metric and excluded from every V1 score.' },
      normalizationContext: ctx,
    },
  };
}

function pick(r: { coverage: number; components: unknown; missing: unknown; notes: string[] }) {
  return { coverage: r.coverage, components: r.components, missing: r.missing, notes: r.notes };
}
