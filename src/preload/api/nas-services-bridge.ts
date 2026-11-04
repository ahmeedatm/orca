import { ipcRenderer } from 'electron'
import type { NasServicesResult } from '../../shared/nas-services'

// Fork ahmeedatm/orca: Services panel. Main reads the key; the renderer only sees states.
export type NasServicesApi = {
  get: () => Promise<NasServicesResult>
}

export const nasServicesApi: NasServicesApi = { get: () => ipcRenderer.invoke('nasServices:get') }
