import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect } from 'vitest';
import { ROOT } from './env.js';

const FILE = `${ROOT}/tests/golden/hashes.json`;
/**
 * Empreintes « golden » épinglées. Tout changement d'une valeur numérique, d'une trace ou d'une structure change ces hash :
 * le test échoue. Mise à jour INTENTIONNELLE uniquement : UPDATE_GOLDEN=1 npx vitest run tests/golden (puis documenter dans le changelog moteur).
 */
export function pinned(name: string, actual: Record<string, string>): void {
  const all: Record<string, Record<string, string>> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  if (process.env.UPDATE_GOLDEN === '1') {
    all[name] = actual; const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b]) => (a < b ? -1 : 1)));
    writeFileSync(FILE, JSON.stringify(sorted, null, 2) + '\n'); return;
  }
  expect(all[name], `empreintes golden « ${name} » absentes : lancer UPDATE_GOLDEN=1 npx vitest run tests/golden`).toBeDefined();
  expect(actual).toEqual(all[name]);
}
