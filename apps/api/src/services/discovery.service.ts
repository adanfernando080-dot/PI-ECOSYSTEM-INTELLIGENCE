import { buildPaginationMeta, categoriesForIntent, paginationOffset, type DiscoveryIntent, type Period } from '@pi/shared';
import type { Repositories } from '../domain/ports';
import { demoMeta, presentAppSummary } from '../domain/presenters';
import { sortApps, type AppSort } from './apps.service';

export async function discover(
  repos: Repositories,
  query: {
    intent?: DiscoveryIntent;
    category?: string;
    sort: AppSort;
    minConfidence?: number;
    period: Period;
    page: number;
    limit: number;
  },
) {
  let categorySlugs: string[] | undefined;
  if (query.intent) categorySlugs = [...categoriesForIntent(query.intent)];
  if (query.category) {
    categorySlugs = categorySlugs ? categorySlugs.filter((c) => c === query.category) : [query.category];
  }

  const apps =
    categorySlugs && categorySlugs.length === 0
      ? []
      : await repos.apps.list({ statuses: ['ACTIVE'], categorySlugs });
  const metrics = await repos.metrics.latestFor(apps.map((a) => a.id), query.period);
  const eligible =
    query.minConfidence === undefined
      ? apps
      : apps.filter((a) => (metrics.get(a.id)?.confidenceScore ?? -1) >= query.minConfidence!);

  const sorted = sortApps(eligible, metrics, query.sort);
  const offset = paginationOffset(query.page, query.limit);
  const page = sorted.slice(offset, offset + query.limit);

  return {
    data: page.map((a) => presentAppSummary(a, metrics.get(a.id))),
    meta: {
      pagination: buildPaginationMeta(query.page, query.limit, sorted.length),
      intent: query.intent ?? null,
      categories: categorySlugs ?? null,
      sort: query.sort,
      period: query.period,
      minConfidence: query.minConfidence ?? null,
      ...demoMeta(page.some((a) => a.isDemo)),
    },
  };
}
