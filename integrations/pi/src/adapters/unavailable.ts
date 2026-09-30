import type { BlockchainDataProvider, PiAuthProvider, PiPlatformClient, StakingDataProvider } from '../ports';
import type { ProviderResult } from '../types';

/**
 * V1 adapters: no real Pi connection exists yet, so every provider reports
 * itself as UNAVAILABLE. This is deliberate — returning empty arrays or zeros
 * would make the platform pretend it observed "no activity".
 */

const unavailable = (reason: string): ProviderResult<never> => ({ available: false, reason });

export class UnavailablePlatformClient implements PiPlatformClient {
  readonly name = 'unavailable-pi-platform';
  async getAppMetrics() {
    return unavailable('Pi Platform API integration is not configured in V1');
  }
}

export class UnavailableAuthProvider implements PiAuthProvider {
  readonly name = 'unavailable-pi-auth';
  async verifyAccessToken() {
    return unavailable('Pi authentication is not configured in V1');
  }
}

export class UnavailableBlockchainProvider implements BlockchainDataProvider {
  readonly name = 'unavailable-blockchain';
  async getTransactions() {
    return unavailable('No blockchain data provider is configured in V1');
  }
}

export class UnavailableStakingProvider implements StakingDataProvider {
  readonly name = 'unavailable-staking';
  async getStakedPi() {
    return unavailable('Staking data is not used by the V1 MVP');
  }
}
