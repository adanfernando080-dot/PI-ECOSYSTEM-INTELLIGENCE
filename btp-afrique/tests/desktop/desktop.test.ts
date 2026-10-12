import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { ROOT } from '../support/env.js';
import { checkSize, isFileKind, sanitizeFileName, withExpectedExtension } from '../../apps/desktop/electron/files.js';
import { CSP } from '../../apps/desktop/electron/csp.js';
import { CHANNELS } from '../../apps/desktop/shared/ipc.js';

const walk = (d: string, ext: RegExp): string[] => readdirSync(d).flatMap((n) => { const p = `${d}/${n}`; return statSync(p).isDirectory() ? walk(p, ext) : ext.test(p) ? [p] : []; });

describe('Shell Electron — aides pures du processus principal', () => {
  it('noms de fichier : jamais de chemin, caractères réservés Windows, noms réservés, vide', () => {
    expect(sanitizeFileName('..\\..\\Windows\\evil.exe')).toBe('evil.exe'); expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('a<b>c:d"e|f?g*.pdf')).toBe('a_b_c_d_e_f_g_.pdf'); expect(sanitizeFileName('CON')).toBe('document'); expect(sanitizeFileName('nul.txt')).toBe('document');
    expect(sanitizeFileName('')).toBe('document'); expect(sanitizeFileName(42)).toBe('document'); expect(sanitizeFileName('.hidden')).toBe('hidden'); expect(sanitizeFileName('x'.repeat(500)).length).toBe(120);
  });
  it('extension forcée selon le type produit ; types inconnus refusés (pas de .exe possible)', () => {
    expect(withExpectedExtension('rapport', 'application/pdf')).toBe('rapport.pdf'); expect(withExpectedExtension('p.btpx', 'application/zip')).toBe('p.btpx');
    expect(withExpectedExtension('x.exe', 'application/pdf')).toBe('x.exe.pdf'); expect(withExpectedExtension('x', 'application/x-msdownload')).toBeNull();
  });
  it('types de fichier à ouvrir : liste fermée ; taille bornée', () => {
    expect(isFileKind('btpx')).toBe(true); expect(isFileKind('plan')).toBe(true); expect(isFileKind('../etc')).toBe(false); expect(isFileKind('__proto__')).toBe(false);
    expect(checkSize('btpx', 10)).toBeNull(); expect(checkSize('plan', 300 * 1048576)).toMatch(/volumineux/);
  });
  it('CSP : aucune ouverture externe, pas d\'eval, pas d\'objet', () => {
    expect(CSP).toContain("default-src 'none'"); expect(CSP).toContain("script-src 'self'"); expect(CSP).not.toMatch(/unsafe-eval|https?:|\*/); expect(CSP).toContain("object-src 'none'"); expect(CSP).toContain("connect-src 'self'");
  });
  it('canaux IPC : liste fermée et nommée', () => { expect(Object.values(CHANNELS).sort()).toEqual(['btp:app:info', 'btp:file:pick', 'btp:file:save', 'btp:packs:list', 'btp:window:set-dirty']); });
});

describe('Shell Electron — séparation (le noyau ne dépend pas du shell)', () => {
  it('src/ (noyau et adaptateurs) n\'importe ni electron ni apps/', () => {
    for (const f of walk(`${ROOT}/src`, /\.ts$/)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from 'electron'|from "electron"|apps\/desktop|require\('electron'\)/);
  });
  it('le renderer (apps/desktop/src) n\'importe ni electron ni node:* ; seul le preload importe electron', () => {
    for (const f of walk(`${ROOT}/apps/desktop/src`, /\.tsx?$/)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from 'electron'|from 'node:|require\(/);
    const main = readFileSync(`${ROOT}/apps/desktop/electron/main.ts`, 'utf8');
    expect(main).toMatch(/contextIsolation: true/); expect(main).toMatch(/nodeIntegration: false/); expect(main).toMatch(/sandbox: true/); expect(main).not.toMatch(/nodeIntegration: true|contextIsolation: false|webSecurity: false|enableRemoteModule/);
    const pre = readFileSync(`${ROOT}/apps/desktop/electron/preload.ts`, 'utf8'); expect(pre).not.toMatch(/exposeInMainWorld\('\w+', ipcRenderer\)|exposeInMainWorld\('\w+', require/);
  });
  it('aucun calcul métier dans le shell : electron/ n\'importe que les packs (adaptateur) et ses propres fichiers', () => {
    for (const f of walk(`${ROOT}/apps/desktop/electron`, /\.ts$/)) {
      const imports = [...readFileSync(f, 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
      for (const i of imports) expect(i.startsWith('.') ? /adapters\/packs|shared\/ipc|\.\/(files|csp)/.test(i) : /^(electron|node:.*)$/.test(i), `${f}: ${i}`).toBe(true);
    }
  });
});
