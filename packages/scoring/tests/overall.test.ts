import { describe, expect, it } from 'vitest';
import { computePiEcosystemScore, OVERALL_WEIGHTS, SCORING_VERSION } from '../src';

describe('computePiEcosystemScore', () => {
  it('uses the 25/20/20/15/10/10 weights', () => {
    expect(OVERALL_WEIGHTS).toEqual({
      activity: 0.25,
      growth: 0.2,
      economic: 0.2,
      community: 0.15,
      transparency: 0.1,
      confidence: 0.1,
    });
    const r = computePiEcosystemScore({
      activity: 100,
      growth: 0,
      economic: 0,
      community: 0,
      transparency: 0,
      confidence: 0,
    });
    expect(r.score).toBe(25);
  });

  it('has no staking input and no staking component', () => {
    const r = computePiEcosystemScore({
      activity: 50,
      growth: 50,
      economic: 50,
      community: 50,
      transparency: 50,
      confidence: 50,
    });
    expect(Object.keys(r.components).some((k) => k.toLowerCase().includes('stak'))).toBe(false);
    expect(r.score).toBe(50);
  });

  it('redistributes weight when community data is unavailable', () => {
    const r = computePiEcosystemScore({
      activity: 80,
      growth: 80,
      economic: 80,
      community: null,
      transparency: 80,
      confidence: 80,
    });
    expect(r.score).toBe(80);
    expect(r.coverage).toBe(0.85);
  });

  it('is not produced when less than half of the weight is available', () => {
    const r = computePiEcosystemScore({
      activity: null,
      growth: null,
      economic: null,
      community: null,
      transparency: 90,
      confidence: 90,
    });
    expect(r.score).toBeNull();
  });

  it('exposes a methodology version', () => {
    expect(SCORING_VERSION).toMatch(/^scoring-v\d+\.\d+\.\d+$/);
  });
});
