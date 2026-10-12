/** Aides pures (testables sans Electron) pour les accès fichiers du processus principal. */
import { FILE_KINDS, type FileKind } from '../shared/ipc.js';

/** Nom de fichier proposé : jamais de chemin, pas de caractères réservés Windows, longueur bornée. */
export function sanitizeFileName(name: unknown): string {
  const raw = typeof name === 'string' ? name : '';
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '').replace(/[. ]+$/, '').slice(0, 120);
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(cleaned);
  return cleaned && !reserved ? cleaned : 'document';
}
export function isFileKind(k: unknown): k is FileKind { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(FILE_KINDS, k); }
export function checkSize(kind: FileKind, bytes: number): string | null {
  const max = FILE_KINDS[kind].maxBytes; return bytes > max ? `Fichier trop volumineux (${Math.round(bytes / 1048576)} Mo, maximum ${Math.round(max / 1048576)} Mo)` : null;
}
/** Extensions d'enregistrement autorisées selon le type MIME produit par l'application. */
export const SAVE_TYPES: Record<string, { ext: string; label: string }> = {
  'application/zip': { ext: 'btpx', label: 'Projet BTP (.btpx)' },
  'application/pdf': { ext: 'pdf', label: 'PDF' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', label: 'Excel (.xlsx)' },
  'text/markdown': { ext: 'md', label: 'Markdown' },
};
export const MAX_SAVE_BYTES = 512 * 1024 * 1024;
/** Force l'extension attendue pour le type MIME (le renderer ne peut pas faire écrire un .exe). */
export function withExpectedExtension(name: string, mediaType: string): string | null {
  const t = SAVE_TYPES[mediaType]; if (!t) return null;
  return name.toLowerCase().endsWith('.' + t.ext) ? name : `${name}.${t.ext}`;
}
