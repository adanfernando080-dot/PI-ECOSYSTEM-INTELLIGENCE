/**
 * Metrics worker — computes app_metrics for one day (all periods) and appends
 * them to the history.   npm run worker:metrics -- --date=2026-09-28
 */
import { disconnectPrisma, getPrisma } from '@pi/database';
import { recordMetrics } from '@pi/metrics/persistence';
import { parseAsOf, runWorker } from './cli';

const asOf = parseAsOf(process.argv.slice(2));
await runWorker(
  'metrics',
  async () => ({ asOf: asOf.toISOString().slice(0, 10), inserted: await recordMetrics(getPrisma(), [asOf]) }),
  disconnectPrisma,
);
