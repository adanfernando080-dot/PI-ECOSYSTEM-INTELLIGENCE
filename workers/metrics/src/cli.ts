import { loadDotEnv } from '@pi/database';
import { addDays, startOfUtcDay } from '@pi/shared';

loadDotEnv();

/**
 * Shared CLI helpers for workers. Workers are thin: they parse arguments,
 * call the metrics engine and exit. Scheduling (cron, queue) is left to the
 * infrastructure — see docs/development/README.md.
 */

/** Parses `--date=YYYY-MM-DD`; defaults to the last complete UTC day. */
export function parseAsOf(argv: readonly string[]): Date {
  const arg = argv.find((a) => a.startsWith('--date='));
  if (!arg) return addDays(startOfUtcDay(new Date()), -1);
  const value = new Date(`${arg.slice('--date='.length)}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) throw new Error(`Invalid --date: ${arg}`);
  return value;
}

export async function runWorker(name: string, job: () => Promise<unknown>, cleanup: () => Promise<void>) {
  const started = Date.now();
  try {
    const result = await job();
    console.log(JSON.stringify({ worker: name, status: 'ok', ms: Date.now() - started, result }));
  } catch (err) {
    console.error(JSON.stringify({ worker: name, status: 'error', message: (err as Error).message }));
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}
