/**
 * In-memory implementation of the repository ports, populated from the DEMO
 * dataset and the real metrics engine. Used by unit tests (no database) and
 * by the HTTP tests that run the Express app without PostgreSQL.
 */
import { randomUUID } from 'node:crypto';
import { demoToEngineInputs } from '@pi/database/demo-engine';
import { generateDemoDataset } from '@pi/database/demo';
import { computeRankings, computeSnapshot, type AppMetricRow } from '@pi/metrics';
import { PERIODS, type Period, type RankingType } from '@pi/shared';
import type { AuthUser } from '../../src/auth/policies';
import type { Repositories } from '../../src/domain/ports';
import type {
  AnomalyRecord,
  AppRecord,
  CategoryRecord,
  ClaimRecord,
  DeclaredMetric,
  DeveloperRecord,
  MetricRecord,
  RankingBatch,
  ReviewRecord,
} from '../../src/domain/types';

export const DEMO_AS_OF = new Date('2026-09-28T00:00:00Z');

export interface MemoryState {
  categories: CategoryRecord[];
  developers: (DeveloperRecord & { userId: string | null })[];
  users: (AuthUser & { createdAt: Date; displayName: string })[];
  apps: AppRecord[];
  metrics: MetricRecord[];
  rankings: RankingBatch[];
  reviews: ReviewRecord[];
  favorites: { userId: string; appId: string }[];
  declared: (DeclaredMetric & { appId: string; declaredBy: string })[];
  claims: ClaimRecord[];
  anomalies: AnomalyRecord[];
  pipelineRuns: Date[];
}

const toMetric = (r: AppMetricRow, createdAt: Date): MetricRecord => ({ ...r, createdAt });

export function createMemoryState(): MemoryState {
  const ds = generateDemoDataset({ asOf: DEMO_AS_OF });
  const inputs = demoToEngineInputs(ds);

  const categories = ds.categories.map(({ id, name, slug, description }) => ({ id, name, slug, description }));
  const developers = ds.developers.map((d) => ({
    id: d.id,
    piUsername: d.piUsername,
    displayName: d.displayName,
    verificationStatus: d.verificationStatus,
    userId: d.userId,
  }));
  const devByUser = new Map(ds.developers.map((d) => [d.userId, d.id]));
  const users = ds.users.map((u) => ({
    id: u.id,
    piUsername: u.piUsername,
    role: u.role,
    developerId: devByUser.get(u.id) ?? null,
    createdAt: u.createdAt,
    displayName: u.displayName,
  }));
  const apps: AppRecord[] = ds.apps.map((a) => ({
    ...a,
    isDemo: true,
    createdAt: a.firstSeenAt,
    updatedAt: a.firstSeenAt,
    category: categories.find((c) => c.id === a.categoryId) ?? null,
    developer: developers.find((d) => d.id === a.developerId) ?? null,
  }));

  // Metrics for the last 30 days, every period — computed by the real engine.
  const metrics: MetricRecord[] = [];
  const latest = new Map<Period, Map<string, AppMetricRow>>();
  for (let i = 29; i >= 0; i--) {
    const asOf = new Date(DEMO_AS_OF.getTime() - i * 86_400_000);
    for (const period of PERIODS) {
      const rows = computeSnapshot({ ...inputs, asOf, period });
      metrics.push(...rows.map((r) => toMetric(r, asOf)));
      if (i === 0) latest.set(period, new Map(rows.map((r) => [r.appId, r])));
    }
  }
  const rankings: RankingBatch[] = [];
  for (const period of PERIODS) {
    const all = computeRankings(inputs.apps, latest, period, DEMO_AS_OF);
    for (const [type, entries] of Object.entries(all)) {
      rankings.push({
        type: type as RankingType,
        period,
        computedAt: DEMO_AS_OF,
        rows: entries.map((e) => ({ appId: e.appId, rank: e.rank, score: e.score, confidence: e.confidence, isDemo: true })),
      });
    }
  }

  const reviews: ReviewRecord[] = ds.reviews.map((r) => ({
    ...r,
    authorName: users.find((u) => u.id === r.userId)?.displayName ?? null,
    moderationNote: null,
    isDemo: true,
    updatedAt: r.createdAt,
  }));

  return {
    categories,
    developers,
    users,
    apps,
    metrics,
    rankings,
    reviews,
    favorites: [],
    declared: [],
    claims: [],
    anomalies: [],
    pipelineRuns: [],
  };
}

function page<T>(items: T[], p: number, limit: number) {
  return { items: items.slice((p - 1) * limit, (p - 1) * limit + limit), total: items.length };
}

