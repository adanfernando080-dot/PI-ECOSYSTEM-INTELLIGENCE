import type { Prisma, PrismaClient } from '@prisma/client';
import { addDays, periodToDays, PERIODS, startOfUtcDay, windowEndingAt, type Period, type RankingType } from '@pi/shared';
import { detectAppAnomalies } from './anomalies';
import { decimalToNumber, fromDbPeriod, toDbPeriod, toDbRankingType } from './mappers';
import { computeRankings } from './rankings';
import { computeSnapshot } from './snapshot';
import type { AppMetricRow, AppProfile, MetricPointRecord, ReviewRecord, TransactionRecord } from './types';

/**
 * Persistence side of the metrics engine: loads data with Prisma, runs the
 * pure engines and APPENDS results. Nothing here updates historical rows.
 */

export interface EngineData {
  apps: AppProfile[];
  pointsByApp: Map<string, MetricPointRecord[]>;
  reviews: ReviewRecord[];
  transactions: TransactionRecord[];
}

/** Apps whose metrics are computed (rejected apps are ignored). */
const SCORED_APP_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING'] as const;

export async function loadApps(prisma: PrismaClient): Promise<AppProfile[]> {
  const apps = await prisma.app.findMany({
    where: { status: { in: [...SCORED_APP_STATUSES] } },
    include: { developer: { select: { verificationStatus: true } } },
  });
  return apps.map((a) => ({
    id: a.id,
    name: a.name,
    isDemo: a.isDemo,
    description: a.description,
    categoryId: a.categoryId,
    url: a.url,
    logoUrl: a.logoUrl,
    tags: a.tags,
    methodologyNote: a.methodologyNote,
    developer: a.developer ? { verified: a.developer.verificationStatus === 'VERIFIED' } : null,
    firstSeenAt: a.firstSeenAt,
  }));
}

export async function loadEngineData(prisma: PrismaClient, from: Date, to: Date): Promise<EngineData> {
  const [apps, raw, reviews, transactions] = await Promise.all([
    loadApps(prisma),
    prisma.rawMetric.findMany({
      where: { periodStart: { gte: from, lt: to } },
      include: { source: { select: { trustLevel: true } } },
    }),
    prisma.review.findMany({ select: { appId: true, rating: true, status: true, createdAt: true } }),
    prisma.transaction.findMany({
      where: { timestamp: { gte: from, lt: to }, appId: { not: null } },
      select: { appId: true, sender: true, receiver: true, amount: true, timestamp: true, attributionConfidence: true },
    }),
  ]);

  const pointsByApp = new Map<string, MetricPointRecord[]>();
  for (const r of raw) {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const point: MetricPointRecord = {
      appId: r.appId,
      metricType: r.metricType,
      day: startOfUtcDay(r.periodStart),
      value: decimalToNumber(r.value),
      provenance: r.provenance,
      sourceId: r.sourceId,
      sourceTrust: r.source.trustLevel,
      attributionConfidence: typeof meta.attributionConfidence === 'number' ? meta.attributionConfidence : null,
    };
    const list = pointsByApp.get(r.appId);
    if (list) list.push(point);
    else pointsByApp.set(r.appId, [point]);
  }

  return {
    apps,
    pointsByApp,
    reviews,
    transactions: transactions.map((t) => ({ ...t, amount: decimalToNumber(t.amount) ?? 0 })),
  };
}

/** Earliest raw-metric day needed to score `dates` for `periods`. */
export function horizonStart(dates: readonly Date[], periods: readonly Period[]): Date {
  const earliest = dates.reduce((a, d) => (d < a ? d : a), dates[0]!);
  const maxDays = Math.max(...periods.map(periodToDays));
  // current + previous window, plus a margin to locate the last activity.
  return addDays(startOfUtcDay(earliest), -(2 * maxDays + 30));
}

/** Computes and appends app_metrics rows for every (date, period). */
export async function recordMetrics(
  prisma: PrismaClient,
  dates: readonly Date[],
  periods: readonly Period[] = PERIODS,
  data?: EngineData,
): Promise<number> {
  if (dates.length === 0) return 0;
  const latest = dates.reduce((a, d) => (d > a ? d : a), dates[0]!);
  const engineData = data ?? (await loadEngineData(prisma, horizonStart(dates, periods), addDays(latest, 1)));

  let inserted = 0;
  for (const asOf of dates) {
    const rows: AppMetricRow[] = [];
    for (const period of periods) {
      rows.push(...computeSnapshot({ ...engineData, asOf, period }));
    }
    const result = await prisma.appMetric.createMany({ data: rows.map(toAppMetricCreate) });
    inserted += result.count;
  }
  return inserted;
}

