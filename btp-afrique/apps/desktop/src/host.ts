/**
 * Port d'hôte : tout ce que l'interface demande au « système » passe ici (ADR-0010). Le renderer n'appelle jamais Node, Electron ni Tauri.
 * Implémentations : `DevHttpHost` (serveur de développement Vite, packs vérifiés par Node) ; hôte Electron à écrire à l'étape suivante.
 */
import type { ResolvedPack } from '../../../src/core/pack/types.js';
import type { BtpHostBridge, FileKind, IpcResult } from '../shared/ipc.js';

export interface HostApi {
  /** packs marché installés, DÉJÀ vérifiés (schéma, empreinte, signature) et résolus par l'hôte */
  listPacks(): Promise<ResolvedPack[]>;
  /** enregistre un fichier produit par l'application (téléchargement en développement ; boîte « Enregistrer sous » en desktop) */
  saveFile(name: string, bytes: Uint8Array, mediaType: string): Promise<void>;
  /** horloge de l'application (le noyau n'en a pas) */
  today(): string;
  nowMs(): number;
  /** sélecteur de fichier natif (desktop). Absent en développement navigateur : l'interface utilise alors un <input type=file>. */
  pickFile?(kind: FileKind): Promise<{ name: string; bytes: Uint8Array } | null>;
  /** informe l'hôte de modifications non enregistrées (confirmation à la fermeture) */
  setDirty?(dirty: boolean): void;
}

export const DevHttpHost: HostApi = {
  async listPacks() {
    const r = await fetch('/host/packs.json'); if (!r.ok) throw new Error(`Hôte : packs indisponibles (${r.status})`);
    return (await r.json()) as ResolvedPack[];
  },
  async saveFile(name, bytes, mediaType) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mediaType }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
  today() { return new Date().toISOString().slice(0, 10); },
  nowMs() { return Date.now(); },
};

const unwrap = <T,>(r: IpcResult<T>): T => { if (!r.ok) throw new Error(r.error); return r.value; };
/** Hôte Electron : tout passe par le pont du preload (IPC explicite, sans accès Node). */
export const electronHost = (b: BtpHostBridge): HostApi => ({
  async listPacks() { return unwrap(await b.listPacks()) as ResolvedPack[]; },
  async saveFile(name, bytes, mediaType) { unwrap(await b.saveFile(name, bytes, mediaType)); },
  today() { return new Date().toISOString().slice(0, 10); },
  nowMs() { return Date.now(); },
  async pickFile(kind) { return unwrap(await b.pickFile(kind)); },
  setDirty(d) { b.setDirty(d); },
});
