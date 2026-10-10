import { UnitRegistry } from '../units/units.js';
import { Dec } from '../units/decimal.js';
import { hashOf } from '../trace/canonical.js';
import type { Taxonomy } from '../model/validate.js';
import { BASES, ENGINE_API, REQUIRED_PARAMS, RULE_LANGUAGE, type Basis, type MappingTarget, type PackData, type ResolvedPack } from './types.js';
import { packContentHash } from './resolve.js';

/** Port de vérification de signature (le noyau n'embarque aucune primitive cryptographique asymétrique). */
export interface SignatureVerifier { verify(contentHash: string, sig: { keyId: string; alg: string; value: string }): boolean }

const TARGET_BASIS: Record<MappingTarget, Basis> = {
  wall: 'wall.area', 'wall.layer': 'wall.area', 'space.floor': 'space.floor.area', 'space.wall': 'space.wall.area',
  'space.ceiling': 'space.ceiling.area', slab: 'slab.volume', roof: 'roof.area', opening: 'opening.count',
};

/** Intégrité d'un pack brut : hash de contenu + signature (ADR-0020). */
export function verifyPackIntegrity(p: PackData, verifier: SignatureVerifier | null): string[] {
  const errs: string[] = [];
  if (p.contentHash !== packContentHash(p)) errs.push(`${p.id}@${p.version} : empreinte de contenu invalide (pack modifié après signature ?)`);
  if (p.dataClass === 'commercial' && !p.signature) errs.push(`${p.id} : un pack « commercial » doit être signé`);
  if (p.signature) {
    if (!verifier) errs.push(`${p.id} : signature présente mais aucun vérificateur fourni`);
    else if (!verifier.verify(p.contentHash ?? '', p.signature)) errs.push(`${p.id}@${p.version} : signature invalide`);
  }
  return errs;
}

export function validateRaw(p: PackData): string[] {
  const errs: string[] = [];
  if (p.packSchemaVersion !== '1') errs.push(`${p.id} : packSchemaVersion « 1 » attendu`);
  if (p.requires?.engineApi !== ENGINE_API) errs.push(`${p.id} : engineApi incompatible (pack ${p.requires?.engineApi}, moteur ${ENGINE_API})`);
  if (p.requires?.ruleLanguage !== RULE_LANGUAGE) errs.push(`${p.id} : langage de règles « ${p.requires?.ruleLanguage} » non supporté (${RULE_LANGUAGE})`);
  if (p.dataClass !== 'synthetic/test' && p.dataClass !== 'commercial') errs.push(`${p.id} : dataClass invalide`);
  return errs;
}

