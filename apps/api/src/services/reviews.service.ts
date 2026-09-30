import { addDays, AppError, buildPaginationMeta } from '@pi/shared';
import { collectReviewSignals } from '@pi/validation';
import { assertRole, canReviewApp, type AuthUser } from '../auth/policies';
import type { Repositories } from '../domain/ports';
import { demoMeta, presentReview } from '../domain/presenters';
import { resolveApp } from './apps.service';

/** Maximum reviews one user can submit per rolling 24 hours (all apps). */
export const MAX_REVIEWS_PER_DAY = 10;

export async function listReviews(
  repos: Repositories,
  ref: string,
  page: number,
  limit: number,
  user: AuthUser | null,
) {
  const app = await resolveApp(repos, ref, user);
  const result = await repos.reviews.list({ appId: app.id, statuses: ['PUBLISHED'] }, page, limit);
  const summary = await repos.reviews.summary(app.id);
  return {
    data: result.items.map(presentReview),
    meta: {
      pagination: buildPaginationMeta(page, limit, result.total),
      summary: { publishedCount: summary.count, averageRating: summary.average },
      ...demoMeta(app.isDemo || result.items.some((r) => r.isDemo)),
    },
  };
}

/**
 * Creates a review in PENDING status. Neutral context signals are stored for
 * future analysis; nothing here labels or rejects a review automatically.
 */
export async function createReview(
  repos: Repositories,
  ref: string,
  body: { rating: number; review: string },
  user: AuthUser | null,
  now = new Date(),
) {
  assertRole(user, 'USER');
  const app = await resolveApp(repos, ref, user);
  if (app.status !== 'ACTIVE') throw AppError.validation('Reviews are only accepted for active applications');
  if (!canReviewApp(user, app)) throw AppError.forbidden('Developers cannot review their own application');
  if (await repos.reviews.findByAppAndUser(app.id, user.id)) {
    throw AppError.conflict('You have already reviewed this application');
  }

  const recent = await repos.reviews.countByUserSince(user.id, addDays(now, -1));
  if (recent >= MAX_REVIEWS_PER_DAY) {
    throw new AppError('RATE_LIMITED', 'Review limit reached, please try again later');
  }

  const account = await repos.users.findAuthUser(user.id);
  const signals = collectReviewSignals({
    text: body.review,
    rating: body.rating,
    accountCreatedAt: account?.createdAt ?? now,
    submittedAt: now,
    userReviewsLast24h: recent,
  });

  const review = await repos.reviews.create({
    appId: app.id,
    userId: user.id,
    rating: body.rating,
    review: body.review,
    status: 'PENDING',
    signals: { ...signals },
  });

  return {
    status: 201,
    data: presentReview(review),
    meta: { moderation: 'Your review will be visible once moderated.' },
  };
}
