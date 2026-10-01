/**
 * Safety guard for the DEMO seed (and `db:reset`, which seeds after wiping).
 *
 * The seed inserts FICTIONAL data and deletes existing demo rows, so it must
 * never run against a remote/managed database by accident. Rules:
 *
 *  1. DATABASE_URL must be set and parseable.
 *  2. Every host the connection can resolve to (URL host AND libpq-style
 *     `host` / `hostaddr` query parameters) must be local — localhost,
 *     127.0.0.0/8, ::1 or a unix socket path — otherwise the target is REMOTE.
 *  3. A REMOTE target is refused unless SEED_ALLOW_REMOTE_DATABASE is set to
 *     the EXACT host name of that database. A generic "true" is not accepted:
 *     the operator has to type the host they mean to write to, so a wrong or
 *     leftover DATABASE_URL cannot be unlocked by a habit-typed flag.
 *  4. NODE_ENV=production additionally requires SEED_ALLOW_PRODUCTION=true,
 *     whatever the target.
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

export function evaluateSeedGuard(env: Env): SeedGuardResult {
  const raw = env.DATABASE_URL;
  if (!raw || !raw.trim()) return { ok: false, reason: 'DATABASE_URL is not set: refusing to run the DEMO seed.' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'DATABASE_URL is not a valid connection URL: refusing to run the DEMO seed.' };
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    return { ok: false, reason: 'DATABASE_URL is not a PostgreSQL URL: refusing to run the DEMO seed.' };
  }

  const hosts = connectionHosts(url);
  const remoteHosts = hosts.filter((h) => !isLocalHost(h) && h !== '/default-unix-socket');
  const target: 'local' | 'remote' = remoteHosts.length === 0 ? 'local' : 'remote';

  if (target === 'remote') {
    const allowed = (env.SEED_ALLOW_REMOTE_DATABASE ?? '').trim().toLowerCase();
    const covered = remoteHosts.every((h) => h.toLowerCase() === allowed);
    if (!covered) {
      return {
        ok: false,
        reason:
          `Refusing to run the DEMO seed against a REMOTE database (host: ${remoteHosts.join(', ')}). ` +
          'The seed inserts fictional data and deletes demo rows. ' +
          (allowed
            ? 'SEED_ALLOW_REMOTE_DATABASE is set but does not match this database host. '
            : '') +
          'To do this on purpose, set SEED_ALLOW_REMOTE_DATABASE to the exact host name of the database you mean to write to.',
      };
    }
  }

  if (env.NODE_ENV === 'production' && env.SEED_ALLOW_PRODUCTION !== 'true') {
    return {
      ok: false,
      reason: 'Refusing to insert DEMO data with NODE_ENV=production (set SEED_ALLOW_PRODUCTION=true to override).',
    };
  }

  return { ok: true, target, hosts: hosts.filter((h) => h !== '/default-unix-socket') };
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
