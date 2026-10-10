/**
 * Règles géométriques de l'étage 1 (UNIVERSEL, aucun pack). Chaque règle a un identifiant, une version et un
 * hash de définition, enregistrés dans les traces (ADR-0007).
 */
import { hashOf } from '../trace/canonical.js';
import type { RuleRef } from '../trace/types.js';

interface RuleDef { id: string; version: string; formula: string }

const DEFS: RuleDef[] = [
  { id: 'geom.wall.length.axis', version: '1.0.0', formula: 'racine(dx² + dy²) entre les nœuds d\'axe ; sqrt décimal échelle 8, arrondi échelle 6 (demi vers le haut)' },
  { id: 'geom.wall.area.gross', version: '1.0.0', formula: 'longueur d\'axe × hauteur' },
  { id: 'geom.opening.area', version: '1.0.0', formula: 'largeur × hauteur' },
  { id: 'geom.opening.count', version: '1.0.0', formula: '1 unité par ouverture' },
  { id: 'geom.wall.openings.area', version: '1.0.0', formula: 'Σ aires des ouvertures dont le mur hôte est ce mur' },
  { id: 'geom.wall.area.net', version: '1.0.0', formula: 'surface brute − surface des ouvertures hébergées' },
  { id: 'geom.space.clear.area', version: '1.0.0', formula: '(Δx_axe − ½e_gauche − ½e_droite) × (Δy_axe − ½e_bas − ½e_haut), pièce rectangulaire orthogonale' },
  { id: 'geom.space.clear.perimeter', version: '1.0.0', formula: '2 × (largeur libre + profondeur libre)' },
  { id: 'geom.space.wall.area.gross', version: '1.0.0', formula: 'périmètre libre × hauteur libre du niveau' },
  { id: 'geom.space.wall.openings.area', version: '1.0.0', formula: 'Σ aires des ouvertures hébergées par les murs de la pièce' },
  { id: 'geom.space.wall.area.net', version: '1.0.0', formula: 'surface murale brute − ouvertures des murs de la pièce' },
  { id: 'geom.space.ceiling.area', version: '1.0.0', formula: 'surface libre de la pièce' },
  { id: 'geom.slab.area', version: '1.0.0', formula: 'formule du lacet sur le contour (entiers), converti en m²' },
  { id: 'geom.slab.volume', version: '1.0.0', formula: 'surface × épaisseur' },
  { id: 'geom.roof.area.plan', version: '1.0.0', formula: 'formule du lacet sur le contour en plan' },
  { id: 'geom.roof.area.developed', version: '1.0.0', formula: 'surface en plan × racine(1 + (montée/portée)²) ; sqrt décimal échelle 8' },
];

const REGISTRY = new Map<string, RuleRef>(DEFS.map((d) => [d.id, { id: d.id, version: d.version, hash: hashOf(d) }]));

export function geoRule(id: string): RuleRef {
  const r = REGISTRY.get(id);
  if (!r) throw new Error(`Règle géométrique inconnue : ${id}`);
  return r;
}
export function allGeometryRules(): RuleRef[] { return [...REGISTRY.values()]; }

/** précision d'émission des GeoQuantity (décimales) — ADR-0011 */
export const GEO_SCALE = 6;