export function createMemoryRepositories(state: MemoryState = createMemoryState()): Repositories & { state: MemoryState } {
  const withRelations = (a: AppRecord): AppRecord => ({
    ...a,
    category: state.categories.find((c) => c.id === a.category?.id) ?? a.category,
    developer: state.developers.find((d) => d.id === a.developerId) ?? null,
  });

  return {
    state,
    apps: {
      async list(filter) {
        const q = filter.search?.toLowerCase();
        return state.apps
          .filter((a) => filter.statuses.includes(a.status))
          .filter((a) => !filter.categorySlugs || (a.category && filter.categorySlugs.includes(a.category.slug)))
          .filter(
            (a) =>
              !q ||
              a.name.toLowerCase().includes(q) ||
              (a.description ?? '').toLowerCase().includes(q) ||
              a.tags.includes(q),
          )
          .map(withRelations);
      },
      async findById(id) {
        const a = state.apps.find((x) => x.id === id);
        return a ? withRelations(a) : null;
      },
      async findBySlug(slug) {
        const a = state.apps.find((x) => x.slug === slug);
        return a ? withRelations(a) : null;
      },
      async listByDeveloper(developerId) {
        return state.apps.filter((a) => a.developerId === developerId).map(withRelations);
      },
      async create(data) {
        const now = new Date();
        const app: AppRecord = {
          id: randomUUID(),
          name: data.name,
          slug: data.slug,
          description: data.description,
          url: data.url,
          logoUrl: data.logoUrl,
          status: 'PENDING',
          tags: data.tags,
          methodologyNote: data.methodologyNote,
          isDemo: false,
          firstSeenAt: now,
          lastSeenAt: null,
          createdAt: now,
          updatedAt: now,
          developerId: data.developerId,
          category: state.categories.find((c) => c.id === data.categoryId) ?? null,
          developer: null,
        };
        state.apps.push(app);
        return withRelations(app);
      },
      async update(id, changes) {
        const app = state.apps.find((a) => a.id === id);
        if (!app) throw new Error('not found');
        const { categoryId, ...rest } = changes;
        for (const [k, v] of Object.entries(rest)) if (v !== undefined) (app as unknown as Record<string, unknown>)[k] = v;
        if (categoryId !== undefined) app.category = state.categories.find((c) => c.id === categoryId) ?? null;
        app.updatedAt = new Date();
        return withRelations(app);
      },
    },
    metrics: {
      async latestFor(appIds, period) {
        const out = new Map<string, MetricRecord>();
        for (const m of state.metrics) {
          if (m.period !== period || !appIds.includes(m.appId)) continue;
          const cur = out.get(m.appId);
          if (!cur || m.periodEnd > cur.periodEnd || (+m.periodEnd === +cur.periodEnd && m.createdAt > cur.createdAt)) out.set(m.appId, m);
        }
        return out;
      },
      async history(appId, period, from, to) {
        const byDay = new Map<number, MetricRecord>();
        for (const m of state.metrics) {
          if (m.appId !== appId || m.period !== period || m.periodEnd <= from || m.periodEnd > to) continue;
          const cur = byDay.get(+m.periodEnd);
          if (!cur || m.createdAt > cur.createdAt) byDay.set(+m.periodEnd, m);
        }
        return [...byDay.values()].sort((a, b) => +a.periodEnd - +b.periodEnd);
      },
    },
    rankings: {
      async latestBatch(type, period) {
        return (
          state.rankings
            .filter((r) => r.type === type && r.period === period)
            .sort((a, b) => +b.computedAt - +a.computedAt)[0] ?? null
        );
      },
    },
    reviews: {
      async list(filter, p, limit) {
        const items = state.reviews
          .filter((r) => filter.statuses.includes(r.status) && (!filter.appId || r.appId === filter.appId))
          .sort((a, b) => +b.createdAt - +a.createdAt);
        return page(items, p, limit);
      },
      async summary(appId) {
        const pub = state.reviews.filter((r) => r.appId === appId && r.status === 'PUBLISHED');
        return {
          count: pub.length,
          average: pub.length === 0 ? null : pub.reduce((a, r) => a + r.rating, 0) / pub.length,
        };
      },
      async findByAppAndUser(appId, userId) {
        return state.reviews.find((r) => r.appId === appId && r.userId === userId) ?? null;
      },
      async findById(id) {
        return state.reviews.find((r) => r.id === id) ?? null;
      },
      async countByUserSince(userId, since) {
        return state.reviews.filter((r) => r.userId === userId && r.createdAt >= since).length;
      },
      async create(data) {
        const now = new Date();
        const review: ReviewRecord = {
          id: randomUUID(),
          appId: data.appId,
          userId: data.userId,
          authorName: state.users.find((u) => u.id === data.userId)?.displayName ?? null,
          rating: data.rating,
          review: data.review,
          status: data.status,
          moderationNote: null,
          isDemo: false,
          createdAt: now,
          updatedAt: now,
        };
        state.reviews.push(review);
        return review;
      },
      async moderate(id, status, note) {
        const r = state.reviews.find((x) => x.id === id)!;
        r.status = status;
        r.moderationNote = note;
        return r;
      },
    },
    categories: {
      async list() {
        return [...state.categories].sort((a, b) => a.name.localeCompare(b.name));
      },
      async findBySlug(slug) {
        return state.categories.find((c) => c.slug === slug) ?? null;
      },
      async findById(id) {
        return state.categories.find((c) => c.id === id) ?? null;
      },
      async create(data) {
        const c = { id: randomUUID(), ...data };
        state.categories.push(c);
        return c;
      },
      async update(id, data) {
        const c = state.categories.find((x) => x.id === id)!;
        Object.assign(c, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
        return c;
      },
    },
    users: {
      async findAuthUser(id) {
        const u = state.users.find((x) => x.id === id);
        return u ? { id: u.id, piUsername: u.piUsername, role: u.role, developerId: u.developerId, createdAt: u.createdAt } : null;
      },
    },
    developers: {
      async findById(id) {
        return state.developers.find((d) => d.id === id) ?? null;
      },
      async ensureForUser(user) {
        const existing = state.developers.find((d) => d.userId === user.id);
        if (existing) return existing;
        const dev = { id: randomUUID(), piUsername: user.piUsername, displayName: null, verificationStatus: 'UNVERIFIED' as const, userId: user.id };
        state.developers.push(dev);
        const u = state.users.find((x) => x.id === user.id);
        if (u) u.developerId = dev.id;
        user.developerId = dev.id;
        return dev;
      },
    },
    favorites: {
      async list(userId) {
        return state.favorites.filter((f) => f.userId === userId).map((f) => f.appId);
      },
      async add(userId, appId) {
        if (!state.favorites.some((f) => f.userId === userId && f.appId === appId)) state.favorites.push({ userId, appId });
      },
      async remove(userId, appId) {
        state.favorites = state.favorites.filter((f) => !(f.userId === userId && f.appId === appId));
      },
    },
    rawMetrics: {
      async createDeclared(appId, metrics, declaredBy) {
        state.declared.push(...metrics.map((m) => ({ ...m, appId, declaredBy })));
        return metrics.length;
      },
    },
    claims: {
      async create(appId, developerId, evidence) {
        const c: ClaimRecord = { id: randomUUID(), appId, developerId, status: 'PENDING', evidence, createdAt: new Date() };
        state.claims.push(c);
        return c;
      },
      async findByAppAndDeveloper(appId, developerId) {
        return state.claims.find((c) => c.appId === appId && c.developerId === developerId) ?? null;
      },
      async findById(id) {
        return state.claims.find((c) => c.id === id) ?? null;
      },
      async list(status, p, limit) {
        return page(state.claims.filter((c) => !status || c.status === status), p, limit);
      },
      async decide(id, status) {
        const c = state.claims.find((x) => x.id === id)!;
        c.status = status;
        return c;
      },
    },
    anomalies: {
      async list(filter, p, limit) {
        return page(
          state.anomalies.filter((a) => (!filter.status || a.status === filter.status) && (!filter.appId || a.appId === filter.appId)),
          p,
          limit,
        );
      },
      async findById(id) {
        return state.anomalies.find((a) => a.id === id) ?? null;
      },
      async updateStatus(id, status) {
        const a = state.anomalies.find((x) => x.id === id)!;
        a.status = status;
        return a;
      },
    },
    pipeline: {
      async run(asOf) {
        state.pipelineRuns.push(asOf);
        return { metrics: 0, rankings: 0, anomalies: 0 };
      },
    },
  };
}

/** Convenience lookups for tests. */
export function userByName(state: MemoryState, piUsername: string): AuthUser {
  const u = state.users.find((x) => x.piUsername === piUsername);
  if (!u) throw new Error(`no user ${piUsername}`);
  return { id: u.id, piUsername: u.piUsername, role: u.role, developerId: u.developerId };
}

export function appBySlug(state: MemoryState, slug: string): AppRecord {
  const a = state.apps.find((x) => x.slug === slug);
  if (!a) throw new Error(`no app ${slug}`);
  return a;
}
