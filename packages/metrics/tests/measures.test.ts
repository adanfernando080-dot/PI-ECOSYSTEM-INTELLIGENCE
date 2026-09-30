import { describe, expect, it } from 'vitest';
import { addDays } from '@pi/shared';
import { extractMeasures, windowTotal, type MetricPointRecord } from '../src';

const asOf = new Date('2026-09-28T00:00:00Z');

function tx(daysAgo: number, value: number | null, provenance: MetricPointRecord['provenance'] = 'OBSERVABLE'): MetricPointRecord {
  return {
    appId: 'a',
    metricType: 'TRANSACTION_COUNT',
    day: addDays(asOf, -daysAgo),
    value,
    provenance: value === null ? 'UNAVAILABLE' : provenance,
    sourceId: 'chain',
    sourceTrust: 90,
  };
}

const window7 = { start: addDays(asOf, -6), end: addDays(asOf, 1), days: 7 };
const norm = (points: MetricPointRecord[]) =>
  points.map((p) => ({
    metricType: p.metricType,
    day: p.day.toISOString().slice(0, 10),
    value: p.value,
    provenance: p.provenance,
    sourceId: p.sourceId,
    reportingSources: 1,
    attributionConfidence: null,
  }));

describe('windowTotal', () => {
  it('sums a fully observed window', () => {
    const pts = norm([0, 1, 2, 3, 4, 5, 6].map((d) => tx(d, 10)));
    expect(windowTotal(pts, window7, null)).toEqual({ value: 70, knownDays: 7, extrapolated: false });
  });

  it('extrapolates from the observed rate instead of counting missing days as 0', () => {
    const pts = norm([0, 1, 2, 3, 4].map((d) => tx(d, 10)));
    const r = windowTotal(pts, window7, null);
    expect(r.value).toBe(70);
    expect(r.extrapolated).toBe(true);
  });

  it('is unavailable below the minimum day coverage', () => {
    const pts = norm([tx(0, 10), tx(1, 10)]);
    expect(windowTotal(pts, window7, null).value).toBeNull();
  });

  it('treats days before the app existed as known zeros', () => {
    const pts = norm([tx(0, 10), tx(1, 10)]);
    const r = windowTotal(pts, window7, addDays(asOf, -1));
    // 5 days before listing (known 0) + 2 observed days of 10
    expect(r).toEqual({ value: 20, knownDays: 7, extrapolated: false });
  });
});

describe('extractMeasures', () => {
  it('computes current and previous windows, frequency and recency', () => {
    const points = Array.from({ length: 14 }, (_, d) => tx(d, d < 7 ? 20 : 10));
    const m = extractMeasures(points, asOf, '7d');
    expect(m.transactionCount).toBe(140);
    expect(m.previousTransactionCount).toBe(70);
    expect(m.activeDays).toBe(7);
    expect(m.daysSinceLastActivity).toBe(0);
    expect(m.dayCoverage).toBe(1);
    expect(m.provenanceCounts).toEqual({ OBSERVABLE: 7 });
  });

  it('keeps unavailable measures null', () => {
    const m = extractMeasures([tx(0, null), tx(1, null)], asOf, '7d');
    expect(m.transactionCount).toBeNull();
    expect(m.activeDays).toBeNull();
    expect(m.volumePi).toBeNull();
    expect(m.daysSinceLastActivity).toBeNull();
    expect(m.provenanceKnownShare).toBe(0);
  });

  it('ignores staking in scored provenance counts but exposes it separately', () => {
    const staking: MetricPointRecord = { ...tx(0, 5000), metricType: 'STAKED_PI' };
    const m = extractMeasures([tx(0, 10), staking], asOf, '24h');
    expect(m.stakedPi).toBe(5000);
    expect(m.provenanceCounts).toEqual({ OBSERVABLE: 1 });
  });
});
