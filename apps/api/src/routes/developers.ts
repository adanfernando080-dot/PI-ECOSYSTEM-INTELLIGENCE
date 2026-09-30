import { Router } from 'express';
import type { Repositories } from '../domain/ports';
import { route } from '../http/route';
import { AppRefParams } from '../schemas/common';
import { ClaimAppBody, CreateAppBody, DeclareMetricsBody, FavoriteParams, UpdateAppBody } from '../schemas/writes';
import {
  claimApp,
  declareMetrics,
  listDeveloperApps,
  registerApp,
  updateDeveloperApp,
} from '../services/developers.service';
import { addFavorite, getMe, listFavorites, removeFavorite } from '../services/me.service';

/** Endpoints for DEVELOPER users. Ownership is enforced in the services. */
export function developerRoutes(repos: Repositories): Router {
  const r = Router();
  r.get('/apps', route({}, ({ user }) => listDeveloperApps(repos, user)));
  r.post('/apps', route({ body: CreateAppBody }, ({ body, user }) => registerApp(repos, body, user)));
  r.patch(
    '/apps/:id',
    route({ params: AppRefParams, body: UpdateAppBody }, ({ params, body, user }) =>
      updateDeveloperApp(repos, params.id, body, user),
    ),
  );
  r.post(
    '/apps/:id/claim',
    route({ params: AppRefParams, body: ClaimAppBody }, ({ params, body, user }) =>
      claimApp(repos, params.id, body.evidence, user),
    ),
  );
  r.post(
    '/apps/:id/metrics',
    route({ params: AppRefParams, body: DeclareMetricsBody }, ({ params, body, user }) =>
      declareMetrics(repos, params.id, body, user),
    ),
  );
  return r;
}

/** Endpoints about the authenticated user. */
export function meRoutes(repos: Repositories): Router {
  const r = Router();
  r.get('/', route({}, ({ user }) => getMe(user)));
  r.get('/favorites', route({}, ({ user }) => listFavorites(repos, user)));
  r.post('/favorites/:appId', route({ params: FavoriteParams }, ({ params, user }) => addFavorite(repos, params.appId, user)));
  r.delete(
    '/favorites/:appId',
    route({ params: FavoriteParams }, ({ params, user }) => removeFavorite(repos, params.appId, user)),
  );
  return r;
}
