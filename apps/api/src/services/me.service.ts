import { AppError } from '@pi/shared';
import { assertRole, type AuthUser } from '../auth/policies';
import type { Repositories } from '../domain/ports';
import { demoMeta, presentAppSummary } from '../domain/presenters';
import { PUBLIC_STATUSES } from './apps.service';

export async function getMe(user: AuthUser | null) {
  assertRole(user, 'USER');
  return {
    data: { id: user.id, piUsername: user.piUsername, role: user.role, hasDeveloperProfile: user.developerId !== null },
    meta: {},
  };
}

export async function listFavorites(repos: Repositories, user: AuthUser | null) {
  assertRole(user, 'USER');
  const ids = await repos.favorites.list(user.id);
  const apps = (await Promise.all(ids.map((id) => repos.apps.findById(id)))).filter(
    (a): a is NonNullable<typeof a> => a !== null && PUBLIC_STATUSES.includes(a.status),
  );
  const metrics = await repos.metrics.latestFor(apps.map((a) => a.id), '30d');
  return { data: apps.map((a) => presentAppSummary(a, metrics.get(a.id))), meta: demoMeta(apps.some((a) => a.isDemo)) };
}

export async function addFavorite(repos: Repositories, appId: string, user: AuthUser | null) {
  assertRole(user, 'USER');
  const app = await repos.apps.findById(appId);
  if (!app || !PUBLIC_STATUSES.includes(app.status)) throw AppError.notFound('Application');
  await repos.favorites.add(user.id, app.id);
  return { status: 201, data: { appId: app.id, favorite: true }, meta: {} };
}

export async function removeFavorite(repos: Repositories, appId: string, user: AuthUser | null) {
  assertRole(user, 'USER');
  await repos.favorites.remove(user.id, appId);
  return { data: { appId, favorite: false }, meta: {} };
}

export async function listCategories(repos: Repositories) {
  const categories = await repos.categories.list();
  return { data: categories, meta: { total: categories.length } };
}
