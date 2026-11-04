import { useSyncExternalStore } from 'react'
import type {
  NasServicesFailure,
  NasServicesResult,
  NasServicesSnapshot
} from '../../../../shared/nas-services'

export const NAS_SERVICES_REFRESH_MS = 30_000
// Why: the network is often down right after wake (Tailscale), so back off instead of hammering.
export const NAS_SERVICES_RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000]

export type NasServicesState = {
  loading: boolean
  /** Last good list; kept when a later refresh fails. */
  snapshot: NasServicesSnapshot | null
  failure: NasServicesFailure | null
}

export type NasServicesPoller = {
  subscribe: (listener: () => void) => () => void
  getState: () => NasServicesState
  refresh: () => void
}

function retryDelay(failures: number): number {
  return NAS_SERVICES_RETRY_DELAYS_MS[
    Math.min(failures - 1, NAS_SERVICES_RETRY_DELAYS_MS.length - 1)
  ]
}

/** Polls only while something listens (sidebar entry or drawer mounted). */
export function createNasServicesPoller(
  fetcher: () => Promise<NasServicesResult>
): NasServicesPoller {
  let state: NasServicesState = {
    loading: true,
    snapshot: null,
    failure: null
  }
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  // Why: a result from a cycle that was stopped or restarted must not schedule a second loop.
  let generation = 0

  const emit = (next: NasServicesState): void => {
    state = next
    listeners.forEach((listener) => listener())
  }

  const run = async (cycle: number): Promise<void> => {
    let result: NasServicesResult
    try {
      result = await fetcher()
    } catch {
      result = { ok: false, reason: 'injoignable' }
    }
    if (cycle !== generation) {
      return
    }
    failures = result.ok ? 0 : failures + 1
    emit(
      result.ok
        ? { loading: false, snapshot: result.snapshot, failure: null }
        : { loading: false, snapshot: state.snapshot, failure: result.reason }
    )
    timer = setTimeout(
      () => void run(cycle),
      result.ok ? NAS_SERVICES_REFRESH_MS : retryDelay(failures)
    )
  }

  const restart = (): void => {
    clearTimeout(timer)
    generation += 1
    void run(generation)
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      if (listeners.size === 1) {
        restart()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          clearTimeout(timer)
          generation += 1
        }
      }
    },
    getState: () => state,
    refresh: () => {
      // Why: without listeners nothing would ever stop the loop.
      if (listeners.size === 0) {
        return
      }
      emit({ ...state, loading: true })
      restart()
    }
  }
}

export const nasServicesPoller = createNasServicesPoller(() => window.api.nasServices.get())

export function useNasServices(): NasServicesState {
  return useSyncExternalStore(nasServicesPoller.subscribe, nasServicesPoller.getState)
}
