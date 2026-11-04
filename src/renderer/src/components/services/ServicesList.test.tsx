// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NasService } from '../../../../shared/nas-services'
import { NAS_KEY_COMMAND, ServicesList } from './ServicesList'

afterEach(cleanup)

function service(overrides: Partial<NasService>): NasService {
  return {
    nom: 'Jellyfin',
    groupe: 'Médias',
    etat: 'actif',
    url: null,
    depuis: null,
    ...overrides
  }
}

const snapshot = {
  genere: '2026-11-04T10:00:00Z',
  services: [
    service({ nom: 'Jellyfin', url: 'https://jellyfin.azru.uk' }),
    service({ nom: 'Sonarr', etat: 'erreur' }),
    service({ nom: 'Immich', groupe: 'Photos', etat: 'veille' })
  ]
}

describe('ServicesList', () => {
  it('shows a loading line before the first answer', () => {
    render(
      <ServicesList
        state={{ loading: true, snapshot: null, failure: null }}
        onOpen={vi.fn()}
        onRetry={vi.fn()}
      />
    )
    expect(screen.getByText('Loading services…')).toBeTruthy()
  })

  it('tells how to add the key when it is missing', () => {
    const onRetry = vi.fn()
    render(
      <ServicesList
        state={{ loading: false, snapshot: null, failure: 'cle-absente' }}
        onOpen={vi.fn()}
        onRetry={onRetry}
      />
    )
    expect(screen.getByRole('alert').textContent).toContain('orca-nas-azru')
    expect(screen.getByText(NAS_KEY_COMMAND)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('says the NAS is unreachable without showing the key command', () => {
    render(
      <ServicesList
        state={{ loading: false, snapshot: null, failure: 'injoignable' }}
        onOpen={vi.fn()}
        onRetry={vi.fn()}
      />
    )
    expect(screen.getByRole('alert').textContent).toContain('NAS unreachable')
    expect(screen.queryByText(NAS_KEY_COMMAND)).toBeNull()
  })

  it('shows an empty state when the NAS lists nothing', () => {
    render(
      <ServicesList
        state={{ loading: false, snapshot: { ...snapshot, services: [] }, failure: null }}
        onOpen={vi.fn()}
        onRetry={vi.fn()}
      />
    )
    expect(screen.getByText('The NAS reports no services.')).toBeTruthy()
  })

  it('groups services, errors first, and opens a service url on click', () => {
    const onOpen = vi.fn()
    render(
      <ServicesList
        state={{ loading: false, snapshot, failure: null }}
        onOpen={onOpen}
        onRetry={vi.fn()}
      />
    )
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Médias', 'Photos'])
    const names = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(names).toEqual(['Sonarr', 'Jellyfin', 'Immich'])
    expect(screen.getByRole('img', { name: 'Error' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Jellyfin/ }))
    expect(onOpen).toHaveBeenCalledWith('https://jellyfin.azru.uk')
    expect(screen.getByRole('button', { name: /Sonarr/ }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps the last list visible under a failure notice', () => {
    render(
      <ServicesList
        state={{ loading: false, snapshot, failure: 'injoignable' }}
        onOpen={vi.fn()}
        onRetry={vi.fn()}
      />
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Jellyfin')).toBeTruthy()
  })
})
