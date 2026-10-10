/**
 * Garde-fou CI (ADR-0001 R8) : ajouter ou modifier un pack ne doit EXIGER aucune modification du moteur universel.
 * Un changement qui touche à la fois `market-packs/**` et le moteur (`src/core/**`, `taxonomy/**`) est refusé,
 * sauf justification explicite dans un message de commit : « ENGINE-CHANGE: ADR-NNNN » (le moteur évolue alors pour tous les marchés, par ADR).
 *
 * Usage : tsx tools/check-pack-isolation.ts [base-ref]   (défaut : origin/main)
 */
import { execFileSync } from 'node:child_process';

const PACK_PATHS = [/^market-packs\//, /^tools\/gen-packs\.ts$/];
const ENGINE_PATHS = [/^src\/core\//, /^taxonomy\//];
const JUSTIFICATION = /ENGINE-CHANGE:\s*ADR-\d{4}/;

export interface IsolationResult { ok: boolean; packFiles: string[]; engineFiles: string[]; violations: string[] }

export function checkPackIsolation(changedFiles: string[], commitMessages: string[] = []): IsolationResult {
  const norm = changedFiles.map((f) => f.split('\\').join('/').replace(/^\.\//, ''));
  const packFiles = norm.filter((f) => PACK_PATHS.some((r) => r.test(f)));
  const engineFiles = norm.filter((f) => ENGINE_PATHS.some((r) => r.test(f)));
  const violations: string[] = [];
  if (packFiles.length && engineFiles.length && !commitMessages.some((m) => JUSTIFICATION.test(m))) {
    violations.push(`Le changement modifie des packs (${packFiles.length} fichier(s)) ET le moteur (${engineFiles.length} fichier(s)) sans justification « ENGINE-CHANGE: ADR-NNNN » : ajouter un marché ne doit pas exiger de modifier le moteur.`);
  }
  return { ok: violations.length === 0, packFiles, engineFiles, violations };
}

if (process.argv[1]?.endsWith('check-pack-isolation.ts')) {
  const base = process.argv[2] ?? 'origin/main';
  const git = (...a: string[]): string => execFileSync('git', a, { encoding: 'utf8' });
  const files = git('diff', '--name-only', `${base}...HEAD`, '--', '.').split('\n').filter(Boolean).map((f) => f.replace(/^btp-afrique\//, ''));
  const msgs = git('log', '--format=%B', `${base}..HEAD`).split('\n\n');
  const r = checkPackIsolation(files, msgs);
  console.log(r.ok ? 'OK — isolation moteur/packs respectée' : r.violations.join('\n'));
  process.exit(r.ok ? 0 : 1);
}
