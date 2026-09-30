import { describe, expect, it } from 'vitest';
import { collectReviewSignals, sanitizeText } from '../src';

describe('sanitizeText', () => {
  it('strips HTML tags and control characters and collapses spaces', () => {
    expect(sanitizeText('  <b>Great</b>   app<script>x</script>\u0007 ')).toBe('Great app x');
  });

  it('keeps line breaks but limits blank lines', () => {
    expect(sanitizeText('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('collectReviewSignals', () => {
  it('collects neutral context facts, never a verdict', () => {
    const s = collectReviewSignals({
      text: 'aaaaaaaaab see www.example.com',
      rating: 5,
      accountCreatedAt: new Date('2026-09-27T00:00:00Z'),
      submittedAt: new Date('2026-09-29T12:00:00Z'),
      userReviewsLast24h: 3,
    });
    expect(s).toMatchObject({ accountAgeDays: 2, userReviewsLast24h: 3, containsUrl: true });
    expect(Object.keys(s).some((k) => /fake|fraud|spam|scam/i.test(k))).toBe(false);
  });
});
