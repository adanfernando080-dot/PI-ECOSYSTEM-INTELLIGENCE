import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCatalogue, planCatalogueImport, runCatalogueImport, type Catalogue } from '../src/real-data/catalogue';
import { addressProblem } from '../src/real-data/addresses';
import { MemoryCatalogueStore } from './support/memory-stores';

// Test fixtures only: obviously synthetic values, never used outside tests.
const ADDR_A = 'TESTADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ADDR_B = 'TESTADDRESSBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const NOW = new Date('2026-10-02T12:00:00Z');

const app = (over: Record<string, unknown> = {}) => ({
  name: 'Test Application One',
  slug: 'test-application-one',
  categorySlug: 'marketplace',
  ...over,
});
const file = (apps: unknown[], extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, apps, ...extra });
const parseOk = (input: unknown): Catalogue => {
  const r = parseCatalogue(input, NOW);
  if (!r.ok) throw new Error(`expected a valid catalogue: ${JSON.stringify(r.errors)}`);
  return r.catalogue;
};
const errorsOf = (input: unknown) => {
  const r = parseCatalogue(input, NOW);
  if (r.ok) throw new Error('expected validation errors');
  return r.errors;
};
const messages = (input: unknown) => errorsOf(input).map((e) => `${e.path}: ${e.message}`).join('\n');

describe('catalogue template', () => {
  it('the shipped template is valid and imports nothing (no data, no invented example)', () => {
    const template = JSON.parse(readFileSync(new URL('../../../docs/real-data/catalogue.template.json', import.meta.url), 'utf8'));
    const catalogue = parseOk(template);
    expect(catalogue.apps).toEqual([]);
    expect(JSON.stringify(template)).not.toMatch(/https?:|"slug"|"name"|address/);
  });

  it('README placeholders such as <...> are rejected if copied as-is', () => {
    const errors = messages(file([{ name: '<nom public>', slug: '<identifiant>', categorySlug: '<slug>', url: '<https://…>' }]));
    expect(errors).toMatch(/name/);
    expect(errors).toMatch(/slug/);
    expect(errors).toMatch(/categorySlug/);
    expect(errors).toMatch(/url/);
  });
});

