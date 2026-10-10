import { describe, expect, it } from 'vitest';
import { resolvePack, packContentHash } from '../../src/core/pack/resolve.js';
import { createBinding } from '../../src/core/pack/binding.js';
import { validateRaw, validateResolved, verifyPackIntegrity } from '../../src/core/pack/validate.js';
import { Ed25519Verifier } from '../../src/adapters/signature.js';
import { hashOf } from '../../src/core/trace/canonical.js';
import type { PackData } from '../../src/core/pack/types.js';
import { catalog, clone, taxonomy } from '../support/env.js';

const verifier = new Ed25519Verifier();
const raw = (id: string): PackData => clone([...catalog.raw.values()].find((p) => p.id === id)!);

describe('Intégrité des packs (hash de contenu + signature Ed25519 de test)', () => {
  it('tous les packs livrés sont intègres, signés et marqués synthétiques', () => {
    for (const p of catalog.raw.values()) {
      expect(verifyPackIntegrity(p, verifier), p.id).toEqual([]);
      expect(validateRaw(p), p.id).toEqual([]);
      expect(p.dataClass).toBe('synthetic/test');
    }
    expect(catalog.raw.size).toBe(4);
  });
  it('un pack modifié après signature est refusé', () => {
    const p = raw('pack.bj'); p.priceBooks![0]!.entries[0]!.stat.median = '1';
    expect(verifyPackIntegrity(p, verifier).join()).toMatch(/empreinte de contenu invalide/);
  });
  it('signature invalide, clé inconnue, algorithme inconnu, vérificateur absent', () => {
    const a = raw('pack.bj'); a.signature!.value = Buffer.from('x'.repeat(64)).toString('base64');
    expect(verifyPackIntegrity(a, verifier).join()).toMatch(/signature invalide/);
    const b = raw('pack.bj'); b.signature!.keyId = 'autre-cle';
    expect(verifyPackIntegrity(b, verifier).join()).toMatch(/signature invalide/);
    expect(verifyPackIntegrity(raw('pack.bj'), null).join()).toMatch(/aucun vérificateur/);
  });
  it('un pack « commercial » exige une signature ; un pack synthétique ne peut contenir que des prix synthétiques', () => {
    const c = raw('pack.bj'); c.dataClass = 'commercial'; delete c.signature; c.contentHash = packContentHash(c);
    expect(verifyPackIntegrity(c, verifier).join()).toMatch(/doit être signé/);
    const r = clone(catalog.resolve('pack.bj')); r.priceBooks[0]!.entries[0]!.dataClass = 'commercial';
    expect(validateResolved(r, taxonomy).join()).toMatch(/un pack synthétique ne contient que des prix synthétiques/);
    // sens inverse (le plus dangereux) : un prix synthétique dans un pack déclaré commercial
    const k = clone(catalog.resolve('pack.bj')); k.dataClass = 'commercial'; k.priceBooks[0]!.dataClass = 'commercial';
    expect(validateResolved(k, taxonomy).join()).toMatch(/donnée synthétique interdite dans un pack commercial/);
  });
  it('compatibilité moteur : engineApi et langage de règles', () => {
    const p = raw('pack.bj'); p.requires.engineApi = '2'; p.requires.ruleLanguage = 'declarative-9';
    const e = validateRaw(p).join();
    expect(e).toMatch(/engineApi incompatible/); expect(e).toMatch(/langage de règles/);
  });
});

