import { describe, expect, it, vi } from 'vitest'
import { createNasServicesClient, NAS_SERVICES_URL } from './nas-services-client'

function fetchNasServices(deps: Parameters<typeof createNasServicesClient>[0]) {
  return createNasServicesClient(deps)()
}

const KEY = 'cle-de-test'
const PAYLOAD = {
  genere: '2026-11-04T10:00:00Z',
  services: [
    {
      nom: 'Jellyfin',
      groupe: 'Médias',
      etat: 'actif',
      url: 'https://jellyfin.azru.uk/',
      depuis: null
    }
  ]
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('fetchNasServices', () => {
  it('sends the key in X-Orca-Cle and returns the parsed snapshot', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(PAYLOAD))
    const result = await fetchNasServices({ readKey: async () => KEY, fetchImpl })

    expect(result).toEqual({ ok: true, snapshot: PAYLOAD })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(NAS_SERVICES_URL)
    expect(new Headers(init.headers).get('X-Orca-Cle')).toBe(KEY)
    // Why: a redirect must not carry the key to another host.
    expect(init.redirect).toBe('error')
  })

  it('reports a missing key without calling the NAS', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchNasServices({ readKey: async () => null, fetchImpl })

    expect(result).toEqual({ ok: false, reason: 'cle-absente' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports a missing key when the keychain read fails', async () => {
    const result = await fetchNasServices({
      readKey: async () => {
        throw new Error('security timed out')
      },
      fetchImpl: vi.fn()
    })
    expect(result).toEqual({ ok: false, reason: 'cle-absente' })
  })

  it('reports a refused key on 403', async () => {
    const result = await fetchNasServices({
      readKey: async () => KEY,
      fetchImpl: async () => jsonResponse({}, 403)
    })
    expect(result).toEqual({ ok: false, reason: 'cle-refusee' })
  })

  it('reports the NAS as unreachable when the network is down', async () => {
    const result = await fetchNasServices({
      readKey: async () => KEY,
      fetchImpl: async () => {
        throw new TypeError('fetch failed')
      }
    })
    expect(result).toEqual({ ok: false, reason: 'injoignable' })
  })

  it('reports the NAS as unreachable on a server error', async () => {
    const result = await fetchNasServices({
      readKey: async () => KEY,
      fetchImpl: async () => jsonResponse({}, 502)
    })
    expect(result).toEqual({ ok: false, reason: 'injoignable' })
  })

  it('reports an invalid answer for broken JSON or a wrong shape', async () => {
    const broken = await fetchNasServices({
      readKey: async () => KEY,
      fetchImpl: async () => new Response('<html>portier</html>', { status: 200 })
    })
    const missingList = await fetchNasServices({
      readKey: async () => KEY,
      fetchImpl: async () => jsonResponse({ services: 'non' })
    })
    expect(broken).toEqual({ ok: false, reason: 'reponse-invalide' })
    expect(missingList).toEqual({ ok: false, reason: 'reponse-invalide' })
  })

  it('reads the keychain once and reuses the key until the NAS refuses it', async () => {
    const readKey = vi.fn(async () => KEY)
    const fetchImpl = vi.fn<(url: string, init: RequestInit) => Promise<Response>>()
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(PAYLOAD))
      .mockResolvedValueOnce(jsonResponse({}, 403))
      .mockResolvedValueOnce(jsonResponse(PAYLOAD))
    const client = createNasServicesClient({ readKey, fetchImpl })

    await client()
    await client()
    expect(readKey).toHaveBeenCalledOnce()
    await client()
    expect(readKey).toHaveBeenCalledTimes(2)
  })

  it('shares one request between overlapping calls', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(PAYLOAD))
    const client = createNasServicesClient({ readKey: async () => KEY, fetchImpl })

    const [first, second] = await Promise.all([client(), client()])
    expect(first).toEqual(second)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('refuses a malformed key without sending it anywhere', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchNasServices({ readKey: async () => 'abc\ndef', fetchImpl })
    expect(result).toEqual({ ok: false, reason: 'cle-refusee' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects a body announced as too large before reading it', async () => {
    const response = new Response('{}', { headers: { 'content-length': '5000000' } })
    const text = vi.spyOn(response, 'text')
    const result = await fetchNasServices({
      readKey: async () => KEY,
      fetchImpl: async () => response
    })
    expect(result).toEqual({ ok: false, reason: 'reponse-invalide' })
    expect(text).not.toHaveBeenCalled()
  })
})
