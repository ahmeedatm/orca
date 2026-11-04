// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NasPanel, {
  NAS_PANEL_COLLAPSED_STORAGE_KEY,
  NAS_PANEL_RETRY_DELAYS_MS,
  NAS_PANEL_URL,
  nasPanelRetryDelay
} from './NasPanel'
import { ORCA_BROWSER_PARTITION } from '../../../../shared/constants'

vi.mock('@/components/browser-pane/host-guest/webview-registry', () => ({
  moveFocusToRendererBeforeWebviewDetach: vi.fn()
}))

let container: HTMLDivElement
let root: Root

function render(): void {
  act(() => root.render(<NasPanel />))
}

beforeEach(() => {
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('NasPanel', () => {
  it('loads the NAS page in the shared browser partition', () => {
    render()
    const webview = container.querySelector('webview')
    expect(webview?.getAttribute('partition')).toBe(ORCA_BROWSER_PARTITION)
    expect(webview?.getAttribute('src')).toBe(NAS_PANEL_URL)
  })

  it('keeps the webview attached and remembers the choice when collapsed', () => {
    render()
    const toggle = container.querySelector('button')
    act(() => toggle?.click())
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    expect(window.localStorage.getItem(NAS_PANEL_COLLAPSED_STORAGE_KEY)).toBe('1')
    expect(container.querySelector('webview')).not.toBeNull()
  })

  it('starts collapsed when it was collapsed before', () => {
    window.localStorage.setItem(NAS_PANEL_COLLAPSED_STORAGE_KEY, '1')
    render()
    expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('removes the webview on unmount', () => {
    render()
    act(() => root.unmount())
    expect(container.querySelector('webview')).toBeNull()
    root = createRoot(container)
  })

  it('backs off then stays on the longest retry delay', () => {
    expect(nasPanelRetryDelay(0)).toBe(NAS_PANEL_RETRY_DELAYS_MS[0])
    expect(nasPanelRetryDelay(99)).toBe(NAS_PANEL_RETRY_DELAYS_MS.at(-1))
  })
})
