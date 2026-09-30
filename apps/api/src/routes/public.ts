import { Router } from 'express';
import type { Repositories } from '../domain/ports';
import { route } from '../http/route';
import { AppRefParams } from '../schemas/common';
import { AppDetailQuery, AppSlugParams, CompareQuery, HistoryQuery, ListAppsQuery } from '../schemas/apps';
import { DiscoverQuery, RankingParams, RankingQuery } from '../schemas/rankings';
import { CreateReviewBody, ListReviewsQuery } from '../schemas/writes';
import { compareApps, getAppDetail, getAppHistory, listApps } from '../services/apps.service';
import { discover } from '../services/discovery.service';
import { listCategories } from '../services/me.service';
import { getRanking } from '../services/rankings.service';
import { createReview, listReviews } from '../services/reviews.service';

/** Public read endpoints (+ review submission) consumed by the Lovable frontend. */
export function publicRoutes(repos: Repositories): Router {
  const r = Router();

  r.get('/categories', route({}, () => listCategories(repos)));

  r.get('/apps', route({ query: ListAppsQuery }, ({ query, user }) => listApps(repos, query, user)));

  r.get(
    '/apps/:id/history',
    route({ params: AppRefParams, query: HistoryQuery }, ({ params, query, user }) =>
      getAppHistory(repos, params.id, query.range, query.period, user),
    ),
  );

  r.get(
    '/apps/:id/reviews',
    route({ params: AppRefParams, query: ListReviewsQuery }, ({ params, query, user }) =>
      listReviews(repos, params.id, query.page, query.limit, user),
    ),
  );

  r.post(
    '/apps/:id/reviews',
    route({ params: AppRefParams, body: CreateReviewBody }, ({ params, body, user }) =>
      createReview(repos, params.id, body, user),
    ),
  );

  r.get(
    '/apps/:slug',
    route({ params: AppSlugParams, query: AppDetailQuery }, ({ params, query, user }) =>
      getAppDetail(repos, params.slug, query.period, user),
    ),
  );

  r.get(
    '/rankings/:type',
    route({ params: RankingParams, query: RankingQuery }, ({ params, query }) => getRanking(repos, params.type, query)),
  );

  r.get('/discover', route({ query: DiscoverQuery }, ({ query }) => discover(repos, query)));

  r.get(
    '/compare',
    route({ query: CompareQuery }, ({ query, user }) => compareApps(repos, query.apps, query.period, user)),
  );

  return r;
}