describe('Héritage à parent unique (ADR-0004)', () => {
  it('résolution : socle + surcharges ; paramètres fusionnés ; méthode et zones remplacées/ajoutées', () => {
    const sn = catalog.resolve('pack.sn'); const bj = catalog.resolve('pack.bj');
    expect(sn.resolution.chain.map((c) => c.id)).toEqual(['pack.test.base-xof', 'pack.sn']);
    expect(sn.assemblies).toHaveLength(bj.assemblies.length);                       // surcharge, pas ajout
    expect(sn.assemblies.find((a) => a.code === 'OUV.MAC.BLOC20')!.components[0]!.consumption).toBe('13');
    expect(bj.assemblies.find((a) => a.code === 'OUV.MAC.BLOC20')!.components[0]!.consumption).toBe('12.5');
    expect(sn.params).toMatchObject({ overheadRate: '0.15', marginRate: '0.08', staleAfterDays: '180', vatRate: '0.18' });
    expect(sn.measurementMethod.id).toBe('MM.TEST.THRESHOLD'); expect(bj.measurementMethod.id).toBe('MM.TEST.NET');
    expect(sn.zoneTree.map((z) => z.id)).toEqual(['SN', 'SN-DAKAR', 'SN-DAKAR-DAKAR', 'SN-DAKAR-DAKAR-PLATEAU']);
    expect(sn.dataClass).toBe('synthetic/test');
  });
  it('hash du pack résolu : stable, distinct par pack, sensible à toute modification', () => {
    expect(catalog.resolve('pack.bj').resolution.resolvedHash).toBe(catalog.resolve('pack.bj').resolution.resolvedHash);
    expect(new Set(['pack.bj', 'pack.sn', 'pack.test.divergent'].map((i) => catalog.resolve(i).resolution.resolvedHash)).size).toBe(3);
    const mod = raw('pack.bj'); mod.params = { overheadRate: '0.13' }; mod.contentHash = packContentHash(mod);
    const alt = new Map(catalog.raw); alt.set('pack.bj@0.0.1-synthetic', mod);
    expect(resolvePack(mod, alt).resolution.resolvedHash).not.toBe(catalog.resolve('pack.bj').resolution.resolvedHash);
  });
  it('remove : retrait explicite ; clé absente, ré-introduction et parent modifié => erreur', () => {
    const base = [...catalog.raw.values()].find((p) => p.id === 'pack.test.base-xof')!;
    const child = (patch: Partial<PackData>): PackData => ({ ...raw('pack.bj'), ...patch });
    const alt = (c: PackData): Map<string, PackData> => new Map([...catalog.raw, [`${c.id}@${c.version}`, c]]);
    const ok = child({ remove: { specMappings: ['SM.TOLE'], assemblies: ['OUV.TOLE'] } });
    const r = resolvePack(ok, alt(ok));
    expect(r.assemblies.some((a) => a.code === 'OUV.TOLE')).toBe(false); expect(r.specMappings.some((m) => m.id === 'SM.TOLE')).toBe(false);
    expect(validateResolved(r, taxonomy).filter((e) => !/prix|price/.test(e))).toEqual([]);
    expect(() => resolvePack(child({ remove: { assemblies: ['NOPE'] } }), alt(child({})))).toThrow(/clé absente/);
    expect(() => resolvePack(child({ remove: { assemblies: ['OUV.TOLE'] }, assemblies: [clone(base.assemblies!.find((a) => a.code === 'OUV.TOLE')!)] }), alt(child({})))).toThrow(/retirée puis réintroduite/);
    const tampered = clone(base); tampered.params!.overheadRate = '0.99';
    const m = new Map(catalog.raw); m.set('pack.test.base-xof@0.0.1-synthetic', tampered);
    expect(() => resolvePack(raw('pack.bj'), m)).toThrow(/Empreinte du parent/);
  });
  it('parent introuvable ou héritage cyclique => erreur', () => {
    const lone = raw('pack.bj'); expect(() => resolvePack(lone, new Map())).toThrow(/introuvable/);
    const a = raw('pack.bj'); const b = raw('pack.sn');
    a.extends = { id: b.id, version: b.version, contentHash: packContentHash(b) }; b.extends = { id: a.id, version: a.version, contentHash: packContentHash(a) };
    a.extends.contentHash = packContentHash(b);
    expect(() => resolvePack(a, new Map([[`${a.id}@${a.version}`, a], [`${b.id}@${b.version}`, b]]))).toThrow(/cyclique|Empreinte/);
  });
  it('un pack complet exige les paramètres de politique : aucun défaut dans le moteur (R7)', () => {
    const p = clone(catalog.resolve('pack.bj')); delete p.params.staleAfterDays; delete p.params.lowConfidenceBelow;
    expect(validateResolved(p, taxonomy).join()).toMatch(/paramètre obligatoire absent : staleAfterDays/);
    const base = catalog.resolve('pack.test.base-xof');
    expect(validateResolved(base, taxonomy).join()).toMatch(/zoneTree/);                    // un socle seul n'est pas utilisable
  });
  it('structure de coût : paramètre manquant ou base postérieure => erreur', () => {
    const a = clone(catalog.resolve('pack.bj')); delete a.params.marginRate;
    expect(validateResolved(a, taxonomy).join()).toMatch(/paramètre de taux marginRate absent/);
    const b = clone(catalog.resolve('pack.bj')); b.costBuildUp[1]!.base = ['margin'];
    expect(validateResolved(b, taxonomy).join()).toMatch(/inconnue ou postérieure/);
  });
});

describe('MarketBinding (ADR-0001, ADR-0004)', () => {
  const bj = catalog.resolve('pack.bj');
  it('lie projet et marché : pack résolu, zone, PriceBook, paramètres, date de prix', () => {
    const b = createBinding(bj, { zoneId: 'BJ-LITTORAL-COTONOU', asOf: '2026-10-08' });
    expect(b).toMatchObject({ packId: 'pack.bj', packVersion: '0.0.1-synthetic', packResolvedHash: bj.resolution.resolvedHash, zoneId: 'BJ-LITTORAL-COTONOU', priceBookId: 'pb.bj.test', revision: 1, parentRev: null, priceStatistic: 'median', dataClass: 'synthetic/test' });
    expect(b.priceBookHash).toBe(hashOf(bj.priceBooks[0]));
    expect(b.rev).toMatch(/^sha256:/);
  });
  it('immuable par révision : toute modification crée une NOUVELLE révision chaînée', () => {
    const b1 = createBinding(bj, { zoneId: 'BJ-LITTORAL-COTONOU', asOf: '2026-10-08' });
    const b1again = createBinding(bj, { zoneId: 'BJ-LITTORAL-COTONOU', asOf: '2026-10-08' });
    expect(b1again.rev).toBe(b1.rev);                                                    // déterministe
    const b2 = createBinding(bj, { zoneId: 'BJ-LITTORAL-COTONOU', asOf: '2026-10-08', paramOverrides: { marginRate: '0.12' }, parent: b1 });
    expect(b2.rev).not.toBe(b1.rev); expect(b2.revision).toBe(2); expect(b2.parentRev).toBe(b1.rev); expect(b2.params.marginRate).toBe('0.12');
    expect(b1.params.marginRate).toBe('0.10');                                           // l'ancienne révision est intacte
  });
  it('refus : zone hors pack, date invalide, paramètre inconnu, PriceBook inconnu', () => {
    expect(() => createBinding(bj, { zoneId: 'SN-DAKAR', asOf: '2026-10-08' })).toThrow(/absente du pack/);
    expect(() => createBinding(bj, { zoneId: 'BJ', asOf: '08/10/2026' })).toThrow(/asOf/);
    expect(() => createBinding(bj, { zoneId: 'BJ', asOf: '2026-10-08', paramOverrides: { nope: '1' } })).toThrow(/Paramètre inconnu/);
    expect(() => createBinding(bj, { zoneId: 'BJ', asOf: '2026-10-08', priceBookId: 'pb.zzz' })).toThrow(/Aucun PriceBook/);
  });
});
