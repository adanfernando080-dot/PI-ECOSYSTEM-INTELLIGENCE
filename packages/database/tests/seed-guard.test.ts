import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SeedGuardError, assertSeedAllowed, evaluateSeedGuard } from '../src/seed/guard';

const NEON = 'postgresql://neondb_owner:S3cretPassw0rd@ep-example-123.c-4.us-west-2.aws.neon.tech/neondb?sslmode=require';
const NEON_HOST = 'ep-example-123.c-4.us-west-2.aws.neon.tech';

const ok = (env: Record<string, string | undefined>) => evaluateSeedGuard(env);
const refusal = (env: Record<string, string | undefined>) => {
  const r = evaluateSeedGuard(env);
  if (r.ok) throw new Error('expected the guard to refuse');
  return r.reason;
};

describe('seed guard — local development database stays usable', () => {
  it.each([
    'postgresql://pi:pi@localhost:5432/pi_ecosystem?schema=public',
    'postgresql://pi:pi@127.0.0.1:5432/pi_ecosystem',
    'postgresql://pi:pi@127.1.2.3:5432/pi_ecosystem',
    'postgres://pi:pi@[::1]:5432/pi_ecosystem',
    'postgresql://pi:pi@LOCALHOST/pi_ecosystem',
    'postgresql:///pi_ecosystem?host=/var/run/postgresql',
    'postgresql:///pi_ecosystem',
  ])('allows %s with no extra flag', (DATABASE_URL) => {
    expect(ok({ DATABASE_URL })).toMatchObject({ ok: true, target: 'local' });
  });
});

describe('seed guard — remote databases are refused by default', () => {
  it('refuses a managed remote database (Neon-style) with no flag', () => {
    expect(ok({ DATABASE_URL: NEON }).ok).toBe(false);
    expect(refusal({ DATABASE_URL: NEON })).toContain(NEON_HOST);
  });

  it('refuses when NODE_ENV is NOT production too (the old guard missed this case)', () => {
    expect(ok({ DATABASE_URL: NEON, NODE_ENV: 'development' }).ok).toBe(false);
    expect(ok({ DATABASE_URL: NEON }).ok).toBe(false);
  });

  it('does not accept generic truthy flags, SEED_ALLOW_PRODUCTION alone, or another host', () => {
    for (const flag of ['true', '1', 'yes', '*', 'neon.tech', 'localhost']) {
      expect(ok({ DATABASE_URL: NEON, SEED_ALLOW_REMOTE_DATABASE: flag }).ok, flag).toBe(false);
    }
    expect(ok({ DATABASE_URL: NEON, SEED_ALLOW_PRODUCTION: 'true', NODE_ENV: 'production' }).ok).toBe(false);
    expect(refusal({ DATABASE_URL: NEON, SEED_ALLOW_REMOTE_DATABASE: 'other-host.example.com' })).toMatch(/does not match/);
  });

  it('is not fooled by look-alike hosts or userinfo tricks', () => {
    for (const DATABASE_URL of [
      'postgresql://pi:pi@localhost.evil.example.com/db',
      'postgresql://localhost:pw@evil.example.com/db',
      'postgresql://pi:pi@127.0.0.1.evil.example.com/db',
      'postgresql://pi:pi@0.0.0.0/db',
    ]) {
      expect(ok({ DATABASE_URL }).ok, DATABASE_URL).toBe(false);
    }
  });

  it('inspects libpq-style host/hostaddr parameters that could redirect a "local" URL', () => {
    expect(ok({ DATABASE_URL: 'postgresql://pi:pi@localhost/db?host=db.remote.example.com' }).ok).toBe(false);
    expect(ok({ DATABASE_URL: 'postgresql://pi:pi@localhost/db?hostaddr=203.0.113.9' }).ok).toBe(false);
    expect(ok({ DATABASE_URL: 'postgresql://pi:pi@localhost/db?host=/var/run/postgresql' }).ok).toBe(true);
  });
});

