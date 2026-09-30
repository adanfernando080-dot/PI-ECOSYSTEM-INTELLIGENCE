import { z } from 'zod/v4';
import { HISTORY_RANGES, PERIODS } from '@pi/shared';

/** Reusable request/response schemas. `.meta({ id })` names them in OpenAPI. */

export const UuidSchema = z.uuid();

export const SlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase slug (a-z, 0-9, hyphens)');

/** An app reference: its UUID or its slug. */
export const AppRefSchema = z.union([UuidSchema, SlugSchema]);

export const PeriodSchema = z.enum(PERIODS).meta({ id: 'Period', description: 'Analysis window' });
export const HistoryRangeSchema = z.enum(HISTORY_RANGES).meta({ id: 'HistoryRange' });

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ConfidenceFilter = z.coerce.number().min(0).max(100);

export const PaginationMetaSchema = z
  .object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .meta({ id: 'PaginationMeta' });

export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: 'ErrorEnvelope' });

/** Plain-text user input limited to http(s) URLs. */
export const HttpsUrlSchema = z
  .url({ protocol: /^https?$/ })
  .max(500);

export const AppRefParams = z.object({ id: AppRefSchema });
export const UuidParams = z.object({ id: UuidSchema });
