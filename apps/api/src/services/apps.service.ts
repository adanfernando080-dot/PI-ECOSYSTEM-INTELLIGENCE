import {
  addDays,
  AppError,
  buildPaginationMeta,
  paginationOffset,
  periodToDays,
  startOfUtcDay,
  type AppStatus,
  type HistoryRange,
  type Period,
} from '@pi/shared';
import { hasRole, type AuthUser } from '../auth/policies';
import type { AppFilter, Repositories } from '../domain/ports';
import {
  demoMeta,
  presentAppDetail,
  presentAppSummary,
  presentHistoryPoint,
} from '../domain/presenters';
import type { AppRecord, MetricRecord } from '../domain/types';

export const PUBLIC_STATUSES: AppStatus[] = ['ACTIVE', 'INACTIVE'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AppSort = 'name' | 'newest' | 'activity' | 'growth' | 'economic' | 'community' | 'transparency' | 'confidence';

/** Resolves an app by UUID or slug. Non-public apps are only visible to admins and their developer. */
export async function resolveApp(repos: Repositories, ref: string, user: AuthUser | null = null): Promise<AppRecord> {
  const app = UUID_RE.test(ref) ? await repos.apps.findById(ref) : await repos.apps.findBySlug(ref.toLowerCase());
  if (!app) throw AppError.notFound('Application');
  const visible =
    PUBLIC_STATUSES.includes(app.status) ||
    hasRole(user, 'ADMIN') ||
    (user?.developerId != null && user.developerId === app.developerId);
  if (!visible) throw AppError.notFound('Application');
  return app;
}

/** Sort key extractor. Unavailable values always sort last (they are not 0). */
function sortValue(sort: AppSort, app: AppRecord, m: MetricRecord | undefined): number | string | null {
  switch (sort) {
    case 'name':
      return app.name.toLowerCase();
    case 'newest':
      return app.firstSeenAt.getTime();
    case 'activity':
      return m?.activityScore ?? null;
    case 'growth':
      return m?.growthScore ?? null;
    case 'economic':
      return m?.economicScore ?? null;
    case 'community':
      return m?.communityScore ?? null;
    case 'transparency':
      return m?.transparencyScore ?? null;
    case 'confidence':
      return m?.confidenceScore ?? null;
  }
}

export function sortApps(
  apps: readonly AppRecord[],
  metrics: ReadonlyMap<string, MetricRecord>,
  sort: AppSort,
  order?: 'asc' | 'desc',
): AppRecord[] {
  const direction = order ?? (sort === 'name' ? 'asc' : 'desc');
  const sign = direction === 'asc' ? 1 : -1;
  return [...apps].sort((a, b) => {
    const va = sortValue(sort, a, metrics.get(a.id));
    const vb = sortValue(sort, b, metrics.get(b.id));
    if (va === null && vb === null) return a.name.localeCompare(b.name);
    if (va === null) return 1;
    if (vb === null) return -1;
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return cmp !== 0 ? sign * cmp : a.name.localeCompare(b.name);
  });
}

export async function listApps(
  repos: Repositories,
  query: {
    page: number;
    limit: number;
    category?: string;
    status?: AppStatus;
    sort: AppSort;
    order?: 'asc' | 'desc';
    period: Period;
    q?: string;
  },
  user: AuthUser | null,
) {
  let statuses: AppStatus[] = ['ACTIVE'];
  if (query.status) {
    if (!PUBLIC_STATUSES.includes(query.status) && !hasRole(user, 'ADMIN')) {
      throw AppError.forbidden(`Listing ${query.status} applications requires the ADMIN role`);
    }
    statuses = [query.status];
  }
  const filter: AppFilter = { statuses, categorySlugs: query.category ? [query.category] : undefined, search: query.q };
  const apps = await repos.apps.list(filter);
  const metrics = await repos.metrics.latestFor(apps.map((a) => a.id), query.period);
  const sorted = sortApps(apps, metrics, query.sort, query.order);
  const page = sorted.slice(paginationOffset(query.page, query.limit), paginationOffset(query.page, query.limit) + query.limit);

  return {
    data: page.map((a) => presentAppSummary(a, metrics.get(a.id))),
    meta: {
      pagination: buildPaginationMeta(query.page, query.limit, sorted.length),
      sort: query.sort,
      period: query.period,
      ...demoMeta(page.some((a) => a.isDemo)),
    },
  };
}

export async function getAppDetail(repos: Repositories, ref: string, period: Period, user: AuthUser | null) {
  const app = await resolveApp(repos, ref, user);
  const metrics = await repos.metrics.latestFor([app.id], period);
  const summary = await repos.reviews.summary(app.id);
  return {
    data: presentAppDetail(app, metrics.get(app.id), summary),
    meta: { period, ...demoMeta(app.isDemo) },
  };
}

export async function getAppHistory(
  repos: Repositories,
  ref: string,
  range: HistoryRange,
  period: Period,
  user: AuthUser | null,
  now = new Date(),
) {
  const app = await resolveApp(repos, ref, user);
  // The range ends on the latest computed day (today is usually not computed yet).
  const latest = (await repos.metrics.latestFor([app.id], period)).get(app.id);
  const to = latest?.periodEnd ?? addDays(startOfUtcDay(now), 1);
  const from = addDays(to, -periodToDays(range));
  const rows = await repos.metrics.history(app.id, period, from, to);
  return {
    data: {
      appId: app.id,
      slug: app.slug,
      range,
      period,
      points: rows.map(presentHistoryPoint),
    },
    meta: {
      points: rows.length,
      note: 'Each point is the score of the given period window ending on that date. Missing days are omitted, not zero-filled.',
      ...demoMeta(app.isDemo),
    },
  };
}

export async function compareApps(repos: Repositories, refs: readonly string[], period: Period, user: AuthUser | null) {
  const apps = await Promise.all(refs.map((r) => resolveApp(repos, r, user)));
  const metrics = await repos.metrics.latestFor(apps.map((a) => a.id), period);
  const summaries = await Promise.all(apps.map((a) => repos.reviews.summary(a.id)));
  return {
    data: apps.map((a, i) => presentAppDetail(a, metrics.get(a.id), summaries[i]!)),
    meta: {
      period,
      note: 'Side-by-side analytical indicators. The platform does not designate a preferable application.',
      ...demoMeta(apps.some((a) => a.isDemo)),
    },
  };
}
