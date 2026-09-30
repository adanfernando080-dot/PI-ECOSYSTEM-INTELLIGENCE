import { clamp, round } from '@pi/shared';

/** One scored component of an engine. `value` is null when the input is unavailable. */
export interface ComponentScore {
  weight: number;
  value: number | null;
}

/**
 * Output of every scoring engine.
 *
 * `score` is null when too little data is available — it is never replaced
 * by 0. `coverage` is the share of component weight that was actually
 * computed and is fed to the confidence engine by the caller.
 */
export interface ScoreResult<K extends string = string> {
  score: number | null;
  coverage: number;
  components: Record<K, ComponentScore>;
  missing: K[];
  notes: string[];
}

/**
 * Weighted average over the AVAILABLE components only.
 *
 * Missing components are excluded and the remaining weights are renormalized,
 * so an unavailable input neither counts as 0 nor silently inflates the score:
 * the reduced `coverage` is reported so confidence can be lowered.
 */
export function combineAvailable<K extends string>(
  components: Record<K, ComponentScore>,
  minCoverage: number,
): ScoreResult<K> {
  const keys = Object.keys(components) as K[];
  const totalWeight = keys.reduce((acc, k) => acc + components[k].weight, 0);
  let availableWeight = 0;
  let weighted = 0;
  const missing: K[] = [];

  for (const key of keys) {
    const { weight, value } = components[key];
    if (value === null) {
      missing.push(key);
      continue;
    }
    availableWeight += weight;
    weighted += weight * clamp(value, 0, 100);
  }

  const coverage = totalWeight === 0 ? 0 : availableWeight / totalWeight;
  const notes: string[] = [];
  let score: number | null = null;

  if (availableWeight > 0 && coverage >= minCoverage) {
    score = round(weighted / availableWeight);
  } else {
    notes.push(
      `Insufficient data: ${round(coverage * 100, 0)}% of the component weight is available (minimum ${round(
        minCoverage * 100,
        0,
      )}%).`,
    );
  }
  if (missing.length > 0 && score !== null) {
    notes.push(`Computed without: ${missing.join(', ')} (weights redistributed, confidence reduced).`);
  }

  return {
    score,
    coverage: round(coverage, 4),
    components: roundComponents(components),
    missing,
    notes,
  };
}

function roundComponents<K extends string>(components: Record<K, ComponentScore>): Record<K, ComponentScore> {
  const out = {} as Record<K, ComponentScore>;
  for (const key of Object.keys(components) as K[]) {
    const c = components[key];
    out[key] = { weight: c.weight, value: c.value === null ? null : round(clamp(c.value, 0, 100)) };
  }
  return out;
}

/** Maps a signed ratio to 0..100 with 50 = no change, using tanh for smooth saturation. */
export function signedRatioToScore(ratio: number): number {
  return clamp(50 + 50 * Math.tanh(ratio), 0, 100);
}
