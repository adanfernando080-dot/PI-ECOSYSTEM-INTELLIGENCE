import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPackCatalog } from '../../src/adapters/packs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Hôte de DÉVELOPPEMENT : sert les packs marché VÉRIFIÉS (schéma + empreinte + signature) et résolus par Node.
 * Le renderer ne fait aucun calcul de confiance sur les packs : il les reçoit via le port `HostApi.listPacks()`.
 * En production, l'hôte Electron implémente le même port (ADR-0010).
 */
function hostPacks(): Plugin {
  const handler = (_req: unknown, res: { setHeader(k: string, v: string): void; end(b: string): void }): void => {
    const catalog = loadPackCatalog(ROOT);
    const parents = new Set([...catalog.raw.values()].map((p) => (p.extends ? p.extends.id : '')));  // un pack parent est une base commune, pas un marché
    const ids = [...new Set([...catalog.raw.values()].map((p) => p.id))].filter((id) => !parents.has(id));
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(ids.map((id) => catalog.resolve(id))));
  };
  return {
    name: 'btp-dev-host-packs',
    configureServer(s) { s.middlewares.use('/host/packs.json', handler as never); },
    configurePreviewServer(s) { s.middlewares.use('/host/packs.json', handler as never); },
  };
}

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  plugins: [react(), hostPacks()],
  server: { port: 5173, fs: { allow: [ROOT] } },
  preview: { port: 4173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 4000 },
});