function toAppMetricCreate(row: AppMetricRow): Prisma.AppMetricCreateManyInput {
  return {
    appId: row.appId,
    period: toDbPeriod(row.period),
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    activityScore: row.activityScore,
    growthScore: row.growthScore,
    economicScore: row.economicScore,
    communityScore: row.communityScore,
    transparencyScore: row.transparencyScore,
    confidenceScore: row.confidenceScore,
    confidenceLevel: row.confidenceLevel,
    overallScore: row.overallScore,
    stakedPi: row.stakedPi,
    details: row.details as Prisma.InputJsonValue,
    scoringVersion: row.scoringVersion,
    isDemo: row.isDemo,
  };
}

/**
 * Latest metric per app for each period whose window ends at `asOf`'s day.
 * When metrics were recomputed, the most recently created row wins.
 */
async function latestMetricsAt(prisma: PrismaClient, asOf: Date) {
  const byPeriod = new Map<Period, Map<string, AppMetricRow>>();
  for (const period of PERIODS) {
    const w = windowEndingAt(asOf, periodToDays(period));
    const rows = await prisma.appMetric.findMany({
      where: { period: toDbPeriod(period), periodEnd: w.end },
      orderBy: { createdAt: 'desc' },
    });
    const map = new Map<string, AppMetricRow>();
    for (const r of rows) {
      if (map.has(r.appId)) continue;
      map.set(r.appId, {
        ...r,
        period: fromDbPeriod(r.period),
        stakedPi: decimalToNumber(r.stakedPi),
        details: r.details as Record<string, unknown>,
      });
    }
    byPeriod.set(period, map);
  }
  return byPeriod;
}

/** Builds every ranking for every period and appends one snapshot batch. */
export async function recordRankings(
  prisma: PrismaClient,
  asOf: Date,
  periods: readonly Period[] = PERIODS,
  computedAt = new Date(),
): Promise<number> {
  const apps = await loadApps(prisma);
  const isDemo = new Map(apps.map((a) => [a.id, a.isDemo]));
  const latest = await latestMetricsAt(prisma, asOf);

  const data: Prisma.RankingSnapshotCreateManyInput[] = [];
  for (const period of periods) {
    const rankings = computeRankings(apps, latest, period, asOf);
    for (const [type, entries] of Object.entries(rankings)) {
      for (const e of entries) {
        data.push({
          rankingType: toDbRankingType(type as RankingType),
          appId: e.appId,
          score: e.score,
          rank: e.rank,
          period: toDbPeriod(period),
          confidence: e.confidence,
          computedAt,
          isDemo: isDemo.get(e.appId) ?? false,
        });
      }
    }
  }
  if (data.length === 0) return 0;
  return (await prisma.rankingSnapshot.createMany({ data })).count;
}

/** Runs anomaly detection at `asOf`; already-known signals (same fingerprint) are skipped. */
export async function recordAnomalies(prisma: PrismaClient, asOf: Date, now = new Date()): Promise<number> {
  const data = await loadEngineData(prisma, addDays(startOfUtcDay(asOf), -40), addDays(startOfUtcDay(asOf), 1));
  const rows: Prisma.AnomalyCreateManyInput[] = [];
  for (const app of data.apps) {
    const findings = detectAppAnomalies(
      {
        appId: app.id,
        points: data.pointsByApp.get(app.id) ?? [],
        transactions: data.transactions,
        reviews: data.reviews,
        asOf,
      },
      now,
    );
    for (const f of findings) {
      rows.push({
        appId: app.id,
        type: f.type,
        severity: f.severity,
        score: f.score,
        description: f.explanation,
        detectedAt: f.detectedAt,
        metadata: f.metadata as Prisma.InputJsonValue,
        fingerprint: f.fingerprint,
        isDemo: app.isDemo,
      });
    }
  }
  if (rows.length === 0) return 0;
  return (await prisma.anomaly.createMany({ data: rows, skipDuplicates: true })).count;
}

/** Full pipeline at one date: METRICS → SCORING → RANKING, plus ANOMALY DETECTION. */
export async function runPipeline(prisma: PrismaClient, asOf = new Date()) {
  const metrics = await recordMetrics(prisma, [asOf]);
  const rankings = await recordRankings(prisma, asOf);
  const anomalies = await recordAnomalies(prisma, asOf);
  return { metrics, rankings, anomalies };
}
