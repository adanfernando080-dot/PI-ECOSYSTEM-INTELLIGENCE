/**
 * Hypothèses explicites (ADR-0005, D15). Aucun défaut implicite : une valeur non lisible sur le plan
 * est `unspecified` ou référence une hypothèse CONFIRMÉE. Un pack peut seulement PROPOSER.
 */
import { Dec } from '../units/decimal.js';
import type { Attr } from '../model/types.js';

export interface AssumptionItem {
  id: string;
  key: string;
  value: { value: string; unit?: string };
  scope: 'project' | 'level' | 'entity';
  status: 'proposed' | 'confirmed';
  rationale: string;
  confirmedBy?: string; confirmedAt?: string;
  /** provenance informative, chaîne opaque (ne référence aucune donnée de marché) */
  seededFrom?: { kind: string; ref: string };
}
export interface AssumptionSet { id: string; items: AssumptionItem[] }

export type Resolved<T> = { ok: true; value: T; source: ResolvedSource } | { ok: false; reason: string };
export interface ResolvedSource {
  type: 'attr' | 'assumption'; origin: string; assumptionId?: string;
  confidence?: string | null; validation?: string;
}

export class AssumptionIndex {
  private readonly byId = new Map<string, AssumptionItem>();
  constructor(readonly set: AssumptionSet) {
    for (const it of set.items) {
      if (this.byId.has(it.id)) throw new Error(`Hypothèse dupliquée : ${it.id}`);
      this.byId.set(it.id, it);
    }
  }
  get(id: string): AssumptionItem | undefined { return this.byId.get(id); }

  /** Valeur d'une hypothèse : uniquement si CONFIRMÉE. */
  confirmed(id: string): Resolved<{ value: string; unit?: string }> {
    const it = this.byId.get(id);
    if (!it) return { ok: false, reason: `hypothèse ${id} absente` };
    if (it.status !== 'confirmed') return { ok: false, reason: `hypothèse ${id} non confirmée (statut ${it.status})` };
    return { ok: true, value: it.value, source: { type: 'assumption', origin: 'assumption', assumptionId: id } };
  }

  /** Résout un attribut numérique en Dec + unité. */
  decimal(attr: Attr | undefined, what: string): Resolved<{ dec: Dec; unit: string }> {
    if (!attr) return { ok: false, reason: `${what} : attribut absent (unspecified)` };
    if (attr.origin === 'assumption') {
      if (!attr.assumptionId) return { ok: false, reason: `${what} : origine « assumption » sans assumptionId` };
      const r = this.confirmed(attr.assumptionId);
      if (!r.ok) return { ok: false, reason: `${what} : ${r.reason}` };
      return { ok: true, value: { dec: Dec.parse(r.value.value), unit: r.value.unit ?? attr.unit }, source: r.source };
    }
    if (attr.value === undefined) return { ok: false, reason: `${what} : valeur non spécifiée (unspecified)` };
    return {
      ok: true, value: { dec: Dec.parse(attr.value), unit: attr.unit },
      source: { type: 'attr', origin: attr.origin, confidence: attr.confidence ?? null, validation: attr.validation },
    };
  }

  /** Classe d'une spécification : directe ou via hypothèse confirmée. */
  specSystem(spec: { system?: string; origin: string; assumptionId?: string }, what: string): Resolved<string> {
    if (spec.origin === 'assumption') {
      if (!spec.assumptionId) return { ok: false, reason: `${what} : spécification « assumption » sans assumptionId` };
      const r = this.confirmed(spec.assumptionId);
      if (!r.ok) return { ok: false, reason: `${what} : ${r.reason}` };
      return { ok: true, value: r.value.value, source: r.source };
    }
    if (!spec.system) return { ok: false, reason: `${what} : classe de spécification non renseignée (unspecified)` };
    return { ok: true, value: spec.system, source: { type: 'attr', origin: spec.origin } };
  }
}

/** Propositions d'un pack (DefaultSpecProfile) : jamais appliquées sans confirmation. */
export function proposeAssumptions(
  existing: AssumptionSet,
  proposals: Array<Pick<AssumptionItem, 'key' | 'value' | 'scope' | 'rationale'> & { id: string }>,
  seededFrom: { kind: string; ref: string },
): { merged: AssumptionSet; conflicts: Array<{ id: string; existing: string; proposed: string }> } {
  const items = existing.items.slice();
  const conflicts: Array<{ id: string; existing: string; proposed: string }> = [];
  for (const p of proposals) {
    const cur = items.find((i) => i.id === p.id);
    if (cur) {
      if (cur.value.value !== p.value.value) conflicts.push({ id: p.id, existing: cur.value.value, proposed: p.value.value });
      continue; // une hypothèse existante (confirmée ou non) n'est jamais écrasée
    }
    items.push({ ...p, status: 'proposed', seededFrom });
  }
  return { merged: { ...existing, items }, conflicts };
}

export function confirmAssumption(set: AssumptionSet, id: string, by: string, at: string): AssumptionSet {
  if (!set.items.some((i) => i.id === id)) throw new Error(`Hypothèse inconnue : ${id}`);
  return { ...set, items: set.items.map((i) => (i.id === id ? { ...i, status: 'confirmed', confirmedBy: by, confirmedAt: at } : i)) };
}
