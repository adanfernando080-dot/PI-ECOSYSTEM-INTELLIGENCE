import { describe, expect, it } from 'vitest';
import {
  computeActivityScore,
  combineAvailable,
  DEFAULT_NORMALIZATION_CONTEXT as ctx,
} from '../src';

describe('combineAvailable', () => {
  it('averages available components and renormalizes weights', () => {
    const r = combineAvailable({ a: { weight: 0.5, value: 80 }, b: { weight: 0.5, value: null } }, 0.4);
    expect(r.score).toBe(80);
    expect(r.coverage).toBe(0.5);
    expect(r.missing).toEqual(['b']);
  });

  it('returns null (never 0) when coverage is below the minimum', () => {
    const r = combineAvailable({ a: { weight: 0.3, value: 90 }, b: { weight: 0.7, value: null } }, 0.4);
    expect(r.score).toBeNull();
    expect(r.notes[0]).toMatch(/Insufficient data/);
  });

  it('returns null when nothing is available', () => {
    const r = combineAvailable({ a: { weight: 1, value: null } }, 0);
    expect(r.score).toBeNull();
    expect(r.coverage).toBe(0);
  });
});

describe('computeActivityScore', () => {
  const full = {
    transactionCount: 1000,
    activeDays: 30,
    windowDays: 30,
    activeAddresses: 500,
    daysSinceLastActivity: 0,
  };

  it('reaches 100 at the ecosystem reference with daily activity', () => {
    const r = computeActivityScore(full, ctx);
    expect(r.score).toBe(100);
    expect(r.coverage).toBe(1);
    expect(r.missing).toHaveLength(0);
  });

  it('applies the 40/25/20/15 weights', () => {
    const r = computeActivityScore(
      { transactionCount: 0, activeDays: 0, windowDays: 30, activeAddresses: 0, daysSinceLastActivity: 0 },
      ctx,
    );
    // Only recency (15%) is at 100.
    expect(r.score).toBe(15);
  });

  it('does not treat unavailable addresses as zero: weight is redistributed', () => {
    const withAddresses = computeActivityScore({ ...full, activeAddresses: 500 }, ctx);
    const withoutAddresses = computeActivityScore({ ...full, activeAddresses: null }, ctx);
    const zeroAddresses = computeActivityScore({ ...full, activeAddresses: 0 }, ctx);

    expect(withoutAddresses.score).toBe(100);
    expect(withoutAddresses.coverage).toBe(0.8);
    expect(withoutAddresses.missing).toEqual(['activeAddresses']);
    expect(zeroAddresses.score).toBe(80);
    expect(withAddresses.coverage).toBeGreaterThan(withoutAddresses.coverage);
  });

  it('decays recency by half every 7 days', () => {
    const r = computeActivityScore({ ...full, daysSinceLastActivity: 7 }, ctx);
    expect(r.components.recency.value).toBe(50);
  });

  it('is null when only recency is known', () => {
    const r = computeActivityScore(
      { transactionCount: null, activeDays: null, windowDays: 30, activeAddresses: null, daysSinceLastActivity: 1 },
      ctx,
    );
    expect(r.score).toBeNull();
  });

  it('uses log normalization so a larger app scores higher without saturating smaller ones', () => {
    const small = computeActivityScore({ ...full, transactionCount: 50 }, ctx);
    const large = computeActivityScore({ ...full, transactionCount: 800 }, ctx);
    expect(large.score!).toBeGreaterThan(small.score!);
    expect(small.components.transactionActivity.value!).toBeGreaterThan(50);
  });
});
