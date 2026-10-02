/**
 * Bootstrap of an empty database — PURE part.
 *
 * Creates (idempotently):
 *  1. the category taxonomy (missing slugs only; existing rows are never touched);
 *  2. optionally, the FIRST administrator, under strict rules:
 *     - the Pi username is supplied by the operator at run time and typed twice
 *       (--admin-pi-username / --confirm-admin); there is NO default account and
 *       no credential of any kind is created or printed;
 *     - only when no administrator exists yet (this tool is not a way to add or
 *       promote admins later);
 *     - never a name starting with "demo_", never over an existing user.
 *
 * Authentication note: the administrator row only prepares the identity. Nobody
 * can act as this administrator until Pi authentication is implemented (the API
 * issues no tokens, and `token:dev` is refused in production).
 */
import { TAXONOMY_CATEGORIES, type TaxonomyCategory } from './taxonomy';

export interface BootstrapState {
  categorySlugs: ReadonlySet<string>;
  /** Pi usernames of existing administrators. */
  adminUsernames: readonly string[];
  /** Existing users by Pi username (any role). */
  usersByUsername: ReadonlyMap<string, { role: string; isDemo: boolean }>;
  demoRowCount: number;
}

export interface BootstrapOptions {
  adminPiUsername?: string | null;
  allowDemoPresent?: boolean;
}

export interface BootstrapPlan {
  createCategories: TaxonomyCategory[];
  existingCategories: number;
  /** Username of the administrator to create, or null. */
  createAdmin: string | null;
  notes: string[];
  warnings: string[];
  errors: string[];
}

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,38}[A-Za-z0-9]$/;

export function adminUsernameProblem(name: string): string | null {
  if (!USERNAME_RE.test(name)) return 'must be 3-40 characters: letters, digits, "_", "." or "-" (no spaces, no leading/trailing symbol)';
  if (name.toLowerCase().startsWith('demo_')) return 'the "demo_" prefix is reserved for fictional demo accounts';
  return null;
}

export function planBootstrap(state: BootstrapState, options: BootstrapOptions = {}): BootstrapPlan {
  const plan: BootstrapPlan = { createCategories: [], existingCategories: 0, createAdmin: null, notes: [], warnings: [], errors: [] };

  if (state.demoRowCount > 0 && !options.allowDemoPresent) {
    plan.errors.push(
      `the database contains ${state.demoRowCount} demo row(s): refusing to mix real data with fictional data (use a database without demo data; local tests only: --allow-demo-data-present)`,
    );
  }

  for (const category of TAXONOMY_CATEGORIES) {
    if (state.categorySlugs.has(category.slug)) plan.existingCategories += 1;
    else plan.createCategories.push({ ...category });
  }

  const username = options.adminPiUsername?.trim() || null;
  if (!username) {
    if (state.adminUsernames.length === 0) {
      plan.warnings.push('no administrator exists yet: re-run with --admin-pi-username=<your Pi username> (and --confirm-admin) when you are ready to create the first one');
    }
    return plan;
  }

  const problem = adminUsernameProblem(username);
  if (problem) {
    plan.errors.push(`--admin-pi-username: ${problem}`);
    return plan;
  }

  if (state.adminUsernames.length > 0) {
    if (state.adminUsernames.includes(username)) plan.notes.push(`"${username}" is already an administrator: nothing to do`);
    else plan.errors.push(`an administrator already exists (${state.adminUsernames.length}): the bootstrap never adds or promotes administrators`);
    return plan;
  }

  const existing = state.usersByUsername.get(username);
  if (existing) {
    plan.errors.push(
      existing.isDemo
        ? `"${username}" is a demo account: refusing`
        : `a user "${username}" already exists with role ${existing.role}: the bootstrap never promotes an existing user`,
    );
    return plan;
  }

  plan.createAdmin = username;
  return plan;
}

/** The operator must type the administrator name twice; both must match exactly. */
export function adminConfirmationProblem(adminPiUsername: string | null | undefined, confirm: string | null | undefined): string | null {
  if (!adminPiUsername) return null;
  if (!confirm) return 'creating an administrator requires --confirm-admin=<the same Pi username>';
  if (confirm.trim() !== adminPiUsername.trim()) return '--confirm-admin does not match --admin-pi-username';
  return null;
}

export interface BootstrapResult {
  categoriesCreated: number;
  adminCreated: boolean;
}

/** Port implemented by Prisma (production) and in memory (tests). */
export interface BootstrapStore {
  loadState(): Promise<BootstrapState>;
  /** Applies the plan atomically. Categories: skip existing slugs. Admin: create only if absent. */
  apply(plan: BootstrapPlan): Promise<BootstrapResult>;
}

export async function runBootstrap(
  store: BootstrapStore,
  options: BootstrapOptions & { apply: boolean },
): Promise<{ plan: BootstrapPlan; applied: BootstrapResult | null }> {
  const plan = planBootstrap(await store.loadState(), options);
  const nothingToDo = plan.createCategories.length === 0 && plan.createAdmin === null;
  if (!options.apply || plan.errors.length > 0 || nothingToDo) return { plan, applied: null };
  return { plan, applied: await store.apply(plan) };
}
