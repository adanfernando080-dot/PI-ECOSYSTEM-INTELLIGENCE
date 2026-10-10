/**
 * Démonstration en ligne de commande du noyau M0 (aucune interface) :
 *   npx tsx src/cli.ts [--out <dossier>]
 * Chiffre la petite habitation synthétique avec les packs Bénin, Sénégal et divergent ; écrit DQE, devis, explications, chaîne de traçabilité et bundle .btpx.
 * ⚠ Toutes les données sont SYNTHÉTIQUES.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPackCatalog } from './adapters/packs.js';
import { engineSourceHash, writeBundleDir } from './adapters/fs.js';
import { renderMarkdown, fmtMoney } from './adapters/render-text.js';
import { emitDocument, runEstimate } from './core/project/pipeline.js';
import { formatDocNumber } from './core/docs/document.js';
import { createBundle, verifyBundle } from './core/project/bundle.js';
import { resolveChain } from './core/trace/chain.js';
import { explainLine, explainPrice, explainRequirement } from './core/trace/explain.js';
import { houseAssumptions, houseModel } from '../fixtures/synthetic/house.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? process.argv[outArg + 1]! : join(ROOT, 'out');
const taxonomy = JSON.parse(readFileSync(join(ROOT, 'taxonomy', 'spec-taxonomy.json'), 'utf8'));
const catalog = loadPackCatalog(ROOT);
const engine = { version: '0.0.1-m0', apiVersion: '1', sourceHash: engineSourceHash(ROOT) };
const markets = [
  { key: 'bj', pack: 'pack.bj', zone: 'BJ-LITTORAL-COTONOU' },
  { key: 'sn', pack: 'pack.sn', zone: 'SN-DAKAR-DAKAR-PLATEAU' },
  { key: 'divergent', pack: 'pack.test.divergent', zone: 'REALM-P1-D1-T1' },
] as const;
const put = (p: string, c: string): void => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c, 'utf8'); };

const rows: string[] = ['| Marché (pack) | Devise | Hash métré géométrique | Total | Documents |', '|---|---|---|---:|---|'];
for (const m of markets) {
  const run = runEstimate({ taxonomy, model: houseModel(), assumptions: houseAssumptions(), pack: catalog.resolve(m.pack), binding: { zoneId: m.zone, asOf: '2026-10-08' }, engine });
  const dqeTpl = run.pack.documentTemplates.find((t) => t.layout === 'priced-lines')!; const quoteTpl = run.pack.documentTemplates.find((t) => t.layout === 'quote')!;
  const num = (kind: string): string => formatDocNumber(run.pack.numberingRules.find((n) => n.kind === kind)!, '2026-10-08', 1);
  const dqe = emitDocument(run, { templateId: dqeTpl.id, number: num(dqeTpl.kind), date: '2026-10-08', status: 'final' });
  const idKey = run.pack.legalIdentifiers[0]!.key;
  const quote = emitDocument(run, { templateId: quoteTpl.id, number: num(quoteTpl.kind), date: '2026-10-08', status: 'final',
    issuer: { name: 'ENTREPRISE DE TEST', identifiers: { [idKey]: '000-TEST' } }, client: { name: 'CLIENT DE TEST' }, site: 'Chantier synthétique', validityDays: 30 });
  const dir = join(OUT, m.key);
  put(join(dir, 'DQE.md'), renderMarkdown(dqe)); put(join(dir, 'DEVIS.md'), renderMarkdown(quote));
  const why = run.estimate.lines.flatMap((l) => ['', `### ${l.id}`, '', ...explainLine(run, l.id), '', ...explainPrice(run, l.id)]);
  const bom = run.quantitySet.requirements.flatMap((r) => ['', ...explainRequirement(run, r.item)]);
  put(join(dir, 'POURQUOI.md'), `# Explications déterministes (${m.pack})\n\n> ${dqe.content.syntheticBanner}\n${why.join('\n')}\n\n## Articles à commander\n${bom.join('\n')}\n`);
  put(join(dir, 'chaine-de-tracabilite.json'), JSON.stringify(dqe.content.sections.flatMap((s) => s.lines).map((l) => resolveChain(run, dqe, l.lineId)), null, 2));
  const bundle = createBundle(run); writeBundleDir(join(dir, 'projet.btpx'), bundle);
  const v = verifyBundle(bundle);
  const money = (x: string): string => fmtMoney(x, run.pack.currency.minorUnits, run.pack.currency.code);
  rows.push(`| ${m.pack} | ${run.pack.currency.code} | \`${run.takeoff.contentHash.slice(0, 19)}…\` | ${money(run.estimate.total)} | ${dqe.content.number}, ${quote.content.number} ; bundle ${v.ok ? 'vérifié' : 'ÉCHEC'} |`);
  console.log(`${m.pack}: total ${money(run.estimate.total)} — ${dqe.id}, ${quote.id} — bundle ${v.ok ? 'OK' : 'ÉCHEC ' + v.problems.join('; ')}`);
}
put(join(OUT, 'COMPARAISON-MARCHES.md'), `# Même projet architectural, trois marchés\n\n> DONNÉES SYNTHÉTIQUES — aucune valeur réelle.\n\nLe hash du métré géométrique est IDENTIQUE : seules les étapes de marché changent.\n\n${rows.join('\n')}\n`);
console.log(`Livrables écrits dans ${OUT}`);
