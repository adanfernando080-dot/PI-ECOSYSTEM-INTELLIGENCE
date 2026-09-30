import { describe, expect, it } from 'vitest';
import { computeTransparencyScore, TRANSPARENCY_WEIGHTS, type TransparencyInput } from '../src';

const complete: TransparencyInput = {
  description: 'A marketplace where Pioneers list and buy second-hand goods locally.',
  hasCategory: true,
  hasDeveloper: true,
  developerVerified: true,
  url: 'https://example.pi',
  hasPublicInformation: true,
  methodologyNote: 'Counts are exported daily from our payment log.',
  hasDeveloperReportedData: true,
  provenanceKnownShare: 1,
};

describe('computeTransparencyScore', () => {
  it('weights sum to 100', () => {
    const total = Object.values(TRANSPARENCY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('gives 100 when every item is disclosed', () => {
    const r = computeTransparencyScore(complete);
    expect(r.score).toBe(100);
    expect(r.missing).toHaveLength(0);
  });

  it('gives 0 when nothing is disclosed', () => {
    const r = computeTransparencyScore({
      description: null,
      hasCategory: false,
      hasDeveloper: false,
      developerVerified: false,
      url: null,
      hasPublicInformation: false,
      methodologyNote: null,
      hasDeveloperReportedData: false,
      provenanceKnownShare: null,
    });
    expect(r.score).toBe(0);
  });

  it('does not count a too-short description or an invalid URL', () => {
    const r = computeTransparencyScore({ ...complete, description: 'Shop', url: 'javascript:alert(1)' });
    expect(r.missing).toContain('description');
    expect(r.missing).toContain('url');
    expect(r.score).toBe(75);
  });

  it('gives partial credit for partially declared provenance', () => {
    const r = computeTransparencyScore({ ...complete, provenanceKnownShare: 0.5 });
    expect(r.items.provenanceDeclared.earned).toBe(7.5);
    expect(r.score).toBe(92.5);
  });
});