describe('catalogue validation — required fields and nothing invented', () => {
  it('accepts a minimal application and applies safe defaults (PENDING, no description, no addresses)', () => {
    const [a] = parseOk(file([app()])).apps;
    expect(a).toMatchObject({ status: 'PENDING', description: null, url: null, logoUrl: null, tags: [], addresses: [] });
  });

  it('requires name, slug and categorySlug, and never derives the slug', () => {
    const m = messages(file([{}]));
    for (const f of ['name', 'slug', 'categorySlug']) expect(m).toContain(`apps[0].${f}`);
    expect(messages(file([{ name: 'Only A Name', categorySlug: 'marketplace' }]))).toMatch(/never derived/);
  });

  it('rejects unknown fields and any figure (metrics, scores, stakes, transactions, ratings…)', () => {
    for (const key of ['metrics', 'score', 'stakedPi', 'transactions', 'rating', 'activeUsers', 'volume', 'isDemo', 'developerId']) {
      const m = messages(file([app({ [key]: 1 })]));
      expect(m, key).toContain(`apps[0].${key}`);
    }
    expect(messages(file([app({ metrics: { users: 5 } })]))).toMatch(/figures are never imported/);
    expect(messages(file([app()], { stats: {} }))).toMatch(/stats/);
  });

  it('enforces the schema version, an apps array, https-only URLs without credentials, and tag rules', () => {
    expect(messages({ schemaVersion: 2, apps: [] })).toMatch(/schemaVersion/);
    expect(messages({ schemaVersion: 1 })).toMatch(/apps/);
    expect(messages(file([app({ url: 'http://example.com' })]))).toMatch(/https/);
    expect(messages(file([app({ url: 'https://user:pass@example.com' })]))).toMatch(/https/);
    expect(messages(file([app({ tags: ['UPPER'] })]))).toMatch(/tags/);
    expect(messages(file([app({ status: 'REJECTED' })]))).toMatch(/status/);
    expect(messages(file([app({ status: 'ACTIVE', description: 'x'.repeat(2001) })]))).toMatch(/description/);
  });

  it('strips markup from text instead of storing it', () => {
    const [a] = parseOk(file([app({ name: 'Test <b>Application</b> One', description: '<script>alert(1)</script>Plain text' })])).apps;
    expect(a!.name).not.toContain('<');
    expect(a!.description).not.toContain('<');
  });

  it('collects every problem instead of stopping at the first', () => {
    const errors = errorsOf(file([app({ slug: 'BAD SLUG' }), app({ url: 'ftp://x' }), 'not-an-object']));
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('catalogue validation — duplicates', () => {
  it('rejects duplicate slugs and duplicate names (case-insensitive) inside the file', () => {
    expect(messages(file([app(), app({ name: 'Another Name' })]))).toMatch(/duplicate slug/);
    expect(messages(file([app(), app({ slug: 'second-slug', name: 'TEST APPLICATION one' })]))).toMatch(/duplicate name/);
  });

  it('rejects an address listed twice, within one app or across two apps', () => {
    const decl = { address: ADDR_A, sourceNote: 'listed on the official page' };
    expect(messages(file([app({ addresses: [decl, decl] })]))).toMatch(/duplicate address/);
    expect(messages(file([app({ addresses: [decl] }), app({ slug: 'second', name: 'Second Application', addresses: [decl] })]))).toMatch(/belongs to one application/);
  });
});

describe('addresses — provenance and declared vs verified', () => {
  const declared = { address: ADDR_A, sourceNote: 'listed on the official application page' };

  it('an address without verification is DECLARED and keeps its provenance note', () => {
    const [a] = parseOk(file([app({ addresses: [declared] })])).apps;
    expect(a!.addresses[0]).toMatchObject({ address: ADDR_A, sourceNote: 'listed on the official application page', verification: { status: 'DECLARED' } });
  });

  it('requires the provenance note on every address', () => {
    expect(messages(file([app({ addresses: [{ address: ADDR_A }] })]))).toMatch(/sourceNote: is required/);
  });

  it('validates the address token (length, characters)', () => {
    expect(addressProblem('short')).toMatch(/characters long/);
    expect(addressProblem(`${ADDR_A} `.trim() + ' x')).toMatch(/letters and digits/);
    expect(messages(file([app({ addresses: [{ address: 'bad address with spaces!!', sourceNote: 'some source' }] })]))).toMatch(/address/);
  });

  it('VERIFIED needs method, evidence and a past date; a declared address cannot carry proof fields', () => {
    const v = (verification: unknown) => file([app({ addresses: [{ ...declared, verification }] })]);
    expect(messages(v({ status: 'verified' }))).toMatch(/method/);
    expect(messages(v({ status: 'verified', method: 'GUESS', evidence: 'long enough evidence', verifiedAt: '2026-10-01' }))).toMatch(/method/);
    expect(messages(v({ status: 'verified', method: 'ADMIN_REVIEW', evidence: 'short', verifiedAt: '2026-10-01' }))).toMatch(/evidence/);
    expect(messages(v({ status: 'verified', method: 'ADMIN_REVIEW', evidence: 'long enough evidence' }))).toMatch(/verifiedAt/);
    expect(messages(v({ status: 'verified', method: 'ADMIN_REVIEW', evidence: 'long enough evidence', verifiedAt: '2099-01-01' }))).toMatch(/future/);
    expect(messages(v({ status: 'declared', method: 'ADMIN_REVIEW' }))).toMatch(/only allowed when status is "verified"/);
    expect(messages(v({ status: 'maybe' }))).toMatch(/declared.*verified/);
    const ok = parseOk(v({ status: 'verified', method: 'admin_review', evidence: 'compared with the signed announcement', verifiedAt: '2026-10-01' }));
    expect(ok.apps[0]!.addresses[0]!.verification).toMatchObject({ status: 'VERIFIED', method: 'ADMIN_REVIEW' });
  });
});

describe('import plan — against the current database state', () => {
  const catalogue = parseOk(
    file([app({ addresses: [{ address: ADDR_A, sourceNote: 'official application page' }] }), app({ slug: 'second-app', name: 'Second Application', categorySlug: 'games' })]),
  );

  it('dry run plans creations and writes nothing', async () => {
    const store = new MemoryCatalogueStore();
    const { plan, applied } = await runCatalogueImport(store, catalogue, { apply: false, now: NOW });
    expect(plan.counts).toMatchObject({ appsToCreate: 2, addressesToAdd: 1, addressesDeclared: 1 });
    expect(applied).toBeNull();
    expect(store.apps).toHaveLength(0);
    expect(store.writes).toBe(0);
  });

  it('apply creates real, unclaimed apps with isDemo=false, and keeps provenance and DECLARED state', async () => {
    const store = new MemoryCatalogueStore();
    const { applied } = await runCatalogueImport(store, catalogue, { apply: true, now: NOW });
    expect(applied).toEqual({ appsCreated: 2, addressesAdded: 1, addressesVerified: 0 });
    for (const a of store.apps) expect(a).toMatchObject({ isDemo: false, developerId: null, status: 'PENDING' });
    expect(store.apps[0]!.addresses[0]).toMatchObject({ verificationStatus: 'DECLARED', source: 'ADMIN_IMPORT', sourceNote: 'official application page', verifiedAt: null });
  });

  it('is idempotent: a second run creates and changes nothing', async () => {
    const store = new MemoryCatalogueStore();
    await runCatalogueImport(store, catalogue, { apply: true, now: NOW });
    const again = await runCatalogueImport(store, catalogue, { apply: true, now: NOW });
    expect(again.plan.actions).toEqual([]);
    expect(again.plan.counts).toMatchObject({ appsToCreate: 0, appsUnchanged: 2, addressesToAdd: 0, addressesUnchanged: 1 });
    expect(again.applied).toBeNull();
    expect(store.apps).toHaveLength(2);
    expect(store.writes).toBe(1);
  });

  it('never overwrites an existing application: differences are reported as conflicts', async () => {
    const store = new MemoryCatalogueStore();
    await runCatalogueImport(store, catalogue, { apply: true, now: NOW });
    const edited = parseOk(file([app({ description: 'A different description', addresses: [{ address: ADDR_A, sourceNote: 'official application page' }] })]));
    const { plan } = await runCatalogueImport(store, edited, { apply: true, now: NOW });
    expect(plan.conflicts[0]!.message).toMatch(/description.*left untouched/);
    expect(plan.errors).toEqual([]);
    expect(store.apps[0]!.description).toBeNull();
  });

  it('adds new addresses to an existing application and upgrades DECLARED to VERIFIED, never downgrades', async () => {
    const store = new MemoryCatalogueStore();
    await runCatalogueImport(store, catalogue, { apply: true, now: NOW });
    const verified = { status: 'verified', method: 'ADMIN_REVIEW', evidence: 'matched against the signed announcement', verifiedAt: '2026-10-01' };
    const upgrade = parseOk(
      file([app({ addresses: [{ address: ADDR_A, sourceNote: 'official application page', verification: verified }, { address: ADDR_B, sourceNote: 'second public wallet' }] })]),
    );
    const up = await runCatalogueImport(store, upgrade, { apply: true, now: NOW });
    expect(up.applied).toEqual({ appsCreated: 0, addressesAdded: 1, addressesVerified: 1 });
    expect(store.apps[0]!.addresses.map((a) => a.verificationStatus)).toEqual(['VERIFIED', 'DECLARED']);

    const downgrade = parseOk(file([app({ addresses: [{ address: ADDR_A, sourceNote: 'official application page' }] })]));
    const down = await runCatalogueImport(store, downgrade, { apply: true, now: NOW });
    expect(down.plan.actions).toEqual([]);
    expect(store.apps[0]!.addresses[0]!.verificationStatus).toBe('VERIFIED');
  });

  it('blocks everything when an address already belongs to another application', async () => {
    const store = new MemoryCatalogueStore();
    await runCatalogueImport(store, catalogue, { apply: true, now: NOW });
    const clash = parseOk(file([app({ slug: 'third-app', name: 'Third Application', addresses: [{ address: ADDR_A, sourceNote: 'some other page' }] })]));
    const { plan, applied } = await runCatalogueImport(store, clash, { apply: true, now: NOW });
    expect(plan.errors[0]!.message).toMatch(/already attached to another application/);
    expect(applied).toBeNull();
    expect(store.apps).toHaveLength(2);
  });

  it('flags an unknown category, a possible duplicate name under another slug, and a demo slug', async () => {
    const store = new MemoryCatalogueStore();
    await runCatalogueImport(store, catalogue, { apply: true, now: NOW });
    store.apps.push({ ...store.apps[0]!, id: 'demo', slug: 'demo-slug', name: 'Demo App', isDemo: true });
    const bad = parseOk(
      file([app({ slug: 'new-one', name: 'Test Application One', categorySlug: 'nonexistent' }), app({ slug: 'demo-slug', name: 'Other Name' })]),
    );
    const { plan, applied } = await runCatalogueImport(store, bad, { apply: true, now: NOW });
    const m = plan.errors.map((e) => e.message).join('\n');
    expect(m).toMatch(/unknown category/);
    expect(m).toMatch(/possible duplicate/);
    expect(m).toMatch(/belongs to demo data/);
    expect(applied).toBeNull();
  });

  it('refuses to mix real data with demo rows unless explicitly allowed (local tests only)', async () => {
    const store = new MemoryCatalogueStore();
    store.demoRows = 3;
    const refused = await runCatalogueImport(store, catalogue, { apply: true, now: NOW });
    expect(refused.plan.errors[0]!.message).toMatch(/demo row/);
    expect(store.apps).toHaveLength(0);
    const allowed = await runCatalogueImport(store, catalogue, { apply: true, allowDemoPresent: true, now: NOW });
    expect(allowed.applied?.appsCreated).toBe(2);
  });

  it('an empty catalogue plans and does nothing', async () => {
    const store = new MemoryCatalogueStore();
    const { plan, applied } = await runCatalogueImport(store, parseOk(file([])), { apply: true, now: NOW });
    expect(plan).toMatchObject({ actions: [], errors: [], conflicts: [] });
    expect(applied).toBeNull();
    expect(planCatalogueImport(parseOk(file([])), await store.loadState()).counts.appsToCreate).toBe(0);
  });
});
