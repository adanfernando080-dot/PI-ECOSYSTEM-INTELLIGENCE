/** Compile le processus principal et le preload en CommonJS autonomes (esbuild) : aucune dépendance à embarquer dans l'installateur. */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); const OUT = join(HERE, '..', 'electron', 'dist');
for (const [entry, out] of [['main.ts', 'main.cjs'], ['preload.ts', 'preload.cjs']] as const) {
  await build({ entryPoints: [join(HERE, '..', 'electron', entry)], outfile: join(OUT, out), bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['electron'], sourcemap: false, logLevel: 'warning', legalComments: 'none' });
}
console.log(`Processus principal + preload compilés dans ${OUT}`);
