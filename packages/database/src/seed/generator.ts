/**
 * DEMO dataset generator (pure and deterministic).
 *
 * Everything produced here is FICTIONAL. Every entity carries `isDemo: true`,
 * data-source names start with "DEMO ·", and every raw metric / transaction
 * carries `metadata.demo = true`. The API surfaces this flag on every
 * response that contains demo rows.
 */
import {
  addDays,
  startOfUtcDay,
  type AppStatus,
  type DataSourceType,
  type DeveloperVerificationStatus,
  type MetricType,
  type Provenance,
  type ReviewStatus,
  type Role,
} from '@pi/shared';
import { TAXONOMY_CATEGORIES } from '../real-data/taxonomy';

export const DEMO_HISTORY_DAYS = 180;

// ------------------------------------------------------------------ PRNG ----

/** mulberry32 — small deterministic PRNG so the seed is reproducible. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
    /** Approximately normal noise (mean 0, sd 1). */
    normal: () => {
      const u = Math.max(next(), 1e-9);
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    uuid: () => {
      const hex = Array.from({ length: 32 }, () => Math.floor(next() * 16).toString(16));
      hex[12] = '4';
      hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
      const s = hex.join('');
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
  };
}
type Rng = ReturnType<typeof createRng>;

// ----------------------------------------------------------------- types ----

export interface DemoCategory { id: string; name: string; slug: string; description: string }
export interface DemoUser { id: string; piUsername: string; displayName: string; role: Role; createdAt: Date }
export interface DemoDeveloper {
  id: string;
  piUsername: string;
  displayName: string;
  verificationStatus: DeveloperVerificationStatus;
  userId: string;
}
export interface DemoDataSource { id: string; name: string; type: DataSourceType; trustLevel: number; description: string }
export interface DemoApp {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  url: string | null;
  logoUrl: string | null;
  status: AppStatus;
  developerId: string | null;
  methodologyNote: string | null;
  tags: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
}
export interface DemoRawMetric {
  id: string;
  appId: string;
  sourceId: string;
  metricType: MetricType;
  value: number | null;
  periodStart: Date;
  periodEnd: Date;
  provenance: Provenance;
  metadata: Record<string, unknown>;
}
export interface DemoTransaction {
  id: string;
  txHash: string;
  appId: string;
  sender: string;
  receiver: string;
  amount: number;
  timestamp: Date;
  sourceId: string;
  attributionConfidence: number;
  attributionMethod: string;
  metadata: Record<string, unknown>;
}
export interface DemoReview {
  id: string;
  appId: string;
  userId: string;
  rating: number;
  review: string;
  status: ReviewStatus;
  createdAt: Date;
}
export interface DemoDataset {
  asOf: Date;
  categories: DemoCategory[];
  users: DemoUser[];
  developers: DemoDeveloper[];
  dataSources: DemoDataSource[];
  apps: DemoApp[];
  rawMetrics: DemoRawMetric[];
  transactions: DemoTransaction[];
  reviews: DemoReview[];
}

// --------------------------------------------------------------- profiles ---

interface AppProfile {
  name: string;
  slug: string;
  category: string;
  description: string | null;
  /** Daily transactions at the start of the history. */
  baseTx: number;
  /** Daily compound growth rate. */
  dailyGrowth: number;
  /** Mean Pi per transaction. */
  avgAmount: number;
  firstSeenDaysAgo: number;
  /** Observable on the (simulated) chain; otherwise developer-reported only. */
  observable: boolean;
  /** Developer also declares figures (overlapping sources). */
  developerReports: boolean;
  addressAttribution: number;
  reviews: { count: number; mean: number };
  developer: { username: string; verification: DeveloperVerificationStatus } | null;
  withUrl: boolean;
  methodology: string | null;
  tags: string[];
  /** Days (from the end) where data is UNAVAILABLE. */
  gapDays?: number;
  scenario?: 'activity-spike' | 'concentration' | 'review-burst' | 'decline';
  staking?: number;
}

const CATEGORIES: Omit<DemoCategory, 'id'>[] = TAXONOMY_CATEGORIES.map((c) => ({ ...c }));

const DEMO_DESC = (what: string) => `[DEMO] Fictional application used for development: ${what}`;

