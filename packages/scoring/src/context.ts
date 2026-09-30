/**
 * Ecosystem reference values used to normalize absolute quantities to 0..100.
 * Computed by the metrics engine (e.g. 90th percentile across active apps) so
 * that a score expresses a position within the observed ecosystem.
 */
export interface NormalizationContext {
  transactionCountRef: number;
  activeAddressesRef: number;
  volumePiRef: number;
  absoluteGrowthRef: number;
  baseSizeRef: number;
}

export const DEFAULT_NORMALIZATION_CONTEXT: NormalizationContext = {
  transactionCountRef: 1000,
  activeAddressesRef: 500,
  volumePiRef: 10000,
  absoluteGrowthRef: 500,
  baseSizeRef: 1000,
};
