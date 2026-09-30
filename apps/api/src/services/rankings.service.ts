import type { Period, RankingType } from '@pi/shared';
import type { Repositories } from '../domain/ports';
import { demoMeta } from '../domain/presenters';

const RANKING_DESCRIPTIONS: Record<RankingType, string> = {
  activity: 'Ordered by Activity Score (observable transaction activity, frequency, addresses, recency).',
  growth: 'Ordered by Growth Score (relative and absolute growth, damped by base size, and persistence).',
  economic: 'Ordered by Observable Economic Activity (observable transactions and Pi volume — not revenue).',
  community: 'Ordered by Community Score (Bayesian average of published reviews). Apps without reviews are not ranked.',
  transparency: 'Ordered by Transparency Score (publicly disclosed information).',
  trending: 'Short-term momentum: 60% short-window growth + 40% activity.',
  rising: 'Apps listed in the last 90 days, ordered by Growth Score.',
  new: 'Apps listed in the last 30 days, most recent first.',
};

export async function getRanking(
  repos: Repositories,
  type: RankingType,
  query: { period: Period; limit: number; minConfidence?: number },
) {
  const batch = await repos.rankings.latestBatch(type, query.period);
  const rows = (batch?.rows ?? [])
    .filter((r) => query.minConfidence === undefined || r.confidence >= query.minConfidence)
    .slice(0, query.limit);
  const apps = await Promise.all(rows.map((r) => repos.apps.findById(r.appId)));

  const entries = rows.flatMap((r, i) => {
    const app = apps[i];
    if (!app || !['ACTIVE', 'INACTIVE'].includes(app.status)) return [];
    return [
      {
        rank: r.rank,
        score: r.score,
        confidence: r.confidence,
        app: {
          id: app.id,
          slug: app.slug,
          name: app.name,
          logoUrl: app.logoUrl,
          category: app.category ? { slug: app.category.slug, name: app.category.name } : null,
          isDemo: app.isDemo,
        },
      },
    ];
  });

  return {
    data: { type, period: query.period, computedAt: batch?.computedAt.toISOString() ?? null, entries },
    meta: {
      description: RANKING_DESCRIPTIONS[type],
      note: 'A ranking orders apps along one analytical dimension. It is not a judgement that one app is better than another.',
      ...(batch ? {} : { status: 'NOT_COMPUTED', hint: 'No snapshot yet: run the rankings worker.' }),
      ...demoMeta(entries.some((e) => e.app.isDemo)),
    },
  };
}
