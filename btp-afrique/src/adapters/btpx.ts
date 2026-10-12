/**
 * Fichier projet autonome `.btpx` (ADR-0016) : UN seul fichier = archive ZIP « stockée » (sans compression), octets DÉTERMINISTES
 * (entrées triées, horodatage fixe). Lisible par n'importe quel outil ZIP (`unzip -t`). Aucune dépendance Node : utilisable dans le renderer.
 *
 * Contenu : fichiers du bundle (modèle, hypothèses, saisies manuelles, pack résolu embarqué, binding, métré, estimation, documents),
 * `manifest.json` (empreintes), `project.json` (nom, journal d'opérations), `sources/*` (plans importés, octets bruts).
 * Les propositions IA non validées ne sont PAS dans le modèle ; elles peuvent être conservées dans `ai/` sans effet sur les empreintes de calcul.
 */
import type { Bundle } from '../core/project/bundle.js';
import { readBundle, verifyBundle } from '../core/project/bundle.js';
import type { Run } from '../core/project/run.js';
import type { OpRecord } from '../core/ops/oplog.js';
import { sha256Bytes } from '../core/trace/sha256.js';
const sha256Hex = (b: Uint8Array): string => Array.from(sha256Bytes(b), (x) => x.toString(16).padStart(2, '0')).join('');

export interface ProjectMeta { schema: 'btpx-project-1'; name: string; oplog: OpRecord[]; sources: Record<string, { sha256: string; bytes: number; mediaType: string; originalName: string }> }
export interface BtpxProject { bundle: Bundle; meta: ProjectMeta; sources: Record<string, Uint8Array>; extra: Record<string, Uint8Array> }

const enc = new TextEncoder(); const dec = new TextDecoder('utf-8', { fatal: true });
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = (b: Uint8Array): number => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zipStore(entries: Record<string, Uint8Array>): Uint8Array {
  const names = Object.keys(entries).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let off = 0;
  const u16 = (v: DataView, o: number, x: number): void => v.setUint16(o, x, true); const u32 = (v: DataView, o: number, x: number): void => v.setUint32(o, x, true);
  for (const name of names) {
    const data = entries[name]!; const nb = enc.encode(name); const crc = crc32(data);
    const lh = new Uint8Array(30 + nb.length); const v = new DataView(lh.buffer);
    u32(v, 0, 0x04034b50); u16(v, 4, 20); u16(v, 6, 0x0800); u16(v, 8, 0); u16(v, 10, 0); u16(v, 12, 0x21); u32(v, 14, crc); u32(v, 18, data.length); u32(v, 22, data.length); u16(v, 26, nb.length); u16(v, 28, 0); lh.set(nb, 30);
    const ch = new Uint8Array(46 + nb.length); const c = new DataView(ch.buffer);
    u32(c, 0, 0x02014b50); u16(c, 4, 20); u16(c, 6, 20); u16(c, 8, 0x0800); u16(c, 10, 0); u16(c, 12, 0); u16(c, 14, 0x21); u32(c, 16, crc); u32(c, 20, data.length); u32(c, 24, data.length); u16(c, 28, nb.length); u32(c, 42, off); ch.set(nb, 46);
    parts.push(lh, data); central.push(ch); off += lh.length + data.length;
  }
  const cdSize = central.reduce((s, x) => s + x.length, 0); const eocd = new Uint8Array(22); const e = new DataView(eocd.buffer);
  u32(e, 0, 0x06054b50); u16(e, 8, names.length); u16(e, 10, names.length); u32(e, 12, cdSize); u32(e, 16, off);
  const all = [...parts, ...central, eocd]; const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of all) { out.set(x, p); p += x.length; }
  return out;
}

