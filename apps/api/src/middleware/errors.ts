import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { isAppError } from '@pi/shared';

/**
 * Converts any error into the { error: { code, message } } envelope.
 * Unexpected errors are logged with details and returned as a generic 500 —
 * internals (stack traces, SQL, secrets) never reach the client.
 */
export function errorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(err)) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
      });
      return;
    }

    // Body parser errors (invalid JSON, payload too large).
    const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
    if (status === 400 || status === 413) {
      res.status(status).json({
        error: {
          code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR',
          message: status === 413 ? 'Request body too large' : 'Malformed request body',
        },
      });
      return;
    }

    logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}
