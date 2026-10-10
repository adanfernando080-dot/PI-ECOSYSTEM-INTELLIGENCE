import { describe, expect, it } from 'vitest';
import { Dec } from '../../src/core/units/decimal.js';
import { UnitRegistry } from '../../src/core/units/units.js';

describe('Unités et conversions exactes', () => {
  const reg = new UnitRegistry([{ code: 'sac', dimension: 'mass', factor: '50' }, { code: 'sqft', dimension: 'area', factor: '0.09290304' }, { code: 'pot20', dimension: 'volume', factor: '0.02' }]);
  it('longueur, masse, volume', () => {
    expect(reg.convert(Dec.parse('250'), 'cm', 'm').toString()).toBe('2.5');
    expect(reg.convert(Dec.parse('280.64925'), 'kg', 'sac').toString()).toBe('5.612985');
    expect(reg.convert(Dec.parse('1.5'), 't', 'kg').toString()).toBe('1500');
    expect(reg.convert(Dec.parse('0.25'), 'l', 'pot20').toString()).toBe('0.0125');
  });
  it('unités commerciales/impériales fournies par données (pack)', () => {
    expect(reg.convert(Dec.parse('1'), 'm2', 'sqft').toString().startsWith('10.76391041')).toBe(true);
    expect(reg.convert(Dec.parse('10'), 'sqft', 'sqft').toString()).toBe('10');
  });
  it('incohérence dimensionnelle = erreur', () => {
    expect(() => reg.convert(Dec.ONE, 'kg', 'm2')).toThrow(/dimensionnelle/);
    expect(() => reg.convert(Dec.ONE, 'kg', 'zzz')).toThrow(/inconnue/);
    expect(() => new UnitRegistry([{ code: 'm', dimension: 'length', factor: '1' }])).toThrow(/dupliquée/);
  });
});
