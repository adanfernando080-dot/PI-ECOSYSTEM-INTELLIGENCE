import { describe, expect, it } from 'vitest';
import { findMeritTerms, findVerdictTerms, RANKING_TYPES } from '@pi/shared';
import { compareApps, getAppDetail, getAppHistory, listApps } from '../src/services/apps.service';
import { discover } from '../src/services/discovery.service';
import { getRanking } from '../src/services/rankings.service';
import { createReview, listReviews } from '../src/services/reviews.service';
import {
  claimApp,
  declareMetrics,
  listDeveloperApps,
  registerApp,
  slugify,
  updateDeveloperApp,
} from '../src/services/developers.service';
import { decideClaim, moderateReview, recalculate, setAppStatus } from '../src/services/admin.service';
import { addFavorite, listFavorites, removeFavorite } from '../src/services/me.service';
import { appBySlug, createMemoryRepositories, DEMO_AS_OF, userByName } from './support/memory-repos';

const repos = createMemoryRepositories();
const { state } = repos;
const now = new Date(DEMO_AS_OF.getTime() + 86_400_000 + 3_600_000);
const admin = userByName(state, 'demo_admin');
const alice = userByName(state, 'demo_user_01');
const devMarket = userByName(state, 'demo_dev_market');
const devJobs = userByName(state, 'demo_dev_jobs');

