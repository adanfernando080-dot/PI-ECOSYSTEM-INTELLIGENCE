/**
 * Format DÉCLARATIF des packs marché (ADR-0004, ADR-0008, ADR-0012). Données pures, signées.
 * Le moteur n'exécute que le vocabulaire fermé « declarative-1 » ci-dessous ; aucun code n'est embarqué.
 */
import type { UnitDef } from '../units/units.js';

export const ENGINE_API = '1';
export const ENGINE_VERSION = '0.0.1-m0';
export const RULE_LANGUAGE = 'declarative-1';

export type DataClass = 'synthetic/test' | 'commercial';
export type CostKind = 'material' | 'labour' | 'equipment' | 'transport';
export interface Rounding { scale: number; mode: 'half_up' | 'floor' | 'ceil' }

export interface Zone { id: string; parent: string | null; type: string; name: string }
export interface Currency { code: string; minorUnits: number; symbol: string; name: string }
export interface CatalogueItem {
  code: string; label: string; kind: CostKind; unit: string;
  orderRounding?: Rounding; specClass?: string;
}
export interface Range { min: string; max: string }
export type MappingTarget = 'wall' | 'wall.layer' | 'space.floor' | 'space.wall' | 'space.ceiling' | 'slab' | 'roof' | 'opening';
export interface SpecMapping {
  id: string; version: string; target: MappingTarget; class: string; side?: 'exterior' | 'interior';
  thickness?: Range; width?: Range; height?: Range; material?: string; assembly: string; priority?: number;
}
export interface Component {
  kind: CostKind | 'assembly'; item?: string; ref?: string;
  consumption: string; unit: string; per: string; lossRate?: string;
}
export interface Assembly {
  code: string; version: string; label: string; unit: string; basis: Basis; lot: string;
  quantityRounding: Rounding; estimateFlag?: string; components: Component[];
}
export type Basis = 'wall.area' | 'space.wall.area' | 'space.floor.area' | 'space.ceiling.area' | 'slab.volume' | 'roof.area' | 'opening.count';
export const BASES: Basis[] = ['wall.area', 'space.wall.area', 'space.floor.area', 'space.ceiling.area', 'slab.volume', 'roof.area', 'opening.count'];

export interface DeductionRule { mode: 'net' | 'gross' | 'threshold'; thresholdM2?: string }
export interface MeasurementMethod { id: string; version: string; deductions: { 'wall.area': DeductionRule; 'space.wall.area': DeductionRule } }

export interface CostLayer {
  id: string; label: string; kind: 'sum' | 'percent' | 'fixed'; scope: 'line' | 'total';
  of?: CostKind[]; base?: string[]; rate?: { param: string }; amount?: { param: string };
  /** 'add' (défaut) : le montant s'ajoute au total ; 'tax' : idem, mais présenté comme taxe */
  effect?: 'add' | 'tax';
}
export interface PriceEntry {
  id: string; item: string; unit: string; zoneId: string; currency: string; date: string;
  source: { type: string; ref: string }; version: string; confidence: string;
  stat: { min: string; median: string; mean: string; max: string; n: number };
  dataClass: DataClass;
}
export interface PriceBook { id: string; version: string; dataClass: DataClass; currency: string; entries: PriceEntry[] }
export interface Lot { code: string; label: string; order: number }
export interface DocumentTemplate {
  id: string; kind: string; layout: 'priced-lines' | 'quote'; language: string; labels: Record<string, string>;
}
export interface LegalIdentifier { key: string; label: string }
export interface NumberingRule { kind: string; pattern: string }
export interface AssumptionProposal { id: string; key: string; value: { value: string; unit?: string }; scope: 'project' | 'level' | 'entity'; rationale: string }

export type CollectionName = 'catalogue' | 'specMappings' | 'assemblies' | 'zoneTree' | 'units' | 'workBreakdown'
  | 'documentTemplates' | 'legalIdentifiers' | 'numberingRules' | 'defaultSpecProfiles' | 'priceBooks';

export interface PackData {
  packSchemaVersion: '1';
  id: string; version: string; dataClass: DataClass; description?: string;
  extends: null | { id: string; version: string; contentHash: string };
  requires: { engineApi: string; specTaxonomy: string; ruleLanguage: string };
  zoneTree?: Zone[];
  currency?: Currency;
  units?: UnitDef[];
  catalogue?: CatalogueItem[];
  specMappings?: SpecMapping[];
  assemblies?: Assembly[];
  measurementMethod?: MeasurementMethod;
  costBuildUp?: CostLayer[];
  params?: Record<string, string>;
  rounding?: { quantity: Rounding; unitPrice: Rounding; lineAmount: Rounding; totalLayer: Rounding };
  priceBooks?: PriceBook[];
  workBreakdown?: Lot[];
  documentTemplates?: DocumentTemplate[];
  legalIdentifiers?: LegalIdentifier[];
  numberingRules?: NumberingRule[];
  defaultSpecProfiles?: AssumptionProposal[];
  remove?: Partial<Record<CollectionName, string[]>>;
  contentHash?: string;
  signature?: { keyId: string; alg: 'ed25519'; value: string };
}

export interface ResolvedPack extends Omit<PackData, 'extends' | 'remove' | 'signature' | 'contentHash'> {
  zoneTree: Zone[]; currency: Currency; units: UnitDef[]; catalogue: CatalogueItem[]; specMappings: SpecMapping[];
  assemblies: Assembly[]; measurementMethod: MeasurementMethod; costBuildUp: CostLayer[]; params: Record<string, string>;
  rounding: NonNullable<PackData['rounding']>; priceBooks: PriceBook[]; workBreakdown: Lot[];
  documentTemplates: DocumentTemplate[]; legalIdentifiers: LegalIdentifier[]; numberingRules: NumberingRule[];
  defaultSpecProfiles: AssumptionProposal[];
  resolution: { chain: Array<{ id: string; version: string; contentHash: string }>; resolvedHash: string };
}

/** Paramètres de politique OBLIGATOIRES dans tout pack résolu : le moteur n'a aucun défaut (ADR-0001 R7). */
export const REQUIRED_PARAMS = ['staleAfterDays', 'lowConfidenceBelow'];
