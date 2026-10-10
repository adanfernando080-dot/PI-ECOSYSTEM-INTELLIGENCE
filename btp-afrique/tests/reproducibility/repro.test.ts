/**
 * REPRODUCTIBILITÉ — garantie définie (voir ADR-0006, § « Niveaux de garantie ») :
 *  R1 EXACTE (bit à bit)   : GeoQuantity, QuantitySet, Estimate, DocumentModel, manifeste, bundle — mêmes entrées => mêmes octets canoniques,
 *                            donc mêmes SHA-256, sur tout processus/plateforme (BigInt exact, aucun flottant, JSON canonique, arrondis explicites).
 *  R2 CONTENU              : rendus (texte/PDF/XLSX) — mêmes chiffres que le DocumentModel ; les octets d'un PDF peuvent différer (polices, métadonnées).
 *  R3 ENREGISTRÉE          : sorties de perception IA — non rejouables bit à bit ; la garantie commence au modèle ACCEPTÉ, source de vérité.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalize, hashOf } from '../../src/core/trace/canonical.js';
import { emitDocument } from '../../src/core/project/pipeline.js';
import { createBundle, readBundle, verifyBundle } from '../../src/core/project/bundle.js';
import { readBundleDir, writeBundleDir, engineSourceHash } from '../../src/adapters/fs.js';
import { ROOT, catalog, cell, cellAssumptions, cellModel, clone, house, houseAssumptions, houseModel, runWith, ZONES, type PackKey } from '../support/env.js';

const deepReverseKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(deepReverseKeys)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as object).reverse().map(([k, x]) => [k, deepReverseKeys(x)])) : v;
const docOf = (r: ReturnType<typeof house>) => emitDocument(r, { templateId: r.pack.documentTemplates[0]!.id, number: 'N', date: '2026-10-08', status: 'draft' });

describe('R1 — reproductibilité exacte du cœur déterministe', () => {
  it('deux exécutions : mêmes empreintes à tous les niveaux', () => {
    for (const k of ['bj', 'sn', 'divergent'] as PackKey[]) {
      const a = house(k); const b = house(k);
      expect([a.takeoff.contentHash, a.quantitySet.contentHash, a.estimate.contentHash, a.binding.rev]).toEqual([b.takeoff.contentHash, b.quantitySet.contentHash, b.estimate.contentHash, b.binding.rev]);
      expect(docOf(a).id).toBe(docOf(b).id);
    }
  });
  it('indépendant de l\'ORDRE des clés des entrées (modèle, hypothèses, pack)', () => {
    const a = house('bj');
    const b = runWith(deepReverseKeys(catalog.resolve('pack.bj')) as any, deepReverseKeys(houseModel()) as any, deepReverseKeys(houseAssumptions()) as any, { zoneId: ZONES.bj });
    expect(b.takeoff.contentHash).toBe(a.takeoff.contentHash); expect(b.quantitySet.contentHash).toBe(a.quantitySet.contentHash);
    expect(b.estimate.contentHash).toBe(a.estimate.contentHash); expect(docOf(b).contentHash).toBe(docOf(a).contentHash);
  });
  it('INTER-PROCESSUS : un autre processus Node produit exactement les mêmes empreintes', () => {
    const out = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'tests/support/hash-cli.ts'], { cwd: ROOT, encoding: 'utf8' })) as Record<string, string>;
    const mine: Record<string, string> = {};
    for (const [n, r] of [['cell-bj', cell('bj')], ['house-bj', house('bj')], ['house-sn', house('sn')], ['house-divergent', house('divergent')]] as const) {
      const d = docOf(r); mine[`${n}.takeoff`] = r.takeoff.contentHash; mine[`${n}.quantitySet`] = r.quantitySet.contentHash; mine[`${n}.estimate`] = r.estimate.contentHash; mine[`${n}.document`] = d.contentHash;
    }
    expect(out).toEqual(mine);
  }, 60_000);
  it("l'empreinte du code du moteur est enregistrée mais n'entre PAS dans les empreintes de contenu", () => {
    const base = house('bj');
    const tagged = runWith(catalog.resolve('pack.bj'), houseModel(), houseAssumptions(), { zoneId: ZONES.bj }, { engine: { version: '0.0.1-m0', apiVersion: '1', sourceHash: engineSourceHash(ROOT) } });
    expect(tagged.estimate.contentHash).toBe(base.estimate.contentHash);
    expect(docOf(tagged).contentHash).toBe(docOf(base).contentHash);
    expect(engineSourceHash(ROOT)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
  it('vecteur canonique épinglé, confirmé par sha256sum (outil système indépendant)', () => {
    const v = { a: 1, b: [1, 2, { c: 'x' }], d: null, e: true };
    expect(canonicalize(v)).toBe('{"a":1,"b":[1,2,{"c":"x"}],"d":null,"e":true}');
    expect(hashOf(v)).toBe('sha256:327704d0e06e2025821121cff374ab457ca05432a3b5579d042c0a06c0fb6dd3');
  });
  it('une modification MINIMALE d\'une entrée change les empreintes (aucune collision silencieuse)', () => {
    const a = house('bj');
    const m = houseModel(); m.buildings[0]!.levels[0]!.openings[3]!.width = { ...m.buildings[0]!.levels[0]!.openings[3]!.width, value: '0.91' };
    const b = runWith(catalog.resolve('pack.bj'), m, houseAssumptions(), { zoneId: ZONES.bj });
    expect(b.takeoff.contentHash).not.toBe(a.takeoff.contentHash); expect(b.estimate.contentHash).not.toBe(a.estimate.contentHash);
  });
});

describe('Projet .btpx (bundle logique) : sérialisation, relecture, vérification hors ligne', () => {
  const build = () => { const r = house('bj'); docOf(r); emitDocument(r, { templateId: 'tpl.devis.fr', number: 'D', date: '2026-10-08', status: 'draft', issuer: { name: 'E', identifiers: {} }, client: { name: 'C' } }); return r; };
  it('création déterministe : mêmes fichiers, mêmes empreintes ; paquets EMBARQUÉS', () => {
    const a = createBundle(build()); const b = createBundle(build());
    expect(a.files).toEqual(b.files); expect(a.manifest).toEqual(b.manifest);
    expect(Object.keys(a.files).sort()).toEqual(expect.arrayContaining(['model.json', 'assumptions.json', 'binding.json', 'takeoff.json', 'quantity-set.json', 'estimate.json', 'packs/pack.bj@0.0.1-synthetic.resolved.json']));
    expect(Object.keys(a.files).filter((f) => f.startsWith('documents/'))).toHaveLength(2);
    expect(a.manifest.dataClass).toBe('synthetic/test');
  });
  it('aller-retour disque + vérification COMPLÈTE sans pack installé ni réseau (recalcul intégral)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'btpx-'));
    try {
      writeBundleDir(dir, createBundle(build()));
      const back = readBundleDir(dir);
      expect(verifyBundle(back)).toEqual({ ok: true, problems: [] });
      const { run } = readBundle(back);
      expect(run!.estimate.total).toBe(house('bj').estimate.total); expect(run!.documents).toHaveLength(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('toute altération est détectée : fichier modifié, supprimé, ajouté, prix embarqué falsifié', () => {
    const good = createBundle(build());
    const tamper = (f: (b: ReturnType<typeof createBundle>) => void): string => { const b = clone(good); f(b); return verifyBundle(b).problems.join('\n'); };
    expect(tamper((b) => { b.files['model.json'] = b.files['model.json']!.replace('0.20', '0.25'); })).toMatch(/empreinte invalide : model.json/);
    expect(tamper((b) => { delete b.files['assumptions.json']; })).toMatch(/fichier manquant : assumptions.json/);
    expect(tamper((b) => { b.files['extra.json'] = '{}'; })).toMatch(/fichier non déclaré : extra.json/);
    const packFile = Object.keys(good.files).find((f) => f.startsWith('packs/'))!;
    const forged = tamper((b) => { b.files[packFile] = b.files[packFile]!.replace('"median":"450"', '"median":"1"'); });
    expect(forged).toMatch(/empreinte invalide/); expect(forged).toMatch(/non reproductible|altéré|différente|introuvable/);
    // même si l'attaquant recalcule les empreintes de fichiers, le recalcul intégral et les hash croisés détectent la falsification
    const b2 = clone(good); b2.files[packFile] = b2.files[packFile]!.replace('"median":"450"', '"median":"1"');
    b2.manifest.files[packFile] = { ...b2.manifest.files[packFile]!, sha256: hashOfFile(b2.files[packFile]!) };
    expect(verifyBundle(b2).ok).toBe(false);
  });
  it('fichier de bundle écrit sur disque : empreintes de fichiers = SHA-256 standard', () => {
    const dir = mkdtempSync(join(tmpdir(), 'btpx-')); const b = createBundle(cell('bj'));
    try { writeBundleDir(dir, b); const f = join(dir, 'model.json'); appendFileSync(f, ' '); writeFileSync(join(dir, 'x'), ''); expect(verifyBundle(readBundleDir(dir)).problems.join()).toMatch(/empreinte invalide : model.json/); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

import { sha256Hex } from '../../src/core/trace/sha256.js';
const hashOfFile = (c: string): string => sha256Hex(c);
void cellModel; void cellAssumptions;
