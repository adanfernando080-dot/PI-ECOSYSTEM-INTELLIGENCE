import {
  addDays,
  daysBetween,
  isoDay,
  mean,
  percentile,
  periodToDays,
  previousWindow,
  round,
  windowEndingAt,
  type MetricType,
  type Period,
  type Window,
} from '@pi/shared';
import { consistencyFromPairs } from '@pi/confidence';
import { DEFAULT_NORMALIZATION_CONTEXT, type NormalizationContext } from '@pi/scoring';
import { normalizeRawPoints, type NormalizedPoint } from '@pi/validation';
import type { MetricPointRecord } from './types';

/** Metrics that feed the V1 scores. STAKED_PI is deliberately excluded. */
export const SCORED_METRICS: readonly MetricType[] = [
  'TRANSACTION_COUNT',
  'TRANSACTION_VOLUME_PI',
  'ACTIVE_ADDRESSES',
  'ACTIVE_USERS',
];

/**
 * Minimum share of "known" days (observed days + days before the app existed)
 * required to produce a window total. Below it the total is unavailable.
 */
export const MIN_DAY_COVERAGE = 0.5;

/** Measures extracted for one app over one analysis window. null = unavailable. */
export interface AppMeasures {
  window: Window;
  previous: Window;
  /**
   * Window totals. When some days are missing, the total is the observed
   * daily rate × window days (missing days are never counted as 0) and the
   * corresponding `*Extrapolated` flag is set.
   */
  transactionCount: number | null;
  transactionCountExtrapolated: boolean;
  previousTransactionCount: number | null;
  activeDays: number | null;
  /** Mean daily active addresses (or active users when addresses are unavailable). */
  activeAddresses: number | null;
  addressAttributionConfidence: number | null;
  volumePi: number | null;
  volumeExtrapolated: boolean;
  previousVolumePi: number | null;
  daysSinceLastActivity: number | null;
  subPeriods: (number | null)[];
  stakedPi: number | null;
  /** Share of window days whose transaction count is known. */
  dayCoverage: number;
  /** Data quality facts for the confidence engine. */
  provenanceCounts: Record<string, number>;
  daysSinceLastUpdate: number | null;
  consistency: number | null;
  concordantSources: number;
  hasDeveloperReportedData: boolean;
  provenanceKnownShare: number | null;
}

interface WindowTotal {
  value: number | null;
  knownDays: number;
  extrapolated: boolean;
}

/**
 * Total of a daily metric over a window.
 *  - days before `firstSeenAt` are KNOWN zeros (the app was not listed yet);
 *  - days without data are UNKNOWN, never zeros: the total is extrapolated
 *    from the observed daily rate, or null below MIN_DAY_COVERAGE.
 */
export function windowTotal(points: readonly NormalizedPoint[], w: Window, firstSeenAt: Date | null): WindowTotal {
  const firstDay = firstSeenAt ? isoDay(firstSeenAt) : null;
  let preDays = 0;
  for (let i = 0; i < w.days; i++) {
    const d = isoDay(addDays(w.start, i));
    if (firstDay !== null && d < firstDay) preDays++;
  }
  const available = points.filter((p) => inRange(p.day, w) && p.value !== null && (firstDay === null || p.day >= firstDay));
  const knownDays = preDays + available.length;
  if (knownDays === 0 || knownDays / w.days < MIN_DAY_COVERAGE) {
    return { value: null, knownDays, extrapolated: false };
  }
  const sum = available.reduce((acc, p) => acc + p.value!, 0);
  return {
    value: round((sum / knownDays) * w.days, 6),
    knownDays,
    extrapolated: knownDays < w.days,
  };
}

/**
 * Extracts window measures from raw points (DATA NORMALIZATION → METRICS).
 * `points` should contain the app's data for at least the current window and
 * the previous one; extra history is used to find the last activity date.
 */
