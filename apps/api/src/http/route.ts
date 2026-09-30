import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod/v4';
import { AppError } from '@pi/shared';
import type { AuthUser } from '../auth/policies';

/**
 * Route adapter: validates params / query / body with zod, runs a plain
 * handler and wraps its result in the uniform { data, meta } envelope.
 *
 * Handlers never touch req/res directly, which keeps them unit-testable and
 * guarantees that nothing reaches business code without validation.
 */

export interface HandlerContext<P, Q, B> {
  params: P;
  query: Q;
  body: B;
  user: AuthUser | null;
  ip: string | undefined;
}

export interface HandlerResult<T = unknown> {
  data: T;
  meta?: Record<string, unknown>;
  status?: number;
}

export interface RouteSchemas<P, Q, B> {
  params?: z.ZodType<P>;
  query?: z.ZodType<Q>;
  body?: z.ZodType<B>;
}

export function parseOrThrow<T>(schema: z.ZodType<T> | undefined, value: unknown, where: string): T {
  if (!schema) return undefined as T;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppError.validation(
      `Invalid ${where}`,
      result.error.issues.map((i) => ({ path: [where, ...i.path.map(String)].join('.'), message: i.message })),
    );
  }
  return result.data;
}

export function route<P = undefined, Q = undefined, B = undefined>(
  schemas: RouteSchemas<P, Q, B>,
  handler: (ctx: HandlerContext<P, Q, B>) => Promise<HandlerResult>,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx: HandlerContext<P, Q, B> = {
        params: parseOrThrow(schemas.params, req.params, 'params'),
        query: parseOrThrow(schemas.query, req.query, 'query'),
        body: parseOrThrow(schemas.body, req.body ?? {}, 'body'),
        user: res.locals.user ?? null,
        ip: req.ip,
      };
      const result = await handler(ctx);
      res.status(result.status ?? 200).json({ data: result.data, meta: result.meta ?? {} });
    } catch (err) {
      next(err);
    }
  };
}
