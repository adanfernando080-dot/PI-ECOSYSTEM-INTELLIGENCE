import { buildAllRankings, type RankingCandidate, type RankingEntry } from '@pi/ranking';
import { RANKING_TYPES, type Period, type RankingType } from '@pi/shared';
import type { AppMetricRow, AppProfile } from './types';

/**
 * Short window whose growth feeds "trending" for a given ranking period:
 * 90d → 30d, 30d → 7d, 7d → 24h, 24h → 24h.
 */
export const SHORT_TERM_PERIOD: Record<Period, Period> = {
  '90d': '30d',
  '30d': '7d',
  '7d': '24h',
  '24h': '24h',
};

/**
 * RANKING step: builds every analytical ranking for one period from the
 * latest metrics of that period and of its short-term period.
 */
export function computeRankings(
  apps: readonly AppProfile[],
  latestByPeriod: ReadonlyMap<Period, ReadonlyMap<string, AppMetricRow>>,
  period: Period,
  asOf: Date,
): Record<RankingType, RankingEntry[]> {
  const main = latestByPeriod.get(period) ?? new Map<string, AppMetricRow>();
  const short = latestByPeriod.get(SHORT_TERM_PERIOD[period]) ?? new Map<string, AppMetricRow>();

  const candidates: RankingCandidate[] = [];
  for (const app of apps) {
    const m = main.get(app.id);
    if (!m) continue;
    candidates.push({
      appId: app.id,
      name: app.name,
      firstSeenAt: app.firstSeenAt,
      confidence: m.confidenceScore,
      activity: m.activityScore,
      growth: m.growthScore,
      economic: m.economicScore,
      community: m.communityScore,
      transparency: m.transparencyScore,
      shortTermGrowth: short.get(app.id)?.growthScore ?? null,
    });
  }
  return buildAllRankings(RANKING_TYPES, candidates, { asOf });
}
