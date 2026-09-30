import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads `.env` from the working directory into process.env (Node ≥ 20.12
 * built-in, no dependency). Variables already set in the environment win.
 * Called explicitly by entrypoints (API server, seed, workers, scripts).
 */
export function loadDotEnv(file = '.env'): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (typeof loader === 'function') loader(path);
}
