/**
 * Anomaly worker — runs statistical anomaly detection for the given day.
 * Signals are recorded with status NEW for admin review; they are never
 * treated as conclusions about an app.
 *   npm run worker:anomalies -- --date=2026-09-28
 */
import { disconnectPrisma, getPrisma } from '@pi/database';
import { recordAnomalies } from '@pi/metrics/persistence';
import { parseAsOf, runWorker } from '../../metrics/src/cli';

const asOf = parseAsOf(process.argv.slice(2));
await runWorker(
  'anomalies',
  async () => ({ asOf: asOf.toISOString().slice(0, 10), recorded: await recordAnomalies(getPrisma(), asOf) }),
  disconnectPrisma,
);
