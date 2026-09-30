import { describe, expect, it } from 'vitest';
import { attributionFor, createPiIntegration, isConsistentPoint, type NormalizedTransaction } from '../src';

const range = { from: new Date('2026-09-01'), to: new Date('2026-09-29') };

describe('createPiIntegration (V1)', () => {
  it('reports every provider as unavailable instead of returning empty data', async () => {
    const pi = createPiIntegration({ apiKey: 'secret' });
    const results = await Promise.all([
      pi.platform.getAppMetrics('app', range),
      pi.auth.verifyAccessToken('token'),
      pi.blockchain.getTransactions(['G...'], range),
      pi.staking.getStakedPi('app', range),
    ]);
    for (const r of results) {
      expect(r.available).toBe(false);
    }
  });

  it('never exposes the API key through the integration object', () => {
    const pi = createPiIntegration({ apiKey: 'super-secret-key' });
    expect(JSON.stringify(pi)).not.toContain('super-secret-key');
  });
});

describe('attributionFor', () => {
  const tx: NormalizedTransaction = {
    txHash: 'h',
    sender: 'a',
    receiver: 'b',
    amount: 1,
    timestamp: new Date(),
    status: 'CONFIRMED',
    appRef: 'app-1',
    attributionConfidence: 0.8,
    attributionMethod: 'memo',
  };

  it('links a confidently attributed transaction', () => {
    expect(attributionFor(tx)).toEqual({ appRef: 'app-1', confidence: 0.8 });
  });

  it('does not link a weakly attributed transaction', () => {
    expect(attributionFor({ ...tx, attributionConfidence: 0.3 })).toEqual({ appRef: null, confidence: 0.3 });
  });
});

describe('isConsistentPoint', () => {
  it('enforces UNAVAILABLE ⇔ null', () => {
    const p = {
      appRef: 'a',
      metricType: 'TRANSACTION_COUNT' as const,
      periodStart: new Date(),
      periodEnd: new Date(),
    };
    expect(isConsistentPoint({ ...p, value: null, provenance: 'UNAVAILABLE' })).toBe(true);
    expect(isConsistentPoint({ ...p, value: 0, provenance: 'UNAVAILABLE' })).toBe(false);
    expect(isConsistentPoint({ ...p, value: null, provenance: 'OBSERVABLE' })).toBe(false);
  });
});
