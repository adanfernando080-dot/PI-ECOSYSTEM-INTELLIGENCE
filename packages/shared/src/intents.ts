import type { DiscoveryIntent } from './enums';

/**
 * Discovery intents → category slugs.
 * This is configuration, not a judgement: an intent only narrows the set of
 * categories that are relevant to what the visitor wants to do.
 */
export const INTENT_CATEGORY_MAP: Record<DiscoveryIntent, readonly string[]> = {
  buy: ['marketplace', 'shopping'],
  sell: ['marketplace', 'shopping'],
  spend: ['shopping', 'travel', 'payments'],
  work: ['jobs', 'services'],
  services: ['services'],
  ai: ['ai'],
  games: ['games'],
  learn: ['education'],
};

export function categoriesForIntent(intent: DiscoveryIntent): readonly string[] {
  return INTENT_CATEGORY_MAP[intent];
}
