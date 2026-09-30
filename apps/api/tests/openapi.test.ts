import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '../src/openapi/document';
import { AppDetailSchema, AppSummarySchema, HistorySchema, RankingSchema, ReviewSchema } from '../src/schemas/responses';
import { getAppDetail, getAppHistory, listApps } from '../src/services/apps.service';
import { getRanking } from '../src/services/rankings.service';
import { listReviews } from '../src/services/reviews.service';
import { createMemoryRepositories } from './support/memory-repos';

const repos = createMemoryRepositories();

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument();

  it('documents every endpoint required by the frontend', () => {
    const required: [string, string][] = [
      ['get', '/api/apps'],
      ['get', '/api/apps/{slug}'],
      ['get', '/api/apps/{id}/history'],
      ['get', '/api/rankings/{type}'],
      ['get', '/api/discover'],
      ['get', '/api/apps/{id}/reviews'],
      ['post', '/api/apps/{id}/reviews'],
      ['get', '/api/developers/apps'],
      ['post', '/api/developers/apps'],
      ['post', '/api/developers/apps/{id}/metrics'],
    ];
    for (const [method, path] of required) {
      expect(doc.paths[path]?.[method]).toBeDefined();
    }
  });

  it('is a valid-looking OpenAPI 3.1 document with resolvable refs', () => {
    expect(doc.openapi).toBe('3.1.0');
    const refs = JSON.stringify(doc).match(/#\/components\/schemas\/[A-Za-z]+/g) ?? [];
    for (const ref of new Set(refs)) {
      const name = ref.split('/').pop()!;
      expect(doc.components.schemas[name]).toBeDefined();
    }
    expect(JSON.stringify(doc)).not.toContain('#/$defs/');
  });

  it('marks protected endpoints with bearer auth and the required role', () => {
    const op = doc.paths['/api/developers/apps/{id}/metrics']!.post as Record<string, unknown>;
    expect(op['x-required-role']).toBe('DEVELOPER');
    expect(JSON.stringify(op.security)).toContain('bearerAuth');
  });

  it('contains no merit vocabulary', () => {
    expect(JSON.stringify(doc)).not.toMatch(/best_app|winner/);
  });
});

describe('response contract (presenters ⇄ documented schemas)', () => {
  it('app list, detail, history, ranking and reviews match their schemas', async () => {
    const list = await listApps(repos, { page: 1, limit: 20, sort: 'name', period: '30d' }, null);
    for (const a of list.data) expect(AppSummarySchema.safeParse(a).success).toBe(true);

    const detail = await getAppDetail(repos, 'pimarket', '30d', null);
    expect(AppDetailSchema.safeParse(detail.data).success).toBe(true);

    const history = await getAppHistory(repos, 'pimarket', '30d', '7d', null);
    expect(HistorySchema.safeParse(history.data).success).toBe(true);

    const ranking = await getRanking(repos, 'growth', { period: '30d', limit: 10 });
    expect(RankingSchema.safeParse(ranking.data).success).toBe(true);

    const reviews = await listReviews(repos, 'pimarket', 1, 5, null);
    for (const r of reviews.data) expect(ReviewSchema.safeParse(r).success).toBe(true);
  });
});
