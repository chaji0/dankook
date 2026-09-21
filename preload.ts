import { contextBridge, ipcRenderer } from 'electron'
import type { AppState } from '../src/lib/types'

export type Mode = 'collapsed' | 'expanded' | 'settings'

export interface ImportResult {
  canceled: boolean
  state?: AppState
  warnings?: string[]
  error?: string
}

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('state:get'),
  patchState: (partial: Partial<AppState>): Promise<AppState> => ipcRenderer.invoke('state:patch', partial),
  setMode: (mode: Mode): Promise<Mode> => ipcRenderer.invoke('ui:setMode', mode),
  getMode: (): Promise<Mode> => ipcRenderer.invoke('ui:getMode'),
  onMode: (cb: (mode: Mode) => void) => {
    const listener = (_e: unknown, mode: Mode) => cb(mode)
    ipcRenderer.on('ui:mode', listener)
    return () => {
      ipcRenderer.off('ui:mode', listener)
    }
  },
  dragStart: (offset: { x: number; y: number }) => ipcRenderer.send('drag:start', offset),
  dragMove: (point: { x: number; y: number }) => ipcRenderer.send('drag:move', point),
  importExcel: (): Promise<ImportResult> => ipcRenderer.invoke('excel:import'),
  clearExcel: (): Promise<AppState> => ipcRenderer.invoke('excel:clear'),
  quit: () => ipcRenderer.invoke('app:quit'),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
}

contextBridge.exposeInMainWorld('bear', api)

export type BearApi = typeof api
