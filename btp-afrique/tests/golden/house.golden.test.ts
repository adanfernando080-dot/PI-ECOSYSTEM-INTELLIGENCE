/**
 * GOLDEN n°2 — petite habitation synthétique (3 pièces, 10 murs, 7 ouvertures, dalle, toiture).
 * La géométrie est vérifiée par un calcul analytique indépendant (tests/geometry) ; ici : flux complet pour les 3 marchés + empreintes épinglées.
 */
import { describe, expect, it } from 'vitest';
import { emitDocument } from '../../src/core/project/pipeline.js';
import { verifyRun } from '../../src/core/trace/chain.js';
import { house, type PackKey } from '../support/env.js';
import { pinned } from '../support/golden.js';

describe('GOLDEN habitation', () => {
  for (const k of ['bj', 'sn', 'divergent'] as PackKey[]) {
    it(`flux complet ${k} : DQE, vérification de bout en bout, empreintes épinglées`, () => {
      const run = house(k);
      const tpl = run.pack.documentTemplates.find((t) => t.layout === 'priced-lines')!;
      const doc = emitDocument(run, { templateId: tpl.id, number: 'N-GOLDEN', date: '2026-10-08', status: 'draft' });
      expect(verifyRun(run).ok).toBe(true);
      expect(run.takeoff.blocked).toEqual([]); expect(run.quantitySet.unmapped).toEqual([]); expect(run.estimate.lines.every((l) => l.status === 'priced')).toBe(true);
      pinned(`house.${k}`, { takeoff: run.takeoff.contentHash, quantitySet: run.quantitySet.contentHash, estimate: run.estimate.contentHash, doc: doc.contentHash, total: run.estimate.total });
    });
  }
  it('le métré géométrique épinglé est IDENTIQUE pour les 3 marchés', () => {
    expect(new Set((['bj', 'sn', 'divergent'] as PackKey[]).map((k) => house(k).takeoff.contentHash)).size).toBe(1);
  });
});
