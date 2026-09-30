import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Env } from './config/env';
import type { Repositories } from './domain/ports';
import { route } from './http/route';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { createRateLimiters } from './middleware/rate-limit';
import { buildOpenApiDocument } from './openapi/document';
import { swaggerUiHtml } from './openapi/swagger-ui';
import { adminRoutes } from './routes/admin';
import { developerRoutes, meRoutes } from './routes/developers';
import { publicRoutes } from './routes/public';
import { methodology } from './services/methodology.service';

export interface AppDependencies {
  env: Pick<
    Env,
    'NODE_ENV' | 'JWT_SECRET' | 'JWT_ISSUER' | 'CORS_ORIGINS' | 'RATE_LIMIT_WINDOW_MS' | 'RATE_LIMIT_MAX' | 'RATE_LIMIT_WRITE_MAX' | 'REDIS_URL'
  >;
  repos: Repositories;
  logger: Logger;
  /** Returns true when the database answers. */
  healthCheck?: () => Promise<boolean>;
}

/**
 * Builds the Express application. No I/O happens here, so tests can create an
 * app with any repositories (Prisma or in-memory).
 */
export function createApp(deps: AppDependencies): { app: Express; close: () => Promise<void> } {
  const { env, repos, logger } = deps;
  const app = express();
  const limiters = createRateLimiters({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    writeMax: env.RATE_LIMIT_WRITE_MAX,
    redisUrl: env.REDIS_URL,
  });

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('query parser', 'simple'); // no nested objects from query strings

  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger }));

  // CORS comes first so /api/openapi.json is also readable from the frontend
  // origin (client generators, docs). Whitelist only: see CORS_ORIGINS.
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      // Lets the browser read rate-limit headers (e.g. to back off on 429).
      exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  );

  // The docs page loads Swagger UI from a CDN, so it gets its own CSP.
  const openApiDocument = buildOpenApiDocument();
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.get(
    '/api/docs',
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          'img-src': ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
        },
      },
    }),
    (_req, res) => res.type('html').send(swaggerUiHtml('/api/openapi.json')),
  );

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', limiters.global, limiters.writes);
  app.use('/api', authenticate(repos.users, env.JWT_SECRET, env.JWT_ISSUER));

  app.get(
    '/api/health',
    route({}, async () => {
      const database = deps.healthCheck ? await deps.healthCheck().catch(() => false) : null;
      return { data: { status: database === false ? 'degraded' : 'ok', database }, meta: {} };
    }),
  );
  app.get('/api/meta/methodology', route({}, async () => ({ data: methodology(), meta: {} })));

  app.use('/api', publicRoutes(repos));
  app.use('/api/me', meRoutes(repos));
  app.use('/api/developers', developerRoutes(repos));
  app.use('/api/admin', adminRoutes(repos));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return { app, close: limiters.close };
}
