import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, SaveDataPayload, TaroNoteApi } from '../shared/types';

// preload 只暴露白名单 API，渲染进程不能直接访问 Node 或 Electron 原生模块。
const api: TaroNoteApi = {
  getState: () => ipcRenderer.invoke('data:get'),
  saveData: (payload: SaveDataPayload) => ipcRenderer.invoke('data:save', payload),
  copyNote: (noteId: string) => ipcRenderer.invoke('notes:copy', noteId),
  applySettings: (settings: AppSettings) => ipcRenderer.invoke('settings:apply', settings),
  exportData: () => ipcRenderer.invoke('dialog:export'),
  importData: () => ipcRenderer.invoke('dialog:import'),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  getPlatform: () => ipcRenderer.invoke('system:get-platform'),
  startResize: (edges, pointerX, pointerY) => ipcRenderer.invoke('window:resize-start', edges, pointerX, pointerY),
  resize: (pointerX, pointerY) => ipcRenderer.invoke('window:resize', pointerX, pointerY),
  endResize: () => ipcRenderer.invoke('window:resize-end'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowState: (callback) => {
    const listener = (_event: unknown, state: { maximized: boolean }) => callback(state);
    ipcRenderer.on('window:state', listener);
    return () => ipcRenderer.removeListener('window:state', listener);
  },
  // 监听主进程菜单事件，并返回清理函数，避免热更新时重复绑定。
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('ui:open-settings', listener);
    return () => ipcRenderer.removeListener('ui:open-settings', listener);
  },
};

contextBridge.exposeInMainWorld('taroNote', api);
