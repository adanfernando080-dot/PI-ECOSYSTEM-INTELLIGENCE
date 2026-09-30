/**
 * Blockchain sync worker — PLACEHOLDER (V1).
 *
 * V1 deliberately ships no blockchain indexer (ADR-0003). This worker only
 * checks the configured provider and reports that no data is available. When
 * a real BlockchainDataProvider is added in integrations/pi, this worker will:
 *   1. fetch NormalizedTransaction[] for the known app addresses;
 *   2. apply attributionFor() (integrations/pi) before persistence;
 *   3. write transactions + daily RawMetric rows with provenance OBSERVABLE.
 */
import { createPiIntegration } from '@pi/integrations-pi';

const pi = createPiIntegration();
const now = new Date();
const result = await pi.blockchain.getTransactions([], { from: new Date(now.getTime() - 86_400_000), to: now });

console.log(
  JSON.stringify({
    worker: 'blockchain-sync',
    provider: pi.blockchain.name,
    available: result.available,
    reason: result.available ? undefined : result.reason,
  }),
);