/** Validation d'un pack RÉSOLU : complétude et références croisées. */
export function validateResolved(r: ResolvedPack, taxonomy: Taxonomy): string[] {
  const errs: string[] = [];
  const E = (m: string): void => { errs.push(`${r.id} : ${m}`); };

  // vocabulaire FERMÉ « declarative-1 » : tout élément hors vocabulaire exige une évolution du moteur (ADR), jamais un contournement
  const OUT = (what: string): string => `${what} hors du vocabulaire ${RULE_LANGUAGE} — cette fonctionnalité exige une évolution du moteur (ADR)`;
  const COST_KINDS = ['material', 'labour', 'equipment', 'transport']; const MODES = ['half_up', 'floor', 'ceil'];
  for (const l of r.costBuildUp ?? []) {
    if (!['sum', 'percent', 'fixed'].includes(l.kind)) E(OUT(`couche « ${l.id} » de type « ${l.kind} »`));
    if (!['line', 'total'].includes(l.scope)) E(OUT(`couche « ${l.id} » de portée « ${l.scope} »`));
    if (l.effect !== undefined && !['add', 'tax'].includes(l.effect)) E(OUT(`couche « ${l.id} » d'effet « ${l.effect} »`));
    for (const k of l.of ?? []) if (!COST_KINDS.includes(k)) E(OUT(`couche « ${l.id} » : nature de coût « ${k} »`));
  }
  for (const m of r.specMappings) if (!(m.target in TARGET_BASIS)) E(OUT(`correspondance « ${m.id} » : cible « ${m.target} »`));
  for (const a of r.assemblies) for (const c of a.components) if (![...COST_KINDS, 'assembly'].includes(c.kind)) E(OUT(`assembly ${a.code} : composant de nature « ${c.kind} »`));
  for (const c of r.catalogue) if (!COST_KINDS.includes(c.kind)) E(OUT(`article ${c.code} : nature « ${c.kind} »`));
  for (const [k, v] of Object.entries(r.rounding ?? {})) if (!MODES.includes(v.mode) || !Number.isInteger(v.scale) || v.scale < 0) E(OUT(`arrondi « ${k} » (${v.mode}, ${v.scale})`));
  for (const [b, d] of Object.entries(r.measurementMethod?.deductions ?? {})) if (!['net', 'gross', 'threshold'].includes(d.mode)) E(OUT(`déduction « ${b} » de mode « ${d.mode} »`));
  for (const t of r.documentTemplates) if (!['priced-lines', 'quote'].includes(t.layout)) E(OUT(`gabarit « ${t.id} » de disposition « ${t.layout} »`));

  // taxonomie
  const major = (v: string): string => v.split('.')[0]!;
  const reqTax = r.requires.specTaxonomy;
  if (major(reqTax) !== major(taxonomy.version)) E(`taxonomie requise ${reqTax} incompatible avec ${taxonomy.version}`);
  const classes = new Set(taxonomy.classes.map((c) => c.id));

  // paramètres obligatoires (aucun défaut dans le moteur)
  for (const k of REQUIRED_PARAMS) if (!(k in r.params)) E(`paramètre obligatoire absent : ${k}`);
  for (const [k, v] of Object.entries(r.params)) { if (/^-?\d+(\.\d+)?$/.test(v) === false && !k.startsWith('label')) { /* chaînes libres autorisées */ } }

  // zones
  const zones = new Map(r.zoneTree.map((z) => [z.id, z]));
  if (zones.size !== r.zoneTree.length) E('zoneTree : identifiants dupliqués');
  const roots = r.zoneTree.filter((z) => z.parent === null);
  if (roots.length !== 1) E(`zoneTree : une racine exactement attendue (trouvé ${roots.length})`);
  for (const z of r.zoneTree) {
    if (z.parent !== null && !zones.has(z.parent)) E(`zoneTree : parent inconnu pour ${z.id}`);
    const seen = new Set<string>();
    for (let c: string | null = z.id; c; c = zones.get(c)?.parent ?? null) { if (seen.has(c)) { E(`zoneTree : cycle en ${z.id}`); break; } seen.add(c); }
  }

  // devise & arrondis
  if (!r.currency?.code || !Number.isInteger(r.currency.minorUnits) || r.currency.minorUnits < 0) E('devise absente ou invalide');
  if (!r.rounding) E('politique d\'arrondi absente');

  // unités
  let reg: UnitRegistry;
  try { reg = new UnitRegistry(r.units); } catch (e) { E((e as Error).message); return errs; }

  // catalogue
  const cat = new Map(r.catalogue.map((c) => [c.code, c]));
  if (cat.size !== r.catalogue.length) E('catalogue : codes dupliqués');
  for (const c of r.catalogue) {
    if (!reg.has(c.unit)) E(`catalogue ${c.code} : unité inconnue ${c.unit}`);
    if (c.specClass && !classes.has(c.specClass)) E(`catalogue ${c.code} : specClass hors taxonomie`);
  }

  // lots
  const lots = new Set(r.workBreakdown.map((l) => l.code));

  // assemblages
  const asm = new Map(r.assemblies.map((a) => [a.code, a]));
  if (asm.size !== r.assemblies.length) E('assemblies : codes dupliqués');
  for (const a of r.assemblies) {
    if (!reg.has(a.unit)) E(`assembly ${a.code} : unité inconnue ${a.unit}`);
    if (!BASES.includes(a.basis)) E(`assembly ${a.code} : base « ${a.basis} » hors vocabulaire`);
    if (!lots.has(a.lot)) E(`assembly ${a.code} : lot « ${a.lot} » inconnu`);
    if (a.components.length === 0) E(`assembly ${a.code} : aucun composant`);
    for (const c of a.components) {
      try { Dec.parse(c.consumption); if (c.lossRate) Dec.parse(c.lossRate); } catch { E(`assembly ${a.code} : valeur décimale invalide`); continue; }
      if (!reg.has(c.unit) || !reg.has(c.per)) { E(`assembly ${a.code} : unité inconnue (${c.unit}/${c.per})`); continue; }
      if (c.per !== a.unit) E(`assembly ${a.code} : « per » (${c.per}) ≠ unité de l'ouvrage (${a.unit})`);
      if (c.kind === 'assembly') {
        const sub = c.ref ? asm.get(c.ref) : undefined;
        if (!sub) E(`assembly ${a.code} : sous-ouvrage ${c.ref} inconnu`);
        else if (!reg.compatible(c.unit, sub.unit)) E(`assembly ${a.code} : unité ${c.unit} incompatible avec ${sub.code} (${sub.unit})`);
      } else {
        const it = c.item ? cat.get(c.item) : undefined;
        if (!it) E(`assembly ${a.code} : article ${c.item} absent du catalogue`);
        else {
          if (it.kind !== c.kind) E(`assembly ${a.code} : article ${it.code} est de nature ${it.kind}, composant ${c.kind}`);
          if (reg.has(it.unit) && !reg.compatible(c.unit, it.unit)) E(`assembly ${a.code} : unité ${c.unit} incompatible avec l'unité de prix ${it.unit} de ${it.code}`);
        }
      }
    }
  }
  // cycles de sous-ouvrages
  const visiting = new Set<string>(); const done = new Set<string>();
  const dfs = (code: string): void => {
    if (done.has(code)) return;
    if (visiting.has(code)) { E(`cycle de sous-ouvrages en ${code}`); return; }
    visiting.add(code);
    for (const c of asm.get(code)?.components ?? []) if (c.kind === 'assembly' && c.ref && asm.has(c.ref)) dfs(c.ref);
    visiting.delete(code); done.add(code);
  };
  for (const a of r.assemblies) dfs(a.code);

  // correspondances
  const ids = new Set<string>();
  for (const m of r.specMappings) {
    if (ids.has(m.id)) E(`specMappings : id dupliqué ${m.id}`); ids.add(m.id);
    if (!classes.has(m.class)) E(`specMapping ${m.id} : classe « ${m.class} » hors taxonomie`);
    const a = asm.get(m.assembly);
    if (!a) E(`specMapping ${m.id} : assembly ${m.assembly} inconnu`);
    else if (a.basis !== TARGET_BASIS[m.target]) E(`specMapping ${m.id} : la cible ${m.target} exige une base « ${TARGET_BASIS[m.target]} », l'assembly ${a.code} utilise « ${a.basis} »`);
  }

  // méthode de mesurage
  for (const b of ['wall.area', 'space.wall.area'] as const) {
    const d = r.measurementMethod?.deductions?.[b];
    if (!d) E(`measurementMethod : règle de déduction absente pour ${b}`);
    else if (d.mode === 'threshold' && !d.thresholdM2) E(`measurementMethod ${b} : seuil requis`);
  }

  // structure de coût
  const layerIds = new Set<string>(['lines']);
  let hasLineSum = false;
  for (const l of r.costBuildUp ?? []) {
    if (layerIds.has(l.id)) E(`costBuildUp : id dupliqué ${l.id}`);
    if (l.kind === 'sum') { if (l.scope !== 'line') E(`costBuildUp ${l.id} : « sum » est de portée ligne`); hasLineSum = true; }
    if (l.kind === 'percent') {
      if (!l.rate || !(l.rate.param in r.params)) E(`costBuildUp ${l.id} : paramètre de taux ${l.rate?.param} absent`);
      for (const b of l.base ?? []) if (!layerIds.has(b)) E(`costBuildUp ${l.id} : base ${b} inconnue ou postérieure`);
    }
    if (l.kind === 'fixed' && (!l.amount || !(l.amount.param in r.params))) E(`costBuildUp ${l.id} : paramètre de montant ${l.amount?.param} absent`);
    layerIds.add(l.id);
  }
  if (!hasLineSum) E('costBuildUp : une couche « sum » de portée ligne est requise');

  // prix
  const reqCur = r.currency?.code;
  for (const pb of r.priceBooks) {
    if (pb.currency !== reqCur) E(`priceBook ${pb.id} : devise ${pb.currency} ≠ ${reqCur}`);
    if (r.dataClass === 'synthetic/test' && pb.dataClass !== 'synthetic/test') E(`priceBook ${pb.id} : un pack synthétique ne peut contenir que des prix synthétiques`);
    if (r.dataClass === 'commercial' && pb.dataClass !== 'commercial') E(`priceBook ${pb.id} : un pack commercial ne peut contenir de prix synthétiques`);
    for (const e of pb.entries) {
      const it = cat.get(e.item);
      if (!it) { E(`prix ${e.id} : article ${e.item} inconnu`); continue; }
      if (e.unit !== it.unit) E(`prix ${e.id} : unité ${e.unit} ≠ unité du catalogue ${it.unit}`);
      if (!zones.has(e.zoneId)) E(`prix ${e.id} : zone ${e.zoneId} inconnue`);
      if (e.currency !== reqCur) E(`prix ${e.id} : devise ${e.currency} ≠ ${reqCur}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) E(`prix ${e.id} : date invalide`);
      const c = Dec.parse(e.confidence); if (c.lt(Dec.ZERO) || c.gt(Dec.ONE)) E(`prix ${e.id} : confiance hors [0,1]`);
      if (!e.dataClass) E(`prix ${e.id} : dataClass manquant`);
      else if (e.dataClass !== r.dataClass) E(`prix ${e.id} : dataClass « ${e.dataClass} » ≠ pack « ${r.dataClass} » — un pack synthétique ne contient que des prix synthétiques et un pack commercial aucun prix synthétique`);
      if (r.dataClass === 'commercial' && (e.source.type === 'synthetic' || e.dataClass === 'synthetic/test')) E(`prix ${e.id} : donnée synthétique interdite dans un pack commercial`);
    }
  }

  // documents
  if (!r.documentTemplates.some((t) => t.layout === 'priced-lines')) E('aucun gabarit « priced-lines » (DQE / BoQ)');
  if (!r.documentTemplates.some((t) => t.layout === 'quote')) E('aucun gabarit « quote » (devis)');
  void hashOf;
  return errs;
}
