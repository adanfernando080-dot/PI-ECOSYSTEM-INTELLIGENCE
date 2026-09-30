import { describe, expect, it } from 'vitest';
import { AppError } from '@pi/shared';
import { parseOrThrow } from '../src/http/route';
import { CompareQuery, HistoryQuery, ListAppsQuery } from '../src/schemas/apps';
import { DiscoverQuery, RankingParams, RankingQuery } from '../src/schemas/rankings';
import { CreateAppBody, CreateReviewBody, DeclareMetricsBody } from '../src/schemas/writes';

describe('query validation', () => {
  it('applies pagination defaults and coerces strings', () => {
    expect(ListAppsQuery.parse({})).toMatchObject({ page: 1, limit: 20, sort: 'name', period: '30d' });
    expect(ListAppsQuery.parse({ page: '3', limit: '50' })).toMatchObject({ page: 3, limit: 50 });
  });

  it('rejects out-of-range pagination and unknown enums', () => {
    expect(ListAppsQuery.safeParse({ limit: '500' }).success).toBe(false);
    expect(ListAppsQuery.safeParse({ page: '0' }).success).toBe(false);
    expect(ListAppsQuery.safeParse({ sort: 'best' }).success).toBe(false);
    expect(ListAppsQuery.safeParse({ category: 'Robert"); DROP' }).success).toBe(false);
  });

  it('only accepts documented ranking types and periods', () => {
    expect(RankingParams.safeParse({ type: 'activity' }).success).toBe(true);
    expect(RankingParams.safeParse({ type: 'best_apps' }).success).toBe(false);
    expect(RankingParams.safeParse({ type: 'overall' }).success).toBe(false);
    expect(RankingQuery.safeParse({ period: '1y' }).success).toBe(false);
    expect(HistoryQuery.safeParse({ range: '24h' }).success).toBe(false);
  });

  it('validates discovery intent and minConfidence', () => {
    expect(DiscoverQuery.parse({ intent: 'buy', minConfidence: '60' })).toMatchObject({ intent: 'buy', minConfidence: 60 });
    expect(DiscoverQuery.safeParse({ intent: 'gamble' }).success).toBe(false);
    expect(DiscoverQuery.safeParse({ minConfidence: '101' }).success).toBe(false);
  });

  it('parses compare lists of 2 to 4 apps', () => {
    expect(CompareQuery.parse({ apps: 'pimarket, pistore' }).apps).toEqual(['pimarket', 'pistore']);
    expect(CompareQuery.safeParse({ apps: 'pimarket' }).success).toBe(false);
    expect(CompareQuery.safeParse({ apps: 'a,b,c,d,e' }).success).toBe(false);
  });
});

describe('body validation', () => {
  it('validates ratings 1–5 and sanitizes review text', () => {
    expect(CreateReviewBody.parse({ rating: 5, review: '  <b>Very</b> good app indeed ' })).toEqual({
      rating: 5,
      review: 'Very good app indeed',
    });
    expect(CreateReviewBody.safeParse({ rating: 0, review: 'long enough text' }).success).toBe(false);
    expect(CreateReviewBody.safeParse({ rating: 6, review: 'long enough text' }).success).toBe(false);
    expect(CreateReviewBody.safeParse({ rating: 4.5, review: 'long enough text' }).success).toBe(false);
    expect(CreateReviewBody.safeParse({ rating: 4, review: '<p>short</p>' }).success).toBe(false);
  });

  it('only accepts http(s) URLs for apps', () => {
    const base = { name: 'My App' };
    expect(CreateAppBody.safeParse({ ...base, url: 'https://example.com' }).success).toBe(true);
    expect(CreateAppBody.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(CreateAppBody.safeParse({ ...base, url: 'ftp://x.y' }).success).toBe(false);
  });

  it('accepts null (unavailable) declared values but not negative ones', () => {
    const m = { metricType: 'TRANSACTION_COUNT', periodStart: '2026-09-27T00:00:00Z', periodEnd: '2026-09-28T00:00:00Z' };
    expect(DeclareMetricsBody.safeParse({ metrics: [{ ...m, value: null }] }).success).toBe(true);
    expect(DeclareMetricsBody.safeParse({ metrics: [{ ...m, value: -3 }] }).success).toBe(false);
    expect(DeclareMetricsBody.safeParse({ metrics: [{ ...m, value: 3, metricType: 'REVENUE' }] }).success).toBe(false);
    expect(DeclareMetricsBody.safeParse({ metrics: [] }).success).toBe(false);
  });
});

describe('parseOrThrow', () => {
  it('throws a VALIDATION_ERROR with field paths', () => {
    try {
      parseOrThrow(ListAppsQuery, { limit: 'abc' }, 'query');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err instanceof AppError).toBe(true);
      expect((err as AppError).code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify((err as AppError).details)).toContain('query.limit');
    }
  });
});
