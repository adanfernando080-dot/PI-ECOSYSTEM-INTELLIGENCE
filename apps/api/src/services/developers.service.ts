import { AppError } from '@pi/shared';
import { validateRawMetric } from '@pi/validation';
import { assertCanManageApp, assertRole, type AuthUser } from '../auth/policies';
import type { Repositories } from '../domain/ports';
import { presentAppSummary } from '../domain/presenters';
import type { DeclaredMetric } from '../domain/types';
import type { CreateAppBody, DeclareMetricsBody, UpdateAppBody } from '../schemas/writes';
import { resolveApp } from './apps.service';

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function categoryIdFor(repos: Repositories, slug: string | null | undefined): Promise<string | null | undefined> {
  if (slug === undefined) return undefined;
  if (slug === null) return null;
  const category = await repos.categories.findBySlug(slug);
  if (!category) throw AppError.validation(`Unknown category: ${slug}`);
  return category.id;
}

export async function listDeveloperApps(repos: Repositories, user: AuthUser | null) {
  assertRole(user, 'DEVELOPER');
  const developer = await repos.developers.ensureForUser(user);
  const apps = await repos.apps.listByDeveloper(developer.id);
  const metrics = await repos.metrics.latestFor(apps.map((a) => a.id), '30d');
  return {
    data: apps.map((a) => presentAppSummary(a, metrics.get(a.id))),
    meta: { developer: { piUsername: developer.piUsername, verificationStatus: developer.verificationStatus } },
  };
}

export async function registerApp(repos: Repositories, body: CreateAppBody, user: AuthUser | null) {
  assertRole(user, 'DEVELOPER');
  const developer = await repos.developers.ensureForUser(user);
  const slug = body.slug ?? slugify(body.name);
  if (!slug) throw AppError.validation('Could not derive a slug from the name; please provide one');
  if (await repos.apps.findBySlug(slug)) throw AppError.conflict(`The slug "${slug}" is already used`);

  const app = await repos.apps.create({
    name: body.name,
    slug,
    description: body.description ?? null,
    categoryId: (await categoryIdFor(repos, body.categorySlug)) ?? null,
    url: body.url ?? null,
    logoUrl: body.logoUrl ?? null,
    methodologyNote: body.methodologyNote ?? null,
    tags: body.tags,
    developerId: developer.id,
  });
  return {
    status: 201,
    data: presentAppSummary(app, null),
    meta: { review: 'New applications are listed once validated by an administrator.' },
  };
}

export async function updateDeveloperApp(repos: Repositories, ref: string, body: UpdateAppBody, user: AuthUser | null) {
  assertRole(user, 'DEVELOPER');
  const app = await resolveApp(repos, ref, user);
  assertCanManageApp(user, app);
  const updated = await repos.apps.update(app.id, {
    name: body.name,
    description: body.description,
    categoryId: await categoryIdFor(repos, body.categorySlug),
    url: body.url,
    logoUrl: body.logoUrl,
    methodologyNote: body.methodologyNote,
    tags: body.tags,
  });
  return { data: presentAppSummary(updated, null), meta: {} };
}

export async function claimApp(repos: Repositories, ref: string, evidence: string, user: AuthUser | null) {
  assertRole(user, 'DEVELOPER');
  const developer = await repos.developers.ensureForUser(user);
  const app = await resolveApp(repos, ref, user);
  if (app.developerId === developer.id) throw AppError.conflict('This application is already linked to your profile');
  if (await repos.claims.findByAppAndDeveloper(app.id, developer.id)) {
    throw AppError.conflict('You already submitted a claim for this application');
  }
  const claim = await repos.claims.create(app.id, developer.id, evidence);
  return {
    status: 202,
    data: { id: claim.id, appId: app.id, status: claim.status, createdAt: claim.createdAt.toISOString() },
    meta: { review: 'Claims are verified by an administrator before the app is linked to your profile.' },
  };
}

/**
 * Developer-declared metrics. They are stored as DEVELOPER_REPORTED (or
 * UNAVAILABLE when value is null) — never as OBSERVABLE — and therefore weigh
 * less in the confidence engine than observable data.
 */
export async function declareMetrics(
  repos: Repositories,
  ref: string,
  body: DeclareMetricsBody,
  user: AuthUser | null,
  now = new Date(),
) {
  assertRole(user, 'DEVELOPER');
  const app = await resolveApp(repos, ref, user);
  assertCanManageApp(user, app);

  const metrics: DeclaredMetric[] = body.metrics.map((m) => ({
    metricType: m.metricType,
    value: m.value,
    periodStart: m.periodStart,
    periodEnd: m.periodEnd,
    provenance: m.value === null ? 'UNAVAILABLE' : 'DEVELOPER_REPORTED',
    note: m.note,
  }));

  const issues = metrics.flatMap((m, index) => {
    const r = validateRawMetric(m, now);
    return r.ok ? [] : r.issues.map((i) => ({ path: `body.metrics.${index}.${i.field}`, message: i.message }));
  });
  if (issues.length > 0) throw AppError.validation('Invalid metrics', issues);

  const stored = await repos.rawMetrics.createDeclared(app.id, metrics, user.id);
  return {
    status: 201,
    data: { appId: app.id, stored, provenance: 'DEVELOPER_REPORTED' },
    meta: {
      note: 'Declared figures are labelled DEVELOPER_REPORTED. They are included in scores with a lower confidence than observable data; staking figures are stored but never scored.',
    },
  };
}
