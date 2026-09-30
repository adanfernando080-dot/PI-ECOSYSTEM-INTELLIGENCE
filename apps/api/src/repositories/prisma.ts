import type { Anomaly, AppClaim, AppMetric, Prisma, PrismaClient } from '@pi/database';
import { decimalToNumber, fromDbPeriod, runPipeline, toDbPeriod, toDbRankingType } from '@pi/metrics/persistence';
import type { AuthUser } from '../auth/policies';
import type { Repositories } from '../domain/ports';
import type { AnomalyRecord, AppRecord, ClaimRecord, MetricRecord, ReviewRecord } from '../domain/types';

/**
 * Prisma implementations of the repository ports. This is the only place in
 * the API that knows the database schema.
 */

/** Name of the (non-demo) data source used for developer declarations. */
export const DEVELOPER_SOURCE_NAME = 'Developer declarations';

const appInclude = {
  category: true,
  developer: { select: { id: true, piUsername: true, displayName: true, verificationStatus: true } },
} satisfies Prisma.AppInclude;

type AppRow = Prisma.AppGetPayload<{ include: typeof appInclude }>;

function toApp(row: AppRow): AppRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    url: row.url,
    logoUrl: row.logoUrl,
    status: row.status,
    tags: row.tags,
    methodologyNote: row.methodologyNote,
    isDemo: row.isDemo,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    developerId: row.developerId,
    category: row.category
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description }
      : null,
    developer: row.developer,
  };
}

function toMetric(row: AppMetric): MetricRecord {
  return {
    appId: row.appId,
    period: fromDbPeriod(row.period),
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    activityScore: row.activityScore,
    growthScore: row.growthScore,
    economicScore: row.economicScore,
    communityScore: row.communityScore,
    transparencyScore: row.transparencyScore,
    confidenceScore: row.confidenceScore,
    confidenceLevel: row.confidenceLevel,
    overallScore: row.overallScore,
    stakedPi: decimalToNumber(row.stakedPi),
    details: (row.details ?? {}) as Record<string, unknown>,
    scoringVersion: row.scoringVersion,
    isDemo: row.isDemo,
    createdAt: row.createdAt,
  };
}

const reviewInclude = { user: { select: { displayName: true, piUsername: true } } } satisfies Prisma.ReviewInclude;

