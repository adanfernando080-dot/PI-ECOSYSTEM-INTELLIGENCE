import type { PiIntegration } from './ports';
import {
  UnavailableAuthProvider,
  UnavailableBlockchainProvider,
  UnavailablePlatformClient,
  UnavailableStakingProvider,
} from './adapters/unavailable';

export interface PiIntegrationConfig {
  /** Server-side only. Never serialized, logged or sent to the frontend. */
  apiKey?: string;
  apiBaseUrl?: string;
}

/**
 * Composition root for the Pi integration. Real adapters (Pi Platform API,
 * Pi auth, blockchain indexer, staking) will be selected here from config;
 * in V1 every port resolves to an explicit UNAVAILABLE adapter.
 */
export function createPiIntegration(_config: PiIntegrationConfig = {}): PiIntegration {
  return {
    platform: new UnavailablePlatformClient(),
    auth: new UnavailableAuthProvider(),
    blockchain: new UnavailableBlockchainProvider(),
    staking: new UnavailableStakingProvider(),
  };
}
