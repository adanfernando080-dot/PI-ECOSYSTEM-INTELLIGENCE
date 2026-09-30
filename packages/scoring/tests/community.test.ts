import { describe, expect, it } from 'vitest';
import { bayesianAverage, computeCommunityScore } from '../src';

describe('bayesianAverage', () => {
  it('implements (n/(n+k))·R + (k/(n+k))·C', () => {
    // n=10, k=10 → halfway between R and C
    expect(bayesianAverage(10, 5, 10, 3)).toBe(4);
    expect(bayesianAverage(0, 5, 10, 3)).toBe(3);
  });
});

describe('computeCommunityScore', () => {
  it('is unavailable (null) with no published review', () => {
    const r = computeCommunityScore({ reviewCount: 0, averageRating: null, globalMean: 3.8 });
    expect(r.score).toBeNull();
    expect(r.adjustedRating).toBeNull();
    expect(r.coverage).toBe(0);
  });

  it('pulls a single 5-star review toward the global mean', () => {
    const r = computeCommunityScore({ reviewCount: 1, averageRating: 5, globalMean: 3.5, k: 10 });
    expect(r.adjustedRating!).toBeCloseTo(3.6364, 3);
    expect(r.score!).toBeLessThan(70);
  });

  it('lets many reviews dominate the prior', () => {
    const few = computeCommunityScore({ reviewCount: 2, averageRating: 4.8, globalMean: 3.5 });
    const many = computeCommunityScore({ reviewCount: 400, averageRating: 4.6, globalMean: 3.5 });
    expect(many.score!).toBeGreaterThan(few.score!);
  });

  it('maps the 1..5 scale to 0..100', () => {
    expect(computeCommunityScore({ reviewCount: 1e9, averageRating: 5, globalMean: 3 }).score).toBe(100);
    expect(computeCommunityScore({ reviewCount: 1e9, averageRating: 1, globalMean: 3 }).score).toBe(0);
  });

  it('uses the documented default C when the ecosystem mean is unknown', () => {
    const r = computeCommunityScore({ reviewCount: 3, averageRating: 4, globalMean: null });
    expect(r.parameters.C).toBe(3.5);
    expect(r.parameters.k).toBe(10);
  });
});