const PROFILES: AppProfile[] = [
  {
    name: 'PiMarket', slug: 'pimarket', category: 'marketplace',
    description: DEMO_DESC('a local marketplace where Pioneers list and buy goods.'),
    baseTx: 380, dailyGrowth: 0.004, avgAmount: 3.2, firstSeenDaysAgo: 420, observable: true, developerReports: true,
    addressAttribution: 0.85, reviews: { count: 60, mean: 4.3 },
    developer: { username: 'demo_dev_market', verification: 'VERIFIED' }, withUrl: true,
    methodology: 'DEMO: counts are exported daily from the order log.', tags: ['demo', 'marketplace'], staking: 12000,
  },
  {
    name: 'PiJobs', slug: 'pijobs', category: 'jobs',
    description: DEMO_DESC('a job board connecting Pioneers with short missions.'),
    baseTx: 120, dailyGrowth: 0.006, avgAmount: 8.5, firstSeenDaysAgo: 300, observable: true, developerReports: false,
    addressAttribution: 0.8, reviews: { count: 25, mean: 4.0 },
    developer: { username: 'demo_dev_jobs', verification: 'VERIFIED' }, withUrl: true, methodology: null, tags: ['demo'],
  },
  {
    name: 'PiLearn', slug: 'pilearn', category: 'education',
    description: DEMO_DESC('short courses paid in Pi.'),
    baseTx: 60, dailyGrowth: 0.003, avgAmount: 2.0, firstSeenDaysAgo: 250, observable: true, developerReports: true,
    addressAttribution: 0.75, reviews: { count: 18, mean: 4.6 },
    developer: { username: 'demo_dev_learn', verification: 'PENDING' }, withUrl: true,
    methodology: 'DEMO: enrolments are counted when a payment is confirmed.', tags: ['demo', 'education'],
  },
  {
    name: 'PiGames', slug: 'pigames', category: 'games',
    description: DEMO_DESC('casual mini-games with Pi rewards.'),
    baseTx: 500, dailyGrowth: 0.001, avgAmount: 0.4, firstSeenDaysAgo: 360, observable: true, developerReports: false,
    addressAttribution: 0.9, reviews: { count: 40, mean: 3.6 },
    developer: { username: 'demo_dev_games', verification: 'VERIFIED' }, withUrl: true, methodology: null, tags: ['demo'],
    scenario: 'activity-spike',
  },
  {
    name: 'PiServices', slug: 'piservices', category: 'services',
    description: DEMO_DESC('a directory of local services (repairs, design, translation).'),
    baseTx: 90, dailyGrowth: 0.002, avgAmount: 12, firstSeenDaysAgo: 280, observable: true, developerReports: true,
    addressAttribution: 0.7, reviews: { count: 22, mean: 3.9 },
    developer: { username: 'demo_dev_services', verification: 'UNVERIFIED' }, withUrl: true, methodology: null, tags: [],
    scenario: 'review-burst',
  },
  {
    name: 'PiAI Hub', slug: 'piai-hub', category: 'ai',
    description: DEMO_DESC('a catalogue of AI assistants billed per request.'),
    baseTx: 15, dailyGrowth: 0.03, avgAmount: 1.5, firstSeenDaysAgo: 60, observable: true, developerReports: true,
    addressAttribution: 0.8, reviews: { count: 9, mean: 4.4 },
    developer: { username: 'demo_dev_ai', verification: 'VERIFIED' }, withUrl: true,
    methodology: 'DEMO: one transaction per paid request.', tags: ['demo', 'ai'],
  },
  {
    name: 'PiTravel', slug: 'pitravel', category: 'travel',
    description: DEMO_DESC('booking of guesthouses and tours.'),
    baseTx: 140, dailyGrowth: -0.006, avgAmount: 25, firstSeenDaysAgo: 400, observable: true, developerReports: false,
    addressAttribution: 0.65, reviews: { count: 14, mean: 3.2 },
    developer: { username: 'demo_dev_travel', verification: 'UNVERIFIED' }, withUrl: false, methodology: null, tags: [],
    scenario: 'decline',
  },
  {
    name: 'PiStore', slug: 'pistore', category: 'shopping',
    description: DEMO_DESC('an online store for accessories.'),
    baseTx: 200, dailyGrowth: 0.002, avgAmount: 6, firstSeenDaysAgo: 330, observable: true, developerReports: true,
    addressAttribution: 0.8, reviews: { count: 30, mean: 4.1 },
    developer: { username: 'demo_dev_store', verification: 'VERIFIED' }, withUrl: true,
    methodology: 'DEMO: orders are counted at checkout.', tags: ['demo', 'shop'], staking: 5000,
  },
  {
    name: 'PiTools', slug: 'pitools', category: 'tools',
    description: null,
    baseTx: 30, dailyGrowth: 0.001, avgAmount: 0.8, firstSeenDaysAgo: 200, observable: true, developerReports: false,
    addressAttribution: 0.4, reviews: { count: 0, mean: 0 },
    developer: null, withUrl: false, methodology: null, tags: [], gapDays: 10,
  },
  {
    name: 'PiSocial', slug: 'pisocial', category: 'social',
    description: DEMO_DESC('a community feed; figures are self-declared only.'),
    baseTx: 250, dailyGrowth: 0.005, avgAmount: 0.2, firstSeenDaysAgo: 150, observable: false, developerReports: true,
    addressAttribution: 0.5, reviews: { count: 12, mean: 3.8 },
    developer: { username: 'demo_dev_social', verification: 'UNVERIFIED' }, withUrl: true, methodology: null, tags: ['demo'],
  },
  {
    name: 'PiPay Tools', slug: 'pipay-tools', category: 'payments',
    description: DEMO_DESC('payment links and invoices for merchants.'),
    baseTx: 70, dailyGrowth: 0.004, avgAmount: 15, firstSeenDaysAgo: 220, observable: true, developerReports: false,
    addressAttribution: 0.85, reviews: { count: 11, mean: 4.0 },
    developer: { username: 'demo_dev_pay', verification: 'VERIFIED' }, withUrl: true, methodology: null, tags: ['demo'],
    scenario: 'concentration',
  },
  {
    name: 'PiCreator', slug: 'picreator', category: 'creator',
    description: DEMO_DESC('tips and paid posts for creators.'),
    baseTx: 5, dailyGrowth: 0.12, avgAmount: 1.0, firstSeenDaysAgo: 12, observable: true, developerReports: true,
    addressAttribution: 0.75, reviews: { count: 3, mean: 4.7 },
    developer: { username: 'demo_dev_creator', verification: 'PENDING' }, withUrl: true, methodology: null, tags: ['demo'],
  },
];

