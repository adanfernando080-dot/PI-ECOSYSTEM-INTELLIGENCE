/**
 * npm run db:bootstrap -- [--apply] [--admin-pi-username=NAME --confirm-admin=NAME] [--allow-demo-data-present]
 *
 * DRY RUN by default (reads the database, writes nothing). Writes only with --apply.
 * Applying on a remote database requires DB_ALLOW_REMOTE_WRITE=<exact host>
 * (same guard mechanism as the seed, separate variable). Never prints DATABASE_URL.
 */
import { disconnectPrisma, getPrisma, loadDotEnv } from '../index';
import { adminConfirmationProblem, runBootstrap } from './bootstrap';
import { parseArgs } from './cli-args';
import { evaluateDatabaseGuard, WRITE_POLICY } from '../seed/guard';
import { createPrismaBootstrapStore } from './prisma-stores';

const USAGE = `Usage: npm run db:bootstrap -- [--apply] [--admin-pi-username=NAME --confirm-admin=NAME] [--allow-demo-data-present]
  (no flag)              dry run: shows what would be created, writes nothing
  --apply                performs the changes (idempotent)
  --admin-pi-username    create the FIRST administrator (only when none exists); type it again in --confirm-admin
  --allow-demo-data-present   local tests only: tolerate demo rows in the database`;

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), {
    flags: ['apply', 'help', 'allow-demo-data-present'],
    values: ['admin-pi-username', 'confirm-admin'],
  });
  if (args.flags.has('help') || args.unknown.length > 0) {
    if (args.unknown.length > 0) console.error(`[bootstrap] unknown argument(s): ${args.unknown.join(' ')}`);
    console.log(USAGE);
    return args.unknown.length > 0 ? 1 : 0;
  }
  const apply = args.flags.has('apply');
  const adminPiUsername = args.values.get('admin-pi-username') ?? process.env.BOOTSTRAP_ADMIN_PI_USERNAME ?? null;
  const confirm = args.values.get('confirm-admin') ?? null;

  loadDotEnv();
  // Guard BEFORE any connection when writing. A dry run only reads.
  const guard = evaluateDatabaseGuard(process.env, WRITE_POLICY);
  if (apply && !guard.ok) {
    console.error(`[bootstrap] ${guard.reason}`);
    return 1;
  }
  if (apply) {
    const problem = adminConfirmationProblem(adminPiUsername, confirm);
    if (problem) {
      console.error(`[bootstrap] ${problem}`);
      return 1;
    }
  }
  console.log(`[bootstrap] ${apply ? 'APPLY' : 'DRY RUN'} — target: ${guard.ok ? `${guard.target} database${guard.hosts.length ? ` (${guard.hosts.join(', ')})` : ''}` : 'unverified (guard would refuse --apply)'}`);

  const prisma = getPrisma();
  try {
    const { plan, applied } = await runBootstrap(createPrismaBootstrapStore(prisma), {
      apply,
      adminPiUsername,
      allowDemoPresent: args.flags.has('allow-demo-data-present'),
    });
    console.log(`[bootstrap] categories: ${plan.createCategories.length} to create, ${plan.existingCategories} already present`);
    for (const c of plan.createCategories) console.log(`            + ${c.slug}`);
    console.log(`[bootstrap] administrator: ${plan.createAdmin ? `will create "${plan.createAdmin}" (role ADMIN, no credential: usable once Pi authentication exists)` : 'none to create'}`);
    for (const n of plan.notes) console.log(`[bootstrap] note: ${n}`);
    for (const w of plan.warnings) console.warn(`[bootstrap] warning: ${w}`);
    for (const e of plan.errors) console.error(`[bootstrap] ERROR: ${e}`);
    if (plan.errors.length > 0) return 1;
    if (applied) console.log(`[bootstrap] done: ${applied.categoriesCreated} categories created, administrator created: ${applied.adminCreated ? 'yes' : 'no'}`);
    else if (!apply) console.log('[bootstrap] dry run only: nothing was written. Re-run with --apply to perform the changes.');
    else console.log('[bootstrap] nothing to do (already up to date).');
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
    console.error(`[bootstrap] failed: ${(err as Error).message}`);
    process.exitCode = 1;
  },
);
