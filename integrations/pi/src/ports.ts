import type {
  NormalizedMetricPoint,
  NormalizedTransaction,
  PiIdentity,
  ProviderResult,
  TimeRange,
} from './types';

/**
 * Ports (interfaces) of the Pi integration. The rest of the backend depends on
 * these interfaces only — never on a concrete Pi SDK, URL or payload shape.
 */

/** Pi Platform API (app information, payments visible to the platform). */
export interface PiPlatformClient {
  readonly name: string;
  getAppMetrics(appRef: string, range: TimeRange): Promise<ProviderResult<NormalizedMetricPoint[]>>;
}

/** Pi authentication: verifies an access token issued by the Pi SDK on the client. */
export interface PiAuthProvider {
  readonly name: string;
  verifyAccessToken(accessToken: string): Promise<ProviderResult<PiIdentity>>;
}

/** Blockchain data provider (indexer / Horizon-like API). */
export interface BlockchainDataProvider {
  readonly name: string;
  getTransactions(addresses: readonly string[], range: TimeRange): Promise<ProviderResult<NormalizedTransaction[]>>;
}

/**
 * Staking data provider. Staking is a DISTINCT metric: it is collected and
 * displayed separately and never feeds a V1 score.
 */
export interface StakingDataProvider {
  readonly name: string;
  getStakedPi(appRef: string, range: TimeRange): Promise<ProviderResult<NormalizedMetricPoint[]>>;
}

export interface PiIntegration {
  platform: PiPlatformClient;
  auth: PiAuthProvider;
  blockchain: BlockchainDataProvider;
  staking: StakingDataProvider;
}
