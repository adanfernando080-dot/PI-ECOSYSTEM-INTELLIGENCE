import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WRITE_POLICY, evaluateDatabaseGuard, evaluateSeedGuard } from '../src/seed/guard';
import { parseArgs } from '../src/real-data/cli-args';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const NEON = 'postgresql://neondb_owner:S3cretPassw0rd@ep-example-123.c-4.us-west-2.aws.neon.tech/neondb?sslmode=require';
const HOST = 'ep-example-123.c-4.us-west-2.aws.neon.tech';
const write = (env: Record<string, string | undefined>) => evaluateDatabaseGuard(env, WRITE_POLICY);

describe('real-data write guard (same mechanism as the seed, separate variable)', () => {
  it('allows a local database and refuses a remote one by default', () => {
    expect(write({ DATABASE_URL: 'postgresql://pi:pi@localhost:5432/db' })).toMatchObject({ ok: true, target: 'local' });
    expect(write({ DATABASE_URL: NEON }).ok).toBe(false);
  });

  it('unlocks a remote database only with DB_ALLOW_REMOTE_WRITE = the exact host', () => {
    expect(write({ DATABASE_URL: NEON, DB_ALLOW_REMOTE_WRITE: HOST })).toMatchObject({ ok: true, target: 'remote' });
    for (const bad of ['true', '1', '*', 'other.example.com']) expect(write({ DATABASE_URL: NEON, DB_ALLOW_REMOTE_WRITE: bad }).ok, bad).toBe(false);
  });

  it('the seed variable does not unlock real-data writes, and the write variable does not unlock the seed', () => {
    expect(write({ DATABASE_URL: NEON, SEED_ALLOW_REMOTE_DATABASE: HOST }).ok).toBe(false);
    expect(evaluateSeedGuard({ DATABASE_URL: NEON, DB_ALLOW_REMOTE_WRITE: HOST }).ok).toBe(false);
  });

  it('works under NODE_ENV=production without the seed-only production flag', () => {
    expect(write({ DATABASE_URL: NEON, DB_ALLOW_REMOTE_WRITE: HOST, NODE_ENV: 'production' }).ok).toBe(true);
    expect(evaluateSeedGuard({ DATABASE_URL: 'postgresql://pi:pi@localhost/db', NODE_ENV: 'production' }).ok).toBe(false);
  });

  it('never leaks credentials in a refusal', () => {
    const r = write({ DATABASE_URL: NEON });
    if (r.ok) throw new Error('expected refusal');
    expect(r.reason).toContain(HOST);
    expect(r.reason).not.toMatch(/S3cretPassw0rd|neondb_owner|postgresql:\/\//);
  });
});

describe('CLI wiring (regression: dry run by default, guard before connection)', () => {
  for (const [name, path] of [
    ['db:bootstrap', '../src/real-data/bootstrap-cli.ts'],
    ['catalogue:import', '../src/real-data/catalogue-cli.ts'],
  ] as const) {
    it(`${name} evaluates the write guard before opening any database connection and only writes with --apply`, () => {
      const src = read(path);
      const guardAt = src.indexOf('evaluateDatabaseGuard(process.env, WRITE_POLICY)');
      const refuseAt = src.indexOf('apply && !guard.ok');
      const prismaAt = src.indexOf('getPrisma()');
      expect(guardAt).toBeGreaterThan(-1);
      expect(refuseAt).toBeGreaterThan(guardAt);
      expect(prismaAt).toBeGreaterThan(refuseAt);
      expect(src).toContain("const apply = args.flags.has('apply')");
    });
  }

  it('the package.json scripts exist and point at the CLIs', () => {
    const { scripts } = JSON.parse(read('../../../package.json')) as { scripts: Record<string, string> };
    expect(scripts['db:bootstrap']).toContain('real-data/bootstrap-cli.ts');
    expect(scripts['catalogue:import']).toContain('real-data/catalogue-cli.ts');
  });

  it('argument parser: flags, values, and unknown arguments are separated', () => {
    const r = parseArgs(['--apply', '--file=a.json', '--oops', 'stray', '--apply=yes'], { flags: ['apply'], values: ['file'] });
    expect([...r.flags]).toEqual(['apply']);
    expect(r.values.get('file')).toBe('a.json');
    expect(r.unknown).toEqual(['--oops', 'stray', '--apply=yes']);
  });
});

describe('app_addresses migration is additive and carries database-level guarantees', () => {
  const dirs = readdirSync(new URL('../prisma/migrations/', import.meta.url)).filter((d) => d.includes('app_addresses'));
  const sql = read(`../prisma/migrations/${dirs[0]}/migration.sql`);
  const code = sql.replace(/--.*$/gm, '');

  it('exists, sorts after the init migration, and is the only app_addresses migration', () => {
    expect(dirs).toHaveLength(1);
    expect(dirs[0]! > '20260929000000_init').toBe(true);
  });

  it('never drops, deletes, updates, renames or truncates anything', () => {
    // Statement-level check: the FK's "ON DELETE/UPDATE CASCADE" clauses are not statements.
    const statements = code.split(';').map((x) => x.trim()).filter(Boolean);
    for (const st of statements) expect(st, st.slice(0, 40)).not.toMatch(/^(DROP|DELETE|UPDATE|TRUNCATE|INSERT)\b/i);
    expect(code).not.toMatch(/\bRENAME\b/i);
    expect(code).not.toMatch(/ALTER\s+TYPE/i);
  });

  it('only creates new objects; the sole ALTER TABLE statements target the new app_addresses table', () => {
    const creates = [...code.matchAll(/CREATE\s+(?:UNIQUE\s+)?(TYPE|TABLE|INDEX)\s+"?([A-Za-z_]+)"?/gi)].map((m) => `${m[1]!.toUpperCase()} ${m[2]}`);
    expect(creates).toEqual(['TYPE AddressSource', 'TYPE AddressVerificationStatus', 'TABLE app_addresses', 'INDEX app_addresses_address_idx', 'INDEX app_addresses_appId_address_key']);
    for (const m of code.matchAll(/ALTER\s+TABLE\s+"?([A-Za-z_]+)"?/gi)) expect(m[1]).toBe('app_addresses');
  });

  it('supports several addresses per app, with provenance, verification state and proof constraints', () => {
    expect(code).toMatch(/UNIQUE INDEX "app_addresses_appId_address_key" ON "app_addresses"\("appId", "address"\)/);
    expect(code).toContain('"source" "AddressSource" NOT NULL');
    expect(code).toContain('"sourceNote" TEXT NOT NULL');
    expect(code).toMatch(/"verificationStatus" "AddressVerificationStatus" NOT NULL DEFAULT 'DECLARED'/);
    expect(code).toMatch(/CHECK \("verificationStatus" <> 'VERIFIED' OR \("verificationMethod" IS NOT NULL AND "verificationEvidence" IS NOT NULL AND "verifiedAt" IS NOT NULL\)\)/);
    expect(code).toMatch(/ON DELETE CASCADE/);
  });

  it('the Prisma schema declares the model and the relation from App', () => {
    const schema = read('../prisma/schema.prisma');
    expect(schema).toMatch(/model AppAddress \{[\s\S]*@@unique\(\[appId, address\]\)[\s\S]*@@map\("app_addresses"\)/);
    expect(schema).toMatch(/addresses\s+AppAddress\[\]/);
  });
});
