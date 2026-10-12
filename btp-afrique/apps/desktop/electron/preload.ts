/** Preload (sandbox) : expose une API MINIMALE et typée. Aucun accès à Node, fs, shell ni ipcRenderer pour la page. */
import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type BtpHostBridge } from '../shared/ipc.js';

const bridge: BtpHostBridge = {
  listPacks: () => ipcRenderer.invoke(CHANNELS.listPacks),
  pickFile: (kind) => ipcRenderer.invoke(CHANNELS.pickFile, kind),
  saveFile: (name, bytes, mediaType) => ipcRenderer.invoke(CHANNELS.saveFile, name, bytes, mediaType),
  setDirty: (dirty) => ipcRenderer.send(CHANNELS.setDirty, !!dirty),
  appInfo: () => ipcRenderer.invoke(CHANNELS.appInfo),
};
contextBridge.exposeInMainWorld('btpHost', Object.freeze(bridge));
