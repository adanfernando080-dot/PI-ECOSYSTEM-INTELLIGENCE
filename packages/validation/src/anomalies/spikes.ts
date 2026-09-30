import { clamp, isoDay, mad, median, round } from '@pi/shared';
import { ANOMALY_CONFIG, severityFor, type AnomalyFinding } from './types';

export interface DailyValue {
  day: Date;
  value: number | null;
}

/**
 * Robust z-score of the last value against the preceding baseline
 * (median / MAD, scaled by 1.4826 to be comparable to a standard deviation).
 * Returns null when the baseline is too short.
 */
export function robustZ(series: readonly DailyValue[], minBaselineDays: number): number | null {
  const values = series.filter((d): d is { day: Date; value: number } => d.value !== null);
  if (values.length < minBaselineDays + 1) return null;
  const last = values[values.length - 1]!.value;
  const baseline = values.slice(0, -1).map((d) => d.value);
  const m = median(baseline)!;
  const dispersion = mad(baseline)! * 1.4826;
  // Floor the dispersion so a perfectly flat baseline does not explode the score.
  const scale = Math.max(dispersion, Math.max(1, Math.abs(m) * 0.05));
  return (last - m) / scale;
}

function detectSpike(
  appId: string,
  series: readonly DailyValue[],
  type: 'ACTIVITY_SPIKE' | 'VOLUME_SPIKE',
  label: string,
  now: Date,
): AnomalyFinding | null {
  const cfg = ANOMALY_CONFIG.spike;
  const z = robustZ(series, cfg.minBaselineDays);
  const lastPoint = [...series].reverse().find((d) => d.value !== null);
  if (z === null || !lastPoint || lastPoint.value! < cfg.minValue) return null;
  const severity = severityFor(z, cfg.thresholds);
  if (!severity) return null;

  const baseline = median(series.slice(0, -1).flatMap((d) => (d.value === null ? [] : [d.value])))!;
  const day = isoDay(lastPoint.day);
  return {
    type,
    severity,
    score: round(clamp(z * 8, 0, 100)),
    explanation:
      `Unusual ${label} on ${day}: ${round(lastPoint.value!)} versus a typical ${round(baseline)} ` +
      `(robust z-score ${round(z, 1)}). This is a statistical signal to review, not a conclusion about the app.`,
    detectedAt: now,
    fingerprint: `${appId}:${type}:${day}`,
    metadata: { day, value: lastPoint.value, baselineMedian: baseline, robustZ: round(z, 3) },
  };
}

/** Sudden activity spike on the latest day (transaction count). */
export function detectActivitySpike(appId: string, series: readonly DailyValue[], now = new Date()) {
  return detectSpike(appId, series, 'ACTIVITY_SPIKE', 'activity (transaction count)', now);
}

/** Sudden observable volume spike on the latest day. */
export function detectVolumeSpike(appId: string, series: readonly DailyValue[], now = new Date()) {
  return detectSpike(appId, series, 'VOLUME_SPIKE', 'observable volume', now);
}
