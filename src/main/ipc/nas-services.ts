import { ipcMain } from 'electron'
import { fetchNasServices } from '../nas-services/nas-services-client'

// Fork ahmeedatm/orca: the renderer only gets the parsed states, never the key.
export function registerNasServicesHandlers(): void {
  ipcMain.handle('nasServices:get', () => fetchNasServices())
}
