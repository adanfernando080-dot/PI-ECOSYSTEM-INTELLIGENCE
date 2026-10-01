/**
 * Runs the seed guard on its own (no database connection). Used by `db:reset`
 * so the check happens BEFORE `prisma migrate reset` wipes anything.
 */
import { loadDotEnv } from '../load-env';
import { evaluateSeedGuard } from './guard';

loadDotEnv();
const result = evaluateSeedGuard(process.env);
if (!result.ok) {
  console.error(`[seed-guard] ${result.reason}`);
  process.exit(1);
}
console.log(`[seed-guard] OK (${result.target} database).`);
