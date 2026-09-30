import type { MetricType, Provenance, TransactionStatus } from '@pi/shared';

/**
 * NORMALIZED DATA — the only shapes the core engines ever see.
 *
 *   Pi Adapter  →  Normalized Data  →  Core Metrics Engine
 *
 * Adapters translate whatever a Pi API or blockchain provider returns into
 * these types. A change in a Pi API only requires changing its adapter.
 */

export interface NormalizedTransaction {
  txHash: string;
  sender: string;
  receiver: string;
  /** Amount in Pi. */
  amount: number;
  timestamp: Date;
  status: TransactionStatus;
  /** Candidate app, when the adapter can attribute it. */
  appRef: string | null;
  /** 0..1 — never assume a transaction belongs economically to an app. */
  attributionConfidence: number;
  attributionMethod: string | null;
  raw?: Record<string, unknown>;
}

export interface NormalizedMetricPoint {
  appRef: string;
  metricType: MetricType;
  /** null ⇔ provenance UNAVAILABLE. */
  value: number | null;
  periodStart: Date;
  periodEnd: Date;
  provenance: Provenance;
  metadata?: Record<string, unknown>;
}

/** Result wrapper that makes unavailability explicit instead of returning empty data. */
export type ProviderResult<T> =
  | { available: true; data: T; fetchedAt: Date }
  | { available: false; reason: string };

export interface TimeRange {
  from: Date;
  to: Date;
}

/** Identity of a Pi user, as returned by Pi authentication. */
export interface PiIdentity {
  uid: string;
  username: string;
}
