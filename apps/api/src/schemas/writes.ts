import { z } from 'zod/v4';
import { ANOMALY_STATUSES, APP_STATUSES, CLAIM_STATUSES, METRIC_TYPES, REVIEW_STATUSES } from '@pi/shared';
import { REVIEW_TEXT_LIMITS, sanitizeText } from '@pi/validation';
import { HttpsUrlSchema, PaginationQuery, SlugSchema } from './common';

// ------------------------------------------------------------- reviews ----

export const CreateReviewBody = z
  .object({
    rating: z.number().int().min(1).max(5),
    review: z
      .string()
      .max(REVIEW_TEXT_LIMITS.max * 2)
      .transform(sanitizeText)
      .pipe(z.string().min(REVIEW_TEXT_LIMITS.min).max(REVIEW_TEXT_LIMITS.max)),
  })
  .meta({ id: 'CreateReviewBody' });

export const ListReviewsQuery = PaginationQuery;

// ---------------------------------------------------------- developers ----

const TagSchema = z.string().trim().toLowerCase().min(1).max(30).regex(/^[a-z0-9-]+$/);
const OptionalText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform(sanitizeText)
    .pipe(z.string().max(max))
    .nullable()
    .optional();

export const CreateAppBody = z
  .object({
    name: z.string().transform(sanitizeText).pipe(z.string().min(2).max(80)),
    slug: SlugSchema.optional().meta({ description: 'Derived from the name when omitted' }),
    description: OptionalText(2000),
    categorySlug: SlugSchema.nullable().optional(),
    url: HttpsUrlSchema.nullable().optional(),
    logoUrl: HttpsUrlSchema.nullable().optional(),
    methodologyNote: OptionalText(2000),
    tags: z.array(TagSchema).max(10).default([]),
  })
  .meta({ id: 'CreateAppBody' });
export type CreateAppBody = z.infer<typeof CreateAppBody>;

export const UpdateAppBody = CreateAppBody.omit({ slug: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required')
  .meta({ id: 'UpdateAppBody' });
export type UpdateAppBody = z.infer<typeof UpdateAppBody>;

export const DeclaredMetricSchema = z
  .object({
    metricType: z.enum(METRIC_TYPES),
    value: z.number().finite().min(0).nullable().meta({ description: 'null = the figure is not available (never send 0 for unknown)' }),
    periodStart: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    periodEnd: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    note: z.string().max(500).transform(sanitizeText).optional(),
  })
  .meta({ id: 'DeclaredMetric' });

export const DeclareMetricsBody = z
  .object({ metrics: z.array(DeclaredMetricSchema).min(1).max(100) })
  .meta({ id: 'DeclareMetricsBody' });
export type DeclareMetricsBody = z.infer<typeof DeclareMetricsBody>;

export const ClaimAppBody = z
  .object({
    evidence: z
      .string()
      .transform(sanitizeText)
      .pipe(z.string().min(10).max(1000))
      .meta({ description: 'How the platform can verify you operate this app' }),
  })
  .meta({ id: 'ClaimAppBody' });

// --------------------------------------------------------------- admin ----

export const AppStatusBody = z.object({ status: z.enum(APP_STATUSES) }).meta({ id: 'AppStatusBody' });

export const CategoryBody = z
  .object({
    name: z.string().transform(sanitizeText).pipe(z.string().min(2).max(60)),
    slug: SlugSchema,
    description: OptionalText(500),
  })
  .meta({ id: 'CategoryBody' });

export const UpdateCategoryBody = CategoryBody.partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required')
  .meta({ id: 'UpdateCategoryBody' });

export const ModerateReviewBody = z
  .object({
    status: z.enum(REVIEW_STATUSES),
    moderationNote: OptionalText(500),
  })
  .meta({ id: 'ModerateReviewBody' });

export const AdminReviewsQuery = PaginationQuery.extend({ status: z.enum(REVIEW_STATUSES).default('PENDING') });

export const AnomalyQuery = PaginationQuery.extend({
  status: z.enum(ANOMALY_STATUSES).optional(),
  appId: z.uuid().optional(),
});

export const AnomalyStatusBody = z.object({ status: z.enum(ANOMALY_STATUSES) }).meta({ id: 'AnomalyStatusBody' });

export const ClaimsQuery = PaginationQuery.extend({ status: z.enum(CLAIM_STATUSES).optional() });

export const ClaimDecisionBody = z
  .object({ status: z.enum(['APPROVED', 'REJECTED']) })
  .meta({ id: 'ClaimDecisionBody' });

export const RecalculateBody = z
  .object({
    date: z.iso
      .date()
      .optional()
      .meta({ description: 'UTC day to compute (YYYY-MM-DD). Defaults to the last complete day.' }),
  })
  .meta({ id: 'RecalculateBody' });

// ------------------------------------------------------------------ me ----

export const FavoriteParams = z.object({ appId: z.uuid() });
