import { describe, expect, it } from 'vitest';
import { addDays, RANKING_TYPES } from '@pi/shared';
import { buildAllRankings, buildRanking, type RankingCandidate } from '../src';

const asOf = new Date('2026-09-29T00:00:00Z');

function candidate(overrides: Partial<RankingCandidate> & { appId: string }): RankingCandidate {
  return {
    name: overrides.appId,
    firstSeenAt: addDays(asOf, -365),
    confidence: 80,
    activity: 50,
    growth: 50,
    economic: 50,
    community: 50,
    transparency: 50,
    shortTermGrowth: 50,
    ...overrides,
  };
}

describe('buildRanking', () => {
  it('orders by the requested dimension, highest first', () => {
    const r = buildRanking(
      'activity',
      [candidate({ appId: 'a', activity: 10 }), candidate({ appId: 'b', activity: 90 }), candidate({ appId: 'c', activity: 50 })],
      { asOf },
    );
    expect(r.map((e) => e.appId)).toEqual(['b', 'c', 'a']);
    expect(r.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it('excludes apps whose metric is unavailable instead of ranking them with 0', () => {
    const r = buildRanking(
      'community',
      [candidate({ appId: 'a', community: null }), candidate({ appId: 'b', community: 20 })],
      { asOf },
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.appId).toBe('b');
  });

  it('gives equal scores the same rank (competition ranking)', () => {
    const r = buildRanking(
      'growth',
      [
        candidate({ appId: 'a', growth: 70 }),
        candidate({ appId: 'b', growth: 70.02 }),
        candidate({ appId: 'c', growth: 40 }),
      ],
      { asOf },
    );
    expect(r.map((e) => e.rank)).toEqual([1, 1, 3]);
    expect(r[0]!.tied).toBe(true);
    expect(r[2]!.tied).toBe(false);
  });

  it('filters by minimum confidence', () => {
    const r = buildRanking(
      'economic',
      [candidate({ appId: 'a', confidence: 30 }), candidate({ appId: 'b', confidence: 80 })],
      { asOf, minConfidence: 50 },
    );
    expect(r.map((e) => e.appId)).toEqual(['b']);
  });

  it('computes trending from short-term growth and activity', () => {
    const r = buildRanking(
      'trending',
      [
        candidate({ appId: 'hot', shortTermGrowth: 90, activity: 40 }),
        candidate({ appId: 'big', shortTermGrowth: 50, activity: 90 }),
        candidate({ appId: 'unknown', shortTermGrowth: null }),
      ],
      { asOf },
    );
    expect(r.map((e) => e.appId)).toEqual(['hot', 'big']);
    expect(r[0]!.score).toBe(70);
  });

  it('limits rising to recently listed apps, ordered by growth', () => {
    const r = buildRanking(
      'rising',
      [
        candidate({ appId: 'old', growth: 99 }),
        candidate({ appId: 'young', growth: 60, firstSeenAt: addDays(asOf, -20) }),
        candidate({ appId: 'younger', growth: 80, firstSeenAt: addDays(asOf, -5) }),
      ],
      { asOf },
    );
    expect(r.map((e) => e.appId)).toEqual(['younger', 'young']);
  });

  it('lists new apps from the most recent', () => {
    const r = buildRanking(
      'new',
      [
        candidate({ appId: 'old' }),
        candidate({ appId: 'd10', firstSeenAt: addDays(asOf, -10) }),
        candidate({ appId: 'd2', firstSeenAt: addDays(asOf, -2) }),
      ],
      { asOf },
    );
    expect(r.map((e) => e.appId)).toEqual(['d2', 'd10']);
  });

  it('applies the limit after ranking', () => {
    const r = buildRanking(
      'activity',
      [candidate({ appId: 'a', activity: 1 }), candidate({ appId: 'b', activity: 2 }), candidate({ appId: 'c', activity: 3 })],
      { asOf, limit: 2 },
    );
    expect(r.map((e) => e.appId)).toEqual(['c', 'b']);
  });
});

describe('buildAllRankings', () => {
  it('produces every analytical ranking and no overall/best ranking', () => {
    const all = buildAllRankings(RANKING_TYPES, [candidate({ appId: 'a' })], { asOf });
    expect(Object.keys(all).sort()).toEqual([...RANKING_TYPES].sort());
    expect(Object.keys(all).some((k) => /best|winner|overall/.test(k))).toBe(false);
  });
});
