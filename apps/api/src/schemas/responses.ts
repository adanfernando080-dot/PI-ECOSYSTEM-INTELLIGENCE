import { z } from 'zod/v4';
import { CONFIDENCE_LEVELS, PERIODS } from '@pi/shared';

/**
 * Response schemas — used ONLY to document the API (OpenAPI). They mirror the
 * presenters in src/domain/presenters.ts; the contract test in
 * tests/openapi.test.ts checks that presenter output validates against them.
 */

const nullableScore = z.number().min(0).max(100).nullable();

export const MetricSnapshotSchema = z
  .object({
    period: z.enum(PERIODS),
    periodStart: z.string(),
    periodEnd: z.string(),
    scores: z.object({
      activity: nullableScore,
      growth: nullableScore,
      observableEconomicActivity: nullableScore.meta({ description: 'Observable economic activity — not revenue' }),
      community: nullableScore,
      transparency: nullableScore,
    }),
    piEcosystemScore: nullableScore.meta({ description: 'Composite analytical indicator; not a verdict' }),
    confidence: z.object({ score: z.number().min(0).max(100), level: z.enum(CONFIDENCE_LEVELS) }),
    staking: z.object({ stakedPi: z.number().nullable(), includedInScores: z.literal(false) }),
    scoringVersion: z.string(),
    computedAt: z.string(),
  })
  .meta({ id: 'MetricSnapshot', description: 'null = data unavailable (never zero-filled)' });

export const AppSummarySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    category: z.object({ slug: z.string(), name: z.string() }).nullable(),
    url: z.string().nullable(),
    logoUrl: z.string().nullable(),
    status: z.string(),
    tags: z.array(z.string()),
    developer: z
      .object({ piUsername: z.string(), displayName: z.string().nullable(), verificationStatus: z.string() })
      .nullable(),
    firstSeenAt: z.string(),
    lastSeenAt: z.string().nullable(),
    isDemo: z.boolean().meta({ description: 'true for fictional DEMO data' }),
    metrics: MetricSnapshotSchema.nullable(),
  })
  .meta({ id: 'AppSummary' });

export const AppDetailSchema = AppSummarySchema.extend({
  methodologyNote: z.string().nullable(),
  reviewSummary: z.object({ publishedCount: z.number().int(), averageRating: z.number().nullable() }),
  breakdown: z.record(z.string(), z.unknown()).nullable().meta({ description: 'Per-engine components, coverage and notes' }),
}).meta({ id: 'AppDetail' });

export const HistoryPointSchema = z
  .object({
    date: z.string(),
    activity: nullableScore,
    growth: nullableScore,
    observableEconomicActivity: nullableScore,
    community: nullableScore,
    transparency: nullableScore,
    piEcosystemScore: nullableScore,
    confidence: z.number(),
    confidenceLevel: z.enum(CONFIDENCE_LEVELS),
    stakedPi: z.number().nullable(),
  })
  .meta({ id: 'HistoryPoint' });

export const HistorySchema = z
  .object({
    appId: z.string(),
    slug: z.string(),
    range: z.string(),
    period: z.string(),
    points: z.array(HistoryPointSchema),
  })
  .meta({ id: 'History' });

export const RankingSchema = z
  .object({
    type: z.string(),
    period: z.string(),
    computedAt: z.string().nullable(),
    entries: z.array(
      z.object({
        rank: z.number().int(),
        score: z.number(),
        confidence: z.number(),
        app: z.object({
          id: z.string(),
          slug: z.string(),
          name: z.string(),
          logoUrl: z.string().nullable(),
          category: z.object({ slug: z.string(), name: z.string() }).nullable(),
          isDemo: z.boolean(),
        }),
      }),
    ),
  })
  .meta({ id: 'Ranking' });

export const ReviewSchema = z
  .object({
    id: z.string(),
    appId: z.string(),
    author: z.string().nullable(),
    rating: z.number().int().min(1).max(5),
    review: z.string(),
    status: z.string(),
    createdAt: z.string(),
    isDemo: z.boolean(),
  })
  .meta({ id: 'Review' });

export const CategorySchema = z
  .object({ id: z.string(), name: z.string(), slug: z.string(), description: z.string().nullable() })
  .meta({ id: 'Category' });
