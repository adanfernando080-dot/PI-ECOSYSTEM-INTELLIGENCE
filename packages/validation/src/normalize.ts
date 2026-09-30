import { pairAgreement } from '@pi/confidence';
import { isoDay, round, type MetricType, type Provenance } from '@pi/shared';

/** A persisted raw data point, as the normalization step sees it. */
export interface RawPoint {
  metricType: MetricType;
  /** Day (UTC) the data point covers. */
  day: Date;
  value: number | null;
  provenance: Provenance;
  sourceId: string;
  /** Source trust level 0..100. */
  sourceTrust: number;
  /** For address/user metrics: confidence (0..1) that they are attributable to the app. */
  attributionConfidence?: number | null;
}

/** One value per (metric, day), chosen among possibly several sources. */
export interface NormalizedPoint {
  metricType: MetricType;
  day: string;
  value: number | null;
  provenance: Provenance;
  sourceId: string;
  /** Number of sources that reported a value for this metric/day. */
  reportingSources: number;
  attributionConfidence: number | null;
}

export interface NormalizationResult {
  points: NormalizedPoint[];
  /** Pairs of values reported by different sources for the same metric/day. */
  overlaps: [number, number][];
  /** Distinct sources that contributed at least one kept or concordant value. */
  concordantSources: Set<string>;
}

const PROVENANCE_RANK: Record<Provenance, number> = {
  OBSERVABLE: 3,
  DEVELOPER_REPORTED: 2,
  ESTIMATED: 1,
  UNAVAILABLE: 0,
};

/** Values within this agreement of the kept value count as concordant. */
export const CONCORDANCE_THRESHOLD = 0.9;

/**
 * DATA NORMALIZATION step.
 *
 * For each (metric, day) keeps a single value using this precedence:
 *   OBSERVABLE > DEVELOPER_REPORTED > ESTIMATED > UNAVAILABLE, then source trust.
 * Conflicting values are never averaged: the most trustworthy one is kept and
 * the disagreement is recorded (used by the confidence engine).
 */
export function normalizeRawPoints(points: readonly RawPoint[]): NormalizationResult {
  const groups = new Map<string, RawPoint[]>();
  for (const p of points) {
    const key = `${p.metricType}|${isoDay(p.day)}`;
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }

  const out: NormalizedPoint[] = [];
  const overlaps: [number, number][] = [];
  const concordantSources = new Set<string>();

  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => PROVENANCE_RANK[b.provenance] - PROVENANCE_RANK[a.provenance] || b.sourceTrust - a.sourceTrust,
    );
    const kept = sorted[0]!;
    const withValue = sorted.filter((p) => p.value !== null);

    if (kept.value !== null) {
      concordantSources.add(kept.sourceId);
      for (const other of withValue) {
        if (other === kept || other.sourceId === kept.sourceId) continue;
        overlaps.push([kept.value, other.value!]);
        if (pairAgreement(kept.value, other.value!) >= CONCORDANCE_THRESHOLD) concordantSources.add(other.sourceId);
      }
    }

    out.push({
      metricType: kept.metricType,
      day: isoDay(kept.day),
      value: kept.value === null ? null : round(kept.value, 6),
      provenance: kept.provenance,
      sourceId: kept.sourceId,
      reportingSources: new Set(withValue.map((p) => p.sourceId)).size,
      attributionConfidence: kept.attributionConfidence ?? null,
    });
  }

  out.sort((a, b) => a.day.localeCompare(b.day) || a.metricType.localeCompare(b.metricType));
  return { points: out, overlaps, concordantSources };
}
