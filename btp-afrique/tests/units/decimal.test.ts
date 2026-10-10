import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Dec, isqrt } from '../../src/core/units/decimal.js';
import { sha256Hex } from '../../src/core/trace/sha256.js';
import { canonicalize, hashOf } from '../../src/core/trace/canonical.js';

const d = (s: string): Dec => Dec.parse(s);

describe('Decimal exact (BigInt) — ADR-0006', () => {
  it('forme canonique : zéros de queue supprimés, zéro unique', () => {
    expect(d('12.50').toString()).toBe('12.5');
    expect(d('-0.00').toString()).toBe('0');
    expect(d('0.0050').toString()).toBe('0.005');
    expect(d('100').toString()).toBe('100');
  });
  it('addition/soustraction/multiplication exactes (0,1 + 0,2 = 0,3)', () => {
    expect(d('0.1').add(d('0.2')).toString()).toBe('0.3');
    expect(d('0.3').sub(d('0.1')).toString()).toBe('0.2');
    expect(d('1.15').mul(d('1.15')).toString()).toBe('1.3225');
    expect(Array.from({ length: 10 }, () => d('0.1')).reduce((a, b) => a.add(b), Dec.ZERO).toString()).toBe('1');
  });
  it('division arrondie : demi vers le haut (loin de zéro), plancher, plafond', () => {
    expect(Dec.int(1).div(Dec.int(3), 4).toString()).toBe('0.3333');
    expect(Dec.int(2).div(Dec.int(3), 4).toString()).toBe('0.6667');
    expect(Dec.int(-2).div(Dec.int(3), 4).toString()).toBe('-0.6667');
    expect(Dec.int(2).div(Dec.int(3), 4, 'floor').toString()).toBe('0.6666');
    expect(Dec.int(-2).div(Dec.int(3), 4, 'floor').toString()).toBe('-0.6667');
    expect(Dec.int(2).div(Dec.int(3), 4, 'ceil').toString()).toBe('0.6667');
    expect(Dec.int(-2).div(Dec.int(3), 4, 'ceil').toString()).toBe('-0.6666');
    expect(() => Dec.int(1).div(Dec.ZERO, 2)).toThrow();
  });
  it('arrondi : égalités arrondies loin de zéro', () => {
    expect(d('2.5').round(0).toString()).toBe('3');
    expect(d('-2.5').round(0).toString()).toBe('-3');
    expect(d('0.125').round(2).toString()).toBe('0.13');
    expect(d('0.124').round(2).toString()).toBe('0.12');
    expect(d('681.1875').round(0, 'ceil').toString()).toBe('682');
    expect(d('0.8991675').round(1, 'ceil').toString()).toBe('0.9');
    expect(d('5.6').round(0, 'floor').toString()).toBe('5');
  });
  it('racine carrée décimale déterministe', () => {
    expect(d('25').sqrt(6).toString()).toBe('5');
    expect(d('2').sqrt(8).toString()).toBe('1.41421356');
    expect(d('1.09').sqrt(8).toString()).toBe('1.04403065');
    expect(d('2').sqrt(8, 'floor').toString()).toBe('1.41421356');
    expect(d('3').sqrt(2).toString()).toBe('1.73');
    expect(() => d('-1').sqrt(4)).toThrow();
    expect(() => d('0.123456').sqrt(2)).toThrow(/échelle/);
    expect(isqrt(10n ** 40n)).toBe(10n ** 20n);
  });
  it('refuse les flottants', () => {
    expect(() => Dec.from(1.5)).toThrow();
    expect(() => d('1,5')).toThrow();
    expect(Dec.from(3).toString()).toBe('3');
  });
  it('propriétés (graine fixe) : (a+b)−b = a ; a×(b+c) = a×b + a×c', () => {
    let s = 123456789n;
    const rnd = (): bigint => { s = (s * 6364136223846793005n + 1442695040888963407n) % (1n << 63n); return s % 1000000n; };
    for (let i = 0; i < 200; i++) {
      const a = Dec.of(rnd(), Number(rnd() % 6n)); const b = Dec.of(rnd(), Number(rnd() % 6n)); const c = Dec.of(rnd(), Number(rnd() % 6n));
      expect(a.add(b).sub(b).eq(a)).toBe(true);
      expect(a.mul(b.add(c)).eq(a.mul(b).add(a.mul(c)))).toBe(true);
    }
  });
});

describe('SHA-256 pur TypeScript = Node crypto', () => {
  it('vecteurs et chaînes aléatoires', () => {
    const ref = (t: string): string => createHash('sha256').update(t, 'utf8').digest('hex');
    for (const t of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'é⚠—日本'.repeat(40), 'x'.repeat(1000)]) expect(sha256Hex(t)).toBe(ref(t));
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('Sérialisation canonique', () => {
  it("indépendante de l'ordre des clés", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(canonicalize({ a: { c: [3, { y: 2, z: 1 }], d: 2 }, b: 1 }));
    expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
  });
  it('Dec normalisé, flottants refusés, undefined ignoré dans les objets', () => {
    expect(canonicalize({ v: d('1.50') })).toBe('{"v":"1.5"}');
    expect(() => canonicalize({ v: 1.5 })).toThrow();
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
  it("l'ordre des tableaux est significatif", () => {
    expect(hashOf([1, 2])).not.toBe(hashOf([2, 1]));
  });
});
