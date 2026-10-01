/**
 * DEMO seed.
 *
 *   npm run db:seed
 *
 * Inserts the fictional demo dataset, then runs the real metrics pipeline
 * over the last 90 days so history, rankings and anomalies are available
 * immediately. Every inserted row is flagged isDemo = true. Re-running the
 * seed removes previous demo rows first; non-demo rows are never touched.
 *
 * It refuses to run against a remote database unless SEED_ALLOW_REMOTE_DATABASE
 * names that exact host (and, with NODE_ENV=production, SEED_ALLOW_PRODUCTION=true).
 */
import { addDays, PERIODS } from '@pi/shared';
import { recordAnomalies, recordMetrics, recordRankings } from '@pi/metrics/persistence';
import { disconnectPrisma, getPrisma, loadDotEnv, type Prisma, type PrismaClient } from '../index';
import { demoToEngineInputs } from './engine-adapter';
import { generateDemoDataset, type DemoDataset } from './generator';
import { evaluateSeedGuard } from './guard';

const HISTORY_DAYS = 90;
const CHUNK = 1000;

export async function seedDemo(prisma: PrismaClient, options: { asOf?: Date; log?: (m: string) => void } = {}) {
  const log = options.log ?? (() => undefined);
  const ds = generateDemoDataset({ asOf: options.asOf });
  log(`Generating DEMO dataset as of ${ds.asOf.toISOString().slice(0, 10)}…`);

  await removeDemoData(prisma);
  const categoryIds = await upsertCategories(prisma, ds);
  remapCategories(ds, categoryIds);
  await insertDataset(prisma, ds);
  log(`Inserted ${ds.apps.length} apps, ${ds.rawMetrics.length} raw metrics, ${ds.transactions.length} transactions, ${ds.reviews.length} reviews.`);

  const dates = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(ds.asOf, -(HISTORY_DAYS - 1 - i)));
  const engineData = demoToEngineInputs(ds);
  const metrics = await recordMetrics(prisma, dates, PERIODS, engineData);
  log(`Computed ${metrics} app_metrics rows (${HISTORY_DAYS} days × ${PERIODS.length} periods).`);

  const rankings = await recordRankings(prisma, ds.asOf);
  const anomalies = await recordAnomalies(prisma, ds.asOf);
  log(`Recorded ${rankings} ranking snapshot rows and ${anomalies} anomaly signals.`);

  return { asOf: ds.asOf, apps: ds.apps.length, metrics, rankings, anomalies };
}

/** Deletes every demo row. Cascades remove dependent metrics, reviews, snapshots… */
export async function removeDemoData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { isDemo: true } }),
    prisma.app.deleteMany({ where: { isDemo: true } }),
    prisma.developer.deleteMany({ where: { isDemo: true } }),
    prisma.user.deleteMany({ where: { isDemo: true } }),
    prisma.dataSource.deleteMany({ where: { isDemo: true } }),
  ]);
}

/** Categories are a shared taxonomy (not demo data): upsert by slug. */
async function upsertCategories(prisma: PrismaClient, ds: DemoDataset): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const c of ds.categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { id: c.id, name: c.name, slug: c.slug, description: c.description },
    });
    ids.set(c.id, row.id);
  }
  return ids;
}

function remapCategories(ds: DemoDataset, ids: Map<string, string>) {
  for (const a of ds.apps) a.categoryId = ids.get(a.categoryId) ?? a.categoryId;
  for (const c of ds.categories) c.id = ids.get(c.id) ?? c.id;
}

async function insertDataset(prisma: PrismaClient, ds: DemoDataset) {
  await prisma.user.createMany({ data: ds.users.map((u) => ({ ...u, isDemo: true })) });
  await prisma.developer.createMany({ data: ds.developers.map((d) => ({ ...d, isDemo: true })) });
  await prisma.dataSource.createMany({ data: ds.dataSources.map((s) => ({ ...s, isDemo: true })) });
  await prisma.app.createMany({ data: ds.apps.map((a) => ({ ...a, isDemo: true })) });

  for (const chunk of chunks(ds.rawMetrics)) {
    await prisma.rawMetric.createMany({
      data: chunk.map((m) => ({ ...m, metadata: m.metadata as Prisma.InputJsonValue, isDemo: true })),
    });
  }
  for (const chunk of chunks(ds.transactions)) {
    await prisma.transaction.createMany({
      data: chunk.map((t) => ({ ...t, metadata: t.metadata as Prisma.InputJsonValue, isDemo: true })),
    });
  }
  for (const chunk of chunks(ds.reviews)) {
    await prisma.review.createMany({
      data: chunk.map((r) => ({
        ...r,
        signals: { demo: true },
        isDemo: true,
        updatedAt: r.createdAt,
      })),
    });
  }
}

function* chunks<T>(items: readonly T[]): Generator<T[]> {
  for (let i = 0; i < items.length; i += CHUNK) yield items.slice(i, i + CHUNK);
}

// ------------------------------------------------------------------ CLI ----

const isMain = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMain) {
  loadDotEnv();
  // Safety guard: runs BEFORE any database connection is opened (see ./guard.ts).
  const guard = evaluateSeedGuard(process.env);
  if (!guard.ok) {
    console.error(`[seed] ${guard.reason}`);
    process.exit(1);
  }
  console.log(`[seed] Target: ${guard.target} database${guard.hosts.length ? ` (${guard.hosts.join(', ')})` : ''}.`);
  const prisma = getPrisma();
  seedDemo(prisma, { log: (m) => console.log(`[seed] ${m}`) })
    .then((r) => console.log(`[seed] Done. DEMO data as of ${r.asOf.toISOString().slice(0, 10)}.`))
    .catch((err) => {
      console.error('[seed] Failed:', err);
      process.exitCode = 1;
    })
    .finally(() => disconnectPrisma());
}
