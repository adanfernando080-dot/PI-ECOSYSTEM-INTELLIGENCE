/**
 * Génère les packs SYNTHÉTIQUES de test (market-packs/<pack>/pack.json) puis les signe avec la CLÉ DE TEST.
 * ⚠ TOUTES les valeurs (prix, taux, consommations, noms de zones) sont des DONNÉES DE TEST : elles ne reflètent AUCUNE réalité de marché.
 * Source de vérité des packs synthétiques ; les JSON générés sont versionnés et vérifiés par les tests (empreintes + signatures).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packContentHash } from '../src/core/pack/resolve.js';
import { signHash, TEST_KEY_ID } from '../src/adapters/signature.js';
import type { Assembly, CatalogueItem, Component, CostKind, PackData, PriceEntry, SpecMapping, Zone } from '../src/core/pack/types.js';

const ROOT = new URL('..', import.meta.url).pathname;
const SYN = 'synthetic/test' as const;
const REQUIRES = { engineApi: '1', specTaxonomy: '1.0.0', ruleLanguage: 'declarative-1' };
const HALF_UP = (scale: number) => ({ scale, mode: 'half_up' as const });
const ROUNDING = { quantity: HALF_UP(2), unitPrice: HALF_UP(0), lineAmount: HALF_UP(0), totalLayer: HALF_UP(0) };

// ---------------------------------------------------------------- catalogue & ouvrages (modèle commun de test)
type Cat = [code: string, label: string, kind: CostKind, unit: string, order?: { scale: number; mode: 'ceil' | 'half_up' }];
const CAT: Cat[] = [
  ['MAT.BLOC.20', 'Bloc creux 20 cm [TEST]', 'material', 'u', { scale: 0, mode: 'ceil' }],
  ['MAT.BLOC.10', 'Bloc creux 10 cm [TEST]', 'material', 'u', { scale: 0, mode: 'ceil' }],
  ['MAT.CIMENT', 'Ciment, sac de 50 kg [TEST]', 'material', 'sac', { scale: 0, mode: 'ceil' }],
  ['MAT.SABLE', 'Sable [TEST]', 'material', 'm3', { scale: 1, mode: 'ceil' }],
  ['MAT.GRAVIER', 'Gravier [TEST]', 'material', 'm3', { scale: 1, mode: 'ceil' }],
  ['MAT.ACIER', 'Acier HA [TEST]', 'material', 'kg', { scale: 0, mode: 'ceil' }],
  ['MAT.CARREAU.SOL', 'Carreau de sol [TEST]', 'material', 'm2', { scale: 1, mode: 'ceil' }],
  ['MAT.CARREAU.MUR', 'Carreau mural [TEST]', 'material', 'm2', { scale: 1, mode: 'ceil' }],
  ['MAT.COLLE', 'Colle carrelage, sac de 25 kg [TEST]', 'material', 'sac25', { scale: 0, mode: 'ceil' }],
  ['MAT.PEINTURE', 'Peinture émulsion, pot de 20 l [TEST]', 'material', 'pot20', { scale: 0, mode: 'ceil' }],
  ['MAT.TOLE', 'Tôle de couverture [TEST]', 'material', 'm2', { scale: 0, mode: 'ceil' }],
  ['MENU.PORTE.100', 'Bloc-porte bois 100×210 [TEST]', 'material', 'u', { scale: 0, mode: 'ceil' }],
  ['MENU.PORTE.90', 'Bloc-porte bois 90×210 [TEST]', 'material', 'u', { scale: 0, mode: 'ceil' }],
  ['MENU.FEN.120', 'Fenêtre aluminium 120×120 [TEST]', 'material', 'u', { scale: 0, mode: 'ceil' }],
  ['MENU.FEN.60', 'Fenêtre aluminium 60×60 [TEST]', 'material', 'u', { scale: 0, mode: 'ceil' }],
  ['MO.MACON', 'Maçon [TEST]', 'labour', 'h'], ['MO.PLATRIER', 'Plâtrier-enduiseur [TEST]', 'labour', 'h'],
  ['MO.CARRELEUR', 'Carreleur [TEST]', 'labour', 'h'], ['MO.PEINTRE', 'Peintre [TEST]', 'labour', 'h'],
  ['MO.COUVREUR', 'Couvreur [TEST]', 'labour', 'h'], ['MO.MENUISIER', 'Menuisier-poseur [TEST]', 'labour', 'h'],
];
const catalogue: CatalogueItem[] = CAT.map(([code, label, kind, unit, order]) => ({ code, label, kind, unit, ...(order ? { orderRounding: order } : {}) }));

const c = (kind: Component['kind'], item: string, consumption: string, unit: string, per: string, lossRate?: string): Component =>
  ({ kind, item, consumption, unit, per, ...(lossRate ? { lossRate } : {}) });
const sub = (ref: string, consumption: string, unit: string, per: string): Component => ({ kind: 'assembly', ref, consumption, unit, per });
const A = (code: string, label: string, unit: string, basis: Assembly['basis'], lot: string, components: Component[], extra: Partial<Assembly> = {}): Assembly =>
  ({ code, version: '1.0.0', label, unit, basis, lot, quantityRounding: HALF_UP(unit === 'u' ? 0 : 2), components, ...extra });

const assemblies: Assembly[] = [
  A('OUV.MORTIER.CIM', 'Mortier de ciment (sous-ouvrage)', 'm3', 'wall.area', 'LOT01', [c('material', 'MAT.CIMENT', '350', 'kg', 'm3', '0.03'), c('material', 'MAT.SABLE', '1.1', 'm3', 'm3', '0.05')]),
  A('OUV.MAC.BLOC20', 'Maçonnerie de blocs creux de 20 cm', 'm2', 'wall.area', 'LOT01', [c('material', 'MAT.BLOC.20', '12.5', 'u', 'm2', '0.05'), sub('OUV.MORTIER.CIM', '0.015', 'm3', 'm2'), c('labour', 'MO.MACON', '0.8', 'h', 'm2')]),
  A('OUV.MAC.BLOC10', 'Maçonnerie de blocs creux de 10 cm (cloisons)', 'm2', 'wall.area', 'LOT01', [c('material', 'MAT.BLOC.10', '12.5', 'u', 'm2', '0.05'), sub('OUV.MORTIER.CIM', '0.01', 'm3', 'm2'), c('labour', 'MO.MACON', '0.7', 'h', 'm2')]),
  A('OUV.DALLE.BA', 'Dalle en béton armé (estimation paramétrique)', 'm3', 'slab.volume', 'LOT01', [c('material', 'MAT.CIMENT', '350', 'kg', 'm3', '0.03'), c('material', 'MAT.SABLE', '0.45', 'm3', 'm3', '0.05'), c('material', 'MAT.GRAVIER', '0.85', 'm3', 'm3', '0.05'), c('material', 'MAT.ACIER', '80', 'kg', 'm3', '0.05'), c('labour', 'MO.MACON', '6', 'h', 'm3')], { estimateFlag: 'parametric_structural' }),
  A('OUV.ENDUIT.EXT', 'Enduit extérieur au mortier de ciment', 'm2', 'wall.area', 'LOT02', [sub('OUV.MORTIER.CIM', '0.02', 'm3', 'm2'), c('labour', 'MO.PLATRIER', '0.6', 'h', 'm2')]),
  A('OUV.ENDUIT.INT', 'Enduit intérieur au mortier de ciment', 'm2', 'space.wall.area', 'LOT02', [sub('OUV.MORTIER.CIM', '0.02', 'm3', 'm2'), c('labour', 'MO.PLATRIER', '0.5', 'h', 'm2')]),
  A('OUV.CARRELAGE.SOL', 'Carrelage de sol', 'm2', 'space.floor.area', 'LOT02', [c('material', 'MAT.CARREAU.SOL', '1', 'm2', 'm2', '0.10'), c('material', 'MAT.COLLE', '5', 'kg', 'm2', '0.05'), c('labour', 'MO.CARRELEUR', '0.8', 'h', 'm2')]),
  A('OUV.CARRELAGE.MUR', 'Faïence murale', 'm2', 'space.wall.area', 'LOT02', [c('material', 'MAT.CARREAU.MUR', '1', 'm2', 'm2', '0.10'), c('material', 'MAT.COLLE', '5', 'kg', 'm2', '0.05'), c('labour', 'MO.CARRELEUR', '1', 'h', 'm2')]),
  A('OUV.PEINT.MUR', 'Peinture murale en émulsion', 'm2', 'space.wall.area', 'LOT02', [c('material', 'MAT.PEINTURE', '0.25', 'l', 'm2', '0.10'), c('labour', 'MO.PEINTRE', '0.25', 'h', 'm2')]),
  A('OUV.PEINT.PLAFOND', 'Peinture de plafond en émulsion', 'm2', 'space.ceiling.area', 'LOT02', [c('material', 'MAT.PEINTURE', '0.25', 'l', 'm2', '0.10'), c('labour', 'MO.PEINTRE', '0.3', 'h', 'm2')]),
  A('OUV.PORTE.100', 'Porte bois 100×210, pose comprise', 'u', 'opening.count', 'LOT03', [c('material', 'MENU.PORTE.100', '1', 'u', 'u'), c('labour', 'MO.MENUISIER', '2', 'h', 'u')]),
  A('OUV.PORTE.90', 'Porte bois 90×210, pose comprise', 'u', 'opening.count', 'LOT03', [c('material', 'MENU.PORTE.90', '1', 'u', 'u'), c('labour', 'MO.MENUISIER', '2', 'h', 'u')]),
  A('OUV.FEN.120', 'Fenêtre aluminium 120×120, pose comprise', 'u', 'opening.count', 'LOT03', [c('material', 'MENU.FEN.120', '1', 'u', 'u'), c('labour', 'MO.MENUISIER', '1.5', 'h', 'u')]),
  A('OUV.FEN.60', 'Fenêtre aluminium 60×60, pose comprise', 'u', 'opening.count', 'LOT03', [c('material', 'MENU.FEN.60', '1', 'u', 'u'), c('labour', 'MO.MENUISIER', '1', 'h', 'u')]),
  A('OUV.TOLE', 'Couverture en tôle', 'm2', 'roof.area', 'LOT04', [c('material', 'MAT.TOLE', '1', 'm2', 'm2', '0.10'), c('labour', 'MO.COUVREUR', '0.4', 'h', 'm2')]),
];

const M = (id: string, target: SpecMapping['target'], cls: string, assembly: string, extra: Partial<SpecMapping> = {}): SpecMapping => ({ id, version: '1.0.0', target, class: cls, assembly, ...extra });
const specMappings: SpecMapping[] = [
  M('SM.MAC.BLOC20', 'wall', 'masonry.block.hollow', 'OUV.MAC.BLOC20', { thickness: { min: '0.19', max: '0.21' } }),
  M('SM.MAC.BLOC10', 'wall', 'masonry.block.hollow', 'OUV.MAC.BLOC10', { thickness: { min: '0.09', max: '0.11' } }),
  M('SM.ENDUIT.EXT', 'wall.layer', 'render.cementitious', 'OUV.ENDUIT.EXT', { side: 'exterior' }),
  M('SM.ENDUIT.INT', 'space.wall', 'render.cementitious', 'OUV.ENDUIT.INT'),
  M('SM.PEINT.MUR', 'space.wall', 'paint.emulsion', 'OUV.PEINT.MUR'),
  M('SM.CARR.MUR', 'space.wall', 'wall.tile.ceramic', 'OUV.CARRELAGE.MUR'),
  M('SM.PEINT.PLAF', 'space.ceiling', 'paint.emulsion', 'OUV.PEINT.PLAFOND'),
  M('SM.CARR.SOL', 'space.floor', 'floor.tile.ceramic', 'OUV.CARRELAGE.SOL'),
  M('SM.DALLE', 'slab', 'slab.reinforced.concrete', 'OUV.DALLE.BA'),
  M('SM.TOLE', 'roof', 'roof.sheet.metal', 'OUV.TOLE'),
  M('SM.PORTE.100', 'opening', 'opening.door.single', 'OUV.PORTE.100', { width: { min: '0.96', max: '1.05' }, material: 'joinery.timber' }),
  M('SM.PORTE.90', 'opening', 'opening.door.single', 'OUV.PORTE.90', { width: { min: '0.75', max: '0.95' }, material: 'joinery.timber' }),
  M('SM.FEN.120', 'opening', 'opening.window.casement', 'OUV.FEN.120', { width: { min: '1.15', max: '1.25' }, material: 'joinery.aluminium' }),
  M('SM.FEN.60', 'opening', 'opening.window.casement', 'OUV.FEN.60', { width: { min: '0.55', max: '0.65' }, material: 'joinery.aluminium' }),
];

const frLabels = { n: 'N°', number: 'N°', date: 'Date', lot: 'Lot', designation: 'Désignation', unit: 'U', quantity: 'Quantité', unitPrice: 'Prix unitaire', amount: 'Montant',
  subtotal: 'Sous-total du lot', total: 'TOTAL', linesTotal: 'Total des postes', issuer: 'Émetteur', client: 'Client', site: 'Chantier', validity: 'Validité', totalHT: 'Total HT', totalTTC: 'Total TTC' };
const enLabels = { n: 'No.', number: 'No.', date: 'Date', lot: 'Section', designation: 'Description', unit: 'Unit', quantity: 'Qty', unitPrice: 'Rate', amount: 'Amount',
  subtotal: 'Section subtotal', total: 'TOTAL', linesTotal: 'Sum of items', issuer: 'Issuer', client: 'Client', site: 'Site', validity: 'Validity', totalHT: 'Total before tax', totalTTC: 'Total incl. taxes' };

const price = (id: string, item: string, unit: string, zoneId: string, currency: string, p: number, o: { conf?: string; date?: string; n?: number; version?: string } = {}): PriceEntry =>
  ({ id, item, unit, zoneId, currency, date: o.date ?? '2026-09-15', source: { type: 'synthetic', ref: 'TEST-DATA-DO-NOT-USE' }, version: o.version ?? 'pb-0.0.1', confidence: o.conf ?? '0.80',
    stat: { min: String(Math.round(p * 0.92)), median: String(p), mean: String(Math.round(p * 1.01)), max: String(Math.round(p * 1.1)), n: o.n ?? 5 }, dataClass: SYN });

// ---------------------------------------------------------------- packs
const base: PackData = {
  packSchemaVersion: '1', id: 'pack.test.base-xof', version: '0.0.1-synthetic', dataClass: SYN,
  description: 'SYNTHÉTIQUE — socle commun (devise, unités, gabarits, modèle d\'ouvrages) aux packs de test Bénin et Sénégal. Aucune donnée réelle.',
  extends: null, requires: REQUIRES,
  currency: { code: 'XOF', minorUnits: 0, symbol: 'FCFA', name: 'Franc CFA (test)' },
  units: [{ code: 'sac', dimension: 'mass', factor: '50' }, { code: 'sac25', dimension: 'mass', factor: '25' }, { code: 'pot20', dimension: 'volume', factor: '0.02' }],
  catalogue, assemblies, specMappings,
  measurementMethod: { id: 'MM.TEST.NET', version: '1.0.0', deductions: { 'wall.area': { mode: 'net' }, 'space.wall.area': { mode: 'net' } } },
  costBuildUp: [
    { id: 'direct', label: 'Déboursé sec', kind: 'sum', scope: 'line', of: ['material', 'labour', 'equipment', 'transport'] },
    { id: 'overheads', label: 'Frais généraux', kind: 'percent', scope: 'line', base: ['direct'], rate: { param: 'overheadRate' } },
    { id: 'margin', label: 'Marge', kind: 'percent', scope: 'line', base: ['direct', 'overheads'], rate: { param: 'marginRate' } },
    { id: 'vat', label: 'TVA (taux de TEST)', kind: 'percent', scope: 'total', base: ['lines'], rate: { param: 'vatRate' }, effect: 'tax' },
  ],
  params: { staleAfterDays: '180', lowConfidenceBelow: '0.50', overheadRate: '0.12', marginRate: '0.10', vatRate: '0.18' },
  rounding: ROUNDING,
  workBreakdown: [{ code: 'LOT01', label: 'Gros œuvre', order: 1 }, { code: 'LOT02', label: 'Enduits et revêtements', order: 2 }, { code: 'LOT03', label: 'Menuiseries', order: 3 }, { code: 'LOT04', label: 'Couverture', order: 4 }],
  documentTemplates: [
    { id: 'tpl.dqe.fr', kind: 'DQE', layout: 'priced-lines', language: 'fr', labels: { ...frLabels, title: 'Détail quantitatif estimatif (DQE)' } },
    { id: 'tpl.devis.fr', kind: 'DEVIS', layout: 'quote', language: 'fr', labels: { ...frLabels, title: 'Devis' } },
  ],
};

// prix de test (XOF) : [article, prix médian, zone feuille ou 'parent', confiance]
const BJ_PRICES: Array<[string, number]> = [['MAT.BLOC.20', 450], ['MAT.BLOC.10', 350], ['MAT.CIMENT', 6000], ['MAT.SABLE', 12000], ['MAT.GRAVIER', 18000], ['MAT.CARREAU.SOL', 6500], ['MAT.CARREAU.MUR', 5500],
  ['MAT.COLLE', 5000], ['MAT.PEINTURE', 28000], ['MAT.TOLE', 4500], ['MENU.PORTE.100', 85000], ['MENU.PORTE.90', 70000], ['MENU.FEN.120', 60000], ['MENU.FEN.60', 25000],
  ['MO.MACON', 1500], ['MO.PLATRIER', 1600], ['MO.CARRELEUR', 1800], ['MO.PEINTRE', 1400], ['MO.COUVREUR', 1700], ['MO.MENUISIER', 1800]];
const priceBook = (tag: string, leaf: string, parent: string, factor: number, ver: string) => ({
  id: `pb.${tag}.test`, version: ver, dataClass: SYN, currency: 'XOF',
  entries: [
    ...BJ_PRICES.map(([it, p]) => price(`pe:${tag}:${it}:${leaf}`, it, catalogue.find((x) => x.code === it)!.unit, leaf, 'XOF', Math.round(p * factor), { version: ver })),
    // acier : prix connu seulement au niveau « parent », confiance basse, plus ancien => test de repli de zone et d'alertes
    price(`pe:${tag}:MAT.ACIER:${parent}`, 'MAT.ACIER', 'kg', parent, 'XOF', Math.round(900 * factor), { conf: '0.40', date: '2026-02-01', n: 2, version: ver }),
  ],
});

const bjZones: Zone[] = [{ id: 'BJ', parent: null, type: 'country', name: 'Bénin (zone de test)' }, { id: 'BJ-LITTORAL', parent: 'BJ', type: 'department', name: 'Littoral (test)' }, { id: 'BJ-LITTORAL-COTONOU', parent: 'BJ-LITTORAL', type: 'commune', name: 'Cotonou (test)' }];
const snZones: Zone[] = [{ id: 'SN', parent: null, type: 'country', name: 'Sénégal (zone de test)' }, { id: 'SN-DAKAR', parent: 'SN', type: 'region', name: 'Dakar (test)' }, { id: 'SN-DAKAR-DAKAR', parent: 'SN-DAKAR', type: 'department', name: 'Dakar (test)' }, { id: 'SN-DAKAR-DAKAR-PLATEAU', parent: 'SN-DAKAR-DAKAR', type: 'commune', name: 'Plateau (test)' }];

function child(parent: PackData, p: Omit<PackData, 'packSchemaVersion' | 'dataClass' | 'extends' | 'requires'>): PackData {
  return { packSchemaVersion: '1', dataClass: SYN, extends: { id: parent.id, version: parent.version, contentHash: packContentHash(parent) }, requires: REQUIRES, ...p };
}

const bj = child(base, {
  id: 'pack.bj', version: '0.0.1-synthetic', description: 'SYNTHÉTIQUE — pack « Bénin » de test : AUCUN prix, taux ni pratique réels.',
  zoneTree: bjZones, legalIdentifiers: [{ key: 'ifu', label: 'IFU' }, { key: 'rccm', label: 'RCCM' }],
  numberingRules: [{ kind: 'DQE', pattern: 'DQE-{YYYY}-{seq:4}' }, { kind: 'DEVIS', pattern: 'DEV-{YYYY}-{seq:4}' }],
  defaultSpecProfiles: [{ id: 'A-01', key: 'level.clearHeight', value: { value: '3.00', unit: 'm' }, scope: 'project', rationale: 'Profil synthétique : hauteur libre proposée' }],
  priceBooks: [priceBook('bj', 'BJ-LITTORAL-COTONOU', 'BJ', 1, 'pb-bj-0.0.1')],
});

const snBloc20 = A('OUV.MAC.BLOC20', 'Maçonnerie de blocs creux de 20 cm', 'm2', 'wall.area', 'LOT01', [c('material', 'MAT.BLOC.20', '13', 'u', 'm2', '0.05'), sub('OUV.MORTIER.CIM', '0.015', 'm3', 'm2'), c('labour', 'MO.MACON', '0.85', 'h', 'm2')]);
const sn = child(base, {
  id: 'pack.sn', version: '0.0.1-synthetic', description: 'SYNTHÉTIQUE — pack « Sénégal » de test : AUCUN prix, taux ni pratique réels. Démontre surcharge d\'ouvrage, seuil de déduction et paramètres propres.',
  zoneTree: snZones, legalIdentifiers: [{ key: 'ninea', label: 'NINEA' }, { key: 'rccm', label: 'RCCM' }],
  numberingRules: [{ kind: 'DQE', pattern: 'DQE/{YYYY}/{seq:4}' }, { kind: 'DEVIS', pattern: 'DV/{YYYY}/{seq:4}' }],
  assemblies: [snBloc20],
  measurementMethod: { id: 'MM.TEST.THRESHOLD', version: '1.0.0', deductions: { 'wall.area': { mode: 'threshold', thresholdM2: '0.50' }, 'space.wall.area': { mode: 'threshold', thresholdM2: '0.50' } } },
  params: { overheadRate: '0.15', marginRate: '0.08' },
  priceBooks: [priceBook('sn', 'SN-DAKAR-DAKAR-PLATEAU', 'SN', 1.08, 'pb-sn-0.0.1')],
});

// ---- pack factice DIVERGENT : autre devise (2 décimales), unités impériales/commerciales, taxes composées, langue, zones, structure de coût, documents
const dUnits = [{ code: 'sqft', dimension: 'area' as const, factor: '0.09290304' }, { code: 'lb', dimension: 'mass' as const, factor: '0.45359237' }, { code: 'bag', dimension: 'mass' as const, factor: '40' }, { code: 'cuyd', dimension: 'volume' as const, factor: '0.764554857984' }];
const dCat: CatalogueItem[] = [
  { code: 'D.BLOCK8', label: 'Concrete block 8in [TEST]', kind: 'material', unit: 'u', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.BLOCK4', label: 'Concrete block 4in [TEST]', kind: 'material', unit: 'u', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.CEMENT', label: 'Cement bag 40 kg [TEST]', kind: 'material', unit: 'bag', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.SAND', label: 'Sand, cubic yard [TEST]', kind: 'material', unit: 'cuyd', orderRounding: { scale: 1, mode: 'ceil' } },
  { code: 'D.TILE', label: 'Floor/wall tile per sq ft [TEST]', kind: 'material', unit: 'sqft', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.STEEL', label: 'Reinforcement steel per lb [TEST]', kind: 'material', unit: 'lb', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.PAINT', label: 'Paint, 20 l pail [TEST]', kind: 'material', unit: 'l', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.SHEET', label: 'Roof sheet [TEST]', kind: 'material', unit: 'm2', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.DOOR', label: 'Door set [TEST]', kind: 'material', unit: 'u', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.WINDOW', label: 'Window set [TEST]', kind: 'material', unit: 'u', orderRounding: { scale: 0, mode: 'ceil' } },
  { code: 'D.CONCRETE', label: 'Ready-mix concrete [TEST]', kind: 'material', unit: 'm3', orderRounding: { scale: 1, mode: 'ceil' } },
  { code: 'D.LAB', label: 'Labour [TEST]', kind: 'labour', unit: 'h' },
];
const dAsm = [
  A('D.MASONRY.8', 'Masonry, 8in blocks', 'm2', 'wall.area', 'B', [c('material', 'D.BLOCK8', '11', 'u', 'm2', '0.04'), c('material', 'D.CEMENT', '0.35', 'bag', 'm2'), c('labour', 'D.LAB', '0.6', 'h', 'm2')]),
  A('D.MASONRY.4', 'Masonry, 4in blocks', 'm2', 'wall.area', 'B', [c('material', 'D.BLOCK4', '11', 'u', 'm2', '0.04'), c('material', 'D.SAND', '0.02', 'm3', 'm2'), c('labour', 'D.LAB', '0.5', 'h', 'm2')]),
  A('D.RENDER.EXT', 'External render', 'm2', 'wall.area', 'B', [c('material', 'D.CEMENT', '0.2', 'bag', 'm2'), c('labour', 'D.LAB', '0.5', 'h', 'm2')]),
  A('D.RENDER.INT', 'Internal render', 'm2', 'space.wall.area', 'B', [c('material', 'D.CEMENT', '0.2', 'bag', 'm2'), c('labour', 'D.LAB', '0.45', 'h', 'm2')]),
  A('D.PAINT.WALL', 'Wall paint', 'm2', 'space.wall.area', 'B', [c('material', 'D.PAINT', '0.3', 'l', 'm2'), c('labour', 'D.LAB', '0.25', 'h', 'm2')]),
  A('D.PAINT.CEIL', 'Ceiling paint', 'm2', 'space.ceiling.area', 'B', [c('material', 'D.PAINT', '0.3', 'l', 'm2'), c('labour', 'D.LAB', '0.3', 'h', 'm2')]),
  A('D.TILE.FLOOR', 'Floor tiling', 'm2', 'space.floor.area', 'B', [c('material', 'D.TILE', '10.7639', 'sqft', 'm2', '0.08'), c('labour', 'D.LAB', '0.9', 'h', 'm2')]),
  A('D.TILE.WALL', 'Wall tiling', 'm2', 'space.wall.area', 'B', [c('material', 'D.TILE', '10.7639', 'sqft', 'm2', '0.08'), c('labour', 'D.LAB', '1.1', 'h', 'm2')]),
  A('D.SLAB', 'Reinforced slab (parametric estimate)', 'm3', 'slab.volume', 'A', [c('material', 'D.CONCRETE', '1', 'm3', 'm3', '0.03'), c('material', 'D.STEEL', '176', 'lb', 'm3', '0.05'), c('labour', 'D.LAB', '5', 'h', 'm3')], { estimateFlag: 'parametric_structural' }),
  A('D.ROOF', 'Roof sheeting', 'm2', 'roof.area', 'C', [c('material', 'D.SHEET', '1', 'm2', 'm2', '0.1'), c('labour', 'D.LAB', '0.4', 'h', 'm2')]),
  A('D.DOOR', 'Door set, fitted', 'u', 'opening.count', 'C', [c('material', 'D.DOOR', '1', 'u', 'u'), c('labour', 'D.LAB', '2', 'h', 'u')]),
  A('D.WINDOW', 'Window set, fitted', 'u', 'opening.count', 'C', [c('material', 'D.WINDOW', '1', 'u', 'u'), c('labour', 'D.LAB', '1.5', 'h', 'u')]),
];
const dMap: SpecMapping[] = [
  M('D.SM.1', 'wall', 'masonry.block.hollow', 'D.MASONRY.8', { thickness: { min: '0.19', max: '0.21' } }), M('D.SM.2', 'wall', 'masonry.block.hollow', 'D.MASONRY.4', { thickness: { min: '0.09', max: '0.11' } }),
  M('D.SM.3', 'wall.layer', 'render.cementitious', 'D.RENDER.EXT', { side: 'exterior' }), M('D.SM.4', 'space.wall', 'render.cementitious', 'D.RENDER.INT'),
  M('D.SM.5', 'space.wall', 'paint.emulsion', 'D.PAINT.WALL'), M('D.SM.6', 'space.wall', 'wall.tile.ceramic', 'D.TILE.WALL'),
  M('D.SM.7', 'space.ceiling', 'paint.emulsion', 'D.PAINT.CEIL'), M('D.SM.8', 'space.floor', 'floor.tile.ceramic', 'D.TILE.FLOOR'),
  M('D.SM.9', 'slab', 'slab.reinforced.concrete', 'D.SLAB'), M('D.SM.10', 'roof', 'roof.sheet.metal', 'D.ROOF'),
  M('D.SM.11', 'opening', 'opening.door.single', 'D.DOOR'), M('D.SM.12', 'opening', 'opening.window.casement', 'D.WINDOW'),
];
const dZones: Zone[] = [{ id: 'REALM', parent: null, type: 'realm', name: 'Realm (test)' }, { id: 'REALM-P1', parent: 'REALM', type: 'province', name: 'Province 1 (test)' }, { id: 'REALM-P1-D1', parent: 'REALM-P1', type: 'district', name: 'District 1 (test)' }, { id: 'REALM-P1-D1-T1', parent: 'REALM-P1-D1', type: 'town', name: 'Town 1 (test)' }];
const dPrices: Array<[string, number]> = [['D.BLOCK8', 120], ['D.BLOCK4', 90], ['D.CEMENT', 1250], ['D.SAND', 3800], ['D.TILE', 410], ['D.STEEL', 85], ['D.PAINT', 2900], ['D.SHEET', 1900], ['D.DOOR', 21000], ['D.WINDOW', 15500], ['D.CONCRETE', 11800], ['D.LAB', 380]];
const divergent: PackData = {
  packSchemaVersion: '1', id: 'pack.test.divergent', version: '0.0.1-synthetic', dataClass: SYN, extends: null, requires: REQUIRES,
  description: 'SYNTHÉTIQUE — pack factice volontairement DIVERGENT (devise à 2 décimales, unités impériales, taxes composées, langue anglaise, zones à 4 niveaux, structure de coût, documents).',
  currency: { code: 'TST', minorUnits: 2, symbol: 'T$', name: 'Test dollar' }, units: dUnits, catalogue: dCat, assemblies: dAsm, specMappings: dMap,
  zoneTree: dZones, measurementMethod: { id: 'MM.DIVERGENT.GROSS', version: '1.0.0', deductions: { 'wall.area': { mode: 'gross' }, 'space.wall.area': { mode: 'gross' } } },
  costBuildUp: [
    { id: 'direct', label: 'Direct cost', kind: 'sum', scope: 'line', of: ['material', 'labour', 'equipment', 'transport'] },
    { id: 'contingency', label: 'Contingency', kind: 'percent', scope: 'line', base: ['direct'], rate: { param: 'contingencyRate' } },
    { id: 'profit', label: 'Overhead and profit', kind: 'percent', scope: 'line', base: ['direct', 'contingency'], rate: { param: 'profitRate' } },
    { id: 'provisional', label: 'Provisional sum', kind: 'fixed', scope: 'total', amount: { param: 'provisionalSum' } },
    { id: 'taxA', label: 'Tax A (TEST)', kind: 'percent', scope: 'total', base: ['lines', 'provisional'], rate: { param: 'taxARate' }, effect: 'tax' },
    { id: 'taxB', label: 'Tax B on subtotal + Tax A (TEST, compound)', kind: 'percent', scope: 'total', base: ['lines', 'provisional', 'taxA'], rate: { param: 'taxBRate' }, effect: 'tax' },
  ],
  params: { staleAfterDays: '90', lowConfidenceBelow: '0.60', contingencyRate: '0.05', profitRate: '0.15', provisionalSum: '2500', taxARate: '0.10', taxBRate: '0.05' },
  rounding: { quantity: HALF_UP(1), unitPrice: HALF_UP(0), lineAmount: HALF_UP(0), totalLayer: HALF_UP(0) },
  workBreakdown: [{ code: 'A', label: 'Structure', order: 1 }, { code: 'B', label: 'Walls, finishes', order: 2 }, { code: 'C', label: 'Roof, joinery', order: 3 }],
  documentTemplates: [
    { id: 'tpl.boq.en', kind: 'BOQ', layout: 'priced-lines', language: 'en', labels: { ...enLabels, title: 'Bill of Quantities' } },
    { id: 'tpl.quote.en', kind: 'QUOTATION', layout: 'quote', language: 'en', labels: { ...enLabels, title: 'Quotation' } },
  ],
  legalIdentifiers: [{ key: 'taxId', label: 'Tax Reg. No.' }], numberingRules: [{ kind: 'BOQ', pattern: 'BOQ/{YYYY}/{seq:3}' }, { kind: 'QUOTATION', pattern: 'Q-{YYYY}-{seq:3}' }],
  defaultSpecProfiles: [],
  priceBooks: [{
    id: 'pb.divergent.test', version: 'pb-div-0.0.1', dataClass: SYN, currency: 'TST',
    entries: dPrices.map(([it, p]) => price(`pe:div:${it}`, it, dCat.find((x) => x.code === it)!.unit, 'REALM-P1-D1-T1', 'TST', p, { version: 'pb-div-0.0.1' })),
  }],
};

function finalize(p: PackData): PackData {
  const { contentHash: _a, signature: _b, ...rest } = p;
  const hashed: PackData = { ...rest };
  const contentHash = packContentHash(hashed);
  return { ...hashed, contentHash, signature: { keyId: TEST_KEY_ID, alg: 'ed25519', value: signHash(contentHash) } };
}

const baseF = finalize(base);
// les enfants référencent l'empreinte du parent tel que finalisé
const out: Array<[string, PackData]> = [['base-xof', baseF], ['bj', finalize(bj)], ['sn', finalize(sn)], ['test-divergent', finalize(divergent)]];
for (const [dir, pack] of out) {
  mkdirSync(join(ROOT, 'market-packs', dir), { recursive: true });
  writeFileSync(join(ROOT, 'market-packs', dir, 'pack.json'), JSON.stringify(pack, null, 2) + '\n');
  console.log(`${dir}: ${pack.id}@${pack.version} ${pack.contentHash}`);
}
