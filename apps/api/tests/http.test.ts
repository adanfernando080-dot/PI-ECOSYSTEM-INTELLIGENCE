/**
 * HTTP tests: the real Express app (middleware, auth, RBAC, error envelope,
 * rate limiting) backed by in-memory repositories — no database required.
 */
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import pino from 'pino';
import { createApp } from '../src/app';
import { signToken } from '../src/auth/jwt';
import { appBySlug, createMemoryRepositories, userByName } from './support/memory-repos';

const env = {
  NODE_ENV: 'test' as const,
  JWT_SECRET: 's'.repeat(48),
  JWT_ISSUER: 'pi-ecosystem-intelligence',
  CORS_ORIGINS: ['http://localhost:5173'],
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 1000,
  RATE_LIMIT_WRITE_MAX: 1000,
  REDIS_URL: undefined,
};
const repos = createMemoryRepositories();
const { app, close } = createApp({ env, repos, logger: pino({ level: 'silent' }) });
const token = (username: string) => `Bearer ${signToken(userByName(repos.state, username).id, env.JWT_SECRET, env.JWT_ISSUER)}`;

afterAll(close);

describe('public endpoints', () => {
  it('GET /api/apps returns the envelope with pagination', async () => {
    const res = await request(app).get('/api/apps?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta.pagination).toMatchObject({ page: 1, limit: 5, total: 12, totalPages: 3 });
    expect(res.body.meta.containsDemoData).toBe(true);
  });

  it('GET /api/apps/:slug, /history, /reviews', async () => {
    expect((await request(app).get('/api/apps/pimarket')).body.data.slug).toBe('pimarket');
    const h = await request(app).get('/api/apps/pimarket/history?range=7d');
    expect(h.status).toBe(200);
    expect(h.body.data.points).toHaveLength(7);
    const r = await request(app).get('/api/apps/pimarket/reviews');
    expect(r.status).toBe(200);
    expect(r.body.meta.pagination).toBeDefined();
  });

  it('GET /api/rankings/:type and /api/discover', async () => {
    const r = await request(app).get('/api/rankings/growth?period=30d&limit=3');
    expect(r.status).toBe(200);
    expect(r.body.data.entries).toHaveLength(3);
    const d = await request(app).get('/api/discover?intent=ai');
    expect(d.body.data.map((a: { slug: string }) => a.slug)).toEqual(['piai-hub']);
  });

  it('returns the error envelope on validation errors and unknown routes', async () => {
    const bad = await request(app).get('/api/apps?limit=1000');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect((await request(app).get('/api/rankings/best')).status).toBe(400);
    const missing = await request(app).get('/api/nothing');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('serves OpenAPI and methodology', async () => {
    expect((await request(app).get('/api/openapi.json')).body.openapi).toBe('3.1.0');
    expect((await request(app).get('/api/meta/methodology')).body.data.piEcosystemScore.excludes).toContain('staking');
  });

  it('sets security headers and never leaks x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('health check', () => {
  it('serves the same minimal payload on /api/health and the /health alias', async () => {
    const a = await request(app).get('/api/health');
    const b = await request(app).get('/health');
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(Object.keys(a.body.data).sort()).toEqual(['database', 'status']); // nothing sensitive
  });

  it('reports degraded (not an error) when the database does not answer, on both paths', async () => {
    const failing = createApp({ env, repos, logger: pino({ level: 'silent' }), healthCheck: async () => { throw new Error('secret connection string'); } });
    for (const path of ['/api/health', '/health']) {
      const res = await request(failing.app).get(path);
      expect(res.body.data).toEqual({ status: 'degraded', database: false });
      expect(JSON.stringify(res.body)).not.toContain('secret');
    }
    await failing.close();
  });

  it('keeps business endpoints under /api only (no unprefixed route)', async () => {
    expect((await request(app).get('/apps')).status).toBe(404);
    expect((await request(app).get('/api/apps?limit=1')).status).toBe(200);
  });
});

describe('CORS (Lovable frontend contract)', () => {
  const origin = env.CORS_ORIGINS[0]!;

  it('answers preflight for an allowed origin with the methods and headers the frontend needs', async () => {
    const res = await request(app)
      .options('/api/apps/pimarket/reviews')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  it('does not grant CORS to unknown origins and never uses a wildcard', async () => {
    const res = await request(app).get('/api/apps').set('Origin', 'https://not-allowed.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    const ok = await request(app).get('/api/apps').set('Origin', origin);
    expect(ok.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('also serves /api/openapi.json to the frontend origin and exposes rate-limit headers', async () => {
    const spec = await request(app).get('/api/openapi.json').set('Origin', origin);
    expect(spec.headers['access-control-allow-origin']).toBe(origin);
    const res = await request(app).get('/api/apps').set('Origin', origin);
    expect(res.headers['access-control-expose-headers']).toMatch(/RateLimit/i);
  });
});

describe('authentication and permissions', () => {
  it('rejects posting a review without a token, accepts it with one', async () => {
    const body = { rating: 4, review: 'Solid app, quick payments.' };
    expect((await request(app).post('/api/apps/pijobs/reviews').send(body)).status).toBe(401);
    const user = repos.state.users.find(
      (u) => u.role === 'USER' && !repos.state.reviews.some((r) => r.userId === u.id && r.appId === appBySlug(repos.state, 'pijobs').id),
    )!;
    const ok = await request(app)
      .post('/api/apps/pijobs/reviews')
      .set('Authorization', token(user.piUsername))
      .send(body);
    expect(ok.status).toBe(201);
    expect(ok.body.data.status).toBe('PENDING');
  });

  it('rejects invalid tokens', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  it('enforces roles on developer and admin routes', async () => {
    expect((await request(app).get('/api/developers/apps')).status).toBe(401);
    expect((await request(app).get('/api/developers/apps').set('Authorization', token('demo_user_02'))).status).toBe(403);
    const dev = await request(app).get('/api/developers/apps').set('Authorization', token('demo_dev_market'));
    expect(dev.status).toBe(200);
    expect(dev.body.data.map((a: { slug: string }) => a.slug)).toEqual(['pimarket']);
    expect((await request(app).get('/api/admin/anomalies').set('Authorization', token('demo_dev_market'))).status).toBe(403);
    expect((await request(app).get('/api/admin/anomalies').set('Authorization', token('demo_admin'))).status).toBe(200);
  });

  it('prevents a developer from declaring metrics for another developer’s app', async () => {
    const metrics = [{ metricType: 'TRANSACTION_COUNT', value: 10, periodStart: '2026-09-27T00:00:00Z', periodEnd: '2026-09-28T00:00:00Z' }];
    const res = await request(app)
      .post('/api/developers/apps/pimarket/metrics')
      .set('Authorization', token('demo_dev_jobs'))
      .send({ metrics });
    expect(res.status).toBe(403);
  });

  it('rejects malformed JSON bodies with the error envelope', async () => {
    const res = await request(app)
      .post('/api/apps/pijobs/reviews')
      .set('Authorization', token('demo_user_03'))
      .set('Content-Type', 'application/json')
      .send('{"rating": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('rate limiting', () => {
  it('limits write requests', async () => {
    const limited = createApp({
      env: { ...env, RATE_LIMIT_WRITE_MAX: 2 },
      repos: createMemoryRepositories(),
      logger: pino({ level: 'silent' }),
    });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await request(limited.app).post('/api/apps/pijobs/reviews').send({})).status);
    expect(statuses[2]).toBe(429);
    await limited.close();
  });
});
