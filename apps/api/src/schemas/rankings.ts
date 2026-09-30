import { z } from 'zod/v4';
import { DISCOVERY_INTENTS, RANKING_TYPES } from '@pi/shared';
import { ConfidenceFilter, PaginationQuery, PeriodSchema, SlugSchema } from './common';
import { APP_SORTS } from './apps';

export const RankingParams = z.object({ type: z.enum(RANKING_TYPES).meta({ id: 'RankingType' }) });

export const RankingQuery = z.object({
  period: PeriodSchema.default('7d'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  minConfidence: ConfidenceFilter.optional(),
});

export const DiscoverQuery = PaginationQuery.extend({
  intent: z.enum(DISCOVERY_INTENTS).optional(),
  category: SlugSchema.optional(),
  sort: z.enum(APP_SORTS).default('activity'),
  minConfidence: ConfidenceFilter.optional(),
  period: PeriodSchema.default('30d'),
});
