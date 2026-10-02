/**
 * Administrator catalogue import — PURE part (parsing, validation, planning).
 *
 * The catalogue file lists applications, optionally with public addresses.
 * Principles:
 *  - NOTHING IS INVENTED: only listed fields are accepted (strict keys). Figures
 *    (metrics, scores, transactions, staking, ratings…) are rejected: they are
 *    produced by the engines from real data, never typed into a catalogue.
 *  - DECLARED vs VERIFIED: an address is DECLARED unless the file documents a
 *    verification (method + evidence + date). Applications imported here are
 *    unclaimed (no developer) and PENDING unless the file says otherwise.
 *  - NEVER OVERWRITE: existing applications are not modified (differences are
 *    reported as conflicts); verification is only ever upgraded, never downgraded.
 *  - isDemo is always false; a slug used by demo data is an error.
 *
 * No I/O here: the executor (a CatalogueStore) is injected.
 */
import { addressProblem, normalizeAddress } from './addresses';

export const CATALOGUE_SCHEMA_VERSION = 1;

export const IMPORTABLE_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE'] as const;
export type ImportableStatus = (typeof IMPORTABLE_STATUSES)[number];

export const VERIFICATION_METHODS = ['ADMIN_REVIEW', 'OWNER_SIGNATURE', 'ONCHAIN_CHALLENGE'] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export type AddressVerificationInput =
  | { status: 'DECLARED' }
  | { status: 'VERIFIED'; method: VerificationMethod; evidence: string; verifiedAt: Date };

export interface CatalogueAddress {
  address: string;
  label: string | null;
  /** Where the address comes from (required: provenance is never optional). */
  sourceNote: string;
  verification: AddressVerificationInput;
}

export interface CatalogueApp {
  name: string;
  slug: string;
  categorySlug: string;
  description: string | null;
  url: string | null;
  logoUrl: string | null;
  tags: string[];
  status: ImportableStatus;
  addresses: CatalogueAddress[];
}

export interface Catalogue {
  schemaVersion: typeof CATALOGUE_SCHEMA_VERSION;
  apps: CatalogueApp[];
}

export interface Issue {
  path: string;
  message: string;
}

export type ParseResult = { ok: true; catalogue: Catalogue } | { ok: false; errors: Issue[] };

// ------------------------------------------------------------------ parsing --

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAG_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;
/** Keys that look like figures: refused with an explicit explanation. */
const FIGURE_KEYS = new Set([
  'metrics', 'metric', 'stats', 'statistics', 'score', 'scores', 'rating', 'ratings', 'reviews', 'transactions',
  'transactioncount', 'volume', 'users', 'activeusers', 'stakedpi', 'staking', 'revenue', 'rank', 'ranking',
]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Same intent as the API's sanitizer: strip markup and control characters, collapse spaces. */
export function cleanText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/<[^>]*>/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function checkKeys(obj: Record<string, unknown>, allowed: readonly string[], path: string, issues: Issue[]) {
  for (const key of Object.keys(obj)) {
    if (allowed.includes(key)) continue;
    issues.push({
      path: path ? `${path}.${key}` : key,
      message: FIGURE_KEYS.has(key.toLowerCase())
        ? 'figures are never imported from a catalogue (they are computed from real data); remove this field'
        : 'unknown field (the catalogue accepts only documented fields)',
    });
  }
}

function text(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issue[],
  opts: { required?: boolean; min?: number; max: number },
): string | null {
  const v = obj[key];
  const here = `${path}.${key}`;
  if (v === undefined || v === null) {
    if (opts.required) issues.push({ path: here, message: 'is required' });
    return null;
  }
  if (typeof v !== 'string') {
    issues.push({ path: here, message: 'must be a string' });
    return null;
  }
  const cleaned = cleanText(v);
  if (cleaned.length < (opts.min ?? 1) || cleaned.length > opts.max) {
    issues.push({ path: here, message: `must be ${opts.min ?? 1}-${opts.max} characters (after removing markup)` });
    return null;
  }
  return cleaned;
}

function httpsUrl(obj: Record<string, unknown>, key: string, path: string, issues: Issue[]): string | null {
  const v = obj[key];
  if (v === undefined || v === null) return null;
  const here = `${path}.${key}`;
  if (typeof v !== 'string' || v.length > 500) {
    issues.push({ path: here, message: 'must be an https URL of at most 500 characters' });
    return null;
  }
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || u.username || u.password) throw new Error('bad');
    return v;
  } catch {
    issues.push({ path: here, message: 'must be a valid https URL without credentials' });
    return null;
  }
}

