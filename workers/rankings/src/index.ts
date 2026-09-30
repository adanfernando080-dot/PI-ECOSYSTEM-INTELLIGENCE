/**
 * Rankings worker — builds every analytical ranking from the latest metrics
 * of the given day and appends one snapshot batch.
 *   npm run worker:rankings -- --date=2026-09-28
 */
import { disconnectPrisma, getPrisma } from '@pi/database';
import { recordRankings } from '@pi/metrics/persistence';
import { parseAsOf, runWorker } from '../../metrics/src/cli';

const asOf = parseAsOf(process.argv.slice(2));
await runWorker(
  'rankings',
  async () => ({ asOf: asOf.toISOString().slice(0, 10), inserted: await recordRankings(getPrisma(), asOf) }),
  disconnectPrisma,
);
