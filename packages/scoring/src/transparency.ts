import { round } from '@pi/shared';
import { TRANSPARENCY_CONFIG, TRANSPARENCY_WEIGHTS } from './config';

export type TransparencyItem = keyof typeof TRANSPARENCY_WEIGHTS;

export interface TransparencyInput {
  description: string | null;
  hasCategory: boolean;
  hasDeveloper: boolean;
  developerVerified: boolean;
  url: string | null;
  /** Public information beyond the basics (e.g. logo, tags). */
  hasPublicInformation: boolean;
  /** A methodology note explaining how the app reports its own figures. */
  methodologyNote: string | null;
  /** At least one DEVELOPER_REPORTED metric in the analysis window. */
  hasDeveloperReportedData: boolean;
  /**
   * Share (0..1) of the app's data points whose provenance is known
   * (i.e. not UNAVAILABLE). null when the app has no data point at all.
   */
  provenanceKnownShare: number | null;
}

export interface TransparencyResult {
  score: number;
  satisfied: TransparencyItem[];
  missing: TransparencyItem[];
  items: Record<TransparencyItem, { weight: number; earned: number }>;
}

/**
 * Transparency Score (0..100): a weighted checklist of publicly available
 * information. It measures disclosure, not quality. Always computable.
 */
export function computeTransparencyScore(input: TransparencyInput): TransparencyResult {
  const ratios: Record<TransparencyItem, number> = {
    description: (input.description?.trim().length ?? 0) >= TRANSPARENCY_CONFIG.minDescriptionLength ? 1 : 0,
    category: input.hasCategory ? 1 : 0,
    developerIdentified: input.hasDeveloper ? 1 : 0,
    developerVerified: input.developerVerified ? 1 : 0,
    url: isHttpUrl(input.url) ? 1 : 0,
    publicInformation: input.hasPublicInformation ? 1 : 0,
    methodology: (input.methodologyNote?.trim().length ?? 0) > 0 ? 1 : 0,
    developerReportedData: input.hasDeveloperReportedData ? 1 : 0,
    // Partial credit: proportional to the share of data points with known provenance.
    provenanceDeclared: input.provenanceKnownShare ?? 0,
  };

  const items = {} as TransparencyResult['items'];
  const satisfied: TransparencyItem[] = [];
  const missing: TransparencyItem[] = [];
  let total = 0;

  for (const key of Object.keys(TRANSPARENCY_WEIGHTS) as TransparencyItem[]) {
    const weight = TRANSPARENCY_WEIGHTS[key];
    const earned = round(weight * Math.min(1, Math.max(0, ratios[key])));
    items[key] = { weight, earned };
    total += earned;
    (earned >= weight ? satisfied : missing).push(key);
  }

  return { score: round(total), satisfied, missing, items };
}

function isHttpUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
