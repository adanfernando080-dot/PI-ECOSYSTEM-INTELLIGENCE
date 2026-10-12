/** Mode développement : serveur Vite (rechargement à chaud) + fenêtre Electron qui le charge. Packs vérifiés servis par le processus principal. */
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..', '..');
await import('./build-main.js');
const server = await createServer({ configFile: join(HERE, '..', 'vite.config.ts'), server: { port: 5173, strictPort: true } }); await server.listen();
const url = `http://localhost:5173`;
const electronPath = createRequire(import.meta.url)('electron') as string;
const child = spawn(electronPath, [ROOT], { stdio: 'inherit', env: { ...process.env, BTP_DEV_SERVER_URL: url } });
child.on('exit', async (code) => { await server.close(); process.exit(code ?? 0); });