describe('apps service', () => {
  it('lists ACTIVE apps with pagination meta and the demo flag', async () => {
    const r = await listApps(repos, { page: 1, limit: 5, sort: 'name', period: '30d' }, null);
    expect(r.data).toHaveLength(5);
    expect(r.meta.pagination).toEqual({ page: 1, limit: 5, total: 12, totalPages: 3 });
    expect(r.meta.containsDemoData).toBe(true);
    expect(r.data[0]!.isDemo).toBe(true);
    expect(r.data.map((a) => a.name)).toEqual([...r.data.map((a) => a.name)].sort((a, b) => a.localeCompare(b)));
  });

  it('paginates without overlap', async () => {
    const p1 = await listApps(repos, { page: 1, limit: 5, sort: 'name', period: '30d' }, null);
    const p3 = await listApps(repos, { page: 3, limit: 5, sort: 'name', period: '30d' }, null);
    expect(p3.data).toHaveLength(2);
    expect(p1.data.map((a) => a.id).some((id) => p3.data.some((b) => b.id === id))).toBe(false);
  });

  it('sorts by a score with unavailable values last', async () => {
    const r = await listApps(repos, { page: 1, limit: 20, sort: 'community', period: '30d' }, null);
    const scores = r.data.map((a) => a.metrics?.scores.community ?? null);
    expect(scores[scores.length - 1]).toBeNull();
    const available = scores.filter((s): s is number => s !== null);
    expect(available).toEqual([...available].sort((a, b) => b - a));
  });

  it('filters by category and searches', async () => {
    const byCat = await listApps(repos, { page: 1, limit: 20, sort: 'name', period: '30d', category: 'games' }, null);
    expect(byCat.data.map((a) => a.slug)).toEqual(['pigames']);
    const search = await listApps(repos, { page: 1, limit: 20, sort: 'name', period: '30d', q: 'marketplace' }, null);
    expect(search.data.map((a) => a.slug)).toContain('pimarket');
  });

  it('restricts non-public statuses to admins', async () => {
    await expect(listApps(repos, { page: 1, limit: 20, sort: 'name', period: '30d', status: 'PENDING' }, alice)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const r = await listApps(repos, { page: 1, limit: 20, sort: 'name', period: '30d', status: 'PENDING' }, admin);
    expect(r.data.every((a) => a.status === 'PENDING')).toBe(true);
  });

  it('returns app detail by slug or id, with breakdown, staking kept apart', async () => {
    const bySlug = await getAppDetail(repos, 'pimarket', '30d', null);
    const byId = await getAppDetail(repos, appBySlug(state, 'pimarket').id, '30d', null);
    expect(byId.data.id).toBe(bySlug.data.id);
    expect(bySlug.data.metrics!.staking.includedInScores).toBe(false);
    expect(bySlug.data.metrics!.staking.stakedPi).not.toBeNull();
    expect(bySlug.data.breakdown).not.toBeNull();
    expect(bySlug.data.metrics!.scores).toHaveProperty('observableEconomicActivity');
    expect(JSON.stringify(bySlug.data).toLowerCase()).not.toContain('revenue');
  });

  it('404s on unknown apps', async () => {
    await expect(getAppDetail(repos, 'nope', '30d', null)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns history for 7d / 30d ranges without zero-filling', async () => {
    const h7 = await getAppHistory(repos, 'pimarket', '7d', '7d', null, now);
    const h30 = await getAppHistory(repos, 'pimarket', '30d', '7d', null, now);
    expect(h7.data.points).toHaveLength(7);
    expect(h30.data.points).toHaveLength(30);
    const dates = h30.data.points.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates[dates.length - 1]).toBe('2026-09-28');
  });

  it('compares apps without designating a preferable one', async () => {
    const r = await compareApps(repos, ['pimarket', 'pistore'], '30d', null);
    expect(r.data).toHaveLength(2);
    expect(r.meta.note).toMatch(/does not designate/);
  });
});

describe('rankings service', () => {
  it('serves every analytical ranking type', async () => {
    for (const type of RANKING_TYPES) {
      const r = await getRanking(repos, type, { period: '30d', limit: 50 });
      expect(r.data.type).toBe(type);
      expect(findMeritTerms(JSON.stringify(r))).toEqual([]);
    }
  });

  it('orders entries by rank and applies limit / minConfidence', async () => {
    const r = await getRanking(repos, 'activity', { period: '30d', limit: 5 });
    expect(r.data.entries).toHaveLength(5);
    const ranks = r.data.entries.map((e) => e.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const filtered = await getRanking(repos, 'activity', { period: '30d', limit: 50, minConfidence: 80 });
    expect(filtered.data.entries.every((e) => e.confidence >= 80)).toBe(true);
  });

  it('does not rank apps without community data', async () => {
    const r = await getRanking(repos, 'community', { period: '30d', limit: 50 });
    expect(r.data.entries.map((e) => e.app.slug)).not.toContain('pitools');
  });

  it('reports NOT_COMPUTED when no snapshot exists', async () => {
    const empty = createMemoryRepositories({ ...createMemoryRepositories().state, rankings: [] });
    const r = await getRanking(empty, 'growth', { period: '7d', limit: 10 });
    expect(r.data.entries).toEqual([]);
    expect(r.meta.status).toBe('NOT_COMPUTED');
  });
});

describe('discovery service', () => {
  it('maps intents to categories', async () => {
    const r = await discover(repos, { intent: 'learn', sort: 'activity', period: '30d', page: 1, limit: 20 });
    expect(r.data.map((a) => a.slug)).toEqual(['pilearn']);
    const buy = await discover(repos, { intent: 'buy', sort: 'activity', period: '30d', page: 1, limit: 20 });
    expect(buy.data.map((a) => a.slug).sort()).toEqual(['pimarket', 'pistore']);
  });

  it('intersects intent and category', async () => {
    const r = await discover(repos, { intent: 'buy', category: 'games', sort: 'name', period: '30d', page: 1, limit: 20 });
    expect(r.data).toHaveLength(0);
  });

  it('filters by minimum confidence', async () => {
    const r = await discover(repos, { sort: 'confidence', minConfidence: 90, period: '30d', page: 1, limit: 20 });
    expect(r.data.length).toBeGreaterThan(0);
    expect(r.data.every((a) => a.metrics!.confidence.score >= 90)).toBe(true);
  });
});

describe('reviews service', () => {
  it('lists published reviews only', async () => {
    const r = await listReviews(repos, 'pimarket', 1, 100, null);
    expect(r.data.every((x) => x.status === 'PUBLISHED')).toBe(true);
    expect(r.meta.pagination.total).toBe(r.data.length);
  });

  it('requires authentication to post', async () => {
    await expect(createReview(repos, 'pimarket', { rating: 4, review: 'Nice enough app' }, null, now)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('creates a PENDING review with neutral signals, once per user and app', async () => {
    const user = userByName(state, 'demo_user_60');
    const target = state.apps.find(
      (a) => a.status === 'ACTIVE' && !state.reviews.some((r) => r.userId === user.id && r.appId === a.id),
    )!.slug;
    const r = await createReview(repos, target, { rating: 4, review: 'Clear lessons, fair price.' }, user, now);
    expect(r.status).toBe(201);
    expect(r.data.status).toBe('PENDING');
    await expect(createReview(repos, target, { rating: 5, review: 'Posting a second time' }, user, now)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('prevents a developer from reviewing their own app', async () => {
    await expect(createReview(repos, 'pimarket', { rating: 5, review: 'Our app is great!' }, devMarket, now)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets an admin publish a pending review', async () => {
    const pending = state.reviews.find((r) => r.status === 'PENDING')!;
    const r = await moderateReview(repos, pending.id, { status: 'PUBLISHED', moderationNote: 'ok' }, admin);
    expect(r.data.status).toBe('PUBLISHED');
    await expect(moderateReview(repos, pending.id, { status: 'HIDDEN' }, alice)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('developers service', () => {
  it('lists only the developer’s own apps', async () => {
    const r = await listDeveloperApps(repos, devMarket);
    expect(r.data.map((a) => a.slug)).toEqual(['pimarket']);
    await expect(listDeveloperApps(repos, alice)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('registers a PENDING app with a derived slug and rejects duplicates', async () => {
    const r = await registerApp(repos, { name: 'Pi Écoles Plus', categorySlug: 'education', tags: [] }, devJobs);
    expect(r.status).toBe(201);
    expect(r.data.slug).toBe('pi-ecoles-plus');
    expect(r.data.status).toBe('PENDING');
    await expect(registerApp(repos, { name: 'Pi Ecoles Plus', tags: [] }, devJobs)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(registerApp(repos, { name: 'X app', categorySlug: 'unknown', tags: [] }, devJobs)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('only lets a developer modify their own app', async () => {
    const ok = await updateDeveloperApp(repos, 'pimarket', { methodologyNote: 'Updated method' }, devMarket);
    expect(ok.data.slug).toBe('pimarket');
    await expect(updateDeveloperApp(repos, 'pimarket', { name: 'Hijacked' }, devJobs)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('stores declared metrics as DEVELOPER_REPORTED, null as UNAVAILABLE', async () => {
    const r = await declareMetrics(
      repos,
      'pimarket',
      {
        metrics: [
          { metricType: 'TRANSACTION_COUNT', value: 120, periodStart: new Date('2026-09-27T00:00:00Z'), periodEnd: new Date('2026-09-28T00:00:00Z') },
          { metricType: 'ACTIVE_USERS', value: null, periodStart: new Date('2026-09-27T00:00:00Z'), periodEnd: new Date('2026-09-28T00:00:00Z') },
        ],
      },
      devMarket,
      now,
    );
    expect(r.data.stored).toBe(2);
    const stored = state.declared.slice(-2);
    expect(stored.map((m) => m.provenance)).toEqual(['DEVELOPER_REPORTED', 'UNAVAILABLE']);
    expect(stored.some((m) => m.provenance === 'OBSERVABLE')).toBe(false);
  });

  it('rejects invalid declared metrics and other developers’ apps', async () => {
    const bad = {
      metrics: [{ metricType: 'TRANSACTION_COUNT' as const, value: 1.5, periodStart: new Date('2026-09-27T00:00:00Z'), periodEnd: new Date('2026-09-28T00:00:00Z') }],
    };
    await expect(declareMetrics(repos, 'pimarket', bad, devMarket, now)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(declareMetrics(repos, 'pimarket', { metrics: [] }, devJobs, now)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('handles claims through admin approval', async () => {
    const claim = await claimApp(repos, 'pitools', 'We operate pitools, see DNS TXT record.', devJobs);
    expect(claim.status).toBe(202);
    await expect(claimApp(repos, 'pitools', 'Second claim attempt here', devJobs)).rejects.toMatchObject({ code: 'CONFLICT' });
    await decideClaim(repos, claim.data.id, 'APPROVED', admin);
    expect(appBySlug(state, 'pitools').developerId).toBe(devJobs.developerId);
    await expect(decideClaim(repos, claim.data.id, 'REJECTED', admin)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('slugifies names', () => {
    expect(slugify('  PiAI Hub!! ')).toBe('piai-hub');
    expect(slugify('Café Été')).toBe('cafe-ete');
  });
});

describe('admin & me services', () => {
  it('validates apps and recalculates only as admin', async () => {
    const pending = state.apps.find((a) => a.status === 'PENDING')!;
    const r = await setAppStatus(repos, pending.id, 'ACTIVE', admin);
    expect(r.data.status).toBe('ACTIVE');
    await expect(setAppStatus(repos, pending.id, 'REJECTED', devMarket)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const rec = await recalculate(repos, '2026-09-28', admin, now);
    expect(rec.data.asOf).toBe('2026-09-28');
    await expect(recalculate(repos, '2030-01-01', admin, now)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('manages favorites', async () => {
    const app = appBySlug(state, 'pijobs');
    await addFavorite(repos, app.id, alice);
    await addFavorite(repos, app.id, alice);
    expect((await listFavorites(repos, alice)).data.map((a) => a.slug)).toEqual(['pijobs']);
    await removeFavorite(repos, app.id, alice);
    expect((await listFavorites(repos, alice)).data).toHaveLength(0);
    await expect(listFavorites(repos, null)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('never produces verdict vocabulary in public outputs', async () => {
    const outputs = await Promise.all([
      listApps(repos, { page: 1, limit: 20, sort: 'activity', period: '30d' }, null),
      getAppDetail(repos, 'pigames', '30d', null),
      discover(repos, { sort: 'activity', period: '7d', page: 1, limit: 20 }),
    ]);
    // Demo review texts are fictional user content; only engine output is checked here.
    const text = JSON.stringify(outputs);
    expect(findVerdictTerms(text)).toEqual([]);
    expect(findMeritTerms(text)).toEqual([]);
  });
});