function parseAddress(raw: unknown, path: string, issues: Issue[], now: Date): CatalogueAddress | null {
  if (!isRecord(raw)) {
    issues.push({ path, message: 'must be an object' });
    return null;
  }
  checkKeys(raw, ['address', 'label', 'sourceNote', 'verification'], path, issues);
  const before = issues.length;

  let address: string | null = null;
  if (typeof raw.address !== 'string') issues.push({ path: `${path}.address`, message: 'is required (string)' });
  else {
    address = normalizeAddress(raw.address);
    const problem = addressProblem(address);
    if (problem) {
      issues.push({ path: `${path}.address`, message: problem });
      address = null;
    }
  }
  const label = text(raw, 'label', path, issues, { max: 60 });
  const sourceNote = text(raw, 'sourceNote', path, issues, { required: true, min: 5, max: 300 });

  let verification: AddressVerificationInput = { status: 'DECLARED' };
  const v = raw.verification;
  if (v !== undefined && v !== null) {
    const vp = `${path}.verification`;
    if (!isRecord(v)) issues.push({ path: vp, message: 'must be an object' });
    else {
      checkKeys(v, ['status', 'method', 'evidence', 'verifiedAt'], vp, issues);
      const status = typeof v.status === 'string' ? v.status.toUpperCase() : null;
      if (status === 'DECLARED') {
        for (const k of ['method', 'evidence', 'verifiedAt']) {
          if (v[k] !== undefined && v[k] !== null) issues.push({ path: `${vp}.${k}`, message: 'only allowed when status is "verified"' });
        }
      } else if (status === 'VERIFIED') {
        const method = typeof v.method === 'string' ? v.method.toUpperCase() : null;
        if (!method || !(VERIFICATION_METHODS as readonly string[]).includes(method)) {
          issues.push({ path: `${vp}.method`, message: `is required, one of ${VERIFICATION_METHODS.join(', ')}` });
        }
        const evidence = text(v, 'evidence', vp, issues, { required: true, min: 10, max: 500 });
        let verifiedAt: Date | null = null;
        if (typeof v.verifiedAt !== 'string' || Number.isNaN(Date.parse(v.verifiedAt))) {
          issues.push({ path: `${vp}.verifiedAt`, message: 'is required (ISO 8601 date)' });
        } else {
          verifiedAt = new Date(v.verifiedAt);
          if (verifiedAt > now) issues.push({ path: `${vp}.verifiedAt`, message: 'cannot be in the future' });
        }
        if (method && (VERIFICATION_METHODS as readonly string[]).includes(method) && evidence && verifiedAt && verifiedAt <= now) {
          verification = { status: 'VERIFIED', method: method as VerificationMethod, evidence, verifiedAt };
        }
      } else {
        issues.push({ path: `${vp}.status`, message: 'must be "declared" or "verified"' });
      }
    }
  }
  if (issues.length > before || !address || !sourceNote) return null;
  return { address, label, sourceNote, verification };
}

/**
 * Validates an already-JSON-parsed catalogue. Collects EVERY problem (it never
 * stops at the first), including duplicates inside the file.
 */