export function zipRead(bytes: Uint8Array): { entries: Record<string, Uint8Array>; problems: string[] } {
  const problems: string[] = []; const entries: Record<string, Uint8Array> = {};
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) return { entries, problems: ['archive ZIP invalide : fin de répertoire introuvable'] };
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) { problems.push('répertoire central corrompu'); break; }
    const method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), size = v.getUint32(p + 24, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    let name: string; try { name = dec.decode(bytes.subarray(p + 46, p + 46 + nl)); } catch { problems.push('nom de fichier illisible'); break; }
    p += 46 + nl + xl + cl;
    if (name.startsWith('/') || name.split('/').some((s) => s === '..' || s === '') ) { problems.push(`chemin refusé : ${name}`); continue; }
    if (name in entries) { problems.push(`entrée en double : ${name}`); continue; }
    if (method !== 0) { problems.push(`méthode de compression non prise en charge pour ${name}`); continue; }
    if (lo + 30 > bytes.length || v.getUint32(lo, true) !== 0x04034b50) { problems.push(`en-tête local invalide : ${name}`); continue; }
    const ds = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
    if (ds + size > bytes.length) { problems.push(`données tronquées : ${name}`); continue; }
    const data = bytes.slice(ds, ds + size);
    if (crc32(data) !== crc) problems.push(`CRC invalide : ${name}`);
    entries[name] = data;
  }
  return { entries, problems };
}

export function writeBtpx(run: Run, bundle: Bundle, opts: { name: string; oplog?: OpRecord[]; sources?: Record<string, { bytes: Uint8Array; mediaType: string; originalName: string }> }): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [p, c] of Object.entries(bundle.files)) entries[p] = enc.encode(c);
  entries['manifest.json'] = enc.encode(JSON.stringify(bundle.manifest, null, 2));
  const srcMeta: ProjectMeta['sources'] = {};
  for (const [id, s] of Object.entries(opts.sources ?? {})) { entries[`sources/${id}`] = s.bytes; srcMeta[id] = { sha256: sha256Hex(s.bytes), bytes: s.bytes.length, mediaType: s.mediaType, originalName: s.originalName }; }
  const meta: ProjectMeta = { schema: 'btpx-project-1', name: opts.name, oplog: opts.oplog ?? [], sources: srcMeta };
  entries['project.json'] = enc.encode(JSON.stringify(meta));
  void run; return zipStore(entries);
}

export function readBtpx(bytes: Uint8Array): { project: BtpxProject | null; run: Run | null; ok: boolean; problems: string[] } {
  const z = zipRead(bytes); const problems = [...z.problems];
  const man = z.entries['manifest.json']; const pj = z.entries['project.json'];
  if (!man || !pj) return { project: null, run: null, ok: false, problems: [...problems, 'manifest.json ou project.json absent'] };
  let manifest: Bundle['manifest']; let meta: ProjectMeta;
  try { manifest = JSON.parse(dec.decode(man)); meta = JSON.parse(dec.decode(pj)); } catch (e) { return { project: null, run: null, ok: false, problems: [...problems, `JSON illisible : ${(e as Error).message}`] }; }
  const files: Record<string, string> = {}; const sources: Record<string, Uint8Array> = {}; const extra: Record<string, Uint8Array> = {};
  for (const [p, d] of Object.entries(z.entries)) {
    if (p === 'manifest.json' || p === 'project.json') continue;
    if (p.startsWith('sources/')) { sources[p.slice(8)] = d; continue; }
    if (p.startsWith('ai/')) { extra[p] = d; continue; }
    try { files[p] = dec.decode(d); } catch { problems.push(`fichier non UTF-8 : ${p}`); }
  }
  for (const [id, m] of Object.entries(meta.sources ?? {})) { const d = sources[id]; if (!d) problems.push(`source manquante : ${id}`); else if (sha256Hex(d) !== m.sha256) problems.push(`source altérée : ${id}`); }
  const bundle: Bundle = { manifest, files };
  const v = verifyBundle(bundle); problems.push(...v.problems);
  const { run } = readBundle(bundle);
  return { project: { bundle, meta, sources, extra }, run, ok: problems.length === 0, problems };
}
