import type { AnomalySeverity, AnomalyType } from '@pi/shared';

/**
 * A statistical signal. It describes something UNUSUAL in the data; it is
 * never evidence of wrongdoing and its wording must stay neutral.
 */
export interface AnomalyFinding {
  type: AnomalyType;
  severity: AnomalySeverity;
  /** 0..100 statistical strength. */
  score: number;
  /** Neutral, human-readable explanation. */
  explanation: string;
  detectedAt: Date;
  /** Stable key used to avoid recording the same signal twice. */
  fingerprint: string;
  metadata: Record<string, unknown>;
}

export const ANOMALY_CONFIG = {
  spike: {
    /** Days of history required before the last day can be assessed. */
    minBaselineDays: 7,
    /** Robust z-score thresholds (inclusive) per severity. */
    thresholds: { LOW: 4, MEDIUM: 7, HIGH: 12 },
    /** Ignore spikes whose absolute value stays tiny. */
    minValue: 20,
  },
  concentration: {
    minTransactions: 20,
    /** Share of volume from the single largest counterparty. */
    thresholds: { LOW: 0.5, MEDIUM: 0.7, HIGH: 0.9 },
  },
  repeatedPattern: {
    minOccurrences: 10,
    /** Share of all transactions represented by the most repeated pattern. */
    thresholds: { LOW: 0.25, MEDIUM: 0.45, HIGH: 0.7 },
  },
  reviews: {
    minBaselineDays: 7,
    thresholds: { LOW: 4, MEDIUM: 7, HIGH: 12 },
    minReviewsInBurst: 5,
    /** Share of identical ratings in a burst considered unusually uniform. */
    uniformShare: 0.9,
  },
} as const;

export function severityFor(
  value: number,
  thresholds: { LOW: number; MEDIUM: number; HIGH: number },
): AnomalySeverity | null {
  if (value >= thresholds.HIGH) return 'HIGH';
  if (value >= thresholds.MEDIUM) return 'MEDIUM';
  if (value >= thresholds.LOW) return 'LOW';
  return null;
}
