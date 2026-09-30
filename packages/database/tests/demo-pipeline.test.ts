import { describe, expect, it } from 'vitest';
import { computeRankings, computeSnapshot, detectAppAnomalies, type AppMetricRow } from '@pi/metrics';
import { findVerdictTerms, PERIODS, type Period } from '@pi/shared';
import { demoToEngineInputs } from '../src/seed/engine-adapter';
import { generateDemoDataset } from '../src/seed/generator';

const asOf = new Date('2026-09-28T00:00:00Z');
const ds = generateDemoDataset({ asOf });
const inputs = demoToEngineInputs(ds);
const idOf = (slug: string) => ds.apps.find((a) => a.slug === slug)!.id;

const snapshots = new Map<Period, Map<string, AppMetricRow>>();
for (const period of PERIODS) {
  const rows = computeSnapshot({ ...inputs, asOf, period });
  snapshots.set(period, new Map(rows.map((r) => [r.appId, r])));
}
const m30 = snapshots.get('30d')!;

describe('demo dataset', () => {
  it('is deterministic for a given seed and date', () => {
    const again = generateDemoDataset({ asOf });
    expect(again.apps.map((a) => a.id)).toEqual(ds.apps.map((a) => a.id));
    expect(again.rawMetrics.length).toBe(ds.rawMetrics.length);
  });

  it('contains the 12 fictional apps, all explicitly marked as demo', () => {
    expect(ds.apps).toHaveLength(12);
    for (const s of ds.dataSources) expect(s.name.startsWith('DEMO ·')).toBe(true);
    for (const m of ds.rawMetrics) expect(m.metadata.demo).toBe(true);
    for (const t of ds.transactions) expect(t.txHash.startsWith('demo_')).toBe(true);
    for (const a of ds.apps) expect(a.url === null || a.url.endsWith('.demo.invalid')).toBe(true);
  });

  it('never stores a missing value as 0', () => {
    for (const m of ds.rawMetrics) {
      expect(m.provenance === 'UNAVAILABLE').toBe(m.value === null);
    }
  });

  it('generates no timestamp after the end of asOf', () => {
    const limit = asOf.getTime() + 86_400_000;
    for (const r of ds.reviews) expect(r.createdAt.getTime()).toBeLessThan(limit);
    for (const t of ds.transactions) expect(t.timestamp.getTime()).toBeLessThanOrEqual(limit);
  });
});

describe('metrics engine on the demo dataset', () => {
  it('produces one bounded row per app and period', () => {
    for (const period of PERIODS) {
      const rows = [...snapshots.get(period)!.values()];
      expect(rows).toHaveLength(12);
      for (const r of rows) {
        for (const v of [r.activityScore, r.growthScore, r.economicScore, r.communityScore, r.transparencyScore, r.overallScore]) {
          if (v !== null) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(100);
          }
        }
        expect(r.isDemo).toBe(true);
      }
    }
  });

  it('leaves community unavailable (null) for an app without reviews', () => {
    expect(m30.get(idOf('pitools'))!.communityScore).toBeNull();
  });

  it('gives self-declared-only data a lower confidence than observable data', () => {
    const social = m30.get(idOf('pisocial'))!;
    const market = m30.get(idOf('pimarket'))!;
    expect(social.confidenceScore).toBeLessThan(market.confidenceScore);
  });

  it('reflects decline and fast growth in the growth score', () => {
    expect(m30.get(idOf('pitravel'))!.growthScore!).toBeLessThan(50);
    expect(m30.get(idOf('piai-hub'))!.growthScore!).toBeGreaterThan(m30.get(idOf('pitravel'))!.growthScore!);
  });

  it('keeps staking as a distinct value outside the scores', () => {
    const market = m30.get(idOf('pimarket'))!;
    expect(market.stakedPi).not.toBeNull();
    expect(JSON.stringify(market.details.overall)).not.toContain('stak');
  });

  it('never uses the word revenue', () => {
    expect(JSON.stringify([...m30.values()]).toLowerCase()).not.toContain('revenue');
  });

  it('produces analytical rankings including the new and rising apps', () => {
    const rankings = computeRankings(inputs.apps, snapshots, '30d', asOf);
    expect(rankings.new.map((e) => e.appId)).toContain(idOf('picreator'));
    expect(rankings.rising.map((e) => e.appId)).toContain(idOf('piai-hub'));
    expect(rankings.community.map((e) => e.appId)).not.toContain(idOf('pitools'));
    expect(rankings.activity.length).toBeGreaterThan(5);
  });
});

describe('anomaly engine on the demo dataset', () => {
  const run = (slug: string) =>
    detectAppAnomalies({
      appId: idOf(slug),
      points: inputs.pointsByApp.get(idOf(slug)) ?? [],
      transactions: inputs.transactions,
      reviews: inputs.reviews,
      asOf,
    });

  it('flags the scripted scenarios with neutral wording', () => {
    const games = run('pigames').map((f) => f.type);
    const pay = run('pipay-tools').map((f) => f.type);
    const services = run('piservices').map((f) => f.type);
    expect(games).toContain('ACTIVITY_SPIKE');
    expect(pay).toContain('CONCENTRATION_SIGNAL');
    expect(pay).toContain('REPEATED_TRANSACTION_PATTERN');
    expect(services).toContain('UNUSUAL_REVIEW_ACTIVITY');
    for (const slug of ['pigames', 'pipay-tools', 'piservices']) {
      for (const f of run(slug)) expect(findVerdictTerms(f.explanation)).toEqual([]);
    }
  });

  it('stays quiet for an ordinary app', () => {
    expect(run('pijobs')).toHaveLength(0);
  });
});
