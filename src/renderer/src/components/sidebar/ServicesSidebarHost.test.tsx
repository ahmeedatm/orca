// @vitest-environment happy-dom

import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import ServicesSidebarHost from './ServicesSidebarHost'

vi.mock('@/components/services/ServicesDrawer', () => ({ ServicesDrawer: () => null }))

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

function host(props: Partial<React.ComponentProps<typeof ServicesSidebarHost>> = {}) {
  return (
    <ServicesSidebarHost
      sidebarOpen
      workspaceBoardOpen={false}
      closeWorkspaceBoard={vi.fn()}
      statusBarVisible
      {...props}
    />
  )
}

describe('ServicesSidebarHost', () => {
  it('closes the drawer when the workspace board opens', async () => {
    useAppStore.setState({ servicesDrawerOpen: true })
    render(host({ workspaceBoardOpen: true }))
    await waitFor(() => expect(useAppStore.getState().servicesDrawerOpen).toBe(false))
  })

  it('closes the workspace board when the drawer opens', async () => {
    const closeWorkspaceBoard = vi.fn()
    render(host({ closeWorkspaceBoard }))
    act(() => useAppStore.setState({ servicesDrawerOpen: true }))
    await waitFor(() => expect(closeWorkspaceBoard).toHaveBeenCalledOnce())
  })

  it('closes the drawer when the agent dashboard opens', async () => {
    useAppStore.setState({ servicesDrawerOpen: true })
    render(host())
    act(() => useAppStore.setState({ agentDashboardDrawerOpen: true }))
    await waitFor(() => expect(useAppStore.getState().servicesDrawerOpen).toBe(false))
  })

  it('clears an open drawer when the sidebar closes', async () => {
    useAppStore.setState({ servicesDrawerOpen: true })
    render(host({ sidebarOpen: false }))
    await waitFor(() => expect(useAppStore.getState().servicesDrawerOpen).toBe(false))
  })
})