export function extractMeasures(
  points: readonly MetricPointRecord[],
  asOf: Date,
  period: Period,
  firstSeenAt: Date | null = null,
): AppMeasures {
  const days = periodToDays(period);
  const window = windowEndingAt(asOf, days);
  const previous = previousWindow(window);

  const relevant = points.filter((p) => p.day >= previous.start && p.day < window.end);
  const normalized = normalizeRawPoints(relevant);
  const inWindow = normalized.points.filter((p) => inRange(p.day, window));

  const tx = byMetric(normalized.points, 'TRANSACTION_COUNT');
  const volume = byMetric(normalized.points, 'TRANSACTION_VOLUME_PI');
  const txCurrent = windowTotal(tx, window, firstSeenAt);
  const txPrevious = windowTotal(tx, previous, firstSeenAt);
  const volCurrent = windowTotal(volume, window, firstSeenAt);
  const volPrevious = windowTotal(volume, previous, firstSeenAt);

  const addresses = byMetric(inWindow, 'ACTIVE_ADDRESSES');
  const users = byMetric(inWindow, 'ACTIVE_USERS');
  const addressSeries = addresses.some((p) => p.value !== null) ? addresses : users;

  // Frequency: share of known days with activity, expressed in window days.
  const txDaysAvailable = tx.filter((p) => inRange(p.day, window) && p.value !== null);
  const activeDays =
    txCurrent.value === null
      ? null
      : round((txDaysAvailable.filter((p) => p.value! > 0).length / txCurrent.knownDays) * days, 2);

  // Window-level data quality (scored metrics only).
  const scored = inWindow.filter((p) => SCORED_METRICS.includes(p.metricType));
  const provenanceCounts: Record<string, number> = {};
  for (const p of scored) provenanceCounts[p.provenance] = (provenanceCounts[p.provenance] ?? 0) + 1;
  const known = scored.filter((p) => p.provenance !== 'UNAVAILABLE').length;
  const latestDataDay = latestDay(normalized.points.filter((p) => p.value !== null && SCORED_METRICS.includes(p.metricType)));

  return {
    window,
    previous,
    transactionCount: txCurrent.value,
    transactionCountExtrapolated: txCurrent.extrapolated,
    previousTransactionCount: txPrevious.value,
    activeDays,
    activeAddresses: meanAvailable(addressSeries),
    addressAttributionConfidence: meanAttribution(addressSeries),
    volumePi: volCurrent.value,
    volumeExtrapolated: volCurrent.extrapolated,
    previousVolumePi: volPrevious.value,
    daysSinceLastActivity: lastActivityGap(points, asOf),
    subPeriods: subPeriodTotals(tx, window, firstSeenAt),
    stakedPi: latestValue(byMetric(inWindow, 'STAKED_PI')),
    dayCoverage: round(txCurrent.knownDays / days, 4),
    provenanceCounts,
    daysSinceLastUpdate: latestDataDay === null ? null : Math.max(0, daysBetween(latestDataDay, addDays(window.end, -1))),
    // Agreement between overlapping sources over the analysed horizon.
    consistency: consistencyFromPairs(normalized.overlaps),
    concordantSources: normalized.concordantSources.size,
    hasDeveloperReportedData: scored.some((p) => p.provenance === 'DEVELOPER_REPORTED'),
    provenanceKnownShare: scored.length === 0 ? null : round(known / scored.length, 4),
  };
}

/**
 * Ecosystem reference values for one (date, period): the 90th percentile of
 * each measure across apps, floored so a quiet ecosystem does not inflate
 * scores. Documented in docs/scoring/README.md.
 */
export function buildNormalizationContext(all: readonly AppMeasures[]): NormalizationContext {
  const p90 = (values: (number | null)[], floor: number) => {
    const v = values.filter((x): x is number => x !== null && x > 0);
    return Math.max(percentile(v, 90) ?? 0, floor);
  };
  const scale = all[0] ? all[0].window.days / 30 : 1;
  return {
    transactionCountRef: p90(all.map((m) => m.transactionCount), DEFAULT_NORMALIZATION_CONTEXT.transactionCountRef * scale * 0.1),
    activeAddressesRef: p90(all.map((m) => m.activeAddresses), 10),
    volumePiRef: p90(all.map((m) => m.volumePi), DEFAULT_NORMALIZATION_CONTEXT.volumePiRef * scale * 0.1),
    absoluteGrowthRef: p90(
      all.map((m) =>
        m.transactionCount === null || m.previousTransactionCount === null
          ? null
          : Math.abs(m.transactionCount - m.previousTransactionCount),
      ),
      10,
    ),
    baseSizeRef: p90(all.map((m) => m.previousTransactionCount), 50),
  };
}

// ------------------------------------------------------------- helpers ----

function inRange(day: string, w: Window): boolean {
  return day >= isoDay(w.start) && day < isoDay(w.end);
}

function byMetric(points: readonly NormalizedPoint[], metric: MetricType): NormalizedPoint[] {
  return points.filter((p) => p.metricType === metric);
}

function meanAvailable(points: readonly NormalizedPoint[]): number | null {
  const m = mean(points.filter((p) => p.value !== null).map((p) => p.value!));
  return m === null ? null : round(m, 4);
}

function meanAttribution(points: readonly NormalizedPoint[]): number | null {
  const m = mean(points.filter((p) => p.value !== null && p.attributionConfidence !== null).map((p) => p.attributionConfidence!));
  return m === null ? null : round(m, 4);
}

function latestValue(points: readonly NormalizedPoint[]): number | null {
  const available = points.filter((p) => p.value !== null);
  return available.length === 0 ? null : available[available.length - 1]!.value;
}

function latestDay(points: readonly NormalizedPoint[]): Date | null {
  if (points.length === 0) return null;
  const max = points.reduce((acc, p) => (p.day > acc ? p.day : acc), points[0]!.day);
  return new Date(`${max}T00:00:00Z`);
}

function lastActivityGap(points: readonly MetricPointRecord[], asOf: Date): number | null {
  let last: Date | null = null;
  for (const p of points) {
    if (p.metricType !== 'TRANSACTION_COUNT' || p.value === null || p.value <= 0) continue;
    if (p.day > asOf) continue;
    if (!last || p.day > last) last = p.day;
  }
  return last === null ? null : Math.max(0, daysBetween(last, asOf));
}

/** Four consecutive sub-period totals ending with the window (for growth persistence). */
function subPeriodTotals(points: readonly NormalizedPoint[], window: Window, firstSeenAt: Date | null): (number | null)[] {
  const len = Math.max(1, Math.floor(window.days / 4));
  const out: (number | null)[] = [];
  for (let i = 3; i >= 0; i--) {
    const end = addDays(window.end, -i * len);
    out.push(windowTotal(points, { start: addDays(end, -len), end, days: len }, firstSeenAt).value);
  }
  return out;
}
