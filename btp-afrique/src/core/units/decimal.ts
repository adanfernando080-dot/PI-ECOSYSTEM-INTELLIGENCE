/**
 * Décimal exact sur BigInt (ADR-0006, ADR-0011).
 * Valeur = n / 10^s. Aucune virgule flottante : résultats identiques sur toutes les plateformes.
 * Les arrondis sont toujours explicites (mode + échelle).
 */
export type RoundingMode = 'half_up' | 'floor' | 'ceil';

const TEN = 10n;
const pow10 = (k: number): bigint => {
  if (k < 0) throw new Error(`pow10: exposant négatif ${k}`);
  return TEN ** BigInt(k);
};

/** Division entière avec mode d'arrondi (signe géré). */
function divRound(num: bigint, den: bigint, mode: RoundingMode): bigint {
  if (den === 0n) throw new Error('division par zéro');
  if (den < 0n) { num = -num; den = -den; }
  const q = num / den; // tronque vers zéro
  const r = num % den;
  if (r === 0n) return q;
  const neg = num < 0n;
  switch (mode) {
    case 'floor': return neg ? q - 1n : q;
    case 'ceil': return neg ? q : q + 1n;
    case 'half_up': {
      const twice = (r < 0n ? -r : r) * 2n;
      if (twice >= den) return neg ? q - 1n : q + 1n; // égalité => on s'éloigne de zéro
      return q;
    }
  }
}

export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('isqrt: négatif');
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

export class Dec {
  private constructor(readonly n: bigint, readonly s: number) {}

  static of(n: bigint, s = 0): Dec { return new Dec(n, s); }
  static int(n: number | bigint): Dec { return new Dec(BigInt(n), 0); }
  static readonly ZERO = new Dec(0n, 0);
  static readonly ONE = new Dec(1n, 0);

  static parse(text: string): Dec {
    const t = text.trim();
    const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(t);
    if (!m) throw new Error(`Décimal invalide : "${text}"`);
    const frac = m[3] ?? '';
    const n = BigInt(m[2]! + frac);
    return new Dec(m[1] ? -n : n, frac.length);
  }

  /** Accepte un Dec, une chaîne décimale ou un entier. */
  static from(v: Dec | string | number | bigint): Dec {
    if (v instanceof Dec) return v;
    if (typeof v === 'string') return Dec.parse(v);
    if (typeof v === 'number') {
      if (!Number.isInteger(v)) throw new Error(`Dec.from: nombre non entier refusé (${v}) ; utiliser une chaîne décimale`);
      return Dec.int(v);
    }
    return Dec.int(v);
  }

  private align(o: Dec): [bigint, bigint, number] {
    if (this.s === o.s) return [this.n, o.n, this.s];
    if (this.s > o.s) return [this.n, o.n * pow10(this.s - o.s), this.s];
    return [this.n * pow10(o.s - this.s), o.n, o.s];
  }

  add(o: Dec): Dec { const [a, b, s] = this.align(o); return new Dec(a + b, s); }
  sub(o: Dec): Dec { const [a, b, s] = this.align(o); return new Dec(a - b, s); }
  mul(o: Dec): Dec { return new Dec(this.n * o.n, this.s + o.s); }
  neg(): Dec { return new Dec(-this.n, this.s); }
  cmp(o: Dec): -1 | 0 | 1 { const [a, b] = this.align(o); return a < b ? -1 : a > b ? 1 : 0; }
  eq(o: Dec): boolean { return this.cmp(o) === 0; }
  lt(o: Dec): boolean { return this.cmp(o) < 0; }
  lte(o: Dec): boolean { return this.cmp(o) <= 0; }
  gt(o: Dec): boolean { return this.cmp(o) > 0; }
  gte(o: Dec): boolean { return this.cmp(o) >= 0; }
  isZero(): boolean { return this.n === 0n; }
  isNeg(): boolean { return this.n < 0n; }
  min(o: Dec): Dec { return this.lte(o) ? this : o; }
  max(o: Dec): Dec { return this.gte(o) ? this : o; }

  /** Division arrondie à `scale` décimales. */
  div(o: Dec, scale: number, mode: RoundingMode = 'half_up'): Dec {
    if (o.n === 0n) throw new Error('division par zéro');
    // (n1/10^s1) / (n2/10^s2) * 10^scale = n1*10^(scale+s2) / (n2*10^s1)
    const num = this.n * pow10(scale + o.s);
    const den = o.n * pow10(this.s);
    return new Dec(divRound(num, den, mode), scale);
  }

  /** Arrondit à `scale` décimales (ne change rien si l'échelle est déjà ≤ scale). */
  round(scale: number, mode: RoundingMode = 'half_up'): Dec {
    if (this.s <= scale) return this;
    return new Dec(divRound(this.n, pow10(this.s - scale), mode), scale);
  }

  /** Racine carrée arrondie à `scale` décimales (ADR-0006). Exige 2*scale >= s. */
  sqrt(scale: number, mode: 'half_up' | 'floor' = 'half_up'): Dec {
    if (this.n < 0n) throw new Error('sqrt: négatif');
    if (2 * scale < this.s) throw new Error(`sqrt: échelle ${scale} trop basse pour une entrée d'échelle ${this.s}`);
    const m = this.n * pow10(2 * scale - this.s);
    const r = isqrt(m);
    if (mode === 'floor') return new Dec(r, scale);
    // arrondi au plus proche : (r+½)² = r²+r+¼ ; M entier => arrondi supérieur ssi M > r²+r
    return new Dec(m > r * r + r ? r + 1n : r, scale);
  }

  /** Forme canonique : sans zéros de queue ; "0" pour zéro ; sans exposant. */
  toString(): string {
    let n = this.n; let s = this.s;
    while (s > 0 && n % TEN === 0n) { n /= TEN; s--; }
    const neg = n < 0n; if (neg) n = -n;
    let digits = n.toString();
    if (s > 0) {
      if (digits.length <= s) digits = '0'.repeat(s - digits.length + 1) + digits;
      digits = digits.slice(0, digits.length - s) + '.' + digits.slice(digits.length - s);
    }
    return (neg ? '-' : '') + digits;
  }

  /** Format avec un nombre fixe de décimales (affichage). */
  toFixed(scale: number, mode: RoundingMode = 'half_up'): string {
    const r = this.round(scale, mode);
    const n = r.s < scale ? r.n * pow10(scale - r.s) : r.n;
    const neg = n < 0n; const abs = neg ? -n : n;
    let digits = abs.toString();
    if (scale > 0) {
      if (digits.length <= scale) digits = '0'.repeat(scale - digits.length + 1) + digits;
      digits = digits.slice(0, digits.length - scale) + '.' + digits.slice(digits.length - scale);
    }
    return (neg ? '-' : '') + digits;
  }

  toJSON(): string { return this.toString(); }
}

export const D = (v: Dec | string | number | bigint): Dec => Dec.from(v);

export function sum(values: Dec[]): Dec { return values.reduce((a, b) => a.add(b), Dec.ZERO); }
