import { describe, expect, it } from 'vitest';
import { computeObservableEconomicActivity, DEFAULT_NORMALIZATION_CONTEXT as ctx } from '../src';

const base = {
  transactionCount: 1000,
  volumePi: 10000,
  previousVolumePi: 10000,
  activeDays: 30,
  windowDays: 30,
  distinctAddresses: 500,
  addressAttributionConfidence: 0.9,
};

describe('computeObservableEconomicActivity', () => {
  it('is labelled observable_economic_activity and exposes no revenue field', () => {
    const r = computeObservableEconomicActivity(base, ctx);
    expect(r.label).toBe('observable_economic_activity');
    expect(JSON.stringify(r).toLowerCase()).not.toContain('revenue');
  });

  it('scores the reference level with a flat trend', () => {
    const r = computeObservableEconomicActivity(base, ctx);
    // everything 100 except trend = 50 (10% weight) → 95
    expect(r.score).toBe(95);
    expect(r.volumeTrend).toBe(0);
  });

  it('ignores distinct addresses when attribution is not reliable enough', () => {
    const r = computeObservableEconomicActivity({ ...base, addressAttributionConfidence: 0.4 }, ctx);
    expect(r.components.distinctAddresses.value).toBeNull();
    expect(r.missing).toContain('distinctAddresses');
    expect(r.notes.join(' ')).toMatch(/attribution confidence/);
  });

  it('does not treat a missing volume as zero', () => {
    const r = computeObservableEconomicActivity({ ...base, volumePi: null }, ctx);
    expect(r.observableVolumePi).toBeNull();
    expect(r.components.volume.value).toBeNull();
    expect(r.components.trend.value).toBeNull();
    expect(r.score).not.toBeNull();
    expect(r.coverage).toBeLessThan(1);
  });

  it('reflects a rising volume trend', () => {
    const rising = computeObservableEconomicActivity({ ...base, previousVolumePi: 5000 }, ctx);
    const flat = computeObservableEconomicActivity(base, ctx);
    expect(rising.components.trend.value!).toBeGreaterThan(flat.components.trend.value!);
  });
});
