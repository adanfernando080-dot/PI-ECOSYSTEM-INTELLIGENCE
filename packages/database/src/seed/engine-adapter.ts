import type { AppProfile, MetricPointRecord, ReviewRecord, TransactionRecord } from '@pi/metrics';
import type { DemoDataset } from './generator';

/** Maps the in-memory demo dataset to metrics-engine inputs (used by tests and the seed). */
export function demoToEngineInputs(ds: DemoDataset): {
  apps: AppProfile[];
  pointsByApp: Map<string, MetricPointRecord[]>;
  reviews: ReviewRecord[];
  transactions: TransactionRecord[];
} {
  const trust = new Map(ds.dataSources.map((s) => [s.id, s.trustLevel]));
  const devs = new Map(ds.developers.map((d) => [d.id, d]));

  const pointsByApp = new Map<string, MetricPointRecord[]>();
  for (const m of ds.rawMetrics) {
    const point: MetricPointRecord = {
      appId: m.appId,
      metricType: m.metricType,
      day: m.periodStart,
      value: m.value,
      provenance: m.provenance,
      sourceId: m.sourceId,
      sourceTrust: trust.get(m.sourceId) ?? 0,
      attributionConfidence:
        typeof m.metadata.attributionConfidence === 'number' ? m.metadata.attributionConfidence : null,
    };
    const list = pointsByApp.get(m.appId);
    if (list) list.push(point);
    else pointsByApp.set(m.appId, [point]);
  }

  return {
    apps: ds.apps.map((a) => ({
      id: a.id,
      name: a.name,
      isDemo: true,
      description: a.description,
      categoryId: a.categoryId,
      url: a.url,
      logoUrl: a.logoUrl,
      tags: a.tags,
      methodologyNote: a.methodologyNote,
      developer: a.developerId ? { verified: devs.get(a.developerId)?.verificationStatus === 'VERIFIED' } : null,
      firstSeenAt: a.firstSeenAt,
    })),
    pointsByApp,
    reviews: ds.reviews.map((r) => ({ appId: r.appId, rating: r.rating, status: r.status, createdAt: r.createdAt })),
    transactions: ds.transactions.map((t) => ({
      appId: t.appId,
      sender: t.sender,
      receiver: t.receiver,
      amount: t.amount,
      timestamp: t.timestamp,
      attributionConfidence: t.attributionConfidence,
    })),
  };
}
