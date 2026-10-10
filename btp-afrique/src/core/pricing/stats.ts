/**
 * Statistiques de prix et confiance (ADR-0008 / T-PRC-05). Formule PUBLIÉE ; paramètres fournis par l'appelant
 * (aucun défaut dans le moteur) :
 *   confiance = fiabilité_source × min(1, n / nFull) × 1/(1 + âge_jours / demiVieJours) × (1 − min(penaliteMax, (max−min)/médiane))
 * Tous les calculs sont décimaux exacts, arrondis à 4 décimales (demi vers le haut).
 */
import { Dec } from '../units/decimal.js';
import { daysBetween } from './dates.js';

export interface PriceObservation { amountMinor: string; date: string; sourceReliability: string }
export interface ConfidenceParams { nFull: number; halfLifeDays: number; maxDispersionPenalty: string }
export interface PriceStatResult { min: string; median: string; mean: string; max: string; n: number; confidence: string; lastObservedAt: string }

export function buildPriceStat(obs: PriceObservation[], asOf: string, p: ConfidenceParams): PriceStatResult {
  if (obs.length === 0) throw new Error('buildPriceStat : aucune observation');
  const amounts = obs.map((o) => Dec.parse(o.amountMinor)).sort((a, b) => a.cmp(b));
  const n = amounts.length;
  const min = amounts[0]!; const max = amounts[n - 1]!;
  const mid = n % 2 === 1 ? amounts[(n - 1) / 2]! : amounts[n / 2 - 1]!.add(amounts[n / 2]!).div(Dec.int(2), 6);
  const median = mid.round(0, 'half_up');
  const mean = amounts.reduce((a, b) => a.add(b), Dec.ZERO).div(Dec.int(n), 6).round(0, 'half_up');
  const last = obs.map((o) => o.date).sort().pop()!;
  const age = Math.max(0, daysBetween(last, asOf));
  const reliability = obs.map((o) => Dec.parse(o.sourceReliability)).reduce((a, b) => a.add(b), Dec.ZERO).div(Dec.int(n), 4);
  const countF = Dec.int(Math.min(n, p.nFull)).div(Dec.int(p.nFull), 4);
  const fresh = Dec.ONE.div(Dec.ONE.add(Dec.int(age).div(Dec.int(p.halfLifeDays), 6)), 4);
  const spread = median.isZero() ? Dec.ZERO : max.sub(min).div(median, 4);
  const pen = spread.min(Dec.parse(p.maxDispersionPenalty));
  const confidence = reliability.mul(countF).round(4).mul(fresh).round(4).mul(Dec.ONE.sub(pen)).round(4);
  return { min: min.toString(), median: median.toString(), mean: mean.toString(), max: max.toString(), n, confidence: confidence.toString(), lastObservedAt: last };
}
