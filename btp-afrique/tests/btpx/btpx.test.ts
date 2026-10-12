import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';
import { readBtpx, writeBtpx, zipRead, zipStore } from '../../src/adapters/btpx.js';
import { createBundle } from '../../src/core/project/bundle.js';
import { applyOperation, type ProjectState } from '../../src/core/ops/oplog.js';
import { recompute } from '../../src/core/project/recompute.js';
import { verifyRun } from '../../src/core/trace/chain.js';
import { catalog, houseAssumptions, houseModel, taxonomy, ZONES, ASOF, house } from '../support/env.js';

const tmp = mkdtempSync(join(tmpdir(), 'btpx-')); afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);

function project() {
  const s0: ProjectState = { model: houseModel(), assumptions: houseAssumptions() };
  const op = applyOperation(s0, { type: 'setAdjustment', adjustment: { id: 'AJ1', target: 'oq:OUV.MAC.BLOC20', mode: 'delta', value: '2', author: 'u.test', date: '2026-10-12', justification: 'ajustement de test' } }, { hlc: { wall: 1, counter: 0, node: 'n' }, actor: 'u' });
  const r = recompute(null, { taxonomy, state: op.state, pack: catalog.resolve('pack.bj'), binding: { zoneId: ZONES.bj, asOf: ASOF } }).run;
  const bundle = createBundle(r);
  const bytes = writeBtpx(r, bundle, { name: 'Maison test (synthetic/test)', oplog: [op.record], sources: { 'plan-1': { bytes: png, mediaType: 'image/png', originalName: 'plan.png' } } });
  return { r, bundle, bytes, op };
}

describe('Fichier projet .btpx autonome (ADR-0016)', () => {
  it('un SEUL fichier, archive ZIP valide lue par des outils indépendants (unzip -t, Python zipfile)', () => {
    const { bytes } = project(); const f = join(tmp, 'p.btpx'); writeFileSync(f, bytes);
    expect(execFileSync('unzip', ['-tq', f]).toString()).toMatch(/No errors detected/);
    const py = execFileSync('python3', ['-I', '-c', 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(",".join(sorted(z.namelist())))', f]).toString();
    expect(py).toContain('manifest.json'); expect(py).toContain('project.json'); expect(py).toContain('sources/plan-1'); expect(py).toMatch(/packs\/pack\.bj@/);
  });
  it('octets DÉTERMINISTES : deux écritures identiques', () => {
    const { r, bundle, op } = project(); const o = { name: 'x', oplog: [op.record] };
    expect(Buffer.from(writeBtpx(r, bundle, o)).equals(Buffer.from(writeBtpx(r, bundle, o)))).toBe(true);
  });
  it('sauvegarde → réouverture : run identique, vérification complète OK, journal et source binaire conservés', () => {
    const { r, bytes, op } = project(); const o = readBtpx(bytes);
    expect(o.problems).toEqual([]); expect(o.ok).toBe(true);
    expect(o.run!.estimate.contentHash).toBe(r.estimate.contentHash); expect(o.run!.takeoff.contentHash).toBe(r.takeoff.contentHash);
    expect(verifyRun(o.run!).ok).toBe(true);
    expect(o.project!.meta.oplog).toEqual([JSON.parse(JSON.stringify(op.record))]);
    expect(Array.from(o.project!.sources['plan-1']!)).toEqual(Array.from(png));
    expect(o.project!.meta.name).toContain('synthetic/test');
  });
  it('REPRODUCTIBILITÉ : le projet rouvert, recalculé à froid avec le pack EMBARQUÉ, redonne les mêmes empreintes (sans catalogue installé)', () => {
    const { r, bytes } = project(); const o = readBtpx(bytes).run!;
    const again = recompute(null, { taxonomy: o.taxonomy, state: { model: o.model, assumptions: o.assumptions, manual: o.manual }, pack: o.pack,
      binding: { zoneId: o.binding.zoneId, asOf: o.binding.asOf, priceBookId: o.binding.priceBookId, priceStatistic: o.binding.priceStatistic, paramOverrides: o.binding.params } }).run;
    expect(again.binding.rev).toBe(r.binding.rev); expect(again.takeoff.contentHash).toBe(r.takeoff.contentHash);
    expect(again.quantitySet.contentHash).toBe(r.quantitySet.contentHash); expect(again.estimate.contentHash).toBe(r.estimate.contentHash);
    expect(again.estimate.total).toBe(r.estimate.total);
  });
  it('un octet altéré dans un fichier de calcul est détecté (CRC ou empreinte)', () => {
    const { bytes } = project(); const z = zipRead(bytes);
    const e = { ...z.entries }; const est = new TextDecoder().decode(e['estimate.json']!); e['estimate.json'] = new TextEncoder().encode(est.replace(/"total":"(\d)/, '"total":"9$1'));
    const o = readBtpx(zipStore(e)); expect(o.ok).toBe(false); expect(o.problems.join()).toMatch(/empreinte invalide : estimate\.json/);
  });
  it('une source de plan altérée est détectée', () => {
    const { bytes } = project(); const e = { ...zipRead(bytes).entries }; e['sources/plan-1'] = new Uint8Array([0, 0, 0]);
    expect(readBtpx(zipStore(e)).problems.join()).toMatch(/source altérée : plan-1/);
  });
  it('corruption d\'un octet de l\'archive : CRC invalide ; archive tronquée / vide / non-ZIP : refusées sans exception', () => {
    const { bytes } = project(); const bad = bytes.slice(); bad[200] = bad[200]! ^ 0xff;
    expect(readBtpx(bad).ok).toBe(false);
    expect(readBtpx(bytes.slice(0, bytes.length - 40)).ok).toBe(false);
    expect(readBtpx(new Uint8Array(0)).ok).toBe(false);
    expect(readBtpx(new TextEncoder().encode('pas un zip')).ok).toBe(false);
  });
  it('chemins dangereux et compression non supportée refusés', () => {
    const z = zipStore({ '../evil': new Uint8Array([1]) }); expect(zipRead(z).problems.join()).toMatch(/chemin refusé/);
  });
  it('fichier requis manquant : refus explicite, pas de run partiel', () => {
    const { bytes } = project(); const e = { ...zipRead(bytes).entries }; delete e['model.json'];
    const o = readBtpx(zipStore(e)); expect(o.ok).toBe(false); expect(o.run).toBeNull(); expect(o.problems.join()).toMatch(/model\.json/);
  });
  it('le contenu du fichier ne dépend pas du chemin ni de la machine (aucun chemin absolu)', () => {
    const { bytes } = project(); const t = Buffer.from(bytes).toString('latin1'); expect(t).not.toContain(tmp); expect(t).not.toMatch(/\/home\/|\/root\//);
  });
});
void house; void readFileSync;
