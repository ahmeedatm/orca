// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import type { NasServicesState } from '@/components/services/nas-services-poller'
import ServicesSidebarEntry from './ServicesSidebarEntry'

const servicesState = vi.hoisted(() => ({
  current: { loading: true, snapshot: null, failure: null } as NasServicesState
}))

vi.mock('@/components/services/nas-services-poller', () => ({
  useNasServices: () => servicesState.current
}))

const initialState = useAppStore.getInitialState()

beforeEach(() => {
  useAppStore.setState({
    servicesDrawerOpen: false,
    agentDashboardDrawerOpen: false
  })
})

afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

describe('ServicesSidebarEntry', () => {
  it('shows error, asleep and running counts, hiding zeros', () => {
    servicesState.current = {
      loading: false,
      failure: null,
      snapshot: {
        genere: '2026-11-04T10:00:00Z',
        services: [
          { nom: 'A', groupe: 'G', etat: 'erreur', url: null, depuis: null },
          { nom: 'B', groupe: 'G', etat: 'actif', url: null, depuis: null },
          { nom: 'C', groupe: 'G', etat: 'actif', url: null, depuis: null }
        ]
      }
    }
    render(<ServicesSidebarEntry />)

    expect(screen.getByLabelText('Error: 1')).toBeTruthy()
    expect(screen.getByLabelText('Running: 2')).toBeTruthy()
    expect(screen.queryByLabelText(/Asleep/)).toBeNull()
  })

  it('flags a failure when there is no list yet', () => {
    servicesState.current = {
      loading: false,
      snapshot: null,
      failure: 'cle-absente'
    }
    render(<ServicesSidebarEntry />)
    expect(screen.getByLabelText('Services unavailable')).toBeTruthy()
  })

  it('toggles the drawer and closes the agent dashboard when opening', () => {
    useAppStore.setState({ agentDashboardDrawerOpen: true })
    render(<ServicesSidebarEntry />)

    fireEvent.click(screen.getByRole('button', { name: /Services/ }))
    expect(useAppStore.getState().servicesDrawerOpen).toBe(true)
    expect(useAppStore.getState().agentDashboardDrawerOpen).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Services/ }))
    expect(useAppStore.getState().servicesDrawerOpen).toBe(false)
  })
})
