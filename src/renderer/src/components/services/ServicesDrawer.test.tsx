// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { ServicesDrawer } from './ServicesDrawer'

vi.mock('./nas-services-poller', () => ({
  nasServicesPoller: { refresh: vi.fn() },
  useNasServices: () => ({
    loading: false,
    failure: null,
    snapshot: {
      genere: '2026-11-04T10:00:00Z',
      services: [
        {
          nom: 'Jellyfin',
          groupe: 'Médias',
          etat: 'actif',
          url: 'https://jellyfin.azru.uk',
          depuis: null
        }
      ]
    }
  })
}))

const initialState = useAppStore.getInitialState()
const createBrowserTab = vi.fn()

beforeEach(() => {
  createBrowserTab.mockReset()
  useAppStore.setState({
    servicesDrawerOpen: true,
    sidebarOpen: true,
    activeWorktreeId: 'wt-1',
    createBrowserTab
  })
})

afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

describe('ServicesDrawer', () => {
  it('opens a service in an Orca browser tab of the active workspace and closes', () => {
    render(<ServicesDrawer statusBarVisible />)

    fireEvent.click(screen.getByRole('button', { name: /Jellyfin/ }))

    expect(createBrowserTab).toHaveBeenCalledWith('wt-1', 'https://jellyfin.azru.uk', {
      activate: true
    })
    expect(useAppStore.getState().servicesDrawerOpen).toBe(false)
  })

  it('closes on Escape', () => {
    render(<ServicesDrawer statusBarVisible />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(useAppStore.getState().servicesDrawerOpen).toBe(false)
  })

  it('stays in Orca when no workspace is open', () => {
    useAppStore.setState({ activeWorktreeId: null })
    const openUrl = vi.fn()
    Object.assign(window, { api: { shell: { openUrl } } })
    render(<ServicesDrawer statusBarVisible />)

    fireEvent.click(screen.getByRole('button', { name: /Jellyfin/ }))

    expect(createBrowserTab).not.toHaveBeenCalled()
    expect(openUrl).not.toHaveBeenCalled()
    expect(useAppStore.getState().servicesDrawerOpen).toBe(true)
  })
})
