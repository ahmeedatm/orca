import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NasServicesResult } from '../../../../shared/nas-services'
import {
  createNasServicesPoller,
  NAS_SERVICES_REFRESH_MS,
  NAS_SERVICES_RETRY_DELAYS_MS
} from './nas-services-poller'

const SNAPSHOT = { genere: '2026-11-04T10:00:00Z', services: [] }
const OK: NasServicesResult = { ok: true, snapshot: SNAPSHOT }
const DOWN: NasServicesResult = { ok: false, reason: 'injoignable' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createNasServicesPoller', () => {
  it('does nothing until someone listens, then fetches at once', async () => {
    const fetcher = vi.fn(async () => OK)
    const poller = createNasServicesPoller(fetcher)
    expect(fetcher).not.toHaveBeenCalled()

    poller.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(poller.getState()).toEqual({ loading: false, snapshot: SNAPSHOT, failure: null })
  })

  it('refreshes every 30 s while listened to and stops when nobody listens', async () => {
    const fetcher = vi.fn(async () => OK)
    const poller = createNasServicesPoller(fetcher)
    const unsubscribe = poller.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(NAS_SERVICES_REFRESH_MS)
    expect(fetcher).toHaveBeenCalledTimes(2)

    unsubscribe()
    await vi.advanceTimersByTimeAsync(NAS_SERVICES_REFRESH_MS * 3)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('backs off after failures and keeps the last good list', async () => {
    const fetcher = vi.fn<() => Promise<NasServicesResult>>()
    fetcher.mockResolvedValueOnce(OK).mockResolvedValue(DOWN)
    const poller = createNasServicesPoller(fetcher)
    poller.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(NAS_SERVICES_REFRESH_MS)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(poller.getState()).toEqual({
      loading: false,
      snapshot: SNAPSHOT,
      failure: 'injoignable'
    })

    await vi.advanceTimersByTimeAsync(NAS_SERVICES_RETRY_DELAYS_MS[0])
    expect(fetcher).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(NAS_SERVICES_RETRY_DELAYS_MS[1] - 1)
    expect(fetcher).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('treats a rejected IPC call as an unreachable NAS', async () => {
    const poller = createNasServicesPoller(async () => {
      throw new Error('ipc closed')
    })
    poller.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    expect(poller.getState().failure).toBe('injoignable')
  })

  it('refresh() fetches now and notifies listeners', async () => {
    const fetcher = vi.fn(async () => OK)
    const poller = createNasServicesPoller(fetcher)
    const listener = vi.fn()
    poller.subscribe(listener)
    await vi.advanceTimersByTimeAsync(0)

    poller.refresh()
    expect(poller.getState().loading).toBe(true)
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(poller.getState().loading).toBe(false)
    expect(listener).toHaveBeenCalled()
  })

  it('keeps a single loop when a listener leaves and comes back during a fetch', async () => {
    let release: (result: NasServicesResult) => void = () => {}
    const fetcher = vi.fn<() => Promise<NasServicesResult>>()
    fetcher.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    fetcher.mockResolvedValue(OK)
    const poller = createNasServicesPoller(fetcher)

    const unsubscribe = poller.subscribe(() => {})
    unsubscribe()
    poller.subscribe(() => {})
    release(DOWN)
    await vi.advanceTimersByTimeAsync(0)
    expect(poller.getState().failure).toBeNull()

    await vi.advanceTimersByTimeAsync(NAS_SERVICES_REFRESH_MS)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('fetches once for two listeners', async () => {
    const fetcher = vi.fn(async () => OK)
    const poller = createNasServicesPoller(fetcher)
    poller.subscribe(() => {})
    poller.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('goes back to the 30 s rhythm after the NAS recovers', async () => {
    const fetcher = vi.fn<() => Promise<NasServicesResult>>()
    fetcher.mockResolvedValueOnce(DOWN).mockResolvedValueOnce(DOWN).mockResolvedValue(OK)
    const poller = createNasServicesPoller(fetcher)
    poller.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(NAS_SERVICES_RETRY_DELAYS_MS[0])
    await vi.advanceTimersByTimeAsync(NAS_SERVICES_RETRY_DELAYS_MS[1])
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(poller.getState().failure).toBeNull()

    await vi.advanceTimersByTimeAsync(NAS_SERVICES_REFRESH_MS)
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('ignores refresh() when nobody listens', async () => {
    const fetcher = vi.fn(async () => OK)
    const poller = createNasServicesPoller(fetcher)
    poller.refresh()
    await vi.advanceTimersByTimeAsync(NAS_SERVICES_REFRESH_MS * 2)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
