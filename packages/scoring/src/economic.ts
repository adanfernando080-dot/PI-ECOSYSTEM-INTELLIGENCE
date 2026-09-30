import { clamp, logNormalize, round } from '@pi/shared';
import { combineAvailable, signedRatioToScore, type ScoreResult } from './combine';
import { ECONOMIC_CONFIG, ECONOMIC_WEIGHTS } from './config';
import type { NormalizationContext } from './context';

export type EconomicComponent = keyof typeof ECONOMIC_WEIGHTS;

export interface ObservableEconomicActivityInput {
  /** Attributable transactions in the window. */
  transactionCount: number | null;
  /** Observable Pi volume of attributable transactions in the window. */
  volumePi: number | null;
  /** Same volume over the previous window, for the trend component. */
  previousVolumePi: number | null;
  activeDays: number | null;
  windowDays: number;
  distinctAddresses: number | null;
  /** Attribution confidence (0..1) of the address data. */
  addressAttributionConfidence: number | null;
}

/**
 * ObservableEconomicActivity.
 *
 * Describes economic activity that can be OBSERVED (transactions, Pi volume,
 * active days, counterparties, trend). It is NOT revenue: no field of this
 * result is, or may be presented as, an income estimate.
 */
export interface ObservableEconomicActivity extends ScoreResult<EconomicComponent> {
  label: 'observable_economic_activity';
  observableVolumePi: number | null;
  volumeTrend: number | null;
}

/**
 * Observable Economic Activity score (0..100)
 *   25% transaction count  35% observable Pi volume  15% active days
 *   15% distinct addresses (only when attribution ≥ 0.7)  10% volume trend
 */
export function computeObservableEconomicActivity(
  input: ObservableEconomicActivityInput,
  ctx: NormalizationContext,
): ObservableEconomicActivity {
  const addressesUsable =
    input.distinctAddresses !== null &&
    input.addressAttributionConfidence !== null &&
    input.addressAttributionConfidence >= ECONOMIC_CONFIG.minAttributionConfidence;

  const volumeTrend =
    input.volumePi === null || input.previousVolumePi === null
      ? null
      : (input.volumePi - input.previousVolumePi) / Math.max(input.previousVolumePi, 1);

  const result = combineAvailable<EconomicComponent>(
    {
      transactions: {
        weight: ECONOMIC_WEIGHTS.transactions,
        value: input.transactionCount === null ? null : logNormalize(input.transactionCount, ctx.transactionCountRef),
      },
      volume: {
        weight: ECONOMIC_WEIGHTS.volume,
        value: input.volumePi === null ? null : logNormalize(input.volumePi, ctx.volumePiRef),
      },
      activeDays: {
        weight: ECONOMIC_WEIGHTS.activeDays,
        value:
          input.activeDays === null || input.windowDays <= 0
            ? null
            : (clamp(input.activeDays, 0, input.windowDays) / input.windowDays) * 100,
      },
      distinctAddresses: {
        weight: ECONOMIC_WEIGHTS.distinctAddresses,
        value: addressesUsable ? logNormalize(input.distinctAddresses!, ctx.activeAddressesRef) : null,
      },
      trend: {
        weight: ECONOMIC_WEIGHTS.trend,
        value: volumeTrend === null ? null : signedRatioToScore(volumeTrend),
      },
    },
    ECONOMIC_CONFIG.minCoverage,
  );

  if (input.distinctAddresses !== null && !addressesUsable) {
    result.notes.push('Distinct addresses ignored: attribution confidence below threshold.');
  }

  return {
    ...result,
    label: 'observable_economic_activity',
    observableVolumePi: input.volumePi === null ? null : round(input.volumePi, 6),
    volumeTrend: volumeTrend === null ? null : round(volumeTrend, 4),
  };
}
