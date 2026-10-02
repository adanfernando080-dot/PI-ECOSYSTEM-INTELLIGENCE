/** In-memory stores with the same semantics as the Prisma ones (used by unit tests). */
import type { BootstrapPlan, BootstrapResult, BootstrapState, BootstrapStore } from '../../src/real-data/bootstrap';
import type { ApplyResult, CatalogueState, CatalogueStore, ExistingApp, PlanAction } from '../../src/real-data/catalogue';

export interface StoredAddress {
  address: string;
  verificationStatus: 'DECLARED' | 'VERIFIED';
  source: string;
  sourceNote: string;
  verificationMethod: string | null;
  verifiedAt: Date | null;
}
export interface StoredApp extends Omit<ExistingApp, 'addresses'> {
  developerId: string | null;
  addresses: StoredAddress[];
}

export class MemoryCatalogueStore implements CatalogueStore {
  apps: StoredApp[] = [];
  categories = new Set<string>(['marketplace', 'games', 'education']);
  demoRows = 0;
  writes = 0;

  async loadState(): Promise<CatalogueState> {
    const appsBySlug = new Map<string, ExistingApp>();
    const slugByLowerName = new Map<string, string>();
    const addressOwners = new Map<string, string>();
    for (const a of this.apps) {
      appsBySlug.set(a.slug, { ...a, addresses: a.addresses.map((x) => ({ address: x.address, verificationStatus: x.verificationStatus })) });
      slugByLowerName.set(a.name.toLowerCase(), a.slug);
      for (const x of a.addresses) addressOwners.set(x.address, a.slug);
    }
    return { categorySlugs: this.categories, appsBySlug, slugByLowerName, addressOwners, demoRowCount: this.demoRows };
  }

  async apply(actions: readonly PlanAction[], now: Date): Promise<ApplyResult> {
    this.writes += 1;
    const result: ApplyResult = { appsCreated: 0, addressesAdded: 0, addressesVerified: 0 };
    const toStored = (a: import('../../src/real-data/catalogue').CatalogueAddress): StoredAddress => ({
      address: a.address,
      verificationStatus: a.verification.status === 'VERIFIED' ? 'VERIFIED' : 'DECLARED',
      source: 'ADMIN_IMPORT',
      sourceNote: a.sourceNote,
      verificationMethod: a.verification.status === 'VERIFIED' ? a.verification.method : null,
      verifiedAt: a.verification.status === 'VERIFIED' ? a.verification.verifiedAt : null,
    });
    for (const action of actions) {
      if (action.kind === 'create-app') {
        this.apps.push({
          id: `id-${this.apps.length + 1}`,
          slug: action.app.slug,
          name: action.app.name,
          categorySlug: action.app.categorySlug,
          description: action.app.description,
          url: action.app.url,
          logoUrl: action.app.logoUrl,
          tags: action.app.tags,
          status: action.app.status,
          isDemo: false,
          developerId: null,
          addresses: action.app.addresses.map(toStored),
        });
        result.appsCreated += 1;
        result.addressesAdded += action.app.addresses.length;
      } else if (action.kind === 'add-address') {
        this.apps.find((a) => a.slug === action.appSlug)!.addresses.push(toStored(action.address));
        result.addressesAdded += 1;
      } else {
        const target = this.apps.find((a) => a.slug === action.appSlug)!.addresses.find((x) => x.address === action.address.address)!;
        if (target.verificationStatus === 'DECLARED') {
          Object.assign(target, toStored(action.address));
          result.addressesVerified += 1;
        }
      }
    }
    void now;
    return result;
  }
}

export class MemoryBootstrapStore implements BootstrapStore {
  categories = new Set<string>();
  users = new Map<string, { role: string; isDemo: boolean }>();
  demoRows = 0;
  writes = 0;

  async loadState(): Promise<BootstrapState> {
    return {
      categorySlugs: this.categories,
      adminUsernames: [...this.users].filter(([, u]) => u.role === 'ADMIN').map(([n]) => n),
      usersByUsername: this.users,
      demoRowCount: this.demoRows,
    };
  }

  async apply(plan: BootstrapPlan): Promise<BootstrapResult> {
    this.writes += 1;
    let categoriesCreated = 0;
    for (const c of plan.createCategories) {
      if (!this.categories.has(c.slug)) {
        this.categories.add(c.slug);
        categoriesCreated += 1;
      }
    }
    let adminCreated = false;
    if (plan.createAdmin && ![...this.users.values()].some((u) => u.role === 'ADMIN') && !this.users.has(plan.createAdmin)) {
      this.users.set(plan.createAdmin, { role: 'ADMIN', isDemo: false });
      adminCreated = true;
    }
    return { categoriesCreated, adminCreated };
  }
}
