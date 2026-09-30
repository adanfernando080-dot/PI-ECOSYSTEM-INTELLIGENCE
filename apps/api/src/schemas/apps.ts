import { z } from 'zod/v4';
import { APP_STATUSES } from '@pi/shared';
import { AppRefSchema, HistoryRangeSchema, PaginationQuery, PeriodSchema, SlugSchema } from './common';

export const APP_SORTS = [
  'name',
  'newest',
  'activity',
  'growth',
  'economic',
  'community',
  'transparency',
  'confidence',
] as const;

export const ListAppsQuery = PaginationQuery.extend({
  category: SlugSchema.optional(),
  status: z.enum(APP_STATUSES).optional().meta({ description: 'PENDING / REJECTED require the ADMIN role' }),
  sort: z.enum(APP_SORTS).default('name'),
  order: z.enum(['asc', 'desc']).optional(),
  period: PeriodSchema.default('30d'),
  q: z.string().trim().min(1).max(80).optional().meta({ description: 'Search in name, description and tags' }),
});
export type ListAppsQuery = z.infer<typeof ListAppsQuery>;

export const AppSlugParams = z.object({ slug: AppRefSchema });

export const AppDetailQuery = z.object({ period: PeriodSchema.default('30d') });

export const HistoryQuery = z.object({
  range: HistoryRangeSchema.default('30d'),
  period: PeriodSchema.default('7d').meta({ description: 'Score window of each history point' }),
});

export const CompareQuery = z.object({
  apps: z
    .string()
    .transform((v) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(AppRefSchema).min(2).max(4))
    .meta({ description: 'Comma-separated slugs or ids (2 to 4)' }),
  period: PeriodSchema.default('30d'),
});
