/** Prisma implementations of the bootstrap / catalogue stores. All writes are transactional. */
import type { Prisma, PrismaClient } from '../index';
import type { BootstrapPlan, BootstrapResult, BootstrapState, BootstrapStore } from './bootstrap';
import type {
  ApplyResult,
  CatalogueAddress,
  CatalogueState,
  CatalogueStore,
  ExistingApp,
  PlanAction,
} from './catalogue';

async function countDemoRows(prisma: PrismaClient | Prisma.TransactionClient): Promise<number> {
  const [apps, users] = await Promise.all([prisma.app.count({ where: { isDemo: true } }), prisma.user.count({ where: { isDemo: true } })]);
  return apps + users;
}

export function createPrismaBootstrapStore(prisma: PrismaClient): BootstrapStore {
  return {
    async loadState(): Promise<BootstrapState> {
      const [categories, admins, users, demoRowCount] = await Promise.all([
        prisma.category.findMany({ select: { slug: true } }),
        prisma.user.findMany({ where: { role: 'ADMIN' }, select: { piUsername: true } }),
        prisma.user.findMany({ select: { piUsername: true, role: true, isDemo: true } }),
        countDemoRows(prisma),
      ]);
      return {
        categorySlugs: new Set(categories.map((c) => c.slug)),
        adminUsernames: admins.map((a) => a.piUsername),
        usersByUsername: new Map(users.map((u) => [u.piUsername, { role: u.role, isDemo: u.isDemo }])),
        demoRowCount,
      };
    },

    async apply(plan: BootstrapPlan): Promise<BootstrapResult> {
      return prisma.$transaction(async (tx) => {
        let categoriesCreated = 0;
        for (const c of plan.createCategories) {
          // update: {} — an existing category is never modified.
          const before = await tx.category.findUnique({ where: { slug: c.slug }, select: { id: true } });
          if (before) continue;
          await tx.category.create({ data: { name: c.name, slug: c.slug, description: c.description } });
          categoriesCreated += 1;
        }
        let adminCreated = false;
        if (plan.createAdmin) {
          // Re-check inside the transaction: never create a second administrator.
          const admins = await tx.user.count({ where: { role: 'ADMIN' } });
          const exists = await tx.user.findUnique({ where: { piUsername: plan.createAdmin }, select: { id: true } });
          if (admins === 0 && !exists) {
            await tx.user.create({ data: { piUsername: plan.createAdmin, role: 'ADMIN', isDemo: false } });
            adminCreated = true;
          }
        }
        return { categoriesCreated, adminCreated };
      });
    },
  };
}

export function createPrismaCatalogueStore(prisma: PrismaClient): CatalogueStore {
  return {
    async loadState(): Promise<CatalogueState> {
      const [categories, apps, demoRowCount] = await Promise.all([
        prisma.category.findMany({ select: { slug: true } }),
        prisma.app.findMany({
          include: { category: { select: { slug: true } }, addresses: { select: { address: true, verificationStatus: true } } },
        }),
        countDemoRows(prisma),
      ]);
      const appsBySlug = new Map<string, ExistingApp>();
      const slugByLowerName = new Map<string, string>();
      const addressOwners = new Map<string, string>();
      for (const a of apps) {
        appsBySlug.set(a.slug, {
          id: a.id,
          slug: a.slug,
          name: a.name,
          categorySlug: a.category?.slug ?? null,
          description: a.description,
          url: a.url,
          logoUrl: a.logoUrl,
          tags: a.tags,
          status: a.status,
          isDemo: a.isDemo,
          addresses: a.addresses.map((x) => ({ address: x.address, verificationStatus: x.verificationStatus })),
        });
        slugByLowerName.set(a.name.toLowerCase(), a.slug);
        for (const x of a.addresses) addressOwners.set(x.address, a.slug);
      }
      return { categorySlugs: new Set(categories.map((c) => c.slug)), appsBySlug, slugByLowerName, addressOwners, demoRowCount };
    },

    async apply(actions: readonly PlanAction[], now: Date): Promise<ApplyResult> {
      return prisma.$transaction(async (tx) => {
        const result: ApplyResult = { appsCreated: 0, addressesAdded: 0, addressesVerified: 0 };
        const addressData = (a: CatalogueAddress) => ({
          address: a.address,
          label: a.label,
          source: 'ADMIN_IMPORT' as const,
          sourceNote: a.sourceNote,
          verificationStatus: a.verification.status,
          verificationMethod: a.verification.status === 'VERIFIED' ? a.verification.method : null,
          verificationEvidence: a.verification.status === 'VERIFIED' ? a.verification.evidence : null,
          verifiedAt: a.verification.status === 'VERIFIED' ? a.verification.verifiedAt : null,
        });

        for (const action of actions) {
          if (action.kind === 'create-app') {
            const category = await tx.category.findUniqueOrThrow({ where: { slug: action.app.categorySlug }, select: { id: true } });
            await tx.app.create({
              data: {
                name: action.app.name,
                slug: action.app.slug,
                description: action.app.description,
                url: action.app.url,
                logoUrl: action.app.logoUrl,
                tags: action.app.tags,
                status: action.app.status,
                categoryId: category.id,
                developerId: null, // unclaimed: ownership is established by the claim flow
                isDemo: false,
                firstSeenAt: now,
                addresses: { create: action.app.addresses.map(addressData) },
              },
            });
            result.appsCreated += 1;
            result.addressesAdded += action.app.addresses.length;
          } else if (action.kind === 'add-address') {
            const app = await tx.app.findUniqueOrThrow({ where: { slug: action.appSlug }, select: { id: true } });
            await tx.appAddress.create({ data: { appId: app.id, ...addressData(action.address) } });
            result.addressesAdded += 1;
          } else {
            const app = await tx.app.findUniqueOrThrow({ where: { slug: action.appSlug }, select: { id: true } });
            const v = action.address.verification;
            // Only upgrades DECLARED -> VERIFIED; the guard on verificationStatus makes a replay a no-op.
            const updated = await tx.appAddress.updateMany({
              where: { appId: app.id, address: action.address.address, verificationStatus: 'DECLARED' },
              data: { verificationStatus: 'VERIFIED', verificationMethod: v.method, verificationEvidence: v.evidence, verifiedAt: v.verifiedAt },
            });
            result.addressesVerified += updated.count;
          }
        }
        return result;
      });
    },
  };
}
