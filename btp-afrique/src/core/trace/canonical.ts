/**
 * Sérialisation canonique (ADR-0006, ADR-0007) : clés triées, Dec/bigint en chaîne normalisée,
 * pas de undefined, pas de nombre non entier. Le hash d'un objet = SHA-256 de sa forme canonique.
 */
import { Dec } from '../units/decimal.js';
import { sha256Hex } from './sha256.js';

export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (value instanceof Dec) return JSON.stringify(value.toString());
  switch (typeof value) {
    case 'string': return JSON.stringify(value);
    case 'boolean': return value ? 'true' : 'false';
    case 'bigint': return JSON.stringify(value.toString());
    case 'number':
      if (!Number.isInteger(value)) throw new Error(`canonicalize: nombre non entier interdit (${value}) ; utiliser une chaîne décimale`);
      return String(value);
    case 'undefined': throw new Error('canonicalize: undefined interdit');
    case 'object': {
      if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
      return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
    }
    default: throw new Error(`canonicalize: type non supporté ${typeof value}`);
  }
}

export const hashOf = (value: unknown): string => 'sha256:' + sha256Hex(canonicalize(value));

/** Copie profonde « JSON pur » : Dec → chaîne, bigint → chaîne, undefined supprimé. */
export function toPlain<T = unknown>(value: unknown): T {
  return JSON.parse(canonicalize(value)) as T;
}
