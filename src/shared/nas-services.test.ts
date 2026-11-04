import { describe, expect, it } from 'vitest'
import {
  countNasServiceStates,
  groupNasServices,
  parseNasServicesPayload,
  type NasService
} from './nas-services'

const GENERE = '2026-11-04T10:00:00Z'

function service(overrides: Partial<NasService> = {}): NasService {
  return {
    nom: 'Jellyfin',
    groupe: 'Médias',
    etat: 'actif',
    url: 'https://jellyfin.azru.uk/',
    depuis: '2026-11-04T09:00:00Z',
    ...overrides
  }
}

describe('parseNasServicesPayload', () => {
  it('accepts a payload that follows the contract', () => {
    const payload = {
      genere: GENERE,
      services: [service(), service({ nom: 'Gatus', url: null, depuis: null })]
    }
    expect(parseNasServicesPayload(payload)).toEqual(payload)
  })

  it('rejects a payload without the top-level shape', () => {
    expect(parseNasServicesPayload(null)).toBeNull()
    expect(parseNasServicesPayload([])).toBeNull()
    expect(parseNasServicesPayload({ genere: GENERE })).toBeNull()
    expect(parseNasServicesPayload({ genere: 42, services: [] })).toBeNull()
    expect(parseNasServicesPayload({ genere: 'pas une date', services: [] })).toBeNull()
  })

  it('drops entries with wrong types and shows unknown states as inconnu', () => {
    const payload = {
      genere: GENERE,
      services: [
        service(),
        { ...service(), nom: 'Sonarr', etat: 'panne' },
        { ...service(), nom: '' },
        { ...service(), groupe: 3 },
        { ...service(), nom: 'x'.repeat(201) },
        'Jellyfin'
      ]
    }
    expect(parseNasServicesPayload(payload)?.services).toEqual([
      service(),
      service({ nom: 'Sonarr', etat: 'inconnu' })
    ])
  })

  it('caps the list at 500 services', () => {
    const payload = { genere: GENERE, services: Array.from({ length: 600 }, () => service()) }
    expect(parseNasServicesPayload(payload)?.services).toHaveLength(500)
  })

  it('keeps only https links so a crafted url cannot run in the browser tab', () => {
    const payload = {
      genere: GENERE,
      services: [
        service({ url: 'javascript:alert(1)' }),
        service({ url: 'http://jellyfin.azru.uk' }),
        service({ url: 'pas une url' }),
        service({ url: 'https://ahmed:secret@jellyfin.azru.uk' })
      ]
    }
    expect(parseNasServicesPayload(payload)?.services.map((s) => s.url)).toEqual([
      null,
      null,
      null,
      null
    ])
  })

  it('turns an unreadable depuis into null', () => {
    const payload = { genere: GENERE, services: [service({ depuis: 'hier' })] }
    expect(parseNasServicesPayload(payload)?.services[0].depuis).toBeNull()
  })
})

describe('groupNasServices', () => {
  it('puts groups with errors first and errors first inside a group', () => {
    const groups = groupNasServices([
      service({ nom: 'Jellyfin', groupe: 'Médias' }),
      service({ nom: 'Immich', groupe: 'Photos', etat: 'veille' }),
      service({ nom: 'Sonarr', groupe: 'Médias', etat: 'erreur' }),
      service({ nom: 'Bazarr', groupe: 'Médias', etat: 'actif' })
    ])
    expect(groups.map((g) => g.groupe)).toEqual(['Médias', 'Photos'])
    expect(groups[0].services.map((s) => s.nom)).toEqual(['Sonarr', 'Bazarr', 'Jellyfin'])
  })

  it('sorts groups without errors by name', () => {
    const groups = groupNasServices([service({ groupe: 'Outils' }), service({ groupe: 'Maison' })])
    expect(groups.map((g) => g.groupe)).toEqual(['Maison', 'Outils'])
  })
})

describe('countNasServiceStates', () => {
  it('counts each state', () => {
    expect(
      countNasServiceStates([
        service({ etat: 'erreur' }),
        service({ etat: 'veille' }),
        service({ etat: 'actif' }),
        service({ etat: 'actif' })
      ])
    ).toEqual({ erreur: 1, veille: 1, actif: 2, inconnu: 0 })
  })
})
