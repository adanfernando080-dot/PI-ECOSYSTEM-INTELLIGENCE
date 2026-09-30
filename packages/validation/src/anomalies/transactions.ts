import { clamp, isoDay, round } from '@pi/shared';
import { ANOMALY_CONFIG, severityFor, type AnomalyFinding } from './types';

export interface TransactionSample {
  sender: string;
  receiver: string;
  amount: number;
  timestamp: Date;
}

/**
 * Concentration signal: a large share of the observable volume involves a
 * single counterparty (sender). Also reports the Herfindahl–Hirschman index.
 */
export function detectConcentration(
  appId: string,
  txs: readonly TransactionSample[],
  windowKey: string,
  now = new Date(),
): AnomalyFinding | null {
  const cfg = ANOMALY_CONFIG.concentration;
  if (txs.length < cfg.minTransactions) return null;

  const bySender = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    const a = Math.max(0, t.amount);
    bySender.set(t.sender, (bySender.get(t.sender) ?? 0) + a);
    total += a;
  }
  if (total <= 0) return null;

  let topSender = '';
  let topVolume = 0;
  let hhi = 0;
  for (const [sender, volume] of bySender) {
    const share = volume / total;
    hhi += share * share;
    if (volume > topVolume) {
      topVolume = volume;
      topSender = sender;
    }
  }
  const topShare = topVolume / total;
  const severity = severityFor(topShare, cfg.thresholds);
  if (!severity) return null;

  return {
    type: 'CONCENTRATION_SIGNAL',
    severity,
    score: round(clamp(topShare * 100, 0, 100)),
    explanation:
      `Concentration signal: ${round(topShare * 100, 1)}% of the observable volume in this window comes from a single ` +
      `address across ${txs.length} transactions (HHI ${round(hhi, 3)}). It can have ordinary explanations ` +
      `(e.g. a treasury or payout account) and is not a conclusion about the app.`,
    detectedAt: now,
    fingerprint: `${appId}:CONCENTRATION_SIGNAL:${windowKey}`,
    metadata: { topShare: round(topShare, 4), hhi: round(hhi, 4), transactions: txs.length, topAddress: maskAddress(topSender) },
  };
}

/**
 * Repeated transaction pattern: many transactions share the same
 * (sender, receiver, amount) triple.
 */
export function detectRepeatedPattern(
  appId: string,
  txs: readonly TransactionSample[],
  windowKey: string,
  now = new Date(),
): AnomalyFinding | null {
  const cfg = ANOMALY_CONFIG.repeatedPattern;
  if (txs.length === 0) return null;

  const patterns = new Map<string, { count: number; first: Date; last: Date }>();
  for (const t of txs) {
    const key = `${t.sender}|${t.receiver}|${round(t.amount, 7)}`;
    const p = patterns.get(key);
    if (p) {
      p.count++;
      if (t.timestamp < p.first) p.first = t.timestamp;
      if (t.timestamp > p.last) p.last = t.timestamp;
    } else {
      patterns.set(key, { count: 1, first: t.timestamp, last: t.timestamp });
    }
  }

  let topKey = '';
  let top = { count: 0, first: now, last: now };
  for (const [key, p] of patterns) {
    if (p.count > top.count) {
      top = p;
      topKey = key;
    }
  }
  if (top.count < cfg.minOccurrences) return null;

  const share = top.count / txs.length;
  const severity = severityFor(share, cfg.thresholds);
  if (!severity) return null;
  const [sender, receiver, amount] = topKey.split('|');

  return {
    type: 'REPEATED_TRANSACTION_PATTERN',
    severity,
    score: round(clamp(share * 100, 0, 100)),
    explanation:
      `Repeated transaction pattern: ${top.count} transactions (${round(share * 100, 1)}% of the window) share the ` +
      `same sender, receiver and amount (${amount} Pi) between ${isoDay(top.first)} and ${isoDay(top.last)}. ` +
      `Subscriptions or automated payouts can produce this; it is a signal to review, not a conclusion.`,
    detectedAt: now,
    fingerprint: `${appId}:REPEATED_TRANSACTION_PATTERN:${windowKey}`,
    metadata: {
      occurrences: top.count,
      share: round(share, 4),
      amount: Number(amount),
      sender: maskAddress(sender ?? ''),
      receiver: maskAddress(receiver ?? ''),
    },
  };
}

/** Keeps addresses recognisable for admins without exposing them in full. */
export function maskAddress(address: string): string {
  return address.length <= 10 ? address : `${address.slice(0, 5)}…${address.slice(-4)}`;
}