function toReview(row: Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>): ReviewRecord {
  return {
    id: row.id,
    appId: row.appId,
    userId: row.userId,
    authorName: row.user.displayName ?? row.user.piUsername,
    rating: row.rating,
    review: row.review,
    status: row.status,
    moderationNote: row.moderationNote,
    isDemo: row.isDemo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAnomaly(row: Anomaly): AnomalyRecord {
  return {
    id: row.id,
    appId: row.appId,
    type: row.type,
    severity: row.severity,
    score: row.score,
    description: row.description,
    detectedAt: row.detectedAt,
    status: row.status,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    isDemo: row.isDemo,
  };
}

const toClaim = (row: AppClaim): ClaimRecord => ({
  id: row.id,
  appId: row.appId,
  developerId: row.developerId,
  status: row.status,
  evidence: row.evidence,
  createdAt: row.createdAt,
});

export function createPrismaRepositories(prisma: PrismaClient): Repositories {
  return {
    apps: {
      async list(filter) {
        const where: Prisma.AppWhereInput = { status: { in: filter.statuses } };
        if (filter.categorySlugs) where.category = { slug: { in: filter.categorySlugs } };
        if (filter.search) {
          where.OR = [
            { name: { contains: filter.search, mode: 'insensitive' } },
            { description: { contains: filter.search, mode: 'insensitive' } },
            { tags: { has: filter.search.toLowerCase() } },
          ];
        }
        const rows = await prisma.app.findMany({ where, include: appInclude, orderBy: { name: 'asc' } });
        return rows.map(toApp);
      },
      async findById(id) {
        const row = await prisma.app.findUnique({ where: { id }, include: appInclude });
        return row ? toApp(row) : null;
      },
      async findBySlug(slug) {
        const row = await prisma.app.findUnique({ where: { slug }, include: appInclude });
        return row ? toApp(row) : null;
      },
      async listByDeveloper(developerId) {
        const rows = await prisma.app.findMany({ where: { developerId }, include: appInclude, orderBy: { name: 'asc' } });
        return rows.map(toApp);
      },
      async create(data) {
        const row = await prisma.app.create({ data: { ...data, status: 'PENDING' }, include: appInclude });
        return toApp(row);
      },
      async update(id, changes) {
        const data: Prisma.AppUncheckedUpdateInput = {};
        for (const [k, v] of Object.entries(changes)) if (v !== undefined) (data as Record<string, unknown>)[k] = v;
        const row = await prisma.app.update({ where: { id }, data, include: appInclude });
        return toApp(row);
      },
    },

    metrics: {
      async latestFor(appIds, period) {
        if (appIds.length === 0) return new Map();
        const rows = await prisma.appMetric.findMany({
          where: { appId: { in: [...appIds] }, period: toDbPeriod(period) },
          orderBy: [{ appId: 'asc' }, { periodEnd: 'desc' }, { createdAt: 'desc' }],
          distinct: ['appId'],
        });
        return new Map(rows.map((r) => [r.appId, toMetric(r)]));
      },
      async history(appId, period, from, to) {
        const rows = await prisma.appMetric.findMany({
          where: { appId, period: toDbPeriod(period), periodEnd: { gt: from, lte: to } },
          orderBy: [{ periodEnd: 'asc' }, { createdAt: 'desc' }],
          distinct: ['periodEnd'],
        });
        return rows.map(toMetric);
      },
    },

    rankings: {
      async latestBatch(type, period) {
        const where = { rankingType: toDbRankingType(type), period: toDbPeriod(period) };
        const latest = await prisma.rankingSnapshot.findFirst({ where, orderBy: { computedAt: 'desc' }, select: { computedAt: true } });
        if (!latest) return null;
        const rows = await prisma.rankingSnapshot.findMany({
          where: { ...where, computedAt: latest.computedAt },
          orderBy: [{ rank: 'asc' }, { score: 'desc' }],
        });
        return {
          type,
          period,
          computedAt: latest.computedAt,
          rows: rows.map((r) => ({ appId: r.appId, rank: r.rank, score: r.score, confidence: r.confidence, isDemo: r.isDemo })),
        };
      },
    },

    reviews: {
      async list(filter, page, limit) {
        const where: Prisma.ReviewWhereInput = { status: { in: filter.statuses } };
        if (filter.appId) where.appId = filter.appId;
        const [rows, total] = await prisma.$transaction([
          prisma.review.findMany({
            where,
            include: reviewInclude,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.review.count({ where }),
        ]);
        return { items: rows.map(toReview), total };
      },
      async summary(appId) {
        const agg = await prisma.review.aggregate({
          where: { appId, status: 'PUBLISHED' },
          _count: { _all: true },
          _avg: { rating: true },
        });
        return { count: agg._count._all, average: agg._avg.rating };
      },
      async findByAppAndUser(appId, userId) {
        const row = await prisma.review.findUnique({ where: { appId_userId: { appId, userId } }, include: reviewInclude });
        return row ? toReview(row) : null;
      },
      async findById(id) {
        const row = await prisma.review.findUnique({ where: { id }, include: reviewInclude });
        return row ? toReview(row) : null;
      },
      countByUserSince(userId, since) {
        return prisma.review.count({ where: { userId, createdAt: { gte: since } } });
      },
      async create(data) {
        const row = await prisma.review.create({
          data: { ...data, signals: data.signals as Prisma.InputJsonValue },
          include: reviewInclude,
        });
        return toReview(row);
      },
      async moderate(id, status, note, moderatorId) {
        const row = await prisma.review.update({
          where: { id },
          data: { status, moderationNote: note, moderatedById: moderatorId },
          include: reviewInclude,
        });
        return toReview(row);
      },
    },

    categories: {
      async list() {
        const rows = await prisma.category.findMany({ orderBy: { name: 'asc' } });
        return rows.map(({ id, name, slug, description }) => ({ id, name, slug, description }));
      },
      async findBySlug(slug) {
        return prisma.category.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, description: true } });
      },
      async findById(id) {
        return prisma.category.findUnique({ where: { id }, select: { id: true, name: true, slug: true, description: true } });
      },
      async create(data) {
        return prisma.category.create({ data, select: { id: true, name: true, slug: true, description: true } });
      },
      async update(id, data) {
        return prisma.category.update({ where: { id }, data, select: { id: true, name: true, slug: true, description: true } });
      },
    },

    users: {
      async findAuthUser(id) {
        const row = await prisma.user.findUnique({ where: { id }, include: { developer: { select: { id: true } } } });
        if (!row) return null;
        return { id: row.id, piUsername: row.piUsername, role: row.role, developerId: row.developer?.id ?? null, createdAt: row.createdAt };
      },
    },

    developers: {
      async findById(id) {
        return prisma.developer.findUnique({
          where: { id },
          select: { id: true, piUsername: true, displayName: true, verificationStatus: true },
        });
      },
      async ensureForUser(user: AuthUser) {
        const select = { id: true, piUsername: true, displayName: true, verificationStatus: true } as const;
        const existing = await prisma.developer.findUnique({ where: { userId: user.id }, select });
        if (existing) return existing;
        return prisma.developer.upsert({
          where: { piUsername: user.piUsername },
          update: { userId: user.id },
          create: { piUsername: user.piUsername, userId: user.id },
          select,
        });
      },
    },

    favorites: {
      async list(userId) {
        const rows = await prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
        return rows.map((r) => r.appId);
      },
      async add(userId, appId) {
        await prisma.favorite.upsert({ where: { userId_appId: { userId, appId } }, update: {}, create: { userId, appId } });
      },
      async remove(userId, appId) {
        await prisma.favorite.deleteMany({ where: { userId, appId } });
      },
    },

    rawMetrics: {
      async createDeclared(appId, metrics, declaredBy) {
        const source = await prisma.dataSource.upsert({
          where: { name: DEVELOPER_SOURCE_NAME },
          update: {},
          create: {
            name: DEVELOPER_SOURCE_NAME,
            type: 'DEVELOPER',
            trustLevel: 55,
            description: 'Figures declared by application developers through the API.',
          },
        });
        const result = await prisma.rawMetric.createMany({
          data: metrics.map((m) => ({
            appId,
            sourceId: source.id,
            metricType: m.metricType,
            value: m.value,
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            provenance: m.provenance,
            metadata: { declaredBy, ...(m.note ? { note: m.note } : {}) },
          })),
        });
        return result.count;
      },
    },

    claims: {
      async create(appId, developerId, evidence) {
        return toClaim(await prisma.appClaim.create({ data: { appId, developerId, evidence } }));
      },
      async findByAppAndDeveloper(appId, developerId) {
        const row = await prisma.appClaim.findUnique({ where: { appId_developerId: { appId, developerId } } });
        return row ? toClaim(row) : null;
      },
      async findById(id) {
        const row = await prisma.appClaim.findUnique({ where: { id } });
        return row ? toClaim(row) : null;
      },
      async list(status, page, limit) {
        const where: Prisma.AppClaimWhereInput = status ? { status } : {};
        const [rows, total] = await prisma.$transaction([
          prisma.appClaim.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
          prisma.appClaim.count({ where }),
        ]);
        return { items: rows.map(toClaim), total };
      },
      async decide(id, status, reviewerId) {
        return toClaim(await prisma.appClaim.update({ where: { id }, data: { status, reviewedById: reviewerId } }));
      },
    },

    anomalies: {
      async list(filter, page, limit) {
        const where: Prisma.AnomalyWhereInput = {};
        if (filter.status) where.status = filter.status;
        if (filter.appId) where.appId = filter.appId;
        const [rows, total] = await prisma.$transaction([
          prisma.anomaly.findMany({ where, orderBy: { detectedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
          prisma.anomaly.count({ where }),
        ]);
        return { items: rows.map(toAnomaly), total };
      },
      async findById(id) {
        const row = await prisma.anomaly.findUnique({ where: { id } });
        return row ? toAnomaly(row) : null;
      },
      async updateStatus(id, status) {
        return toAnomaly(await prisma.anomaly.update({ where: { id }, data: { status } }));
      },
    },

    pipeline: {
      run: (asOf) => runPipeline(prisma, asOf),
    },
  };
}
