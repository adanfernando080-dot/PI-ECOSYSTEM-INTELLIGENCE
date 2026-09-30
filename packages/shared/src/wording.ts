/**
 * Guard-rails on wording.
 *
 * The platform produces analytical indicators. It never labels an application
 * as fraudulent, never calls transaction volume "revenue", and never declares
 * an application "the best". These helpers let tests (and future content
 * pipelines) assert that generated text respects those rules.
 */

export const FORBIDDEN_VERDICT_TERMS = ['fraud', 'scam', 'fake'] as const;
export const FORBIDDEN_MERIT_TERMS = ['best_app', 'best_apps', 'winner'] as const;

/** Returns the forbidden verdict terms found in `text` (case-insensitive, whole words). */
export function findVerdictTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_VERDICT_TERMS.filter((term) => new RegExp(`\\b${term}\\w*`, 'i').test(lower));
}

/** Returns merit terms found in an identifier or text. */
export function findMeritTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_MERIT_TERMS.filter((term) => lower.includes(term));
}
