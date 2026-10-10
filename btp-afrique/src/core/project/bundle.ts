/**
 * Format de projet `.btpx` (ADR-0016). M0 : conteneur LOGIQUE = dossier de fichiers JSON canoniques + manifeste d'empreintes.
 * Les paquets utilisés (pack résolu, PriceBook) sont EMBARQUÉS : le projet est rouvrable et vérifiable sans réseau ni pack installé.
 */
import { canonicalize, hashOf } from '../trace/canonical.js';
import { sha256Hex } from '../trace/sha256.js';
import type { Run } from './run.js';
import { verifyRun } from '../trace/chain.js';

export interface BundleManifest {
  format: 'btpx'; formatVersion: '0.1'; engine: { version: string; apiVersion: string; sourceHash?: string };
  dataClass: string; files: Record<string, { sha256: string; bytes: number }>; roots: Record<string, string>;
}
export interface Bundle { manifest: BundleManifest; files: Record<string, string> }

export function createBundle(run: Run): Bundle {
  const files: Record<string, string> = {
    'model.json': canonicalize(run.model), 'assumptions.json': canonicalize(run.assumptions), 'taxonomy.json': canonicalize(run.taxonomy),
    'binding.json': canonicalize(run.binding), [`packs/${run.pack.id}@${run.pack.version}.resolved.json`]: canonicalize(run.pack),
    'takeoff.json': canonicalize(run.takeoff), 'quantity-set.json': canonicalize(run.quantitySet), 'estimate.json': canonicalize(run.estimate),
  };
  for (const d of run.documents) files[`documents/${d.id.replace(':', '-')}.json`] = canonicalize(d);
  const idx: BundleManifest['files'] = {};
  for (const [p, c] of Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))) idx[p] = { sha256: sha256Hex(c), bytes: new TextEncoder().encode(c).length };
  const manifest: BundleManifest = {
    format: 'btpx', formatVersion: '0.1', engine: run.engine, dataClass: run.pack.dataClass, files: idx,
    roots: { modelRev: run.takeoff.modelRev, assumptionSetRev: run.takeoff.assumptionSetRev, bindingRev: run.binding.rev, packResolvedHash: run.pack.resolution.resolvedHash, estimateHash: run.estimate.contentHash },
  };
  return { manifest, files };
}

const REQUIRED = ['model.json', 'assumptions.json', 'taxonomy.json', 'binding.json', 'takeoff.json', 'quantity-set.json', 'estimate.json'];

export function readBundle(b: Bundle): { run: Run | null; problems: string[] } {
  const problems: string[] = [];
  for (const [p, meta] of Object.entries(b.manifest.files)) {
    const c = b.files[p];
    if (c === undefined) problems.push(`fichier manquant : ${p}`);
    else if (sha256Hex(c) !== meta.sha256) problems.push(`empreinte invalide : ${p}`);
  }
  for (const p of Object.keys(b.files)) if (!(p in b.manifest.files)) problems.push(`fichier non déclaré : ${p}`);
  const packFile = Object.keys(b.files).find((p) => p.startsWith('packs/'));
  for (const r of [...REQUIRED, ...(packFile ? [] : ['packs/*'])]) if (r !== 'packs/*' ? b.files[r] === undefined : true) problems.push(`fichier requis absent : ${r}`);
  if (problems.some((x) => x.startsWith('fichier requis absent'))) return { run: null, problems };
  let run: Run;
  try {
    const j = (p: string): any => JSON.parse(b.files[p]!);
    run = {
      taxonomy: j('taxonomy.json'), model: j('model.json'), assumptions: j('assumptions.json'), pack: j(packFile!), binding: j('binding.json'),
      takeoff: j('takeoff.json'), quantitySet: j('quantity-set.json'), estimate: j('estimate.json'),
      documents: Object.keys(b.files).filter((p) => p.startsWith('documents/')).sort().map((p) => j(p)), engine: b.manifest.engine,
    };
  } catch (e) { return { run: null, problems: [...problems, `fichier illisible : ${(e as Error).message}`] }; }
  return { run, problems };
}

/** Vérification complète : empreintes de fichiers + recalcul intégral + résolution de chaque ligne de chaque document. */
export function verifyBundle(b: Bundle): { ok: boolean; problems: string[] } {
  const { run, problems } = readBundle(b);
  if (!run) return { ok: false, problems };
  const all = [...problems, ...verifyRun(run).problems];
  if (hashOf(run.model) !== b.manifest.roots.modelRev) all.push('modelRev du manifeste incohérente');
  return { ok: all.length === 0, problems: all };
}
