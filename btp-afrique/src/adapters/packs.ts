import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readPack } from './fs.js';
import { Ed25519Verifier } from './signature.js';
import { resolvePack } from '../core/pack/resolve.js';
import { validateRaw, verifyPackIntegrity, type SignatureVerifier } from '../core/pack/validate.js';
import type { PackData, ResolvedPack } from '../core/pack/types.js';

export interface PackCatalog { raw: Map<string, PackData>; resolve(id: string): ResolvedPack }

/** Charge tous les packs de `<root>/market-packs`, vérifie schéma + empreinte + signature, expose la résolution. */
export function loadPackCatalog(root: string, verifier: SignatureVerifier | null = new Ed25519Verifier()): PackCatalog {
  const raw = new Map<string, PackData>();
  const dir = join(root, 'market-packs');
  for (const name of readdirSync(dir).sort()) {
    const p = readPack(join(dir, name, 'pack.json'));
    const errs = [...validateRaw(p), ...verifyPackIntegrity(p, verifier)];
    if (errs.length) throw new Error(`Pack ${name} refusé :\n - ${errs.join('\n - ')}`);
    raw.set(`${p.id}@${p.version}`, p);
  }
  return {
    raw,
    resolve(id: string): ResolvedPack {
      const p = [...raw.values()].find((x) => x.id === id);
      if (!p) throw new Error(`Pack inconnu : ${id}`);
      return resolvePack(p, raw);
    },
  };
}
