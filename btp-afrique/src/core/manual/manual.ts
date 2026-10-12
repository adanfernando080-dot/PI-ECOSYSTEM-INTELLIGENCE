/**
 * Lignes manuelles et ajustements de quantité TRAÇABLES (ADR-0007 G9, T-TRC-03).
 *
 * Principes :
 *  - un ajustement ne modifie JAMAIS la géométrie (les GeoQuantity restent celles du moteur) : il s'applique à la quantité d'OUVRAGE,
 *    après arrondi, et conserve la quantité du moteur ;
 *  - une ligne manuelle est un poste hors modèle (forfait, prestation…) saisi avec son prix de vente ;
 *  - dans les deux cas : justification, auteur et date OBLIGATOIRES ; apparition dans l'annexe, le manifeste et la chaîne de traçabilité.
 */
import { Dec } from '../units/decimal.js';
import { UnitRegistry } from '../units/units.js';
import type { ResolvedPack } from '../pack/types.js';

export interface QuantityAdjustment {
  id: string;
  /** identifiant de la quantité d'ouvrage visée, ex. « oq:OUV.MAC.BLOC20 » */
  target: string;
  mode: 'delta' | 'override';
  /** décimal, dans l'unité de l'ouvrage */
  value: string;
  justification: string; author: string; date: string;
}
export interface ManualLine {
  id: string; lot: string; designation: string; unit: string;
  quantity: string;
  /** prix unitaire de vente, en entier de l'unité mineure de la devise du pack */
  unitPrice: string;
  justification: string; author: string; date: string;
}
export interface ManualEntries { adjustments: QuantityAdjustment[]; lines: ManualLine[] }

export const NO_MANUAL: ManualEntries = { adjustments: [], lines: [] };
export const MIN_JUSTIFICATION = 8;

const isDate = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d);
const decOk = (v: string): boolean => { try { Dec.parse(v); return true; } catch { return false; } };

/** Contrôles structurels (indépendants du métré). `pack` permet de vérifier lots et unités. */
export function validateManual(m: ManualEntries, pack?: Pick<ResolvedPack, 'workBreakdown' | 'units'>): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const common = (e: { id: string; justification: string; author: string; date: string }, what: string): void => {
    if (!e.id) errs.push(`${what} : identifiant manquant`);
    if (ids.has(e.id)) errs.push(`${what} ${e.id} : identifiant dupliqué`);
    ids.add(e.id);
    if ((e.justification ?? '').trim().length < MIN_JUSTIFICATION) errs.push(`${what} ${e.id} : justification obligatoire (≥ ${MIN_JUSTIFICATION} caractères) — une quantité ou un prix sans origine est interdit`);
    if (!(e.author ?? '').trim()) errs.push(`${what} ${e.id} : auteur obligatoire`);
    if (!isDate(e.date ?? '')) errs.push(`${what} ${e.id} : date AAAA-MM-JJ obligatoire`);
  };
  const reg = pack ? new UnitRegistry(pack.units) : null;
  for (const a of m.adjustments) {
    common(a, 'ajustement');
    if (!/^oq:.+/.test(a.target)) errs.push(`ajustement ${a.id} : cible « ${a.target} » invalide (attendu oq:<code d'ouvrage>)`);
    if (a.mode !== 'delta' && a.mode !== 'override') errs.push(`ajustement ${a.id} : mode « ${a.mode} » inconnu`);
    if (!decOk(a.value)) errs.push(`ajustement ${a.id} : valeur décimale invalide`);
  }
  for (const l of m.lines) {
    common(l, 'ligne manuelle');
    if (!(l.designation ?? '').trim()) errs.push(`ligne manuelle ${l.id} : désignation obligatoire`);
    if (!decOk(l.quantity) || Dec.parse(l.quantity).isNeg()) errs.push(`ligne manuelle ${l.id} : quantité décimale ≥ 0 requise`);
    if (!/^\d+$/.test(l.unitPrice ?? '')) errs.push(`ligne manuelle ${l.id} : prix unitaire = entier de l'unité mineure requis`);
    if (pack && !pack.workBreakdown.some((w) => w.code === l.lot)) errs.push(`ligne manuelle ${l.id} : lot « ${l.lot} » absent du pack`);
    if (reg && !reg.has(l.unit)) errs.push(`ligne manuelle ${l.id} : unité « ${l.unit} » inconnue`);
  }
  return errs;
}
