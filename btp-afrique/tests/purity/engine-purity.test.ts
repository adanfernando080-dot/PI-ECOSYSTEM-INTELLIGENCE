/**
 * PURETÉ DU MOTEUR UNIVERSEL (ADR-0001 R1–R3, R6–R7) : aucune dépendance au marché, au réseau, à l'horloge, à Node, aux flottants.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, catalog, cellAssumptions, cellModel, runWith, taxonomy } from '../support/env.js';
import { computeTakeoff } from '../../src/core/geometry/takeoff.js';
import { validateModel } from '../../src/core/model/validate.js';
import type { ResolvedPack } from '../../src/core/pack/types.js';

const CORE = join(ROOT, 'src', 'core');
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const files = walk(CORE);
const src = (f: string): string => readFileSync(f, 'utf8');
/** retire commentaires pour les contrôles de code */
const code = (f: string): string => src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('Pureté du moteur (src/core)', () => {
  it('le moteur contient bien des fichiers à contrôler', () => { expect(files.length).toBeGreaterThan(20); });

  it('R1 : aucun import hors du moteur — ni packs, ni adaptateurs, ni fixtures, ni outils, ni modules Node', () => {
    for (const f of files) {
      for (const m of code(f).matchAll(/from\s+'([^']+)'/g)) {
        const spec = m[1]!;
        expect(spec.startsWith('.'), `${relative(ROOT, f)} importe « ${spec} » (modules non relatifs interdits)`).toBe(true);
        const target = resolve(dirname(f), spec.replace(/\.js$/, ''));
        expect(target.startsWith(CORE), `${relative(ROOT, f)} importe hors du moteur : ${spec}`).toBe(true);
      }
    }
  });
  it('R3 : aucune donnée de marché dans le code du moteur (pays, villes, devises, taxes, identifiants légaux, régimes)', () => {
    const forbidden = /\b(B[ée]nin|b[ée]ninois|S[ée]n[ée]gal|Cotonou|Dakar|Ghana|Nigeria|Togo|C[ôo]te d'Ivoire|Cameroun|Burkina|XOF|XAF|EUR|USD|GHS|NGN|FCFA|CFA|TVA|VAT|IFU|RCCM|NINEA|UEMOA|OHADA|TST)\b/i;
    for (const f of files) expect(code(f).match(forbidden)?.[0] ?? null, relative(ROOT, f)).toBeNull();
  });
  it('la taxonomie neutre ne contient aucune donnée de marché ni produit', () => {
    expect(JSON.stringify(taxonomy)).not.toMatch(/Bénin|Sénégal|XOF|FCFA|TVA|agglo|parpaing|CPJ|\bMAT\./i);
  });
  it('ADR-0006 : aucune virgule flottante dangereuse, aucune trigonométrie, aucun aléa dans le moteur', () => {
    for (const f of files) {
      const c = code(f);
      expect(c.match(/Math\.(?!min\b|max\b|abs\b|floor\b)\w+/)?.[0] ?? null, `${relative(ROOT, f)} : Math.*`).toBeNull();
      expect(c.match(/parseFloat|Math\.random|crypto\.|new Date\b|Date\.(now|parse|UTC)|performance\.now|Number\.EPSILON/)?.[0] ?? null, `${relative(ROOT, f)}`).toBeNull();
    }
  });
  it('hors ligne : aucune API réseau ni système dans le moteur', () => {
    for (const f of files) expect(code(f).match(/\b(fetch|XMLHttpRequest|WebSocket|require|process\.|globalThis\.|setTimeout|localStorage)\b/)?.[0] ?? null, relative(ROOT, f)).toBeNull();
  });
  it('R2 : le schéma du modèle est fermé — injecter une donnée de marché est refusé', () => {
    const m: any = JSON.parse(JSON.stringify(cellModel())); m.buildings[0].levels[0].openings[0].supplierPrice = '85000';
    expect(validateModel(m, taxonomy).join()).toMatch(/clé interdite « supplierPrice »/);
  });
  it('R6 : le moteur calcule le métré géométrique avec ZÉRO pack (aucun marché installé)', () => {
    const t = computeTakeoff(cellModel(), cellAssumptions());
    expect(t.blocked).toEqual([]); expect(t.quantities.find((q) => q.id === 'geo:w-s:wall.area.net')!.value).toBe('12.9');
  });
  it('R7 : aucune valeur de marché par défaut — un pack sans paramètres de politique est refusé à la création du MarketBinding/chiffrage', () => {
    const p = JSON.parse(JSON.stringify(catalog.resolve('pack.bj'))) as ResolvedPack; delete p.params.lowConfidenceBelow;
    expect(() => runWith(p, cellModel(), cellAssumptions(), { zoneId: 'BJ-LITTORAL-COTONOU' })).toThrow(/paramètre obligatoire absent : lowConfidenceBelow/);
  });
  it('les fixtures du moteur (modèles) ne dépendent d\'aucun marché', () => {
    for (const f of ['cell.ts', 'house.ts', 'common.ts']) expect(readFileSync(join(ROOT, 'fixtures', 'synthetic', f), 'utf8')).not.toMatch(/market-packs|pack\.(bj|sn)|XOF|FCFA|\bTVA\b|ifu|rccm/i);
  });
});
