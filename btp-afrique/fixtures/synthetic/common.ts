/**
 * Fixtures SYNTHÉTIQUES — toutes les valeurs sont des DONNÉES DE TEST (aucun plan réel, aucune donnée de marché).
 */
import { sha256Hex } from '../../src/core/trace/sha256.js';
import type { Attr } from '../../src/core/model/types.js';
import type { AssumptionItem, AssumptionSet } from '../../src/core/assumptions/assumptions.js';

export const m = (v: string): number => {
  // mètres décimaux -> entiers 0,1 mm, sans flottant
  const [i = '0', f = ''] = v.replace('-', '').split('.');
  const n = Number(i) * 10000 + Number((f + '0000').slice(0, 4));
  return v.startsWith('-') ? -n : n;
};
export const userAttr = (value: string, unit = 'm'): Attr => ({ value, unit, origin: 'user_entered', validation: 'accepted' });
export const assumed = (assumptionId: string, unit = 'm'): Attr => ({ unit, origin: 'assumption', assumptionId });
export const confirmed = (id: string, key: string, value: string, unit: string | undefined, rationale: string): AssumptionItem => ({
  id, key, value: unit ? { value, unit } : { value }, scope: 'project', status: 'confirmed', rationale, confirmedBy: 'user:test', confirmedAt: '2026-10-08',
});
export const syntheticPlanRevision = (label: string) => ({
  sourceDocumentHash: 'sha256:' + sha256Hex(`SYNTHETIC-PLAN:${label}`), sheetId: `sheet-${label}`, page: 1,
  label: `PLAN SYNTHÉTIQUE « ${label} » — aucun plan réel`, supersedes: null,
});
export const emptyAssumptions = (id: string): AssumptionSet => ({ id, items: [] });
