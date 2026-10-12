/** Contrat IPC renderer ↔ main : liste FERMÉE de canaux, charges utiles sérialisables, aucun chemin fourni par le renderer. */
export const CHANNELS = {
  listPacks: 'btp:packs:list',
  pickFile: 'btp:file:pick',
  saveFile: 'btp:file:save',
  setDirty: 'btp:window:set-dirty',
  appInfo: 'btp:app:info',
} as const;
export type FileKind = 'btpx' | 'plan';
export const FILE_KINDS: Record<FileKind, { title: string; extensions: string[]; maxBytes: number }> = {
  btpx: { title: 'Projet BTP (.btpx)', extensions: ['btpx'], maxBytes: 512 * 1024 * 1024 },
  plan: { title: 'Plan (PDF, PNG, JPEG)', extensions: ['pdf', 'png', 'jpg', 'jpeg'], maxBytes: 256 * 1024 * 1024 },
};
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string };
export interface PickedFile { name: string; bytes: Uint8Array }
export interface AppInfo { name: string; version: string; electron: string; packaged: boolean; platform: string }
/** API exposée au renderer par le preload (via contextBridge) — c'est TOUT ce que le renderer peut demander au système. */
export interface BtpHostBridge {
  listPacks(): Promise<IpcResult<unknown[]>>;
  pickFile(kind: FileKind): Promise<IpcResult<PickedFile | null>>;
  saveFile(suggestedName: string, bytes: Uint8Array, mediaType: string): Promise<IpcResult<{ saved: boolean }>>;
  setDirty(dirty: boolean): void;
  appInfo(): Promise<IpcResult<AppInfo>>;
}
