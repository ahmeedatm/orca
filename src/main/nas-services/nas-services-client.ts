// Fork ahmeedatm/orca: reads the NAS service states for the Services panel.
// Why main and not the renderer: no CORS, and the key never reaches the renderer.
import { readKeychainPassword } from '../macos-keychain/generic-password'
import { parseNasServicesPayload, type NasServicesResult } from '../../shared/nas-services'

export const NAS_SERVICES_URL = 'https://azru.uk/etat/orca.json'
export const NAS_SERVICES_KEYCHAIN_SERVICE = 'orca-nas-azru'
export const NAS_SERVICES_KEYCHAIN_ACCOUNT = 'ahmed'
const REQUEST_TIMEOUT_MS = 10_000
const MAX_BODY_CHARS = 1_000_000
// Why: a key with a newline or non-ASCII byte makes fetch throw with the value in its message.
const VALID_KEY = /^[\x21-\x7e]+$/

type NasServicesClientDeps = {
  readKey: () => Promise<string | null>
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>
}

const defaultDeps: NasServicesClientDeps = {
  readKey: () => readKeychainPassword(NAS_SERVICES_KEYCHAIN_SERVICE, NAS_SERVICES_KEYCHAIN_ACCOUNT),
  fetchImpl: (url, init) => fetch(url, init)
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}

async function readKeySafely(readKey: NasServicesClientDeps['readKey']): Promise<string | null> {
  try {
    return await readKey()
  } catch (error) {
    console.warn('[nas-services] keychain read failed:', errorName(error))
    return null
  }
}

async function readSnapshot(response: Response): Promise<NasServicesResult> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (declaredLength > MAX_BODY_CHARS) {
    return { ok: false, reason: 'reponse-invalide' }
  }
  try {
    const text = await response.text()
    if (text.length > MAX_BODY_CHARS) {
      return { ok: false, reason: 'reponse-invalide' }
    }
    const snapshot = parseNasServicesPayload(JSON.parse(text))
    return snapshot ? { ok: true, snapshot } : { ok: false, reason: 'reponse-invalide' }
  } catch {
    return { ok: false, reason: 'reponse-invalide' }
  }
}

/** One client per process: keeps the key in memory until the NAS refuses it. */
export function createNasServicesClient(
  deps: NasServicesClientDeps = defaultDeps
): () => Promise<NasServicesResult> {
  // Why cache: the panel polls every 30 s; spawning `security` each time is wasteful.
  let cachedKey: string | null = null
  // Why: rapid refresh clicks share one keychain read and one request.
  let inFlight: Promise<NasServicesResult> | null = null

  const fetchOnce = async (): Promise<NasServicesResult> => {
    const key = cachedKey ?? (await readKeySafely(deps.readKey))
    if (!key) {
      return { ok: false, reason: 'cle-absente' }
    }
    if (!VALID_KEY.test(key)) {
      return { ok: false, reason: 'cle-refusee' }
    }

    let response: Response
    try {
      response = await deps.fetchImpl(NAS_SERVICES_URL, {
        headers: { 'X-Orca-Cle': key, Accept: 'application/json' },
        // Why: fetch keeps custom headers across redirects; the key must stay on azru.uk.
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
    } catch (error) {
      console.warn('[nas-services] NAS unreachable:', errorName(error))
      return { ok: false, reason: 'injoignable' }
    }

    if (response.status === 401 || response.status === 403) {
      // Why: Ahmed may fix the keychain item; the next poll must read it again.
      cachedKey = null
      return { ok: false, reason: 'cle-refusee' }
    }
    cachedKey = key
    if (!response.ok) {
      console.warn('[nas-services] NAS answered', response.status)
      return { ok: false, reason: 'injoignable' }
    }
    return readSnapshot(response)
  }

  return () => {
    inFlight ??= fetchOnce().finally(() => {
      inFlight = null
    })
    return inFlight
  }
}

export const fetchNasServices = createNasServicesClient()
