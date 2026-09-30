import { describe, expect, it } from 'vitest';
import {
  computeConfidence,
  confidenceLevel,
  consistencyFromPairs,
  freshnessScore,
  pairAgreement,
  provenanceQuality,
  sourceCountScore,
} from '../src';

describe('confidenceLevel', () => {
  it('maps the documented bands', () => {
    expect(confidenceLevel(100)).toBe('HIGH');
    expect(confidenceLevel(90)).toBe('HIGH');
    expect(confidenceLevel(89.99)).toBe('GOOD');
    expect(confidenceLevel(75)).toBe('GOOD');
    expect(confidenceLevel(74)).toBe('PARTIAL');
    expect(confidenceLevel(50)).toBe('PARTIAL');
    expect(confidenceLevel(49)).toBe('LIMITED');
    expect(confidenceLevel(25)).toBe('LIMITED');
    expect(confidenceLevel(24)).toBe('VERY_LOW');
    expect(confidenceLevel(0)).toBe('VERY_LOW');
  });
});

describe('provenanceQuality', () => {
  it('ranks observable above developer-reported above estimated', () => {
    expect(provenanceQuality({ OBSERVABLE: 10 })).toBe(100);
    expect(provenanceQuality({ DEVELOPER_REPORTED: 10 })).toBe(60);
    expect(provenanceQuality({ ESTIMATED: 10 })).toBe(40);
    expect(provenanceQuality({ OBSERVABLE: 1, UNAVAILABLE: 1 })).toBe(50);
    expect(provenanceQuality({})).toBe(0);
  });
});

describe('freshnessScore', () => {
  it('is full within the grace period and halves every 7 days after', () => {
    expect(freshnessScore(0)).toBe(100);
    expect(freshnessScore(1)).toBe(100);
    expect(freshnessScore(8)).toBe(50);
    expect(freshnessScore(null)).toBe(0);
  });
});

describe('sources and consistency', () => {
  it('rewards concordant sources with diminishing returns', () => {
    expect(sourceCountScore(0)).toBe(0);
    expect(sourceCountScore(1)).toBe(40);
    expect(sourceCountScore(2)).toBe(75);
    expect(sourceCountScore(7)).toBe(100);
  });

  it('measures pair agreement', () => {
    expect(pairAgreement(100, 100)).toBe(1);
    expect(pairAgreement(100, 90)).toBeCloseTo(0.9);
    expect(pairAgreement(0, 0)).toBe(1);
    expect(pairAgreement(100, 0)).toBe(0);
    expect(consistencyFromPairs([])).toBeNull();
    expect(consistencyFromPairs([[100, 100], [100, 50]])).toBe(0.75);
  });
});

describe('computeConfidence', () => {
  it('is HIGH for fresh, complete, observable, multi-source data', () => {
    const r = computeConfidence({
      provenanceCounts: { OBSERVABLE: 90 },
      daysSinceLastUpdate: 0,
      completeness: 1,
      consistency: 0.98,
      concordantSources: 3,
    });
    expect(r.level).toBe('HIGH');
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it('is lower for developer-reported only data', () => {
    const observed = computeConfidence({
      provenanceCounts: { OBSERVABLE: 30 },
      daysSinceLastUpdate: 0,
      completeness: 0.8,
      consistency: null,
      concordantSources: 1,
    });
    const declared = computeConfidence({
      provenanceCounts: { DEVELOPER_REPORTED: 30 },
      daysSinceLastUpdate: 0,
      completeness: 0.8,
      consistency: null,
      concordantSources: 1,
    });
    expect(declared.score).toBeLessThan(observed.score);
  });

  it('uses a neutral consistency with a single source and says so', () => {
    const r = computeConfidence({
      provenanceCounts: { OBSERVABLE: 1 },
      daysSinceLastUpdate: 0,
      completeness: 1,
      consistency: null,
      concordantSources: 1,
    });
    expect(r.components.consistency).toBe(50);
    expect(r.notes.join(' ')).toMatch(/neutral/);
  });

  it('is VERY_LOW when there is no data at all', () => {
    const r = computeConfidence({
      provenanceCounts: {},
      daysSinceLastUpdate: null,
      completeness: 0,
      consistency: null,
      concordantSources: 0,
    });
    // only the neutral consistency contributes: 0.15 × 50
    expect(r.score).toBe(7.5);
    expect(r.level).toBe('VERY_LOW');
  });

  it('decreases as data gets stale', () => {
    const base = {
      provenanceCounts: { OBSERVABLE: 10 },
      completeness: 1,
      consistency: 1,
      concordantSources: 2,
    } as const;
    const fresh = computeConfidence({ ...base, daysSinceLastUpdate: 0 });
    const stale = computeConfidence({ ...base, daysSinceLastUpdate: 30 });
    expect(stale.score).toBeLessThan(fresh.score);
  });
});