describe('seed guard — explicit authorisation of a remote database', () => {
  it('allows a remote host only when SEED_ALLOW_REMOTE_DATABASE names that exact host', () => {
    expect(ok({ DATABASE_URL: NEON, SEED_ALLOW_REMOTE_DATABASE: NEON_HOST })).toMatchObject({
      ok: true,
      target: 'remote',
      hosts: [NEON_HOST],
    });
    expect(ok({ DATABASE_URL: NEON, SEED_ALLOW_REMOTE_DATABASE: NEON_HOST.toUpperCase() }).ok).toBe(true); // host names are case-insensitive
    expect(ok({ DATABASE_URL: 'postgresql://pi:pi@postgres:5432/db', SEED_ALLOW_REMOTE_DATABASE: 'postgres' }).ok).toBe(true); // docker compose
  });

  it('still requires SEED_ALLOW_PRODUCTION=true when NODE_ENV=production, local or remote', () => {
    const remote = { DATABASE_URL: NEON, SEED_ALLOW_REMOTE_DATABASE: NEON_HOST, NODE_ENV: 'production' };
    expect(refusal(remote)).toMatch(/NODE_ENV=production/);
    expect(ok({ ...remote, SEED_ALLOW_PRODUCTION: 'true' }).ok).toBe(true);
    expect(ok({ DATABASE_URL: 'postgresql://pi:pi@localhost/db', NODE_ENV: 'production' }).ok).toBe(false);
  });
});

describe('seed guard — invalid configuration and secrecy', () => {
  it('refuses a missing, blank, malformed or non-PostgreSQL DATABASE_URL', () => {
    for (const DATABASE_URL of [undefined, '', '   ', 'not a url', 'mysql://u:p@localhost/db', 'file:./dev.db']) {
      expect(ok({ DATABASE_URL }).ok, String(DATABASE_URL)).toBe(false);
    }
  });

  it('never leaks the user, password or full connection string in any message', () => {
    const messages = [
      refusal({ DATABASE_URL: NEON }),
      refusal({ DATABASE_URL: NEON, SEED_ALLOW_REMOTE_DATABASE: 'other.example.com' }),
      refusal({ DATABASE_URL: 'postgresql://user:Sup3rSecret@bad host/db' }),
      refusal({ DATABASE_URL: NEON.replace('S3cretPassw0rd', 'Zz9') }),
    ];
    for (const m of messages) {
      expect(m).not.toMatch(/S3cretPassw0rd|Sup3rSecret|Zz9|neondb_owner|postgresql:\/\//);
    }
  });

  it('assertSeedAllowed throws SeedGuardError for a refused target and returns the result otherwise', () => {
    expect(() => assertSeedAllowed({ DATABASE_URL: NEON })).toThrow(SeedGuardError);
    expect(assertSeedAllowed({ DATABASE_URL: 'postgresql://pi:pi@localhost/db' })).toMatchObject({ ok: true, target: 'local' });
  });
});

describe('seed guard — wiring (regression: nobody removes or reorders the check)', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('the seed CLI evaluates the guard before opening any database connection', () => {
    const cli = read('../src/seed/index.ts');
    const guardAt = cli.indexOf('evaluateSeedGuard(process.env)');
    const prismaAt = cli.indexOf('const prisma = getPrisma()');
    expect(guardAt).toBeGreaterThan(-1);
    expect(prismaAt).toBeGreaterThan(guardAt);
  });

  it('db:reset runs the guard BEFORE prisma migrate reset', () => {
    const pkg = JSON.parse(read('../../../package.json')) as { scripts: Record<string, string> };
    const reset = pkg.scripts['db:reset']!;
    expect(reset.indexOf('seed/guard-cli.ts')).toBeGreaterThan(-1);
    expect(reset.indexOf('seed/guard-cli.ts')).toBeLessThan(reset.indexOf('prisma migrate reset'));
    expect(reset.indexOf('&&')).toBeGreaterThan(reset.indexOf('guard-cli'));
  });
});
