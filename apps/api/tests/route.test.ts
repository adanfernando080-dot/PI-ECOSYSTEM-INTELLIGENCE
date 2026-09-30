import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { AppError } from '@pi/shared';
import { route } from '../src/http/route';

/** Minimal req/res doubles: the adapter only uses params, query, body, ip, status, json and locals. */
function call(handler: ReturnType<typeof route>, req: { params?: unknown; query?: unknown; body?: unknown }, user: unknown = null) {
  return new Promise<{ status: number; body: unknown; error?: unknown }>((resolve) => {
    let status = 200;
    const res = {
      locals: { user },
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        resolve({ status, body });
        return this;
      },
    };
    const request = { params: {}, query: {}, body: undefined, ip: '127.0.0.1', ...req };
    void (handler as unknown as (a: unknown, b: unknown, c: (e: unknown) => void) => void)(request, res, (error) =>
      resolve({ status: -1, body: null, error }),
    );
  });
}

describe('route adapter', () => {
  const handler = route(
    { params: z.object({ id: z.string().min(2) }), query: z.object({ n: z.coerce.number().default(1) }) },
    async ({ params, query, user }) => ({ data: { id: params.id, n: query.n, user }, meta: { ok: true } }),
  );

  it('wraps results in the { data, meta } envelope', async () => {
    const r = await call(handler, { params: { id: 'ab' }, query: { n: '3' } }, { id: 'u' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ data: { id: 'ab', n: 3, user: { id: 'u' } }, meta: { ok: true } });
  });

  it('passes validation failures to the error handler as VALIDATION_ERROR', async () => {
    const r = await call(handler, { params: { id: 'a' } });
    expect(r.error instanceof AppError).toBe(true);
    expect((r.error as AppError).code).toBe('VALIDATION_ERROR');
  });

  it('honours custom status codes and forwards thrown errors', async () => {
    const created = route({}, async () => ({ status: 201, data: 1 }));
    expect((await call(created, {})).status).toBe(201);
    const failing = route({}, async () => {
      throw AppError.forbidden();
    });
    expect(((await call(failing, {})).error as AppError).code).toBe('FORBIDDEN');
  });
});
