/**
 * npm run catalogue:import -- --file=<catalogue.json> [--apply] [--allow-demo-data-present]
 *
 * DRY RUN by default: validates the file and shows exactly what would change.
 * Writes only with --apply, and only when the whole file is valid. Applying on a
 * remote database requires DB_ALLOW_REMOTE_WRITE=<exact host>. Never prints DATABASE_URL.
 */
import { readFileSync, statSync } from 'node:fs';
import { disconnectPrisma, getPrisma, loadDotEnv } from '../index';
import { parseCatalogue, runCatalogueImport } from './catalogue';
import { parseArgs } from './cli-args';
import { evaluateDatabaseGuard, WRITE_POLICY } from '../seed/guard';
import { createPrismaCatalogueStore } from './prisma-stores';

const USAGE = `Usage: npm run catalogue:import -- --file=<catalogue.json> [--apply] [--allow-demo-data-present]
  (no --apply)           dry run: validates the file, writes nothing
  --apply                performs the import (idempotent, never overwrites existing applications)`;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), { flags: ['apply', 'help', 'allow-demo-data-present'], values: ['file'] });
  const file = args.values.get('file');
  if (args.flags.has('help') || args.unknown.length > 0 || !file) {
    if (args.unknown.length > 0) console.error(`[catalogue] unknown argument(s): ${args.unknown.join(' ')}`);
    else if (!file && !args.flags.has('help')) console.error('[catalogue] --file is required');
    console.log(USAGE);
    return args.flags.has('help') ? 0 : 1;
  }
  const apply = args.flags.has('apply');

  // 1. File → validated catalogue (no database involved yet).
  let raw: string;
  try {
    if (statSync(file).size > MAX_FILE_BYTES) throw new Error('file too large (max 5 MB)');
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`[catalogue] cannot read the file: ${(err as Error).message}`);
    return 1;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error('[catalogue] the file is not valid JSON');
    return 1;
  }
  const parsed = parseCatalogue(json);
  if (!parsed.ok) {
    console.error(`[catalogue] ${parsed.errors.length} validation error(s); nothing was read from or written to the database:`);
    for (const e of parsed.errors) console.error(`  - ${e.path || '(file)'}: ${e.message}`);
    return 1;
  }
  console.log(`[catalogue] file is valid: ${parsed.catalogue.apps.length} application(s)`);

  // 2. Guard before any connection when writing.
  loadDotEnv();
  const guard = evaluateDatabaseGuard(process.env, WRITE_POLICY);
  if (apply && !guard.ok) {
    console.error(`[catalogue] ${guard.reason}`);
    return 1;
  }
  console.log(`[catalogue] ${apply ? 'APPLY' : 'DRY RUN'} — target: ${guard.ok ? `${guard.target} database${guard.hosts.length ? ` (${guard.hosts.join(', ')})` : ''}` : 'unverified (guard would refuse --apply)'}`);

  const prisma = getPrisma();
  try {
    const { plan, applied } = await runCatalogueImport(createPrismaCatalogueStore(prisma), parsed.catalogue, {
      apply,
      allowDemoPresent: args.flags.has('allow-demo-data-present'),
    });
    const c = plan.counts;
    console.log(`[catalogue] applications: ${c.appsToCreate} to create, ${c.appsUnchanged} unchanged`);
    console.log(`[catalogue] addresses: ${c.addressesToAdd} to add, ${c.addressesToVerify} to mark verified, ${c.addressesUnchanged} unchanged (in file: ${c.addressesDeclared} declared, ${c.addressesVerified} verified)`);
    for (const x of plan.conflicts) console.warn(`[catalogue] conflict (not applied): ${x.path}: ${x.message}`);
    for (const e of plan.errors) console.error(`[catalogue] ERROR: ${e.path}: ${e.message}`);
    if (plan.errors.length > 0) {
      console.error('[catalogue] nothing was written: fix the errors above.');
      return 1;
    }
    if (applied) console.log(`[catalogue] done: ${applied.appsCreated} application(s) created, ${applied.addressesAdded} address(es) added, ${applied.addressesVerified} marked verified`);
    else if (!apply) console.log('[catalogue] dry run only: nothing was written. Re-run with --apply to import.');
    else console.log('[catalogue] nothing to do (already up to date).');
    return 0;
  } finally {
    await disconnectPrisma();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(`[catalogue] failed: ${(err as Error).message}`);
    process.exitCode = 1;
  },
);
