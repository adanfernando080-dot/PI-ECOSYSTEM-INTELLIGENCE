import { describe, expect, it } from 'vitest';
import { validateModel } from '../../src/core/model/validate.js';
import { canonicalize } from '../../src/core/trace/canonical.js';
import { clone, taxonomy, cellModel, houseModel } from '../support/env.js';
import { m } from '../../fixtures/synthetic/common.js';

describe('Modèle architectural neutre', () => {
  it('les fixtures sont valides', () => {
    expect(validateModel(cellModel(), taxonomy)).toEqual([]);
    expect(validateModel(houseModel(), taxonomy)).toEqual([]);
  });
  it('schéma fermé : aucune donnée de marché ne peut entrer dans le modèle', () => {
    for (const key of ['country', 'currency', 'price', 'supplier', 'tax']) {
      const mdl = clone(cellModel()) as any;
      mdl.buildings[0].levels[0].walls[0][key] = 'x';
      expect(validateModel(mdl, taxonomy).join('\n')).toMatch(new RegExp(`clé interdite « ${key} »`));
    }
    const top = clone(cellModel()) as any; top.market = 'BJ';
    expect(validateModel(top, taxonomy).join()).toMatch(/clé interdite « market »/);
  });
  it('classes de spécification : uniquement la taxonomie neutre (pas de produit)', () => {
    const mdl = clone(cellModel()); mdl.buildings[0]!.levels[0]!.walls[0]!.spec.system = 'MAT.AGGLO.20x20x40';
    expect(validateModel(mdl, taxonomy).join()).toMatch(/absente de la taxonomie neutre/);
  });
  it('intégrité référentielle', () => {
    const a = clone(cellModel()); a.buildings[0]!.levels[0]!.openings[0]!.hostWallId = 'nope';
    expect(validateModel(a, taxonomy).join()).toMatch(/mur hôte « nope » inconnu/);
    const b = clone(cellModel()); b.buildings[0]!.levels[0]!.walls[0]!.endNode = 'zzz';
    expect(validateModel(b, taxonomy).join()).toMatch(/nœud inconnu/);
    const c = clone(cellModel()); c.buildings[0]!.levels[0]!.walls[1]!.id = 'w-s';
    expect(validateModel(c, taxonomy).join()).toMatch(/dupliqué/);
    const d = clone(cellModel()); d.buildings[0]!.levels[0]!.nodes[1]!.x = 1.5;
    expect(validateModel(d, taxonomy).join()).toMatch(/entières/);
  });
  it('coordonnées en virgule fixe (0,1 mm) sans flottant', () => {
    expect(m('8.40')).toBe(84000); expect(m('0.10')).toBe(1000); expect(m('-0.10')).toBe(-1000);
    expect(houseModel().buildings[0]!.levels[0]!.nodes.every((n) => Number.isInteger(n.x) && Number.isInteger(n.y))).toBe(true);
  });
  it('sérialisation : aller-retour canonique sans perte', () => {
    for (const mdl of [cellModel(), houseModel()]) {
      const s = canonicalize(mdl);
      expect(canonicalize(JSON.parse(s))).toBe(s);
      expect(JSON.parse(s)).toEqual(JSON.parse(JSON.stringify(mdl)));
    }
  });
  it("pureté : le modèle ne contient aucune donnée de marché (pays, devise, taxes, prix)", () => {
    const text = canonicalize(houseModel()) + canonicalize(cellModel());
    expect(text).not.toMatch(/Bénin|Benin|Sénégal|Senegal|Cotonou|Dakar|XOF|FCFA|TVA|IFU|RCCM|NINEA|\bpack\b|prix|price|currency/i);
  });
});
