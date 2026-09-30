/** Uniform API envelope used by every endpoint. */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SuccessEnvelope<T, M = Record<string, unknown>> {
  data: T;
  meta: M;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function paginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export const DEMO_DATA_NOTICE =
  'This response contains DEMO data generated for development. It does not describe real Pi applications.';
