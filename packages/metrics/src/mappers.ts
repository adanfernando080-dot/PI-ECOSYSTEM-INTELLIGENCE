import type { MetricPeriod, RankingType as DbRankingType } from '@prisma/client';
import type { Period, RankingType } from '@pi/shared';

/** Conversions between API/domain vocabulary and Prisma enums. */

const PERIOD_TO_DB: Record<Period, MetricPeriod> = { '24h': 'P24H', '7d': 'P7D', '30d': 'P30D', '90d': 'P90D' };
const DB_TO_PERIOD: Record<MetricPeriod, Period> = { P24H: '24h', P7D: '7d', P30D: '30d', P90D: '90d' };

export const toDbPeriod = (p: Period): MetricPeriod => PERIOD_TO_DB[p];
export const fromDbPeriod = (p: MetricPeriod): Period => DB_TO_PERIOD[p];

export const toDbRankingType = (t: RankingType): DbRankingType => t.toUpperCase() as DbRankingType;
export const fromDbRankingType = (t: DbRankingType): RankingType => t.toLowerCase() as RankingType;

/** Prisma Decimal | number | null → number | null. */
export function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
}