export function parseCatalogue(input: unknown, now: Date = new Date()): ParseResult {
  const issues: Issue[] = [];
  if (!isRecord(input)) return { ok: false, errors: [{ path: '', message: 'the file must contain a JSON object' }] };
  checkKeys(input, ['$comment', 'schemaVersion', 'apps'], '', issues);
  if (input.schemaVersion !== CATALOGUE_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `must be ${CATALOGUE_SCHEMA_VERSION}` });
  }
  if (!Array.isArray(input.apps)) {
    issues.push({ path: 'apps', message: 'must be an array (it may be empty)' });
    return { ok: false, errors: issues };
  }
  if (input.apps.length > 500) issues.push({ path: 'apps', message: 'at most 500 applications per file' });

  const apps: CatalogueApp[] = [];
  const slugs = new Map<string, number>();
  const names = new Map<string, number>();
  const addresses = new Map<string, string>(); // address -> "apps[i].addresses[j]"

  input.apps.slice(0, 500).forEach((raw, i) => {
    const path = `apps[${i}]`;
    if (!isRecord(raw)) {
      issues.push({ path, message: 'must be an object' });
      return;
    }
    checkKeys(raw, ['name', 'slug', 'categorySlug', 'description', 'url', 'logoUrl', 'tags', 'status', 'addresses'], path, issues);
    const before = issues.length;

    const name = text(raw, 'name', path, issues, { required: true, min: 2, max: 80 });
    const slugRaw = raw.slug;
    let slug: string | null = null;
    if (typeof slugRaw !== 'string' || slugRaw.length > 80 || !SLUG_RE.test(slugRaw)) {
      issues.push({ path: `${path}.slug`, message: 'is required: lowercase letters, digits and hyphens (max 80); it is never derived automatically' });
    } else slug = slugRaw;
    const catRaw = raw.categorySlug;
    let categorySlug: string | null = null;
    if (typeof catRaw !== 'string' || !SLUG_RE.test(catRaw)) issues.push({ path: `${path}.categorySlug`, message: 'is required (a category slug)' });
    else categorySlug = catRaw;
    const description = text(raw, 'description', path, issues, { max: 2000 });
    const url = httpsUrl(raw, 'url', path, issues);
    const logoUrl = httpsUrl(raw, 'logoUrl', path, issues);

    let tags: string[] = [];
    if (raw.tags !== undefined && raw.tags !== null) {
      if (!Array.isArray(raw.tags) || raw.tags.length > 10 || raw.tags.some((t) => typeof t !== 'string' || !TAG_RE.test(t))) {
        issues.push({ path: `${path}.tags`, message: 'must be at most 10 lowercase tags (letters, digits, hyphens; max 30 characters each)' });
      } else tags = [...new Set(raw.tags as string[])];
    }

    let status: ImportableStatus = 'PENDING';
    if (raw.status !== undefined && raw.status !== null) {
      const s = typeof raw.status === 'string' ? raw.status.toUpperCase() : '';
      if ((IMPORTABLE_STATUSES as readonly string[]).includes(s)) status = s as ImportableStatus;
      else issues.push({ path: `${path}.status`, message: `must be one of ${IMPORTABLE_STATUSES.join(', ')} (default PENDING)` });
    }

    const addrs: CatalogueAddress[] = [];
    if (raw.addresses !== undefined && raw.addresses !== null) {
      if (!Array.isArray(raw.addresses) || raw.addresses.length > 50) {
        issues.push({ path: `${path}.addresses`, message: 'must be an array of at most 50 addresses' });
      } else {
        raw.addresses.forEach((a, j) => {
          const ap = `${path}.addresses[${j}]`;
          const parsed = parseAddress(a, ap, issues, now);
          if (!parsed) return;
          const seen = addresses.get(parsed.address);
          if (seen) issues.push({ path: `${ap}.address`, message: `duplicate address (already listed at ${seen}); an address belongs to one application` });
          else addresses.set(parsed.address, ap);
          addrs.push(parsed);
        });
      }
    }

    if (slug) {
      if (slugs.has(slug)) issues.push({ path: `${path}.slug`, message: `duplicate slug "${slug}" (also apps[${slugs.get(slug)}])` });
      else slugs.set(slug, i);
    }
    if (name) {
      const key = name.toLowerCase();
      if (names.has(key)) issues.push({ path: `${path}.name`, message: `duplicate name "${name}" (also apps[${names.get(key)}])` });
      else names.set(key, i);
    }
    if (issues.length === before && name && slug && categorySlug) {
      apps.push({ name, slug, categorySlug, description, url, logoUrl, tags, status, addresses: addrs });
    }
  });

  return issues.length > 0 ? { ok: false, errors: issues } : { ok: true, catalogue: { schemaVersion: CATALOGUE_SCHEMA_VERSION, apps } };
}

// ----------------------------------------------------------------- planning --

export interface ExistingAddress {
  address: string;
  verificationStatus: 'DECLARED' | 'VERIFIED';
}

export interface ExistingApp {
  id: string;
  slug: string;
  name: string;
  categorySlug: string | null;
  description: string | null;
  url: string | null;
  logoUrl: string | null;
  tags: string[];
  status: string;
  isDemo: boolean;
  addresses: ExistingAddress[];
}

export interface CatalogueState {
  categorySlugs: ReadonlySet<string>;
  appsBySlug: ReadonlyMap<string, ExistingApp>;
  /** lowercase name -> slug, for duplicate detection against existing apps. */
  slugByLowerName: ReadonlyMap<string, string>;
  /** address -> slug of the application that already holds it. */
  addressOwners: ReadonlyMap<string, string>;
  /** Rows flagged isDemo (apps + users): real data is not mixed with demo data by accident. */
  demoRowCount: number;
}

export type PlanAction =
  | { kind: 'create-app'; app: CatalogueApp }
  | { kind: 'add-address'; appSlug: string; address: CatalogueAddress }
  | { kind: 'verify-address'; appSlug: string; address: CatalogueAddress & { verification: Extract<AddressVerificationInput, { status: 'VERIFIED' }> } };

export interface ImportPlan {
  actions: PlanAction[];
  /** Blocking problems: nothing is applied while any exists. */
  errors: Issue[];
  /** Differences with existing apps: reported, never applied. */
  conflicts: Issue[];
  counts: {
    appsToCreate: number;
    appsUnchanged: number;
    addressesToAdd: number;
    addressesToVerify: number;
    addressesUnchanged: number;
    addressesDeclared: number;
    addressesVerified: number;
  };
}

const sameTags = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((t, i) => t === [...b].sort()[i]);

