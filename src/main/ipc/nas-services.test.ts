import { describe, expect, it, vi } from 'vitest'

const ipcState = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcState.handlers.set(channel, handler)
    }
  }
}))

const fetchNasServices = vi.hoisted(() => vi.fn())
vi.mock('../nas-services/nas-services-client', () => ({ fetchNasServices }))

import { registerNasServicesHandlers } from './nas-services'

describe('registerNasServicesHandlers', () => {
  it('answers nasServices:get with the client result and ignores renderer arguments', async () => {
    fetchNasServices.mockResolvedValue({ ok: false, reason: 'cle-absente' })
    registerNasServicesHandlers()

    const handler = ipcState.handlers.get('nasServices:get')
    await expect(handler?.({}, 'https://evil.example')).resolves.toEqual({
      ok: false,
      reason: 'cle-absente'
    })
    expect(fetchNasServices).toHaveBeenCalledWith()
  })
})
