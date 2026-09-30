import { DAY_MS, isFiniteNumber, type MetricType, type Provenance } from '@pi/shared';

/** A raw data point before persistence (from an adapter or a developer declaration). */
export interface RawMetricCandidate {
  metricType: MetricType;
  value: number | null;
  periodStart: Date;
  periodEnd: Date;
  provenance: Provenance;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; issues: ValidationIssue[] };

/** Metrics that are counts and must be integers. */
const COUNT_METRICS: ReadonlySet<MetricType> = new Set(['TRANSACTION_COUNT', 'ACTIVE_ADDRESSES', 'ACTIVE_USERS']);

/** Plausibility ceiling per day, to catch unit or typing errors (not a judgement). */
export const DAILY_PLAUSIBILITY_CEILING: Record<MetricType, number> = {
  TRANSACTION_COUNT: 10_000_000,
  TRANSACTION_VOLUME_PI: 1_000_000_000,
  ACTIVE_ADDRESSES: 50_000_000,
  ACTIVE_USERS: 50_000_000,
  STAKED_PI: 10_000_000_000,
};

/** Longest period a single raw metric may cover. */
export const MAX_PERIOD_DAYS = 31;

/**
 * Validates a raw metric before it enters the pipeline.
 *  - UNAVAILABLE ⇔ value is null (a missing value is never stored as 0);
 *  - values are finite and non-negative, counts are integers;
 *  - the period is a non-empty interval of at most 31 days, not in the future.
 */
export function validateRawMetric(candidate: RawMetricCandidate, now: Date = new Date()): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { value, provenance, metricType, periodStart, periodEnd } = candidate;

  if (provenance === 'UNAVAILABLE') {
    if (value !== null) issues.push({ field: 'value', message: 'UNAVAILABLE data must not carry a value' });
  } else if (value === null) {
    issues.push({ field: 'value', message: 'A missing value must use provenance UNAVAILABLE' });
  } else if (!isFiniteNumber(value)) {
    issues.push({ field: 'value', message: 'Value must be a finite number' });
  } else {
    if (value < 0) issues.push({ field: 'value', message: 'Value must be non-negative' });
    if (COUNT_METRICS.has(metricType) && !Number.isInteger(value)) {
      issues.push({ field: 'value', message: `${metricType} must be an integer` });
    }
  }

  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    issues.push({ field: 'period', message: 'Invalid period dates' });
  } else {
    if (endMs <= startMs) issues.push({ field: 'periodEnd', message: 'periodEnd must be after periodStart' });
    const days = (endMs - startMs) / DAY_MS;
    if (days > MAX_PERIOD_DAYS) {
      issues.push({ field: 'period', message: `A metric period cannot exceed ${MAX_PERIOD_DAYS} days` });
    }
    if (endMs > now.getTime() + DAY_MS) {
      issues.push({ field: 'periodEnd', message: 'periodEnd cannot be in the future' });
    }
    if (value !== null && isFiniteNumber(value) && days > 0) {
      const perDay = value / days;
      if (perDay > DAILY_PLAUSIBILITY_CEILING[metricType]) {
        issues.push({ field: 'value', message: 'Value exceeds the plausibility ceiling for this metric' });
      }
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
