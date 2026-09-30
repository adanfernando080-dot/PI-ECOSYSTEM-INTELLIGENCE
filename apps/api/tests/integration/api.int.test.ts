/**
 * Integration tests against a REAL PostgreSQL database (migrated + seeded by
 * tests/integration/global-setup.ts). Run with:  npm run test:integration
 */
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import pino from 'pino';
import { disconnectPrisma, getPrisma } from '@pi/database';
import { createApp } from '../../src/app';
import { signToken } from '../../src/auth/jwt';
import { createPrismaRepositories } from '../../src/repositories/prisma';

const env = {
  NODE_ENV: 'test' as const,
  JWT_SECRET: process.env.JWT_SECRET ?? 'integration-secret-integration-secret-123',
  JWT_ISSUER: 'pi-ecosystem-intelligence',
  CORS_ORIGINS: ['http://localhost:5173'],
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 10_000,
  RATE_LIMIT_WRITE_MAX: 10_000,
  REDIS_URL: undefined,
};
const prisma = getPrisma();
const { app, close } = createApp({
  env,
  repos: createPrismaRepositories(prisma),
  logger: pino({ level: 'silent' }),
  healthCheck: async () => {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  },
});

async function tokenFor(piUsername: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { piUsername } });
  return `Bearer ${signToken(user.id, env.JWT_SECRET, env.JWT_ISSUER)}`;
}

afterAll(async () => {
  await close();
  await disconnectPrisma();
});

describe('database-backed API', () => {
  it('reports a healthy database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.data).toEqual({ status: 'ok', database: true });
  });

  it('GET /api/apps lists the 12 demo apps with metrics', async () => {
    const res = await request(app).get('/api/apps?limit=50&sort=activity');
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination.total).toBe(12);
    expect(res.body.meta.containsDemoData).toBe(true);
    expect(res.body.data.every((a: { isDemo: boolean }) => a.isDemo)).toBe(true);
    expect(res.body.data[0].metrics).not.toBeNull();
  });

  it('GET /api/apps/:slug and history (90 days computed by the seed)', async () => {
    const detail = await request(app).get('/api/apps/pimarket');
    expect(detail.status).toBe(200);
    expect(detail.body.data.breakdown.observableEconomicActivity.label).toBe('observable_economic_activity');
    const history = await request(app).get(`/api/apps/${detail.body.data.id}/history?range=90d&period=30d`);
    expect(history.body.data.points).toHaveLength(90);
  });

  it('GET /api/rankings/:type returns the latest snapshot batch', async () => {
    for (const type of ['activity', 'growth', 'economic', 'community', 'transparency', 'trending', 'rising', 'new']) {
      const res = await request(app).get(`/api/rankings/${type}?period=30d`);
      expect(res.status).toBe(200);
      expect(res.body.data.computedAt).not.toBeNull();
    }
    const community = await request(app).get('/api/rankings/community?period=30d');
    expect(community.body.data.entries.map((e: { app: { slug: string } }) => e.app.slug)).not.toContain('pitools');
  });

  it('GET /api/discover filters by intent', async () => {
    const res = await request(app).get('/api/discover?intent=buy');
    expect(res.body.data.map((a: { slug: string }) => a.slug).sort()).toEqual(['pimarket', 'pistore']);
  });

  it('review lifecycle: submit (PENDING) → moderate → published', async () => {
    const user = await prisma.user.findFirstOrThrow({
      where: { role: 'USER', reviews: { none: { app: { slug: 'pijobs' } } } },
    });
    const submit = await request(app)
      .post('/api/apps/pijobs/reviews')
      .set('Authorization', `Bearer ${signToken(user.id, env.JWT_SECRET, env.JWT_ISSUER)}`)
      .send({ rating: 5, review: 'Integration test review text.' });
    expect(submit.status).toBe(201);
    expect(submit.body.data.status).toBe('PENDING');

    const moderated = await request(app)
      .patch(`/api/admin/reviews/${submit.body.data.id}`)
      .set('Authorization', await tokenFor('demo_admin'))
      .send({ status: 'PUBLISHED' });
    expect(moderated.status).toBe(200);
    expect(moderated.body.data.status).toBe('PUBLISHED');
  });

  it('developer flow: register app, declare metrics (DEVELOPER_REPORTED), cannot touch others', async () => {
    const dev = await tokenFor('demo_dev_ai');
    const created = await request(app)
      .post('/api/developers/apps')
      .set('Authorization', dev)
      .send({ name: `Integration App ${Date.now()}`, categorySlug: 'ai', url: 'https://example.com' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');

    const declared = await request(app)
      .post(`/api/developers/apps/${created.body.data.id}/metrics`)
      .set('Authorization', dev)
      .send({
        metrics: [
          { metricType: 'TRANSACTION_COUNT', value: 42, periodStart: '2026-01-01T00:00:00Z', periodEnd: '2026-01-02T00:00:00Z' },
          { metricType: 'ACTIVE_USERS', value: null, periodStart: '2026-01-01T00:00:00Z', periodEnd: '2026-01-02T00:00:00Z' },
        ],
      });
    expect(declared.status).toBe(201);
    const rows = await prisma.rawMetric.findMany({ where: { appId: created.body.data.id }, orderBy: { metricType: 'asc' } });
    expect(rows.map((r) => r.provenance).sort()).toEqual(['DEVELOPER_REPORTED', 'UNAVAILABLE']);

    const forbidden = await request(app)
      .patch('/api/developers/apps/pimarket')
      .set('Authorization', dev)
      .send({ name: 'Not mine' });
    expect(forbidden.status).toBe(403);
  });

  it('app_metrics history is append-only at the database level', async () => {
    const row = await prisma.appMetric.findFirstOrThrow();
    await expect(prisma.appMetric.update({ where: { id: row.id }, data: { confidenceScore: 1 } })).rejects.toThrow();
  });

  it('admin recalculation appends rows instead of overwriting', async () => {
    const before = await prisma.appMetric.count();
    const res = await request(app)
      .post('/api/admin/recalculate')
      .set('Authorization', await tokenFor('demo_admin'))
      .send({});
    expect(res.status).toBe(200);
    expect(await prisma.appMetric.count()).toBeGreaterThan(before);
  });
});
