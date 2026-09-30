import { clamp, isoDay, median, round, startOfUtcDay } from '@pi/shared';
import { robustZ, type DailyValue } from './spikes';
import { ANOMALY_CONFIG, severityFor, type AnomalyFinding } from './types';

export interface ReviewSample {
  rating: number;
  createdAt: Date;
  /** Age of the reviewer's account when the review was posted, when known. */
  accountAgeDays?: number | null;
}

/**
 * Unusual review activity: the number of reviews on the latest day is far
 * above the app's usual rhythm. The finding describes the burst (volume,
 * rating uniformity, share of recent accounts) — it NEVER labels reviews.
 */
export function detectUnusualReviewActivity(
  appId: string,
  reviews: readonly ReviewSample[],
  asOf: Date,
  lookbackDays = 30,
  now = new Date(),
): AnomalyFinding | null {
  const cfg = ANOMALY_CONFIG.reviews;
  const lastDay = startOfUtcDay(asOf);
  const series: DailyValue[] = [];
  const perDay = new Map<string, ReviewSample[]>();
  for (const r of reviews) {
    const key = isoDay(r.createdAt);
    const list = perDay.get(key);
    if (list) list.push(r);
    else perDay.set(key, [r]);
  }
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const day = new Date(lastDay.getTime() - i * 86_400_000);
    series.push({ day, value: perDay.get(isoDay(day))?.length ?? 0 });
  }

  const burst = perDay.get(isoDay(lastDay)) ?? [];
  if (burst.length < cfg.minReviewsInBurst) return null;
  const z = robustZ(series, cfg.minBaselineDays);
  if (z === null) return null;
  const severity = severityFor(z, cfg.thresholds);
  if (!severity) return null;

  const ratingCounts = new Map<number, number>();
  for (const r of burst) ratingCounts.set(r.rating, (ratingCounts.get(r.rating) ?? 0) + 1);
  const dominantShare = Math.max(...ratingCounts.values()) / burst.length;
  const withAge = burst.filter((r) => r.accountAgeDays !== undefined && r.accountAgeDays !== null);
  const recentAccountShare =
    withAge.length === 0 ? null : withAge.filter((r) => r.accountAgeDays! < 7).length / withAge.length;
  const typical = median(series.slice(0, -1).map((d) => d.value ?? 0)) ?? 0;

  const details: string[] = [];
  if (dominantShare >= cfg.uniformShare) details.push(`${round(dominantShare * 100, 0)}% share the same rating`);
  if (recentAccountShare !== null && recentAccountShare >= 0.5) {
    details.push(`${round(recentAccountShare * 100, 0)}% come from accounts younger than 7 days`);
  }

  return {
    type: 'UNUSUAL_REVIEW_ACTIVITY',
    severity,
    score: round(clamp(z * 8, 0, 100)),
    explanation:
      `Unusual review activity on ${isoDay(lastDay)}: ${burst.length} reviews versus a typical ${round(typical)} per day` +
      (details.length ? ` (${details.join('; ')})` : '') +
      '. Reviews remain subject to normal moderation; this signal does not qualify any review.',
    detectedAt: now,
    fingerprint: `${appId}:UNUSUAL_REVIEW_ACTIVITY:${isoDay(lastDay)}`,
    metadata: {
      reviewsOnDay: burst.length,
      typicalPerDay: typical,
      robustZ: round(z, 3),
      dominantRatingShare: round(dominantShare, 4),
      recentAccountShare: recentAccountShare === null ? null : round(recentAccountShare, 4),
    },
  };
}
