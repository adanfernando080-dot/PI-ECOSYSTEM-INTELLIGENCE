import { clamp, daysBetween, round, type RankingType } from '@pi/shared';

export const RANKING_VERSION = 'ranking-v1.0.0';

export const RANKING_CONFIG = {
  /** Apps first seen within this many days are listed in "new". */
  newWithinDays: 30,
  /** Apps first seen within this many days are eligible for "rising". */
  risingWithinDays: 90,
  /** Trending = momentum over the short window, weighted with current activity. */
  trendingWeights: { shortTermGrowth: 0.6, activity: 0.4 },
  /** Scores equal after rounding to this many decimals share a rank. */
  tieDecimals: 1,
} as const;

/** Per-app input of the ranking engine (latest computed metrics). */
export interface RankingCandidate {
  appId: string;
  name: string;
  firstSeenAt: Date;
  /** Data confidence 0..100. */
  confidence: number;
  activity: number | null;
  growth: number | null;
  economic: number | null;
  community: number | null;
  transparency: number | null;
  /** Growth score over the short window (24h or 7d) — used by "trending". */
  shortTermGrowth: number | null;
}

export interface RankingOptions {
  asOf: Date;
  /** Exclude candidates below this confidence (0..100). */
  minConfidence?: number;
  limit?: number;
}

export interface RankingEntry {
  appId: string;
  name: string;
  rank: number;
  score: number;
  confidence: number;
  /** True when at least one other app shares this rank. */
  tied: boolean;
}

/**
 * Produces one analytical ranking.
 *
 * Rankings order apps along ONE dimension. They never express that an app is
 * "better" overall; there is deliberately no overall ranking type.
 * Apps whose metric is unavailable are excluded (not ranked last with 0).
 */
export function buildRanking(
  type: RankingType,
  candidates: readonly RankingCandidate[],
  options: RankingOptions,
): RankingEntry[] {
  const eligible = candidates.filter((c) => c.confidence >= (options.minConfidence ?? 0));
  const scored: { c: RankingCandidate; score: number }[] = [];

  for (const c of eligible) {
    const score = scoreFor(type, c, options.asOf);
    if (score !== null) scored.push({ c, score: round(score) });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (type === 'new' ? b.c.firstSeenAt.getTime() - a.c.firstSeenAt.getTime() : 0) ||
      b.c.confidence - a.c.confidence ||
      a.c.name.localeCompare(b.c.name) ||
      a.c.appId.localeCompare(b.c.appId),
  );

  const entries = assignCompetitionRanks(scored);
  return options.limit === undefined ? entries : entries.slice(0, options.limit);
}

/** Score used to order apps for a ranking type; null = not eligible. */
export function scoreFor(type: RankingType, c: RankingCandidate, asOf: Date): number | null {
  switch (type) {
    case 'activity':
    case 'growth':
    case 'economic':
    case 'community':
    case 'transparency':
      return c[type];
    case 'trending': {
      if (c.shortTermGrowth === null || c.activity === null) return null;
      const w = RANKING_CONFIG.trendingWeights;
      return w.shortTermGrowth * c.shortTermGrowth + w.activity * c.activity;
    }
    case 'rising': {
      const age = daysBetween(c.firstSeenAt, asOf);
      if (age < 0 || age > RANKING_CONFIG.risingWithinDays) return null;
      return c.growth;
    }
    case 'new': {
      const age = daysBetween(c.firstSeenAt, asOf);
      if (age < 0 || age > RANKING_CONFIG.newWithinDays) return null;
      // Freshness of the listing: 100 on the first day, 0 at the end of the window.
      return clamp(100 * (1 - age / RANKING_CONFIG.newWithinDays), 0, 100);
    }
  }
}

/** Standard competition ranking ("1224"): equal (rounded) scores share a rank. */
function assignCompetitionRanks(sorted: readonly { c: RankingCandidate; score: number }[]): RankingEntry[] {
  const key = (s: number) => round(s, RANKING_CONFIG.tieDecimals);
  const entries: RankingEntry[] = [];
  sorted.forEach(({ c, score }, i) => {
    const prev = entries[i - 1];
    const rank = prev && key(prev.score) === key(score) ? prev.rank : i + 1;
    entries.push({ appId: c.appId, name: c.name, rank, score, confidence: round(c.confidence), tied: false });
  });
  const counts = new Map<number, number>();
  for (const e of entries) counts.set(e.rank, (counts.get(e.rank) ?? 0) + 1);
  for (const e of entries) e.tied = (counts.get(e.rank) ?? 0) > 1;
  return entries;
}

/** Builds every ranking type at once (used by the rankings worker). */
export function buildAllRankings(
  types: readonly RankingType[],
  candidates: readonly RankingCandidate[],
  options: RankingOptions,
): Record<RankingType, RankingEntry[]> {
  const out = {} as Record<RankingType, RankingEntry[]>;
  for (const t of types) out[t] = buildRanking(t, candidates, options);
  return out;
}
