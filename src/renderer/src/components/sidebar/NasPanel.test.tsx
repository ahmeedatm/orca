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

vi.mock('@/components/browser-pane/host-guest/webview-registry', () => ({
  moveFocusToRendererBeforeWebviewDetach: vi.fn()
}))

const PARTITION = 'persist:orca-browser'
const sessionResolvePartition = vi.fn(async () => PARTITION)

let container: HTMLDivElement
let root: Root

async function render(hidden = false): Promise<void> {
  await act(async () => root.render(<NasPanel hidden={hidden} />))
}

function webview(): HTMLElement | null {
  return container.querySelector('webview')
}

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { browser: { sessionResolvePartition } }
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('NasPanel', () => {
  it('loads the NAS page in the resolved browser partition', async () => {
    await render()
    expect(webview()?.getAttribute('partition')).toBe(PARTITION)
    expect(webview()?.getAttribute('src')).toBe(NAS_PANEL_URL)
  })

  it('keeps the webview attached and remembers the choice when collapsed', async () => {
    await render()
    const toggle = container.querySelector('button')
    act(() => toggle?.click())
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    expect(window.localStorage.getItem(NAS_PANEL_COLLAPSED_STORAGE_KEY)).toBe('1')
    expect(webview()).not.toBeNull()
  })

  it('starts collapsed when it was collapsed before', async () => {
    window.localStorage.setItem(NAS_PANEL_COLLAPSED_STORAGE_KEY, '1')
    await render()
    expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps the same webview when hidden by the agents view', async () => {
    await render()
    const first = webview()
    await render(true)
    expect(container.querySelector('section')?.className).toContain('hidden')
    expect(webview()).toBe(first)
  })

  it('reloads the NAS URL after a failed load', async () => {
    vi.useFakeTimers()
    await render()
    const guest = webview()
    const loadURL = vi.fn(async () => {})
    Object.assign(guest ?? {}, { loadURL })
    const failure = Object.assign(new Event('did-fail-load'), {
      errorCode: -106,
      isMainFrame: true,
      errorDescription: 'ERR_INTERNET_DISCONNECTED'
    })
    guest?.dispatchEvent(failure)
    vi.advanceTimersByTime(NAS_PANEL_RETRY_DELAYS_MS[0])
    expect(loadURL).toHaveBeenCalledWith(NAS_PANEL_URL)
  })

  it('removes the webview on unmount', async () => {
    await render()
    act(() => root.unmount())
    expect(webview()).toBeNull()
    root = createRoot(container)
  })

  it('backs off then stays on the longest retry delay', () => {
    expect(nasPanelRetryDelay(0)).toBe(NAS_PANEL_RETRY_DELAYS_MS[0])
    expect(nasPanelRetryDelay(99)).toBe(NAS_PANEL_RETRY_DELAYS_MS.at(-1))
  })
})
