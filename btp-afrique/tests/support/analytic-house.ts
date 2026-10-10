/**
 * Calcul ANALYTIQUE INDÉPENDANT des quantités géométriques de la maison de référence (T-SYN-01).
 * Aucune dépendance au moteur : entiers en centimètres / cm² (JS natif, exact pour ces valeurs), converti en m² en chaîne.
 * Les dimensions sont recopiées de fixtures/synthetic/house.ts (axes : 8,00 × 6,00 m ; murs ext 0,20 ; cloisons 0,10 ; h = 3,00).
 */
const H = 300; // cm
const wallLen: Record<string, number> = { 'w-01': 500, 'w-02': 300, 'w-03': 350, 'w-04': 250, 'w-05': 300, 'w-06': 500, 'w-07': 600, 'w-08': 350, 'w-09': 250, 'w-10': 300 };
const thick: Record<string, number> = { 'w-01': 20, 'w-02': 20, 'w-03': 20, 'w-04': 20, 'w-05': 20, 'w-06': 20, 'w-07': 20, 'w-08': 10, 'w-09': 10, 'w-10': 10 };
const openings: Record<string, { host: string; w: number; h: number }> = {
  'o-d1': { host: 'w-01', w: 100, h: 210 }, 'o-w1': { host: 'w-01', w: 120, h: 120 }, 'o-w2': { host: 'w-06', w: 120, h: 120 },
  'o-d2': { host: 'w-08', w: 90, h: 210 }, 'o-w3': { host: 'w-03', w: 120, h: 120 }, 'o-d3': { host: 'w-09', w: 90, h: 210 }, 'o-w4': { host: 'w-04', w: 60, h: 60 },
};
const rooms: Record<string, { box: [number, number, number, number]; sides: { l: string; r: string; b: string; t: string }; walls: string[] }> = {
  'sp-sal': { box: [0, 0, 500, 600], sides: { l: 'w-07', r: 'w-08', b: 'w-01', t: 'w-06' }, walls: ['w-01', 'w-08', 'w-09', 'w-06', 'w-07'] },
  'sp-cha': { box: [500, 0, 800, 350], sides: { l: 'w-08', r: 'w-03', b: 'w-02', t: 'w-10' }, walls: ['w-02', 'w-03', 'w-10', 'w-08'] },
  'sp-sdb': { box: [500, 350, 800, 600], sides: { l: 'w-09', r: 'w-04', b: 'w-10', t: 'w-05' }, walls: ['w-10', 'w-04', 'w-05', 'w-09'] },
};
/** cm² -> chaîne m² (division par 10 000) */
export const cm2ToM2 = (v: number): string => (v / 10000).toFixed(4).replace(/\.?0+$/, '');
const cmToM = (v: number): string => (v / 100).toFixed(2).replace(/\.?0+$/, '');

export function expectedHouse(): Record<string, string> {
  const out: Record<string, string> = {};
  const opArea = (id: string): number => openings[id]!.w * openings[id]!.h;
  for (const [id, len] of Object.entries(wallLen)) {
    const gross = len * H; const ops = Object.entries(openings).filter(([, o]) => o.host === id).reduce((s, [k]) => s + opArea(k), 0);
    out[`geo:${id}:wall.length.axis`] = cmToM(len);
    out[`geo:${id}:wall.area.gross`] = cm2ToM2(gross);
    out[`geo:${id}:wall.openings.area`] = cm2ToM2(ops);
    out[`geo:${id}:wall.area.net`] = cm2ToM2(gross - ops);
  }
  for (const id of Object.keys(openings)) { out[`geo:${id}:opening.area`] = cm2ToM2(opArea(id)); out[`geo:${id}:opening.count`] = '1'; }
  for (const [id, r] of Object.entries(rooms)) {
    const [x0, y0, x1, y1] = r.box; const t = r.sides;
    const w = (x1 - x0) * 10 - (thick[t.l]! * 10 + thick[t.r]! * 10) / 2; // en mm
    const d = (y1 - y0) * 10 - (thick[t.b]! * 10 + thick[t.t]! * 10) / 2;
    const areaMm2 = w * d; const perMm = 2 * (w + d);
    const ops = r.walls.flatMap((wid) => Object.entries(openings).filter(([, o]) => o.host === wid).map(([k]) => opArea(k))).reduce((s, v) => s + v, 0);
    const grossMm2 = perMm * (H * 10);
    const fmt = (v: number, div: number, dec: number): string => (v / div).toFixed(dec).replace(/\.?0+$/, '');
    out[`geo:${id}:space.clear.area`] = fmt(areaMm2, 1e6, 6);
    out[`geo:${id}:space.ceiling.area`] = fmt(areaMm2, 1e6, 6);
    out[`geo:${id}:space.clear.perimeter`] = fmt(perMm, 1e3, 6);
    out[`geo:${id}:space.wall.area.gross`] = fmt(grossMm2, 1e6, 6);
    out[`geo:${id}:space.wall.openings.area`] = cm2ToM2(ops);
    out[`geo:${id}:space.wall.area.net`] = fmt(grossMm2 - ops * 100, 1e6, 6);
  }
  out['geo:sl-1:slab.area'] = cm2ToM2(820 * 620); out['geo:sl-1:slab.volume'] = ((820 * 620 * 12) / 1e6).toFixed(4).replace(/\.?0+$/, '');
  out['geo:rf-1:roof.area.plan'] = cm2ToM2(820 * 620);
  return out;
}
export const HOUSE_OPENINGS = openings;
