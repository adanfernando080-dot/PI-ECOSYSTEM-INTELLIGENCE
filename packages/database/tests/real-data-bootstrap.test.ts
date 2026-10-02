import { describe, expect, it } from 'vitest';
import { TAXONOMY_CATEGORIES } from '../src/real-data/taxonomy';
import { adminConfirmationProblem, adminUsernameProblem, planBootstrap, runBootstrap } from '../src/real-data/bootstrap';
import { INTENT_CATEGORY_MAP } from '@pi/shared';
import { generateDemoDataset } from '../src/seed/generator';
import { MemoryBootstrapStore } from './support/memory-stores';

describe('category taxonomy', () => {
  it('has unique slugs and covers every category used by the discovery intents', () => {
    const slugs = TAXONOMY_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const wanted of Object.values(INTENT_CATEGORY_MAP).flat()) expect(slugs).toContain(wanted);
  });

  it('is the same list the DEMO seed uses (single source of truth)', () => {
    const demo = generateDemoDataset({ asOf: new Date('2026-10-01T00:00:00Z') });
    expect(demo.categories.map((c) => c.slug)).toEqual(TAXONOMY_CATEGORIES.map((c) => c.slug));
  });
});

describe('bootstrap — categories', () => {
  it('creates only the missing categories and never modifies existing ones', async () => {
    const store = new MemoryBootstrapStore();
    store.categories.add('marketplace');
    const { plan, applied } = await runBootstrap(store, { apply: true });
    expect(plan.createCategories.map((c) => c.slug)).not.toContain('marketplace');
    expect(applied!.categoriesCreated).toBe(TAXONOMY_CATEGORIES.length - 1);
  });

  it('is idempotent: a second run has nothing to do and writes nothing', async () => {
    const store = new MemoryBootstrapStore();
    await runBootstrap(store, { apply: true });
    const again = await runBootstrap(store, { apply: true });
    expect(again.applied).toBeNull();
    expect(again.plan.existingCategories).toBe(TAXONOMY_CATEGORIES.length);
    expect(store.writes).toBe(1);
  });

  it('a dry run (apply=false) writes nothing', async () => {
    const store = new MemoryBootstrapStore();
    const { plan, applied } = await runBootstrap(store, { apply: false, adminPiUsername: 'real_operator' });
    expect(plan.createCategories).toHaveLength(TAXONOMY_CATEGORIES.length);
    expect(plan.createAdmin).toBe('real_operator');
    expect(applied).toBeNull();
    expect(store.writes).toBe(0);
  });
});

describe('bootstrap — first administrator', () => {
  it('NEVER creates an administrator unless a username is supplied (no default account)', async () => {
    const store = new MemoryBootstrapStore();
    const { plan } = await runBootstrap(store, { apply: true });
    expect(plan.createAdmin).toBeNull();
    expect(plan.warnings.join(' ')).toMatch(/no administrator exists yet/);
    expect([...store.users.values()].some((u) => u.role === 'ADMIN')).toBe(false);
  });

  it('creates exactly the administrator named by the operator, once', async () => {
    const store = new MemoryBootstrapStore();
    const first = await runBootstrap(store, { apply: true, adminPiUsername: 'real_operator' });
    expect(first.applied).toEqual({ categoriesCreated: TAXONOMY_CATEGORIES.length, adminCreated: true });
    expect(store.users.get('real_operator')).toEqual({ role: 'ADMIN', isDemo: false });
    const again = await runBootstrap(store, { apply: true, adminPiUsername: 'real_operator' });
    expect(again.plan.notes.join(' ')).toMatch(/already an administrator/);
    expect(again.applied).toBeNull();
  });

  it('refuses to add or promote anyone once an administrator exists', async () => {
    const store = new MemoryBootstrapStore();
    store.users.set('first_admin', { role: 'ADMIN', isDemo: false });
    const { plan, applied } = await runBootstrap(store, { apply: true, adminPiUsername: 'someone_else' });
    expect(plan.errors.join(' ')).toMatch(/administrator already exists/);
    expect(applied).toBeNull();
    expect(store.users.has('someone_else')).toBe(false);
  });

  it('refuses an existing user (no promotion), demo accounts, and invalid names', async () => {
    const store = new MemoryBootstrapStore();
    store.users.set('existing_user', { role: 'USER', isDemo: false });
    store.users.set('some_demo', { role: 'USER', isDemo: true });
    expect((await runBootstrap(store, { apply: true, adminPiUsername: 'existing_user' })).plan.errors.join(' ')).toMatch(/never promotes/);
    expect((await runBootstrap(store, { apply: true, adminPiUsername: 'some_demo' })).plan.errors.join(' ')).toMatch(/demo account/);
    for (const bad of ['demo_admin', 'DEMO_Admin', 'ab', 'has space', '-lead', 'x'.repeat(41), '<script>']) {
      expect(adminUsernameProblem(bad), bad).not.toBeNull();
    }
    expect(adminUsernameProblem('real_operator')).toBeNull();
    expect(store.users.get('existing_user')!.role).toBe('USER');
  });

  it('the username must be typed twice, identically', () => {
    expect(adminConfirmationProblem('real_operator', undefined)).toMatch(/requires --confirm-admin/);
    expect(adminConfirmationProblem('real_operator', 'real_operatr')).toMatch(/does not match/);
    expect(adminConfirmationProblem('real_operator', 'real_operator')).toBeNull();
    expect(adminConfirmationProblem(null, null)).toBeNull(); // no admin requested: nothing to confirm
  });

  it('refuses to mix with demo data unless explicitly allowed (local tests only)', async () => {
    const store = new MemoryBootstrapStore();
    store.demoRows = 5;
    const refused = await runBootstrap(store, { apply: true });
    expect(refused.plan.errors[0]).toMatch(/demo row/);
    expect(store.writes).toBe(0);
    expect((await runBootstrap(store, { apply: true, allowDemoPresent: true })).applied).not.toBeNull();
    expect(planBootstrap({ categorySlugs: new Set(), adminUsernames: [], usersByUsername: new Map(), demoRowCount: 0 }).errors).toEqual([]);
  });
});
