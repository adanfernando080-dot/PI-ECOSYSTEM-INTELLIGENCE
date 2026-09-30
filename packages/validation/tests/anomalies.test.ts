import { describe, expect, it } from 'vitest';
import { addDays, findVerdictTerms } from '@pi/shared';
import {
  detectActivitySpike,
  detectConcentration,
  detectRepeatedPattern,
  detectUnusualReviewActivity,
  detectVolumeSpike,
  robustZ,
  type AnomalyFinding,
  type TransactionSample,
} from '../src';

const asOf = new Date('2026-09-29T00:00:00Z');
const series = (values: (number | null)[]) =>
  values.map((value, i) => ({ day: addDays(asOf, i - values.length + 1), value }));

function expectNeutral(f: AnomalyFinding | null) {
  expect(f).not.toBeNull();
  expect(findVerdictTerms(f!.explanation)).toEqual([]);
  expect(findVerdictTerms(JSON.stringify(f!.metadata))).toEqual([]);
}

describe('robustZ', () => {
  it('needs a baseline', () => {
    expect(robustZ(series([1, 2, 3]), 7)).toBeNull();
  });
  it('is ~0 for a value in line with the baseline', () => {
    expect(Math.abs(robustZ(series([100, 102, 98, 101, 99, 100, 103, 100]), 7)!)).toBeLessThan(1);
  });
});

describe('spike detection', () => {
  const normal = [100, 104, 97, 101, 99, 102, 98, 103, 100, 101];

  it('flags a sudden activity spike with a neutral explanation', () => {
    const f = detectActivitySpike('app-1', series([...normal, 900]), asOf);
    expectNeutral(f);
    expect(f!.type).toBe('ACTIVITY_SPIKE');
    expect(f!.severity).toBe('HIGH');
    expect(f!.fingerprint).toBe('app-1:ACTIVITY_SPIKE:2026-09-29');
    expect(f!.explanation).toMatch(/not a conclusion/);
  });

  it('does not flag ordinary variation', () => {
    expect(detectActivitySpike('app-1', series([...normal, 110]), asOf)).toBeNull();
  });

  it('ignores spikes that stay tiny in absolute terms', () => {
    expect(detectVolumeSpike('app-1', series([0, 0, 1, 0, 0, 1, 0, 0, 12]), asOf)).toBeNull();
  });

  it('skips unavailable days instead of treating them as zero', () => {
    const withGaps = series([100, null, 97, 101, null, 102, 98, 103, 100, 101, 104]);
    expect(detectVolumeSpike('app-1', withGaps, asOf)).toBeNull();
  });
});

const tx = (sender: string, amount: number, receiver = 'APP', i = 0): TransactionSample => ({
  sender,
  receiver,
  amount,
  timestamp: new Date(asOf.getTime() - i * 3_600_000),
});

describe('detectConcentration', () => {
  it('reports a concentration signal when one sender dominates the volume', () => {
    const txs = [
      ...Array.from({ length: 5 }, (_, i) => tx('GWHALE0000000000', 1000, 'APP', i)),
      ...Array.from({ length: 30 }, (_, i) => tx(`GUSER${i}XXXXXXXXXX`, 5, 'APP', i)),
    ];
    const f = detectConcentration('app-1', txs, '2026-09-29/7d', asOf);
    expectNeutral(f);
    expect(f!.type).toBe('CONCENTRATION_SIGNAL');
    expect(f!.severity).toBe('HIGH');
    expect(f!.metadata.topAddress).toBe('GWHAL…0000');
  });

  it('stays silent for diversified volume or too few transactions', () => {
    const diversified = Array.from({ length: 40 }, (_, i) => tx(`G${i}`, 10, 'APP', i));
    expect(detectConcentration('app-1', diversified, 'w', asOf)).toBeNull();
    expect(detectConcentration('app-1', [tx('A', 100)], 'w', asOf)).toBeNull();
  });
});

describe('detectRepeatedPattern', () => {
  it('reports many identical (sender, receiver, amount) transactions', () => {
    const txs = [
      ...Array.from({ length: 30 }, (_, i) => tx('GREPEATER1234567', 3.14, 'APP', i)),
      ...Array.from({ length: 10 }, (_, i) => tx(`G${i}`, 10 + i, 'APP', i)),
    ];
    const f = detectRepeatedPattern('app-1', txs, 'w', asOf);
    expectNeutral(f);
    expect(f!.metadata.occurrences).toBe(30);
    expect(f!.severity).toBe('HIGH');
  });

  it('stays silent below the minimum number of occurrences', () => {
    const txs = Array.from({ length: 5 }, (_, i) => tx('A', 1, 'APP', i));
    expect(detectRepeatedPattern('app-1', txs, 'w', asOf)).toBeNull();
  });
});

describe('detectUnusualReviewActivity', () => {
  const quiet = Array.from({ length: 20 }, (_, i) => ({
    rating: 3 + (i % 3),
    createdAt: addDays(asOf, -(i + 1)),
    accountAgeDays: 200,
  }));

  it('describes a burst without labelling any review', () => {
    const burst = Array.from({ length: 25 }, () => ({ rating: 5, createdAt: asOf, accountAgeDays: 1 }));
    const f = detectUnusualReviewActivity('app-1', [...quiet, ...burst], asOf, 30, asOf);
    expectNeutral(f);
    expect(f!.type).toBe('UNUSUAL_REVIEW_ACTIVITY');
    expect(f!.explanation).toMatch(/does not qualify any review/);
    expect(f!.metadata.dominantRatingShare).toBe(1);
    expect(f!.metadata.recentAccountShare).toBe(1);
  });

  it('stays silent for a normal day', () => {
    const today = [{ rating: 4, createdAt: asOf, accountAgeDays: 300 }];
    expect(detectUnusualReviewActivity('app-1', [...quiet, ...today], asOf, 30, asOf)).toBeNull();
  });
});
