/**
 * Review text sanitation and neutral behavioural signals.
 *
 * Signals are stored with a review to support FUTURE analysis. They are facts
 * about the context of the submission, never a classification of the review:
 * nothing here may hide, reject or label a review automatically.
 */

export const REVIEW_TEXT_LIMITS = { min: 10, max: 2000 } as const;

/**
 * Normalizes user text: strips HTML tags and control characters, collapses
 * whitespace. The API stores plain text only; the frontend must still escape
 * it when rendering.
 */
export function sanitizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/<[^>]*>/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ReviewSignalInput {
  text: string;
  rating: number;
  accountCreatedAt: Date;
  submittedAt: Date;
  /** Reviews this user posted (any app) in the previous 24 hours. */
  userReviewsLast24h: number;
}

export interface ReviewSignals {
  accountAgeDays: number;
  userReviewsLast24h: number;
  textLength: number;
  /** Share of the text made of the single most repeated character. */
  repeatedCharShare: number;
  containsUrl: boolean;
}

export function collectReviewSignals(input: ReviewSignalInput): ReviewSignals {
  const counts = new Map<string, number>();
  const chars = [...input.text.replace(/\s/g, '')];
  for (const c of chars) counts.set(c, (counts.get(c) ?? 0) + 1);
  const maxCount = chars.length === 0 ? 0 : Math.max(...counts.values());

  return {
    accountAgeDays: Math.max(
      0,
      Math.floor((input.submittedAt.getTime() - input.accountCreatedAt.getTime()) / 86_400_000),
    ),
    userReviewsLast24h: input.userReviewsLast24h,
    textLength: input.text.length,
    repeatedCharShare: chars.length === 0 ? 0 : Math.round((maxCount / chars.length) * 1000) / 1000,
    containsUrl: /https?:\/\/|www\./i.test(input.text),
  };
}
