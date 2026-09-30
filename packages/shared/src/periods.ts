/** Analysis windows used by metrics, history and rankings. */
export const PERIODS = ['24h', '7d', '30d', '90d'] as const;
export type Period = (typeof PERIODS)[number];

/** History ranges accepted by GET /api/apps/:id/history. */
export const HISTORY_RANGES = ['7d', '30d', '90d'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

const PERIOD_DAYS: Record<Period, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };

export const DAY_MS = 24 * 60 * 60 * 1000;

export function periodToDays(period: Period | HistoryRange): number {
  return PERIOD_DAYS[period];
}

/** Truncates a date to 00:00:00.000 UTC. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole days between two instants (b - a), floored. */
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

export interface Window {
  /** Inclusive start (00:00 UTC). */
  start: Date;
  /** Exclusive end (00:00 UTC of the day after the last day). */
  end: Date;
  days: number;
}

/**
 * Window of `days` full UTC days ending on (and including) the day of `asOf`.
 * e.g. asOf=2026-09-29, days=7 → [2026-09-23, 2026-09-30).
 */
export function windowEndingAt(asOf: Date, days: number): Window {
  const end = addDays(startOfUtcDay(asOf), 1);
  return { start: addDays(end, -days), end, days };
}

/** The window of identical length immediately preceding `window`. */
export function previousWindow(window: Window): Window {
  return { start: addDays(window.start, -window.days), end: window.start, days: window.days };
}

/** ISO date (YYYY-MM-DD) of a UTC day. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