export function planCatalogueImport(
  catalogue: Catalogue,
  state: CatalogueState,
  options: { allowDemoPresent?: boolean } = {},
): ImportPlan {
  const actions: PlanAction[] = [];
  const errors: Issue[] = [];
  const conflicts: Issue[] = [];
  const counts = { appsToCreate: 0, appsUnchanged: 0, addressesToAdd: 0, addressesToVerify: 0, addressesUnchanged: 0, addressesDeclared: 0, addressesVerified: 0 };

  if (state.demoRowCount > 0 && !options.allowDemoPresent) {
    errors.push({
      path: 'database',
      message: `the database contains ${state.demoRowCount} demo row(s): refusing to mix real data with fictional data (use a database without demo data; local tests only: --allow-demo-data-present)`,
    });
  }

  catalogue.apps.forEach((app, i) => {
    const path = `apps[${i}] (${app.slug})`;
    if (!state.categorySlugs.has(app.categorySlug)) {
      errors.push({ path: `${path}.categorySlug`, message: `unknown category "${app.categorySlug}" (run db:bootstrap first, or fix the slug)` });
    }

    const existing = state.appsBySlug.get(app.slug);
    if (existing?.isDemo) {
      errors.push({ path: `${path}.slug`, message: 'this slug belongs to demo data: refusing to touch it' });
      return;
    }
    if (!existing) {
      const sameName = state.slugByLowerName.get(app.name.toLowerCase());
      if (sameName) errors.push({ path: `${path}.name`, message: `an application named "${app.name}" already exists with another slug ("${sameName}"): possible duplicate` });
    }

    if (!existing) {
      actions.push({ kind: 'create-app', app });
      counts.appsToCreate += 1;
    } else {
      const diffs: string[] = [];
      if (existing.name !== app.name) diffs.push('name');
      if ((existing.categorySlug ?? null) !== app.categorySlug) diffs.push('categorySlug');
      if ((existing.description ?? null) !== app.description) diffs.push('description');
      if ((existing.url ?? null) !== app.url) diffs.push('url');
      if ((existing.logoUrl ?? null) !== app.logoUrl) diffs.push('logoUrl');
      if (!sameTags(existing.tags, app.tags)) diffs.push('tags');
      if (diffs.length > 0) {
        conflicts.push({ path, message: `already exists with different ${diffs.join(', ')}; left untouched (the import never overwrites)` });
      } else counts.appsUnchanged += 1;
    }

    const known = new Map((existing?.addresses ?? []).map((a) => [a.address, a.verificationStatus]));
    for (const address of app.addresses) {
      const ap = `${path}.addresses (${address.address.slice(0, 6)}…)`;
      if (address.verification.status === 'VERIFIED') counts.addressesVerified += 1;
      else counts.addressesDeclared += 1;

      const owner = state.addressOwners.get(address.address);
      if (owner && owner !== app.slug) {
        errors.push({ path: ap, message: `this address is already attached to another application ("${owner}")` });
        continue;
      }
      const current = known.get(address.address);
      if (!existing || current === undefined) {
        if (!existing) {
          // part of create-app: counted below, not as a separate action
          counts.addressesToAdd += 1;
        } else {
          actions.push({ kind: 'add-address', appSlug: app.slug, address });
          counts.addressesToAdd += 1;
        }
      } else if (address.verification.status === 'VERIFIED' && current === 'DECLARED') {
        actions.push({ kind: 'verify-address', appSlug: app.slug, address: { ...address, verification: address.verification } });
        counts.addressesToVerify += 1;
      } else {
        counts.addressesUnchanged += 1; // never downgraded
      }
    }
  });

  return { actions, errors, conflicts, counts };
}

// ---------------------------------------------------------------- execution --

export interface ApplyResult {
  appsCreated: number;
  addressesAdded: number;
  addressesVerified: number;
}

/** Port implemented by Prisma (production) and in memory (tests). */
export interface CatalogueStore {
  loadState(): Promise<CatalogueState>;
  /** Applies every action atomically (all or nothing). */
  apply(actions: readonly PlanAction[], now: Date): Promise<ApplyResult>;
}

export interface ImportOutcome {
  plan: ImportPlan;
  applied: ApplyResult | null;
}

/** Plans, and applies only when `apply` is true and the plan has no blocking error. */
export async function runCatalogueImport(
  store: CatalogueStore,
  catalogue: Catalogue,
  options: { apply: boolean; allowDemoPresent?: boolean; now?: Date },
): Promise<ImportOutcome> {
  const plan = planCatalogueImport(catalogue, await store.loadState(), { allowDemoPresent: options.allowDemoPresent });
  if (!options.apply || plan.errors.length > 0 || plan.actions.length === 0) return { plan, applied: null };
  return { plan, applied: await store.apply(plan.actions, options.now ?? new Date()) };
}
