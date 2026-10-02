/**
 * Safety guard against accidental writes to a remote database.
 *
 * One mechanism, two policies (see SEED_POLICY / WRITE_POLICY below):
 *  - the DEMO seed (and `db:reset`, which seeds after wiping), which inserts
 *    FICTIONAL data and deletes demo rows;
 *  - the real-data tools (`db:bootstrap`, `catalogue:import`), which write real
 *    data and need their own, separate authorisation variable.
 *
 * Rules (the variable names come from the policy):
 *
 *  1. DATABASE_URL must be set and parseable.
 *  2. Every host the connection can resolve to (URL host AND libpq-style
 *     `host` / `hostaddr` query parameters) must be local — localhost,
 *     127.0.0.0/8, ::1 or a unix socket path — otherwise the target is REMOTE.
 *  3. A REMOTE target is refused unless the policy's remote variable is set to
 *     the EXACT host name of that database. A generic "true" is not accepted:
 *     the operator has to type the host they mean to write to, so a wrong or
 *     leftover DATABASE_URL cannot be unlocked by a habit-typed flag.
 *  4. When the policy has a production variable, NODE_ENV=production additionally
 *     requires it to be "true", whatever the target.
 *
 * Pure function: no I/O, no connection. Error messages never contain the
 * connection string, user or password — only host names.
 */

export type SeedGuardResult =
  | { ok: true; target: 'local' | 'remote'; hosts: string[] }
  | { ok: false; reason: string };

type Env = Record<string, string | undefined>;

function isLocalHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (h === 'localhost' || h === '[::1]' || h === '::1') return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(h)) return true; // 127.0.0.0/8 loopback
  return h.startsWith('/'); // unix socket directory
}

/** Hosts a connection string can end up connecting to (URL host + `host`/`hostaddr` params). */
function connectionHosts(url: URL): string[] {
  const hosts: string[] = [];
  if (url.hostname) hosts.push(decodeURIComponent(url.hostname));
  for (const key of ['host', 'hostaddr']) {
    for (const value of url.searchParams.getAll(key)) {
      for (const part of value.split(',')) if (part.trim()) hosts.push(part.trim());
    }
  }
  // `postgresql:///db` (no host at all) connects through the default unix socket.
  return hosts.length > 0 ? hosts : ['/default-unix-socket'];
}

export interface DatabaseGuardPolicy {
  /** Verb phrase used in messages, e.g. "run the DEMO seed". */
  operation: string;
  /** Why the operation is dangerous on a remote database (one sentence). */
  consequence: string;
  /** Env var that must equal the exact remote host to unlock a remote database. */
  remoteAllowEnv: string;
  /** When set, NODE_ENV=production additionally requires this variable to be "true". */
  productionAllowEnv?: string;
}

/** The DEMO seed and `db:reset`. */
export const SEED_POLICY: DatabaseGuardPolicy = {
  operation: 'run the DEMO seed',
  consequence: 'The seed inserts fictional data and deletes demo rows.',
  remoteAllowEnv: 'SEED_ALLOW_REMOTE_DATABASE',
  productionAllowEnv: 'SEED_ALLOW_PRODUCTION',
};

/**
 * Real-data tools (bootstrap, catalogue import). A separate variable on purpose:
 * unlocking the seed on a remote database must never unlock these, and vice versa.
 */
export const WRITE_POLICY: DatabaseGuardPolicy = {
  operation: 'write real data',
  consequence: 'This tool creates categories, an administrator and catalogue entries.',
  remoteAllowEnv: 'DB_ALLOW_REMOTE_WRITE',
};

export function evaluateDatabaseGuard(env: Env, policy: DatabaseGuardPolicy): SeedGuardResult {
  const raw = env.DATABASE_URL;
  if (!raw || !raw.trim()) return { ok: false, reason: `DATABASE_URL is not set: refusing to ${policy.operation}.` };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `DATABASE_URL is not a valid connection URL: refusing to ${policy.operation}.` };
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    return { ok: false, reason: `DATABASE_URL is not a PostgreSQL URL: refusing to ${policy.operation}.` };
  }

  const hosts = connectionHosts(url);
  const remoteHosts = hosts.filter((h) => !isLocalHost(h) && h !== '/default-unix-socket');
  const target: 'local' | 'remote' = remoteHosts.length === 0 ? 'local' : 'remote';

  if (target === 'remote') {
    const allowed = (env[policy.remoteAllowEnv] ?? '').trim().toLowerCase();
    const covered = remoteHosts.every((h) => h.toLowerCase() === allowed);
    if (!covered) {
      return {
        ok: false,
        reason:
          `Refusing to ${policy.operation} against a REMOTE database (host: ${remoteHosts.join(', ')}). ` +
          `${policy.consequence} ` +
          (allowed ? `${policy.remoteAllowEnv} is set but does not match this database host. ` : '') +
          `To do this on purpose, set ${policy.remoteAllowEnv} to the exact host name of the database you mean to write to.`,
      };
    }
  }

  if (policy.productionAllowEnv && env.NODE_ENV === 'production' && env[policy.productionAllowEnv] !== 'true') {
    return {
      ok: false,
      reason: `Refusing to ${policy.operation === 'run the DEMO seed' ? 'insert DEMO data' : policy.operation} with NODE_ENV=production (set ${policy.productionAllowEnv}=true to override).`,
    };
  }

  return { ok: true, target, hosts: hosts.filter((h) => h !== '/default-unix-socket') };
}

export function evaluateSeedGuard(env: Env): SeedGuardResult {
  return evaluateDatabaseGuard(env, SEED_POLICY);
}

export class SeedGuardError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SeedGuardError';
  }
}

/** Throws SeedGuardError when the seed must not run. */
export function assertSeedAllowed(env: Env = process.env): Extract<SeedGuardResult, { ok: true }> {
  const result = evaluateSeedGuard(env);
  if (!result.ok) throw new SeedGuardError(result.reason);
  return result;
}
