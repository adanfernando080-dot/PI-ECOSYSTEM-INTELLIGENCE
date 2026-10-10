/**
 * Modèle architectural NEUTRE et UNIVERSEL (ADR-0001, ADR-0002).
 * Aucun pays, devise, taxe, prix, fournisseur, norme ni code de catalogue local ici.
 * Géométrie : coordonnées entières, unité de base 0,1 mm (ADR-0006). Nombres décimaux : chaînes.
 */
export type Origin = 'ai_detected' | 'user_entered' | 'user_corrected' | 'derived' | 'assumption';
export type Validation = 'accepted' | 'edited' | 'batch_accepted' | 'rejected';

export interface Evidence {
  sheetId?: string; sourceHash?: string; page?: number; bbox?: [number, number, number, number];
  detectorId?: string; modelHash?: string;
}

/** Attribut avec provenance. `value` absent + pas d'hypothèse => `unspecified` (bloquant). */
export interface Attr {
  value?: string;
  unit: string;
  origin: Origin;
  assumptionId?: string;
  confidence?: string | null;
  validation?: Validation;
  evidence?: Evidence;
}

export interface ConstructionSpec {
  /** classe de la taxonomie neutre (jamais un produit) */
  system?: string;
  layers?: Array<{ class: string; side?: 'exterior' | 'interior' }>;
  origin: Origin;
  assumptionId?: string;
}

export interface NodeRef { id: string; x: number; y: number }

export interface Wall {
  id: string; code: string; startNode: string; endNode: string;
  thickness: Attr; height: Attr; role: 'exterior' | 'interior';
  spec: ConstructionSpec;
}
export interface Opening {
  id: string; code: string; hostWallId: string; class: string;
  width: Attr; height: Attr; spec: ConstructionSpec;
}
export interface Space {
  id: string; code: string; name: string; usage: string; boundaryWallIds: string[];
  finishes: { floor?: string[]; wall?: string[]; ceiling?: string[] };
}
export interface Slab { id: string; code: string; outlineNodeIds: string[]; thickness: Attr; spec: ConstructionSpec }
export interface Roof { id: string; code: string; outlineNodeIds: string[]; rise: Attr; run: Attr; spec: ConstructionSpec }

export interface Level {
  id: string; code: string; name: string;
  elevation: Attr; clearHeight: Attr;
  nodes: NodeRef[]; walls: Wall[]; openings: Opening[]; spaces: Space[]; slabs: Slab[]; roofs: Roof[];
}
export interface Building { id: string; name: string; levels: Level[] }

export interface PlanRevision {
  /** empreinte du document source (plan) */
  sourceDocumentHash: string; sheetId: string; page: number; label: string;
  supersedes: string | null;
}

export interface ArchitecturalModel {
  schemaVersion: '1';
  id: string; name: string;
  planRevision: PlanRevision;
  buildings: Building[];
}

/** unité de base de la géométrie : 0,1 mm = 1e-4 m */
export const UNITS_PER_METER = 10_000;
