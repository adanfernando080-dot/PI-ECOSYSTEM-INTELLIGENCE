import { describe, expect, it } from 'vitest';
import { computeGrowthScore, persistenceScore, DEFAULT_NORMALIZATION_CONTEXT as ctx } from '../src';

describe('computeGrowthScore', () => {
  it('is 50-ish for a stable app', () => {
    const r = computeGrowthScore({ current: 1000, previous: 1000, subPeriods: [250, 250, 250, 250] }, ctx);
    // relative 50, absolute 50, persistence 0, base ~100
    expect(r.relativeGrowth).toBe(0);
    expect(r.components.relative.value).toBe(50);
    expect(r.components.absolute.value).toBe(50);
  });

  it('prevents a small app with a one-off spike from dominating an established growing app', () => {
    const tinySpike = computeGrowthScore({ current: 100, previous: 10, subPeriods: [2, 2, 3, 93] }, ctx);
    const establishedSteady = computeGrowthScore(
      { current: 12000, previous: 10000, subPeriods: [2700, 2900, 3100, 3300] },
      ctx,
    );
    expect(tinySpike.relativeGrowth!).toBeGreaterThan(establishedSteady.relativeGrowth!);
    expect(establishedSteady.score!).toBeGreaterThan(tinySpike.score!);
  });

  it('damps relative growth for small bases', () => {
    const small = computeGrowthScore({ current: 20, previous: 10, subPeriods: [] }, ctx);
    const large = computeGrowthScore({ current: 2000, previous: 1000, subPeriods: [] }, ctx);
    // Both double, but the floor + damping reduce the small app's relative component.
    expect(large.components.relative.value!).toBeGreaterThan(small.components.relative.value!);
  });

  it('scores decline below 50', () => {
    const r = computeGrowthScore({ current: 500, previous: 1000, subPeriods: [300, 200, 150] }, ctx);
    expect(r.score!).toBeLessThan(50);
    expect(r.absoluteGrowth).toBe(-500);
  });

  it('is null (not 0) when the previous window is unavailable', () => {
    const r = computeGrowthScore({ current: 500, previous: null, subPeriods: [100, 200] }, ctx);
    expect(r.score).toBeNull();
    expect(r.relativeGrowth).toBeNull();
    expect(r.missing).toContain('relative');
  });

  it('handles a brand-new app (previous = 0) without dividing by zero', () => {
    const r = computeGrowthScore({ current: 300, previous: 0, subPeriods: [0, 100, 200] }, ctx);
    expect(r.relativeGrowth).toBe(6); // 300 / floor 50
    expect(r.score).not.toBeNull();
  });
});

describe('persistenceScore', () => {
  it('measures the share of consecutive increases', () => {
    expect(persistenceScore([1, 2, 3, 4])).toBe(100);
    expect(persistenceScore([4, 3, 2, 1])).toBe(0);
    expect(persistenceScore([1, 2, 1])).toBe(50);
  });

  it('skips unavailable sub-periods and needs at least two comparisons', () => {
    expect(persistenceScore([1, null, 2])).toBeNull();
    expect(persistenceScore([1, null, 2, 3])).toBe(100);
  });
});
