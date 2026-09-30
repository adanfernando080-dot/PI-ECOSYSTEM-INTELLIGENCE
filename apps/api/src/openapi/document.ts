import { z } from 'zod/v4';
import { AppRefSchema, ErrorEnvelopeSchema, PaginationMetaSchema, UuidSchema } from '../schemas/common';
import { AppDetailQuery, CompareQuery, HistoryQuery, ListAppsQuery } from '../schemas/apps';
import { DiscoverQuery, RankingParams, RankingQuery } from '../schemas/rankings';
import {
  AppDetailSchema,
  AppSummarySchema,
  CategorySchema,
  HistorySchema,
  RankingSchema,
  ReviewSchema,
} from '../schemas/responses';
import {
  AdminReviewsQuery,
  AnomalyQuery,
  AnomalyStatusBody,
  AppStatusBody,
  CategoryBody,
  ClaimAppBody,
  ClaimDecisionBody,
  ClaimsQuery,
  CreateAppBody,
  CreateReviewBody,
  DeclareMetricsBody,
  ListReviewsQuery,
  ModerateReviewBody,
  RecalculateBody,
  UpdateAppBody,
  UpdateCategoryBody,
} from '../schemas/writes';

/**
 * OpenAPI 3.1 document generated from the SAME zod schemas that validate
 * requests, so documentation and validation cannot drift apart.
 */

type Json = Record<string, unknown>;
type Io = 'input' | 'output';

class ComponentRegistry {
  readonly schemas: Record<string, Json> = {};

  /** Converts a zod schema, hoisting named sub-schemas into components. */
  convert(schema: z.ZodType, io: Io): Json {
    const raw = z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as Json;
    const defs = (raw.$defs ?? {}) as Record<string, Json>;
    for (const [name, def] of Object.entries(defs)) {
      if (!this.schemas[name]) this.schemas[name] = this.clean(def);
    }
    const root = this.clean(raw);
    const id = (raw as { id?: string }).id;
    if (id) {
      if (!this.schemas[id]) this.schemas[id] = root;
      return { $ref: `#/components/schemas/${id}` };
    }
    return root;
  }

  private clean(node: unknown): Json {
    const walk = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        const out: Json = {};
        for (const [k, val] of Object.entries(v as Json)) {
          if (k === '$schema' || k === '$defs' || k === 'id') continue;
          if (k === '$ref' && typeof val === 'string') {
            out.$ref = val.replace('#/$defs/', '#/components/schemas/');
            continue;
          }
          out[k] = walk(val);
        }
        return out;
      }
      return v;
    };
    return walk(node) as Json;
  }
}

interface Operation {
  summary: string;
  description?: string;
  tags: string[];
  auth?: 'USER' | 'DEVELOPER' | 'ADMIN';
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  response?: z.ZodType;
  paginated?: boolean;
  status?: number;
  /** Documents a 409 response and why it can happen. */
  conflict?: string;
}

