/**
 * Écrit release/RELEASE-MANIFEST.json + release/SHA256SUMS.txt pour l'installateur Windows présent dans release/.
 * Permet au testeur Windows de vérifier que le fichier reçu est bien celui construit (empreinte, taille, commit, versions).
 * Les valeurs sont LUES (git, package.json, fichier) ; rien n'est saisi à la main.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname; const REL = join(ROOT, 'release');
const exe = readdirSync(REL).find((f) => /^BTP-Afrique-Setup-.*-x64\.exe$/.test(f));
if (!exe) { console.error('Aucun installateur dans release/ : lancer `npm run desktop:dist:win`'); process.exit(1); }
const buf = readFileSync(join(REL, exe)); const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const git = (...a: string[]): string => { try { return execFileSync('git', a, { cwd: ROOT }).toString().trim(); } catch { return 'inconnu'; } };
const sha256 = createHash('sha256').update(buf).digest('hex');
const manifest = {
  file: exe, bytes: statSync(join(REL, exe)).size, sha256, sha512Base64: createHash('sha512').update(buf).digest('base64'),
  version: pkg.version, electron: pkg.devDependencies.electron, electronBuilder: pkg.devDependencies['electron-builder'],
  gitCommit: git('rev-parse', 'HEAD'), gitDirty: git('status', '--porcelain') !== '', builtOn: `${process.platform}/${process.arch} node ${process.version}`,
  signed: false, signedNote: 'Installateur NON signé (pas de certificat de signature de code) : SmartScreen affichera un avertissement.',
  dataClass: 'synthetic/test', provenanceNote: 'gitCommit/gitDirty décrivent l\'arbre au moment de CE manifeste, pas nécessairement celui de la construction : pour une provenance stricte, reconstruire sur un arbre propre (gitDirty=false) puis générer le manifeste dans la foulée.',
  note: 'Toutes les données de démonstration sont synthétiques. Windows réel : voir docs/WINDOWS-VALIDATION.md.',
};
writeFileSync(join(REL, 'RELEASE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(REL, 'SHA256SUMS.txt'), `${sha256} *${exe}\n`);
console.log(JSON.stringify(manifest, null, 2));
