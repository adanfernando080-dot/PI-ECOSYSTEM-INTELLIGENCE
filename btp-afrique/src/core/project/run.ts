import type { ArchitecturalModel } from '../model/types.js';
import type { Taxonomy } from '../model/validate.js';
import type { AssumptionSet } from '../assumptions/assumptions.js';
import type { GeometricTakeoff } from '../geometry/takeoff.js';
import type { MarketBinding } from '../pack/binding.js';
import type { ResolvedPack } from '../pack/types.js';
import type { QuantitySet } from '../measure/commercial.js';
import type { Estimate } from '../pricing/estimate.js';
import type { Document } from '../docs/document.js';

export interface EngineInfo { version: string; apiVersion: string; sourceHash?: string }

/** Un « run » regroupe tout ce qui a contribué à un chiffrage : c'est l'unité de traçabilité et de bundle. */
export interface Run {
  taxonomy: Taxonomy; model: ArchitecturalModel; assumptions: AssumptionSet; pack: ResolvedPack; binding: MarketBinding;
  takeoff: GeometricTakeoff; quantitySet: QuantitySet; estimate: Estimate; documents: Document[]; engine: EngineInfo;
}
