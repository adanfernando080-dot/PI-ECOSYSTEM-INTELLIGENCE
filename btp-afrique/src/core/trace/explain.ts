/**
 * Explications DÉTERMINISTES (aucune IA) : le texte est généré uniquement à partir de la trace structurée.
 * Mêmes entrées => même texte, mot pour mot.
 */
import type { Run } from '../project/run.js';

/** Descend la trace d'une quantité géométrique jusqu'aux attributs de l'objet architectural et aux hypothèses. */
function explainGeo(run: Run, id: string, indent: string, seen: Set<string>, out: string[]): void {
  const q = run.takeoff.quantities.find((x) => x.id === id);
  if (!q) { out.push(`${indent}${id} — INTROUVABLE`); return; }
  if (seen.has(id)) { out.push(`${indent}${id} (détaillé plus haut)`); return; }
  seen.add(id);
  out.push(`${indent}${q.id} = ${q.value} ${q.unit}  [règle ${q.trace.rule.id}@${q.trace.rule.version}]`);
  for (const s of q.trace.steps) out.push(`${indent}  - ${s.expr} = ${s.result} ${s.unit}`);
  for (const i of q.trace.inputs) {
    if (i.source.type === 'geo' && i.source.id) explainGeo(run, i.source.id, indent + '    ', seen, out);
    else if (i.source.type === 'assumption') out.push(`${indent}  · ${i.name} = ${i.value} ${i.unit} (hypothèse ${i.source.assumptionId})`);
    else if (i.source.type === 'attr') out.push(`${indent}  · ${i.name} = ${i.value} ${i.unit} (${i.source.id}.${i.source.attr}, origine ${i.source.origin}${i.source.validation ? ', ' + i.source.validation : ''}${i.source.confidence ? ', confiance ' + i.source.confidence : ''})`);
  }
}

export function explainLine(run: Run, lineId: string): string[] {
  const el = run.estimate.lines.find((l) => l.id === lineId);
  if (!el) throw new Error(`Ligne inconnue : ${lineId}`);
  const oq = run.quantitySet.ouvrages.find((o) => o.id === el.ouvrageId)!;
  const out: string[] = [];
  out.push(`Pourquoi ${oq.quantity} ${el.unit} pour « ${el.assembly.label} » (${el.assembly.code}@${el.assembly.version}) ?`);
  out.push(`1. La quantité d'ouvrage est la somme de ${oq.contributions.length} contribution(s) = ${oq.theoretical} ${el.unit}, arrondie à ${oq.rounding.scale} décimale(s) (${oq.rounding.mode}) : ${oq.quantity} ${el.unit}.`);
  oq.contributions.forEach((c, i) => {
    out.push(`2.${i + 1} ${c.entity.type} ${c.entity.code} (classe ${c.specClass}) → correspondance ${c.mapping.id}@${c.mapping.version} ; base « ${c.basis} » ; méthode ${c.method.id}@${c.method.version} (${c.method.deduction}) : ${c.quantity.value} ${c.quantity.unit}.`);
    const seen = new Set<string>();
    for (const g of c.geoRefs) explainGeo(run, g, '      ', seen, out);
    for (const s of c.steps.filter((x) => x.op === 'deduct' || x.op === 'keep')) out.push(`      ${s.expr}`);
  });
  if (oq.confidenceFloor) out.push(`3. Attention : plancher de confiance ${oq.confidenceFloor.value} (limité par ${oq.confidenceFloor.limitedBy}).`);
  return out;
}

export function explainPrice(run: Run, lineId: string): string[] {
  const el = run.estimate.lines.find((l) => l.id === lineId);
  if (!el) throw new Error(`Ligne inconnue : ${lineId}`);
  const cur = run.estimate.currency.code;
  const out: string[] = [];
  if (el.status === 'unpriced') return [`Ligne ${el.id} non chiffrée : prix manquant pour ${el.unpricedItems.join(', ')}.`];
  out.push(`Prix unitaire ${el.unitPrice} ${cur}/${el.unit} pour « ${el.assembly.label} » (valeur exacte avant arrondi : ${el.sellingUnitExact}).`);
  for (const c of el.components) {
    out.push(`  - ${c.item} « ${c.label} » : ${c.qtyPerUnit} ${c.unit}/${el.unit} × ${c.unitPriceMinor} (minor) = ${c.amountPerUnit}  [entrée ${c.price!.entryId}, zone ${c.price!.zoneId}, ${c.price!.date}, source ${c.price!.source.type}:${c.price!.source.ref}, confiance ${c.price!.confidence}, ${c.price!.dataClass}]`);
  }
  for (const l of el.layers) out.push(`  = ${l.label} : ${l.amount}${l.rate ? ` (taux ${l.rate} sur ${l.base.join('+')})` : ''}`);
  out.push(`  Montant de ligne = ${el.quantity} × ${el.unitPrice} = ${el.amount} ${cur}.`);
  return out;
}

export function explainRequirement(run: Run, item: string): string[] {
  const r = run.quantitySet.requirements.find((x) => x.item === item);
  if (!r) throw new Error(`Article inconnu : ${item}`);
  const out = [`Pourquoi ${r.quantity} ${r.unit} de « ${r.label} » (${r.item}) à commander ?`,
    `1. Besoin théorique = ${r.theoretical} ${r.unit} ; avec pertes = ${r.orderedExact} ${r.unit} ; arrondi de commande (${r.rounding.mode}, ${r.rounding.scale} décimale(s)) : ${r.quantity} ${r.unit}.`];
  r.contributions.forEach((c, i) => out.push(`2.${i + 1} via ${c.path.join(' → ')} (${c.component}) : théorique ${c.theoretical}, avec pertes ${c.ordered} ${c.unit}`));
  return out;
}
