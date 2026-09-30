import { describe, expect, it } from 'vitest';
import { normalizeRawPoints, validateRawMetric, type RawPoint } from '../src';

const now = new Date('2026-09-29T12:00:00Z');
const day = (d: string) => new Date(`${d}T00:00:00Z`);

describe('validateRawMetric', () => {
  const base = {
    metricType: 'TRANSACTION_COUNT' as const,
    value: 12,
    periodStart: day('2026-09-27'),
    periodEnd: day('2026-09-28'),
    provenance: 'DEVELOPER_REPORTED' as const,
  };

  it('accepts a well-formed metric', () => {
    expect(validateRawMetric(base, now)).toEqual({ ok: true });
  });

  it('rejects a value on UNAVAILABLE data and a null on available data', () => {
    const a = validateRawMetric({ ...base, provenance: 'UNAVAILABLE' }, now);
    const b = validateRawMetric({ ...base, value: null }, now);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(validateRawMetric({ ...base, provenance: 'UNAVAILABLE', value: null }, now).ok).toBe(true);
  });

  it('rejects negative values and non-integer counts', () => {
    expect(validateRawMetric({ ...base, value: -1 }, now).ok).toBe(false);
    expect(validateRawMetric({ ...base, value: 1.5 }, now).ok).toBe(false);
    expect(validateRawMetric({ ...base, metricType: 'TRANSACTION_VOLUME_PI', value: 1.5 }, now).ok).toBe(true);
  });

  it('rejects inverted, too long or future periods', () => {
    expect(validateRawMetric({ ...base, periodEnd: base.periodStart }, now).ok).toBe(false);
    expect(validateRawMetric({ ...base, periodStart: day('2026-07-01') }, now).ok).toBe(false);
    expect(validateRawMetric({ ...base, periodStart: day('2026-10-10'), periodEnd: day('2026-10-11') }, now).ok).toBe(false);
  });

  it('rejects implausible values', () => {
    expect(validateRawMetric({ ...base, value: 99_000_000 }, now).ok).toBe(false);
  });
});

describe('normalizeRawPoints', () => {
  const p = (o: Partial<RawPoint>): RawPoint => ({
    metricType: 'TRANSACTION_COUNT',
    day: day('2026-09-28'),
    value: 100,
    provenance: 'OBSERVABLE',
    sourceId: 'chain',
    sourceTrust: 90,
    ...o,
  });

  it('prefers observable over developer-reported data and records the overlap', () => {
    const r = normalizeRawPoints([
      p({ provenance: 'DEVELOPER_REPORTED', value: 140, sourceId: 'dev', sourceTrust: 50 }),
      p({ value: 100 }),
    ]);
    expect(r.points).toHaveLength(1);
    expect(r.points[0]).toMatchObject({ value: 100, provenance: 'OBSERVABLE', reportingSources: 2 });
    expect(r.overlaps).toEqual([[100, 140]]);
    // 140 vs 100 disagrees by ~29% → dev source not concordant
    expect([...r.concordantSources]).toEqual(['chain']);
  });

  it('counts agreeing sources as concordant', () => {
    const r = normalizeRawPoints([p({ value: 100 }), p({ provenance: 'DEVELOPER_REPORTED', value: 97, sourceId: 'dev' })]);
    expect(r.concordantSources.size).toBe(2);
  });

  it('keeps UNAVAILABLE as null, never 0', () => {
    const r = normalizeRawPoints([p({ provenance: 'UNAVAILABLE', value: null })]);
    expect(r.points[0]!.value).toBeNull();
    expect(r.points[0]!.provenance).toBe('UNAVAILABLE');
    expect(r.points[0]!.reportingSources).toBe(0);
  });

  it('prefers a real value over an UNAVAILABLE marker for the same day', () => {
    const r = normalizeRawPoints([
      p({ provenance: 'UNAVAILABLE', value: null, sourceId: 'api' }),
      p({ provenance: 'ESTIMATED', value: 42, sourceId: 'model', sourceTrust: 30 }),
    ]);
    expect(r.points[0]).toMatchObject({ value: 42, provenance: 'ESTIMATED' });
  });

  it('returns points sorted by day then metric', () => {
    const r = normalizeRawPoints([
      p({ day: day('2026-09-28'), metricType: 'TRANSACTION_VOLUME_PI' }),
      p({ day: day('2026-09-27') }),
      p({ day: day('2026-09-28') }),
    ]);
    expect(r.points.map((x) => `${x.day}/${x.metricType}`)).toEqual([
      '2026-09-27/TRANSACTION_COUNT',
      '2026-09-28/TRANSACTION_COUNT',
      '2026-09-28/TRANSACTION_VOLUME_PI',
    ]);
  });
});
