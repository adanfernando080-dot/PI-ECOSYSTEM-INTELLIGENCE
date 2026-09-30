import { Router, type NextFunction, type Request, type Response } from 'express';
import { AppError } from '@pi/shared';
import { hasRole } from '../auth/policies';
import type { Repositories } from '../domain/ports';
import { route } from '../http/route';
import { UuidParams } from '../schemas/common';
import {
  AdminReviewsQuery,
  AnomalyQuery,
  AnomalyStatusBody,
  AppStatusBody,
  CategoryBody,
  ClaimDecisionBody,
  ClaimsQuery,
  ModerateReviewBody,
  RecalculateBody,
  UpdateCategoryBody,
} from '../schemas/writes';
import {
  createCategory,
  decideClaim,
  listAnomalies,
  listClaims,
  listReviewsForModeration,
  moderateReview,
  recalculate,
  setAppStatus,
  updateAnomalyStatus,
  updateCategory,
} from '../services/admin.service';

/** Router-level guard: every /api/admin route requires ADMIN (services check again). */
function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user;
  if (!user) return next(AppError.unauthenticated());
  if (!hasRole(user, 'ADMIN')) return next(AppError.forbidden('This action requires the ADMIN role'));
  next();
}

export function adminRoutes(repos: Repositories): Router {
  const r = Router();
  r.use(requireAdmin);

  r.patch(
    '/apps/:id/status',
    route({ params: UuidParams, body: AppStatusBody }, ({ params, body, user }) =>
      setAppStatus(repos, params.id, body.status, user),
    ),
  );

  r.post('/categories', route({ body: CategoryBody }, ({ body, user }) => createCategory(repos, body, user)));
  r.patch(
    '/categories/:id',
    route({ params: UuidParams, body: UpdateCategoryBody }, ({ params, body, user }) =>
      updateCategory(repos, params.id, body, user),
    ),
  );

  r.get(
    '/reviews',
    route({ query: AdminReviewsQuery }, ({ query, user }) =>
      listReviewsForModeration(repos, query.status, query.page, query.limit, user),
    ),
  );
  r.patch(
    '/reviews/:id',
    route({ params: UuidParams, body: ModerateReviewBody }, ({ params, body, user }) =>
      moderateReview(repos, params.id, body, user),
    ),
  );

  r.get(
    '/anomalies',
    route({ query: AnomalyQuery }, ({ query, user }) =>
      listAnomalies(repos, { status: query.status, appId: query.appId }, query.page, query.limit, user),
    ),
  );
  r.patch(
    '/anomalies/:id',
    route({ params: UuidParams, body: AnomalyStatusBody }, ({ params, body, user }) =>
      updateAnomalyStatus(repos, params.id, body.status, user),
    ),
  );

  r.get(
    '/claims',
    route({ query: ClaimsQuery }, ({ query, user }) => listClaims(repos, query.status, query.page, query.limit, user)),
  );
  r.patch(
    '/claims/:id',
    route({ params: UuidParams, body: ClaimDecisionBody }, ({ params, body, user }) =>
      decideClaim(repos, params.id, body.status, user),
    ),
  );

  r.post('/recalculate', route({ body: RecalculateBody }, ({ body, user }) => recalculate(repos, body.date, user)));

  return r;
}
