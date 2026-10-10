/**
 * Unités techniques du moteur (aucune unité commerciale ni monétaire : celles-ci viennent des packs).
 * Conversion exacte via des facteurs décimaux vers l'unité de base de la dimension.
 */
import { Dec } from './decimal.js';

export type Dimension = 'length' | 'area' | 'volume' | 'mass' | 'time' | 'count';

export interface UnitDef { code: string; dimension: Dimension; /** facteur vers l'unité de base de la dimension */ factor: string }

/** Unités techniques. Base : m, m2, m3, kg, h, u. */
export const ENGINE_UNITS: UnitDef[] = [
  { code: 'm', dimension: 'length', factor: '1' },
  { code: 'cm', dimension: 'length', factor: '0.01' },
  { code: 'mm', dimension: 'length', factor: '0.001' },
  { code: 'm2', dimension: 'area', factor: '1' },
  { code: 'm3', dimension: 'volume', factor: '1' },
  { code: 'l', dimension: 'volume', factor: '0.001' },
  { code: 'kg', dimension: 'mass', factor: '1' },
  { code: 't', dimension: 'mass', factor: '1000' },
  { code: 'h', dimension: 'time', factor: '1' },
  { code: 'u', dimension: 'count', factor: '1' },
];

const CONVERSION_SCALE = 18;

export class UnitRegistry {
  private readonly defs = new Map<string, UnitDef>();
  constructor(extra: UnitDef[] = []) {
    for (const d of [...ENGINE_UNITS, ...extra]) {
      if (this.defs.has(d.code)) throw new Error(`Unité dupliquée : ${d.code}`);
      this.defs.set(d.code, d);
    }
  }
  has(code: string): boolean { return this.defs.has(code); }
  get(code: string): UnitDef {
    const d = this.defs.get(code);
    if (!d) throw new Error(`Unité inconnue : "${code}"`);
    return d;
  }
  dimension(code: string): Dimension { return this.get(code).dimension; }
  compatible(a: string, b: string): boolean { return this.dimension(a) === this.dimension(b); }

  /** Convertit `value` de `from` vers `to` (même dimension obligatoire). */
  convert(value: Dec, from: string, to: string): Dec {
    if (from === to) return value;
    const f = this.get(from); const t = this.get(to);
    if (f.dimension !== t.dimension) {
      throw new Error(`Incohérence dimensionnelle : ${from} (${f.dimension}) → ${to} (${t.dimension})`);
    }
    const num = value.mul(Dec.parse(f.factor));
    return num.div(Dec.parse(t.factor), CONVERSION_SCALE, 'half_up');
  }
}
