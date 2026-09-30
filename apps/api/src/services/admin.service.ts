import {
  addDays,
  AppError,
  buildPaginationMeta,
  startOfUtcDay,
  type AnomalyStatus,
  type AppStatus,
  type ReviewStatus,
} from '@pi/shared';
import { assertRole, type AuthUser } from '../auth/policies';
import type { Repositories } from '../domain/ports';
import { presentAppSummary, presentReview } from '../domain/presenters';

/** Administrator use-cases. Every function asserts the ADMIN role itself (defence in depth). */

export async function setAppStatus(repos: Repositories, appId: string, status: AppStatus, user: AuthUser | null) {
  assertRole(user, 'ADMIN');
  const app = await repos.apps.findById(appId);
  if (!app) throw AppError.notFound('Application');
  const updated = await repos.apps.update(app.id, { status });
  return { data: presentAppSummary(updated, null), meta: { previousStatus: app.status } };
}

export async function createCategory(
  repos: Repositories,
  body: { name: string; slug: string; description?: string | null },
  user: AuthUser | null,
) {
  assertRole(user, 'ADMIN');
  if (await repos.categories.findBySlug(body.slug)) throw AppError.conflict(`Category "${body.slug}" already exists`);
  const category = await repos.categories.create({ name: body.name, slug: body.slug, description: body.description ?? null });
  return { status: 201, data: category, meta: {} };
}

export async function updateCategory(
  repos: Repositories,
  id: string,
  body: { name?: string; slug?: string; description?: string | null },
  user: AuthUser | null,
) {
  assertRole(user, 'ADMIN');
  const existing = await repos.categories.findById(id);
  if (!existing) throw AppError.notFound('Category');
  if (body.slug && body.slug !== existing.slug && (await repos.categories.findBySlug(body.slug))) {
    throw AppError.conflict(`Category "${body.slug}" already exists`);
  }
  return { data: await repos.categories.update(id, body), meta: {} };
}

export async function listReviewsForModeration(
  repos: Repositories,
  status: ReviewStatus,
  page: number,
  limit: number,
  user: AuthUser | null,
) {
  assertRole(user, 'ADMIN');
  const result = await repos.reviews.list({ statuses: [status] }, page, limit);
  return {
    data: result.items.map((r) => ({ ...presentReview(r), moderationNote: r.moderationNote })),
    meta: { pagination: buildPaginationMeta(page, limit, result.total) },
  };
}

export async function moderateReview(
  repos: Repositories,
  id: string,
  body: { status: ReviewStatus; moderationNote?: string | null },
  user: AuthUser | null,
) {
  assertRole(user, 'ADMIN');
  const review = await repos.reviews.findById(id);
  if (!review) throw AppError.notFound('Review');
  const updated = await repos.reviews.moderate(id, body.status, body.moderationNote ?? null, user.id);
  return { data: { ...presentReview(updated), moderationNote: updated.moderationNote }, meta: {} };
}

export async function listAnomalies(
  repos: Repositories,
  filter: { status?: AnomalyStatus; appId?: string },
  page: number,
  limit: number,
  user: AuthUser | null,
) {
  assertRole(user, 'ADMIN');
  const result = await repos.anomalies.list(filter, page, limit);
  return {
    data: result.items.map((a) => ({ ...a, detectedAt: a.detectedAt.toISOString() })),
    meta: {
      pagination: buildPaginationMeta(page, limit, result.total),
      note: 'Anomalies are statistical signals for review. They are not conclusions about an application.',
    },
  };
}

export async function updateAnomalyStatus(repos: Repositories, id: string, status: AnomalyStatus, user: AuthUser | null) {
  assertRole(user, 'ADMIN');
  if (!(await repos.anomalies.findById(id))) throw AppError.notFound('Anomaly');
  const updated = await repos.anomalies.updateStatus(id, status);
  return { data: { ...updated, detectedAt: updated.detectedAt.toISOString() }, meta: {} };
}

export async function listClaims(
  repos: Repositories,
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
  page: number,
  limit: number,
  user: AuthUser | null,
) {
  assertRole(user, 'ADMIN');
  const result = await repos.claims.list(status, page, limit);
  return {
    data: result.items.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    meta: { pagination: buildPaginationMeta(page, limit, result.total) },
  };
}

export async function decideClaim(
  repos: Repositories,
  id: string,
  status: 'APPROVED' | 'REJECTED',
  user: AuthUser | null,
) {
  assertRole(user, 'ADMIN');
  const claim = await repos.claims.findById(id);
  if (!claim) throw AppError.notFound('Claim');
  if (claim.status !== 'PENDING') throw AppError.conflict('This claim has already been decided');
  const decided = await repos.claims.decide(id, status, user.id);
  if (status === 'APPROVED') await repos.apps.update(claim.appId, { developerId: claim.developerId });
  return { data: { ...decided, createdAt: decided.createdAt.toISOString() }, meta: {} };
}

/** Recomputes metrics, rankings and anomalies for one day (append-only). */
export async function recalculate(repos: Repositories, date: string | undefined, user: AuthUser | null, now = new Date()) {
  assertRole(user, 'ADMIN');
  const asOf = date ? new Date(`${date}T00:00:00Z`) : addDays(startOfUtcDay(now), -1);
  if (asOf > now) throw AppError.validation('Cannot compute metrics for a future date');
  const result = await repos.pipeline.run(asOf);
  return {
    data: { asOf: asOf.toISOString().slice(0, 10), ...result },
    meta: { note: 'New rows were appended; existing history was not modified.' },
  };
}