const REVIEW_SNIPPETS: Record<number, string[]> = {
  5: ['[DEMO] Works really well, smooth payments.', '[DEMO] Great experience, I use it every week.'],
  4: ['[DEMO] Useful app, a few small bugs.', '[DEMO] Good overall, support answered quickly.'],
  3: ['[DEMO] Average, the interface could be clearer.', '[DEMO] It does the job but slowly.'],
  2: ['[DEMO] Several payments took a long time to confirm.', '[DEMO] Hard to find what I need.'],
  1: ['[DEMO] Could not complete my order.', '[DEMO] Did not work on my phone.'],
};

// ------------------------------------------------------------- generator ----

/**
 * `asOf` defaults to the last COMPLETE UTC day (yesterday), so that no
 * generated timestamp lies in the future.
 */
export function generateDemoDataset(options: { asOf?: Date; seed?: number } = {}): DemoDataset {
  const asOf = startOfUtcDay(options.asOf ?? addDays(new Date(), -1));
  const rng = createRng(options.seed ?? 20260929);

  const categories = CATEGORIES.map((c) => ({ ...c, id: rng.uuid() }));
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const dataSources: DemoDataSource[] = [
    { id: rng.uuid(), name: 'DEMO · Simulated blockchain feed', type: 'BLOCKCHAIN', trustLevel: 90, description: 'Fictional on-chain observations generated by the seed.' },
    { id: rng.uuid(), name: 'DEMO · Developer declarations', type: 'DEVELOPER', trustLevel: 55, description: 'Fictional figures declared by demo developers.' },
    { id: rng.uuid(), name: 'DEMO · Community', type: 'COMMUNITY', trustLevel: 60, description: 'Fictional community reviews.' },
    { id: rng.uuid(), name: 'DEMO · Staking snapshots', type: 'PI_API', trustLevel: 70, description: 'Fictional staking snapshots (distinct metric, not scored).' },
  ];
  const [chain, declared, , stakingSource] = dataSources as [DemoDataSource, DemoDataSource, DemoDataSource, DemoDataSource];

  const users: DemoUser[] = [
    { id: rng.uuid(), piUsername: 'demo_admin', displayName: '[DEMO] Admin', role: 'ADMIN', createdAt: addDays(asOf, -500) },
  ];
  for (let i = 1; i <= 60; i++) {
    users.push({
      id: rng.uuid(),
      piUsername: `demo_user_${String(i).padStart(2, '0')}`,
      displayName: `[DEMO] Pioneer ${i}`,
      role: 'USER',
      createdAt: addDays(asOf, -rng.int(30, 700)),
    });
  }

  const developers: DemoDeveloper[] = [];
  const developerByUsername = new Map<string, DemoDeveloper>();
  for (const p of PROFILES) {
    if (!p.developer) continue;
    const user: DemoUser = {
      id: rng.uuid(),
      piUsername: p.developer.username,
      displayName: `[DEMO] ${p.name} team`,
      role: 'DEVELOPER',
      createdAt: addDays(asOf, -p.firstSeenDaysAgo - 30),
    };
    users.push(user);
    const dev: DemoDeveloper = {
      id: rng.uuid(),
      piUsername: p.developer.username,
      displayName: user.displayName,
      verificationStatus: p.developer.verification,
      userId: user.id,
    };
    developers.push(dev);
    developerByUsername.set(dev.piUsername, dev);
  }

  const apps: DemoApp[] = [];
  const rawMetrics: DemoRawMetric[] = [];
  const transactions: DemoTransaction[] = [];
  const reviews: DemoReview[] = [];
  const reviewers = users.filter((u) => u.role === 'USER');

  for (const p of PROFILES) {
    const firstSeenAt = addDays(asOf, -p.firstSeenDaysAgo);
    const app: DemoApp = {
      id: rng.uuid(),
      name: p.name,
      slug: p.slug,
      description: p.description,
      categoryId: categoryBySlug.get(p.category)!.id,
      url: p.withUrl ? `https://${p.slug}.demo.invalid` : null,
      logoUrl: p.withUrl ? `https://${p.slug}.demo.invalid/logo.png` : null,
      status: 'ACTIVE',
      developerId: p.developer ? developerByUsername.get(p.developer.username)!.id : null,
      methodologyNote: p.methodology,
      tags: p.tags,
      firstSeenAt,
      lastSeenAt: asOf,
    };
    apps.push(app);

    const days = Math.min(DEMO_HISTORY_DAYS, p.firstSeenDaysAgo);
    for (let d = days - 1; d >= 0; d--) {
      const day = addDays(asOf, -d);
      const age = p.firstSeenDaysAgo - d;
      const unavailable = p.gapDays !== undefined && d > 0 && d <= p.gapDays;
      let tx = Math.max(0, Math.round(p.baseTx * Math.exp(p.dailyGrowth * age) * (1 + 0.12 * rng.normal())));
      if (p.scenario === 'activity-spike' && d === 0) tx = tx * 9;
      const volume = Math.max(0, tx * p.avgAmount * (1 + 0.15 * rng.normal()));
      const addresses = Math.max(0, Math.round(tx * (0.35 + 0.1 * rng.next())));

      const push = (sourceId: string, metricType: MetricType, value: number | null, provenance: Provenance, extra: Record<string, unknown> = {}) =>
        rawMetrics.push({
          id: rng.uuid(),
          appId: app.id,
          sourceId,
          metricType,
          value: value === null ? null : Math.round(value * 1e6) / 1e6,
          periodStart: day,
          periodEnd: addDays(day, 1),
          provenance: value === null ? 'UNAVAILABLE' : provenance,
          metadata: { demo: true, ...extra },
        });

      if (p.observable) {
        if (unavailable) {
          push(chain.id, 'TRANSACTION_COUNT', null, 'UNAVAILABLE', { reason: 'DEMO: simulated provider outage' });
          push(chain.id, 'TRANSACTION_VOLUME_PI', null, 'UNAVAILABLE', { reason: 'DEMO: simulated provider outage' });
        } else {
          push(chain.id, 'TRANSACTION_COUNT', tx, 'OBSERVABLE');
          push(chain.id, 'TRANSACTION_VOLUME_PI', volume, 'OBSERVABLE');
          push(chain.id, 'ACTIVE_ADDRESSES', addresses, 'OBSERVABLE', { attributionConfidence: p.addressAttribution });
        }
      }
      if (p.developerReports) {
        // Developers declare slightly different figures (rounding, timezone…).
        const declaredTx = Math.round(tx * (1 + 0.04 * rng.normal()));
        push(declared.id, 'TRANSACTION_COUNT', Math.max(0, declaredTx), 'DEVELOPER_REPORTED');
        push(declared.id, 'ACTIVE_USERS', Math.max(0, Math.round(addresses * 1.1)), 'DEVELOPER_REPORTED', {
          attributionConfidence: 0.6,
        });
        if (!p.observable) push(declared.id, 'TRANSACTION_VOLUME_PI', volume, 'DEVELOPER_REPORTED');
      }
      if (p.staking !== undefined && d % 7 === 0) {
        push(stakingSource.id, 'STAKED_PI', p.staking * (1 + 0.02 * rng.normal()), 'OBSERVABLE');
      }
    }

    // A few days of individual transactions (for concentration / pattern analysis).
    if (p.observable) {
      const appAddress = `GDEMO${p.slug.toUpperCase().replace(/[^A-Z]/g, '').padEnd(10, 'X').slice(0, 10)}APP`;
      for (let d = 6; d >= 0; d--) {
        const day = addDays(asOf, -d);
        const count = Math.min(12, Math.max(2, Math.round(p.baseTx / 30)));
        for (let i = 0; i < count; i++) {
          transactions.push(demoTx(rng, app.id, chain.id, `GDEMOUSER${rng.int(1000, 9999)}XXXXXXX`, appAddress,
            Math.max(0.01, p.avgAmount * (1 + 0.5 * rng.normal())), addDays(day, rng.next()), p.addressAttribution));
        }
        if (p.scenario === 'concentration') {
          for (let i = 0; i < 8; i++) {
            transactions.push(demoTx(rng, app.id, chain.id, 'GDEMOWHALE0000000001', appAddress, 250, addDays(day, rng.next()), 0.9));
          }
        }
      }
      // A weakly attributed transaction: stored, but never linked to an app's economics.
      transactions.push(demoTx(rng, app.id, chain.id, 'GDEMOUNKNOWN000000001', appAddress, 5, asOf, 0.2));
    }

    // Reviews: spread over the app's life; a burst on the last day for the review scenario.
    const reviewCount = p.reviews.count;
    const usedUsers = new Set<string>();
    const pickReviewer = () => {
      for (let tries = 0; tries < 200; tries++) {
        const u = rng.pick(reviewers);
        if (!usedUsers.has(u.id)) {
          usedUsers.add(u.id);
          return u;
        }
      }
      return null;
    };
    const burst = p.scenario === 'review-burst' ? 14 : 0;
    for (let i = 0; i < reviewCount; i++) {
      const u = pickReviewer();
      if (!u) break;
      const isBurst = i >= reviewCount - burst;
      const rating = isBurst ? 5 : Math.min(5, Math.max(1, Math.round(p.reviews.mean + rng.normal())));
      const createdAt = isBurst
        ? addDays(asOf, rng.next() * 0.9)
        : addDays(asOf, -rng.int(1, Math.min(p.firstSeenDaysAgo, DEMO_HISTORY_DAYS)) + rng.next());
      const roll = rng.next();
      const status: ReviewStatus = isBurst ? 'PUBLISHED' : roll < 0.08 ? 'PENDING' : roll < 0.12 ? 'HIDDEN' : 'PUBLISHED';
      reviews.push({ id: rng.uuid(), appId: app.id, userId: u.id, rating, review: rng.pick(REVIEW_SNIPPETS[rating]!), status, createdAt });
    }
  }

  return { asOf, categories, users, developers, dataSources, apps, rawMetrics, transactions, reviews };
}

function demoTx(
  rng: Rng,
  appId: string,
  sourceId: string,
  sender: string,
  receiver: string,
  amount: number,
  timestamp: Date,
  attributionConfidence: number,
): DemoTransaction {
  const hash = Array.from({ length: 64 }, () => Math.floor(rng.next() * 16).toString(16)).join('');
  return {
    id: rng.uuid(),
    txHash: `demo_${hash}`,
    appId,
    sender,
    receiver,
    amount: Math.round(amount * 1e7) / 1e7,
    timestamp,
    sourceId,
    attributionConfidence,
    attributionMethod: 'DEMO: receiver address declared by developer',
    metadata: { demo: true },
  };
}
