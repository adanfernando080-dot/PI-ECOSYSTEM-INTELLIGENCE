/**
 * Vitest global setup for integration tests: applies migrations to the test
 * database (DATABASE_URL, expected to point at a disposable database) and
 * loads the DEMO seed.
 */
import { execSync } from 'node:child_process';

export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must point to a disposable test database for integration tests');
  if (!/test/i.test(url) && process.env.ALLOW_NON_TEST_DB !== 'true') {
    throw new Error('Refusing to reset a database whose URL does not contain "test" (set ALLOW_NON_TEST_DB=true to override)');
  }
  const run = (cmd: string) => execSync(cmd, { stdio: 'inherit', env: process.env });
  run('npx prisma migrate reset --force --skip-seed --schema packages/database/prisma/schema.prisma');
  run('npx tsx packages/database/src/seed/index.ts');
}