export function buildOpenApiDocument(options: { serverUrl?: string } = {}) {
  const reg = new ComponentRegistry();
  const errorRef = reg.convert(ErrorEnvelopeSchema, 'output');
  const paginationRef = reg.convert(PaginationMetaSchema, 'output');
  const paths: Record<string, Record<string, Json>> = {};

  const parameters = (schema: z.ZodObject | undefined, location: 'path' | 'query'): Json[] => {
    if (!schema) return [];
    const json = reg.convert(schema, 'input') as { properties?: Record<string, Json>; required?: string[] };
    return Object.entries(json.properties ?? {}).map(([name, s]) => ({
      name,
      in: location,
      required: location === 'path' || (json.required ?? []).includes(name),
      schema: s,
      ...(typeof s.description === 'string' ? { description: s.description } : {}),
    }));
  };

  const add = (method: string, path: string, op: Operation) => {
    const openApiPath = path.replace(/:([a-zA-Z]+)/g, '{$1}');
    const status = String(op.status ?? 200);
    const dataSchema = op.response ? reg.convert(op.response, 'output') : {};
    const meta: Json = op.paginated
      ? { type: 'object', properties: { pagination: paginationRef, containsDemoData: { type: 'boolean' } } }
      : { type: 'object', properties: { containsDemoData: { type: 'boolean' } } };

    const responses: Record<string, Json> = {
      [status]: {
        description: 'Success',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['data', 'meta'],
              properties: { data: op.paginated ? { type: 'array', items: dataSchema } : dataSchema, meta },
            },
          },
        },
      },
      '400': { description: 'Validation error', content: { 'application/json': { schema: errorRef } } },
      '429': { description: 'Rate limited (RATE_LIMITED)', content: { 'application/json': { schema: errorRef } } },
      '500': { description: 'Unexpected error (INTERNAL_ERROR, no internal detail exposed)', content: { 'application/json': { schema: errorRef } } },
    };
    if (op.body) {
      responses['413'] = { description: 'Body larger than 100 kB (PAYLOAD_TOO_LARGE)', content: { 'application/json': { schema: errorRef } } };
    }
    if (op.conflict) {
      responses['409'] = { description: `Conflict (CONFLICT): ${op.conflict}`, content: { 'application/json': { schema: errorRef } } };
    }
    if (op.auth) {
      responses['401'] = { description: 'Authentication required', content: { 'application/json': { schema: errorRef } } };
      responses['403'] = { description: `Requires ${op.auth} role or ownership`, content: { 'application/json': { schema: errorRef } } };
    }
    if (path.includes(':')) {
      responses['404'] = { description: 'Not found', content: { 'application/json': { schema: errorRef } } };
    }

    paths[openApiPath] ??= {};
    paths[openApiPath][method] = {
      summary: op.summary,
      ...(op.description ? { description: op.description } : {}),
      tags: op.tags,
      ...(op.auth ? { security: [{ bearerAuth: [] }], 'x-required-role': op.auth } : {}),
      parameters: [...parameters(op.params, 'path'), ...parameters(op.query, 'query')],
      ...(op.body
        ? { requestBody: { required: true, content: { 'application/json': { schema: reg.convert(op.body, 'input') } } } }
        : {}),
      responses,
    };
  };

  const AppIdParams = z.object({ id: AppRefSchema.meta({ description: 'App UUID or slug' }) });
  const UuidIdParams = z.object({ id: UuidSchema });

  // --- public -------------------------------------------------------------
  add('get', '/api/health', { summary: 'Health check', tags: ['System'] });
  add('get', '/api/meta/methodology', { summary: 'Scoring methodology (weights, formulas, versions)', tags: ['System'] });
  add('get', '/api/categories', { summary: 'List categories', tags: ['Apps'], response: z.array(CategorySchema) });
  add('get', '/api/apps', {
    summary: 'List applications',
    description: 'Filter, search, sort and paginate. Unavailable scores sort last (never treated as 0).',
    tags: ['Apps'],
    query: ListAppsQuery,
    response: AppSummarySchema,
    paginated: true,
  });
  add('get', '/api/apps/:slug', {
    summary: 'Application detail with score breakdown',
    tags: ['Apps'],
    params: z.object({ slug: AppRefSchema.meta({ description: 'App slug (or UUID)' }) }),
    query: AppDetailQuery,
    response: AppDetailSchema,
  });
  add('get', '/api/apps/:id/history', {
    summary: 'Score history',
    tags: ['Apps'],
    params: AppIdParams,
    query: HistoryQuery,
    response: HistorySchema,
  });
  add('get', '/api/compare', {
    summary: 'Compare 2–4 applications side by side',
    tags: ['Apps'],
    query: CompareQuery,
    response: z.array(AppDetailSchema),
  });
  add('get', '/api/rankings/:type', {
    summary: 'Analytical ranking',
    description: 'One dimension per ranking. There is no overall / "best" ranking.',
    tags: ['Rankings'],
    params: RankingParams,
    query: RankingQuery,
    response: RankingSchema,
  });
  add('get', '/api/discover', {
    summary: 'Discover applications by intent',
    tags: ['Discovery'],
    query: DiscoverQuery,
    response: AppSummarySchema,
    paginated: true,
  });
  add('get', '/api/apps/:id/reviews', {
    summary: 'Published reviews',
    tags: ['Reviews'],
    params: AppIdParams,
    query: ListReviewsQuery,
    response: ReviewSchema,
    paginated: true,
  });
  add('post', '/api/apps/:id/reviews', {
    summary: 'Submit a review (moderated before publication)',
    conflict: 'You have already reviewed this application',
    tags: ['Reviews'],
    auth: 'USER',
    params: AppIdParams,
    body: CreateReviewBody,
    response: ReviewSchema,
    status: 201,
  });

  // --- me -----------------------------------------------------------------
  add('get', '/api/me', { summary: 'Current user', tags: ['Me'], auth: 'USER' });
  add('get', '/api/me/favorites', { summary: 'My favorite apps', tags: ['Me'], auth: 'USER', response: z.array(AppSummarySchema) });
  add('post', '/api/me/favorites/:appId', {
    summary: 'Add a favorite',
    tags: ['Me'],
    auth: 'USER',
    params: z.object({ appId: UuidSchema }),
    status: 201,
  });
  add('delete', '/api/me/favorites/:appId', {
    summary: 'Remove a favorite',
    tags: ['Me'],
    auth: 'USER',
    params: z.object({ appId: UuidSchema }),
  });

  // --- developers ---------------------------------------------------------
  add('get', '/api/developers/apps', { summary: 'My applications', tags: ['Developers'], auth: 'DEVELOPER', response: z.array(AppSummarySchema) });
  add('post', '/api/developers/apps', {
    summary: 'Register an application (PENDING until validated)',
    conflict: 'The slug is already used',
    tags: ['Developers'],
    auth: 'DEVELOPER',
    body: CreateAppBody,
    response: AppSummarySchema,
    status: 201,
  });
  add('patch', '/api/developers/apps/:id', {
    summary: 'Update my application',
    tags: ['Developers'],
    auth: 'DEVELOPER',
    params: AppIdParams,
    body: UpdateAppBody,
    response: AppSummarySchema,
  });
  add('post', '/api/developers/apps/:id/claim', {
    summary: 'Claim an existing application',
    conflict: 'The application is already linked to your profile, or you already submitted a claim for it',
    tags: ['Developers'],
    auth: 'DEVELOPER',
    params: AppIdParams,
    body: ClaimAppBody,
    status: 202,
  });
  add('post', '/api/developers/apps/:id/metrics', {
    summary: 'Declare metrics (stored as DEVELOPER_REPORTED)',
    tags: ['Developers'],
    auth: 'DEVELOPER',
    params: AppIdParams,
    body: DeclareMetricsBody,
    status: 201,
  });

  // --- admin --------------------------------------------------------------
  add('patch', '/api/admin/apps/:id/status', { summary: 'Validate / change app status', tags: ['Admin'], auth: 'ADMIN', params: UuidIdParams, body: AppStatusBody });
  add('post', '/api/admin/categories', { summary: 'Create category',
    conflict: 'The category slug already exists', tags: ['Admin'], auth: 'ADMIN', body: CategoryBody, status: 201 });
  add('patch', '/api/admin/categories/:id', { summary: 'Update category',
    conflict: 'The category slug already exists', tags: ['Admin'], auth: 'ADMIN', params: UuidIdParams, body: UpdateCategoryBody });
  add('get', '/api/admin/reviews', { summary: 'Reviews to moderate', tags: ['Admin'], auth: 'ADMIN', query: AdminReviewsQuery, paginated: true });
  add('patch', '/api/admin/reviews/:id', { summary: 'Moderate a review', tags: ['Admin'], auth: 'ADMIN', params: UuidIdParams, body: ModerateReviewBody });
  add('get', '/api/admin/anomalies', { summary: 'Statistical anomaly signals', tags: ['Admin'], auth: 'ADMIN', query: AnomalyQuery, paginated: true });
  add('patch', '/api/admin/anomalies/:id', { summary: 'Update anomaly status', tags: ['Admin'], auth: 'ADMIN', params: UuidIdParams, body: AnomalyStatusBody });
  add('get', '/api/admin/claims', { summary: 'App ownership claims', tags: ['Admin'], auth: 'ADMIN', query: ClaimsQuery, paginated: true });
  add('patch', '/api/admin/claims/:id', { summary: 'Approve / reject a claim',
    conflict: 'This claim has already been decided', tags: ['Admin'], auth: 'ADMIN', params: UuidIdParams, body: ClaimDecisionBody });
  add('post', '/api/admin/recalculate', { summary: 'Recompute metrics, rankings and anomalies (append-only)', tags: ['Admin'], auth: 'ADMIN', body: RecalculateBody });

  return {
    openapi: '3.1.0',
    info: {
      title: 'Pi Ecosystem Intelligence API',
      version: '1.0.0',
      description:
        'Discover. Analyze. Compare. — Independent analytical indicators about the Pi ecosystem. ' +
        'All responses use { data, meta } or { error: { code, message } }. Scores are analytical indicators, ' +
        'not verdicts; missing data is null, never 0; responses containing fictional data set meta.containsDemoData.',
    },
    servers: [{ url: options.serverUrl ?? '/' }],
    tags: ['System', 'Apps', 'Rankings', 'Discovery', 'Reviews', 'Me', 'Developers', 'Admin'].map((name) => ({ name })),
    paths,
    components: {
      schemas: reg.schemas,
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
  };
}
