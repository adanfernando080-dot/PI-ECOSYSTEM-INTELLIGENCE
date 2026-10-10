/** Orchestration pure du flux de référence : modèle → hypothèses → géométrie → spécification → métré commercial → binding → prix → documents. */
import type { ArchitecturalModel } from '../model/types.js';
import { assertValidModel, type Taxonomy } from '../model/validate.js';
import type { AssumptionSet } from '../assumptions/assumptions.js';
import { computeTakeoff } from '../geometry/takeoff.js';
import { createBinding, type BindingRequest } from '../pack/binding.js';
import { ENGINE_API, ENGINE_VERSION, type ResolvedPack } from '../pack/types.js';
import { validateResolved } from '../pack/validate.js';
import { computeQuantitySet } from '../measure/commercial.js';
import { computeEstimate } from '../pricing/estimate.js';
import { buildDocument, type Document, type DocumentRequest } from '../docs/document.js';
import type { EngineInfo, Run } from './run.js';

export interface PipelineInput {
  taxonomy: Taxonomy; model: ArchitecturalModel; assumptions: AssumptionSet; pack: ResolvedPack; binding: BindingRequest; engine?: EngineInfo;
}
export const DEFAULT_ENGINE: EngineInfo = { version: ENGINE_VERSION, apiVersion: ENGINE_API };

export function runEstimate(input: PipelineInput): Run {
  assertValidModel(input.model, input.taxonomy);
  const packErrors = validateResolved(input.pack, input.taxonomy);
  if (packErrors.length) throw new Error('Pack invalide :\n - ' + packErrors.join('\n - '));
  const binding = createBinding(input.pack, input.binding);
  const takeoff = computeTakeoff(input.model, input.assumptions);
  const quantitySet = computeQuantitySet(input.model, input.assumptions, takeoff, input.pack, binding);
  const estimate = computeEstimate(input.pack, binding, quantitySet);
  return { taxonomy: input.taxonomy, model: input.model, assumptions: input.assumptions, pack: input.pack, binding, takeoff, quantitySet, estimate, documents: [], engine: input.engine ?? DEFAULT_ENGINE };
}

export function emitDocument(run: Run, req: DocumentRequest): Document {
  const doc = buildDocument(run, req);
  run.documents.push(doc);
  return doc;
}
