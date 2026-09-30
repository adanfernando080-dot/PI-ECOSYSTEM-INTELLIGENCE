import { addDays, isoDay, startOfUtcDay } from '@pi/shared';
import {
  detectActivitySpike,
  detectConcentration,
  detectRepeatedPattern,
  detectUnusualReviewActivity,
  detectVolumeSpike,
  type AnomalyFinding,
  type DailyValue,
} from '@pi/validation';
import type { MetricPointRecord, ReviewRecord, TransactionRecord } from './types';

export const ANOMALY_WINDOW = {
  /** Days of daily history used as the spike baseline. */
  seriesDays: 30,
  /** Transactions window for concentration / repeated patterns. */
  transactionDays: 7,
  /** Only transactions attributed with at least this confidence are analysed. */
  minAttribution: 0.5,
} as const;

export interface AppAnomalyInput {
  appId: string;
  points: readonly MetricPointRecord[];
  transactions: readonly TransactionRecord[];
  reviews: readonly ReviewRecord[];
  asOf: Date;
}

/** ANOMALY DETECTION step for one app. Returns neutral statistical signals only. */
export function detectAppAnomalies(input: AppAnomalyInput, now = new Date()): AnomalyFinding[] {
  const asOfDay = startOfUtcDay(input.asOf);
  const findings: (AnomalyFinding | null)[] = [];

  findings.push(detectActivitySpike(input.appId, dailySeries(input.points, 'TRANSACTION_COUNT', asOfDay), now));
  findings.push(detectVolumeSpike(input.appId, dailySeries(input.points, 'TRANSACTION_VOLUME_PI', asOfDay), now));

  const txFrom = addDays(asOfDay, -(ANOMALY_WINDOW.transactionDays - 1));
  const txTo = addDays(asOfDay, 1);
  const txs = input.transactions.filter(
    (t) =>
      t.appId === input.appId &&
      t.attributionConfidence >= ANOMALY_WINDOW.minAttribution &&
      t.timestamp >= txFrom &&
      t.timestamp < txTo,
  );
  const windowKey = `${isoDay(asOfDay)}/${ANOMALY_WINDOW.transactionDays}d`;
  findings.push(detectConcentration(input.appId, txs, windowKey, now));
  findings.push(detectRepeatedPattern(input.appId, txs, windowKey, now));

  findings.push(
    detectUnusualReviewActivity(
      input.appId,
      input.reviews.filter((r) => r.appId === input.appId),
      asOfDay,
      ANOMALY_WINDOW.seriesDays,
      now,
    ),
  );

  return findings.filter((f): f is AnomalyFinding => f !== null);
}

/**
 * Daily series for one metric, one value per day (highest-precedence value
 * when several sources overlap). Days with no data stay null — never 0.
 */
function dailySeries(points: readonly MetricPointRecord[], metric: MetricPointRecord['metricType'], asOfDay: Date): DailyValue[] {
  const byDay = new Map<string, number | null>();
  const rank = { OBSERVABLE: 3, DEVELOPER_REPORTED: 2, ESTIMATED: 1, UNAVAILABLE: 0 } as const;
  const best = new Map<string, number>();
  for (const p of points) {
    if (p.metricType !== metric) continue;
    const key = isoDay(p.day);
    const r = rank[p.provenance];
    if ((best.get(key) ?? -1) < r) {
      best.set(key, r);
      byDay.set(key, p.value);
    }
  }
  const out: DailyValue[] = [];
  for (let i = ANOMALY_WINDOW.seriesDays - 1; i >= 0; i--) {
    const day = addDays(asOfDay, -i);
    out.push({ day, value: byDay.get(isoDay(day)) ?? null });
  }
  return out;
}
