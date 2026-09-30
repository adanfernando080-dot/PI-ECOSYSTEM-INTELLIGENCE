import { CONFIDENCE_LEVEL_THRESHOLDS, CONFIDENCE_VERSION, CONFIDENCE_WEIGHTS, PROVENANCE_QUALITY } from '@pi/confidence';
import { RANKING_CONFIG, RANKING_VERSION } from '@pi/ranking';
import {
  ACTIVITY_WEIGHTS,
  COMMUNITY_CONFIG,
  ECONOMIC_WEIGHTS,
  GROWTH_WEIGHTS,
  OVERALL_WEIGHTS,
  SCORING_VERSION,
  TRANSPARENCY_WEIGHTS,
} from '@pi/scoring';
import { INTENT_CATEGORY_MAP } from '@pi/shared';

/**
 * Public methodology: every weight used by the engines, served as-is so the
 * frontend (and anyone) can display how indicators are computed.
 */
export function methodology() {
  return {
    versions: { scoring: SCORING_VERSION, confidence: CONFIDENCE_VERSION, ranking: RANKING_VERSION },
    principles: [
      'Every data point carries its provenance: OBSERVABLE, DEVELOPER_REPORTED, ESTIMATED or UNAVAILABLE.',
      'Missing data is never treated as zero: weights are redistributed and confidence is reduced.',
      'Observable economic activity is not revenue.',
      'Anomalies are statistical signals, never conclusions about an application.',
      'Staking is shown as a distinct metric and excluded from every V1 score.',
      'Rankings order apps along one dimension; the platform does not designate a best application.',
    ],
    piEcosystemScore: { weights: OVERALL_WEIGHTS, excludes: ['staking'] },
    activity: { weights: ACTIVITY_WEIGHTS },
    growth: { weights: GROWTH_WEIGHTS },
    observableEconomicActivity: { weights: ECONOMIC_WEIGHTS },
    community: {
      formula: 'AdjustedRating = (n/(n+k))·R + (k/(n+k))·C',
      k: COMMUNITY_CONFIG.k,
      defaultC: COMMUNITY_CONFIG.defaultGlobalMean,
    },
    transparency: { weights: TRANSPARENCY_WEIGHTS },
    confidence: { weights: CONFIDENCE_WEIGHTS, provenanceQuality: PROVENANCE_QUALITY, levels: CONFIDENCE_LEVEL_THRESHOLDS },
    rankings: RANKING_CONFIG,
    discoveryIntents: INTENT_CATEGORY_MAP,
  };
}
