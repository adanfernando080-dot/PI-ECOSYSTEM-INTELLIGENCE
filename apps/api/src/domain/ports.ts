import type { AnomalyStatus, AppStatus, ClaimStatus, Period, RankingType, ReviewStatus } from '@pi/shared';
import type { AuthUser } from '../auth/policies';
import type {
  AnomalyRecord,
  AppRecord,
  CategoryRecord,
  ClaimRecord,
  DeclaredMetric,
  DeveloperRecord,
  MetricRecord,
  RankingBatch,
  ReviewRecord,
} from './types';

/**
 * Repository ports. Services depend on these interfaces only; the Prisma
 * implementations live in src/repositories. Tests use in-memory fakes.
 */

export interface AppFilter {
  statuses: AppStatus[];
  categorySlugs?: string[];
  search?: string;
}

export interface NewApp {
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  url: string | null;
  logoUrl: string | null;
  methodologyNote: string | null;
  tags: string[];
  developerId: string;
}

export type AppChanges = Partial<Omit<NewApp, 'developerId' | 'slug'>> & { status?: AppStatus; developerId?: string };

export interface AppRepository {
  list(filter: AppFilter): Promise<AppRecord[]>;
  findById(id: string): Promise<AppRecord | null>;
  findBySlug(slug: string): Promise<AppRecord | null>;
  listByDeveloper(developerId: string): Promise<AppRecord[]>;
  create(data: NewApp): Promise<AppRecord>;
  update(id: string, changes: AppChanges): Promise<AppRecord>;
}

export interface MetricRepository {
  /** Latest metric of `period` for each app (most recent periodEnd, then most recent computation). */
  latestFor(appIds: readonly string[], period: Period): Promise<Map<string, MetricRecord>>;
  /** One row per periodEnd in [from, to], most recent computation per day. */
  history(appId: string, period: Period, from: Date, to: Date): Promise<MetricRecord[]>;
}

export interface RankingRepository {
  latestBatch(type: RankingType, period: Period): Promise<RankingBatch | null>;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface ReviewRepository {
  list(filter: { appId?: string; statuses: ReviewStatus[] }, page: number, limit: number): Promise<Page<ReviewRecord>>;
  summary(appId: string): Promise<{ count: number; average: number | null }>;
  findByAppAndUser(appId: string, userId: string): Promise<ReviewRecord | null>;
  findById(id: string): Promise<ReviewRecord | null>;
  countByUserSince(userId: string, since: Date): Promise<number>;
  create(data: {
    appId: string;
    userId: string;
    rating: number;
    review: string;
    status: ReviewStatus;
    signals: Record<string, unknown>;
  }): Promise<ReviewRecord>;
  moderate(id: string, status: ReviewStatus, note: string | null, moderatorId: string): Promise<ReviewRecord>;
}

export interface CategoryRepository {
  list(): Promise<CategoryRecord[]>;
  findBySlug(slug: string): Promise<CategoryRecord | null>;
  findById(id: string): Promise<CategoryRecord | null>;
  create(data: Omit<CategoryRecord, 'id'>): Promise<CategoryRecord>;
  update(id: string, data: Partial<Omit<CategoryRecord, 'id'>>): Promise<CategoryRecord>;
}

export interface UserRepository {
  findAuthUser(id: string): Promise<(AuthUser & { createdAt: Date }) | null>;
}

export interface DeveloperRepository {
  findById(id: string): Promise<DeveloperRecord | null>;
  /** Returns the developer profile of a DEVELOPER user, creating it on first use. */
  ensureForUser(user: AuthUser): Promise<DeveloperRecord>;
}

export interface FavoriteRepository {
  list(userId: string): Promise<string[]>;
  add(userId: string, appId: string): Promise<void>;
  remove(userId: string, appId: string): Promise<void>;
}

export interface RawMetricRepository {
  /** Stores developer-declared metrics under the developer-declarations source. */
  createDeclared(appId: string, metrics: readonly DeclaredMetric[], declaredBy: string): Promise<number>;
}

export interface ClaimRepository {
  create(appId: string, developerId: string, evidence: string): Promise<ClaimRecord>;
  findByAppAndDeveloper(appId: string, developerId: string): Promise<ClaimRecord | null>;
  findById(id: string): Promise<ClaimRecord | null>;
  list(status: ClaimStatus | undefined, page: number, limit: number): Promise<Page<ClaimRecord>>;
  decide(id: string, status: Exclude<ClaimStatus, 'PENDING'>, reviewerId: string): Promise<ClaimRecord>;
}

export interface AnomalyRepository {
  list(filter: { status?: AnomalyStatus; appId?: string }, page: number, limit: number): Promise<Page<AnomalyRecord>>;
  findById(id: string): Promise<AnomalyRecord | null>;
  updateStatus(id: string, status: AnomalyStatus): Promise<AnomalyRecord>;
}

export interface PipelinePort {
  run(asOf: Date): Promise<{ metrics: number; rankings: number; anomalies: number }>;
}

export interface Repositories {
  apps: AppRepository;
  metrics: MetricRepository;
  rankings: RankingRepository;
  reviews: ReviewRepository;
  categories: CategoryRepository;
  users: UserRepository;
  developers: DeveloperRepository;
  favorites: FavoriteRepository;
  rawMetrics: RawMetricRepository;
  claims: ClaimRepository;
  anomalies: AnomalyRepository;
  pipeline: PipelinePort;
}
