import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPackCatalog } from '../../src/adapters/packs.js';
import { runEstimate, type PipelineInput } from '../../src/core/project/pipeline.js';
import type { Taxonomy } from '../../src/core/model/validate.js';
import type { ArchitecturalModel } from '../../src/core/model/types.js';
import type { AssumptionSet } from '../../src/core/assumptions/assumptions.js';
import type { ResolvedPack } from '../../src/core/pack/types.js';
import type { BindingRequest } from '../../src/core/pack/binding.js';
import type { Run } from '../../src/core/project/run.js';
import { cellAssumptions, cellModel } from '../../fixtures/synthetic/cell.js';
import { houseAssumptions, houseModel } from '../../fixtures/synthetic/house.js';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const taxonomy: Taxonomy = JSON.parse(readFileSync(`${ROOT}/taxonomy/spec-taxonomy.json`, 'utf8'));
export const catalog = loadPackCatalog(ROOT);
export const ZONES = { bj: 'BJ-LITTORAL-COTONOU', sn: 'SN-DAKAR-DAKAR-PLATEAU', divergent: 'REALM-P1-D1-T1' } as const;
export const ASOF = '2026-10-08';
export type PackKey = keyof typeof ZONES;
export const PACK_IDS: Record<PackKey, string> = { bj: 'pack.bj', sn: 'pack.sn', divergent: 'pack.test.divergent' };

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function runWith(pack: ResolvedPack, model: ArchitecturalModel, assumptions: AssumptionSet, binding: Partial<BindingRequest> & { zoneId: string }, extra: Partial<PipelineInput> = {}): Run {
  return runEstimate({ taxonomy, model, assumptions, pack, binding: { asOf: ASOF, ...binding }, ...extra });
}
export function house(key: PackKey = 'bj'): Run {
  return runWith(catalog.resolve(PACK_IDS[key]), houseModel(), houseAssumptions(), { zoneId: ZONES[key] });
}
export function cell(key: PackKey = 'bj'): Run {
  return runWith(catalog.resolve(PACK_IDS[key]), cellModel(), cellAssumptions(), { zoneId: ZONES[key] });
}
export { cellModel, cellAssumptions, houseModel, houseAssumptions };
