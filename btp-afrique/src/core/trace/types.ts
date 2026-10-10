/** Types de trace partagés (ADR-0007). Toute référence est un identifiant stable + empreinte. */
export interface TraceInput {
  name: string; value: string; unit: string;
  source: {
    type: 'attr' | 'assumption' | 'geo' | 'literal' | 'param' | 'catalogue' | 'price';
    id?: string; attr?: string; origin?: string; assumptionId?: string;
    confidence?: string | null; validation?: string;
  };
}
export interface TraceStep { op: string; expr: string; result: string; unit: string }
export interface RuleRef { id: string; version: string; hash: string }
export interface TraceNode {
  rule: RuleRef;
  inputs: TraceInput[];
  steps: TraceStep[];
  result: { value: string; unit: string };
}
export interface ConfidenceFloor { value: string; limitedBy: string }
export interface EntityRef { type: string; id: string; code: string }
