import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { sha256Hex } from '../core/trace/sha256.js';
import type { Bundle } from '../core/project/bundle.js';
import type { PackData } from '../core/pack/types.js';

export function writeBundleDir(dir: string, b: Bundle): void {
  const put = (rel: string, content: string): void => { const p = join(dir, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content, 'utf8'); };
  for (const [p, c] of Object.entries(b.files)) put(p, c);
  put('manifest.json', JSON.stringify(b.manifest, null, 2));
}
export function readBundleDir(dir: string): Bundle {
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files: Record<string, string> = {};
  for (const p of walk(dir)) { const rel = relative(dir, p).split('\\').join('/'); if (rel !== 'manifest.json') files[rel] = readFileSync(p, 'utf8'); }
  return { manifest: JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')), files };
}
export const readPack = (path: string): PackData => JSON.parse(readFileSync(path, 'utf8')) as PackData;

/** Empreinte du code du moteur (src/core) : enregistrée dans les bundles, jamais dans les empreintes de contenu. */
export function engineSourceHash(root: string): string {
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
  const files = walk(join(root, 'src', 'core')).sort();
  return 'sha256:' + sha256Hex(files.map((f) => relative(root, f).split('\\').join('/') + '\n' + readFileSync(f, 'utf8')).join('\n---\n'));
}
