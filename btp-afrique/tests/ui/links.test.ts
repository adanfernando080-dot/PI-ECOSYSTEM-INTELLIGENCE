import { describe, expect, it } from 'vitest';
import { catalog } from '../support/env.js';
import { openSession } from '../../apps/desktop/src/session.js';
import { demoHouse, newRoomProject } from '../../apps/desktop/src/projects.js';
import { defaultZone } from '../../apps/desktop/src/viewmodel.js';
import { linksFor } from '../../apps/desktop/src/editor/links.js';

describe('Éditeur 2D — liens traçables objet → métrés → lignes', () => {
  const pack = catalog.resolve('pack.bj'); const d = demoHouse();
  const s = openSession({ name: d.name, state: d.state, pack, binding: { zoneId: defaultZone(pack), asOf: '2026-10-08' } });
  it('un mur du modèle est relié à ses quantités géométriques, à des ouvrages et à des lignes de chiffrage', () => {
    const w = s.run.model.buildings[0]!.levels[0]!.walls[0]!; const l = linksFor(s.run, w.id);
    expect(l.geoQuantityIds.some((g) => g.endsWith('wall.length.axis'))).toBe(true); expect(l.ouvrageIds.length).toBeGreaterThan(0); expect(l.estimateLineIds.length).toBeGreaterThan(0);
    for (const id of l.estimateLineIds) expect(s.run.estimate.lines.some((x) => x.id === id)).toBe(true);
  });
  it('une entité inconnue n\'a aucun lien ; une ouverture est reliée à son ouvrage', () => {
    expect(linksFor(s.run, 'inexistant')).toEqual({ entityId: 'inexistant', geoQuantityIds: [], ouvrageIds: [], estimateLineIds: [] });
    const o = s.run.model.buildings[0]!.levels[0]!.openings[0]!; expect(linksFor(s.run, o.id).ouvrageIds.length).toBeGreaterThan(0);
  });
  void newRoomProject;
});
