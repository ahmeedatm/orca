import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE } from '../../../../shared/browser-guest-web-preferences'
import { moveFocusToRendererBeforeWebviewDetach } from '@/components/browser-pane/host-guest/webview-registry'
import { cn } from '@/lib/utils'

// Fork ahmeedatm/orca: NAS status page (nas-stacks, homepage/config/orca.html).
export const NAS_PANEL_URL = 'https://azru.uk/ck/orca.html'
export const NAS_PANEL_COLLAPSED_STORAGE_KEY = 'orca.nasPanel.collapsed'
// Why: the network is often down right after wake (Tailscale), so back off instead of giving up.
export const NAS_PANEL_RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000]
const LOAD_ABORTED_ERROR_CODE = -3

export function nasPanelRetryDelay(attempt: number): number {
  return NAS_PANEL_RETRY_DELAYS_MS[Math.min(attempt, NAS_PANEL_RETRY_DELAYS_MS.length - 1)]
}

function readCollapsed(): boolean {
  return window.localStorage.getItem(NAS_PANEL_COLLAPSED_STORAGE_KEY) === '1'
}

function attachNasWebview(container: HTMLDivElement, partition: string): () => void {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Electron upgrades a created <webview> element into a WebviewTag.
  const webview = document.createElement('webview') as Electron.WebviewTag
  // Why the browser partition: the gate login done in an Orca browser tab also unlocks this panel.
  webview.setAttribute('partition', partition)
  webview.setAttribute('webpreferences', ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE)
  webview.setAttribute('aria-label', 'NAS')
  webview.style.display = 'flex'
  webview.style.width = '100%'
  webview.style.height = '100%'

  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  const onLoadFailed = (event: Electron.DidFailLoadEvent): void => {
    if (event.errorCode === LOAD_ABORTED_ERROR_CODE || !event.isMainFrame) {
      return
    }
    const delay = nasPanelRetryDelay(attempt)
    attempt += 1
    console.warn('[nas-panel] load failed, retrying in', delay, 'ms:', event.errorDescription)
    clearTimeout(retryTimer)
    // Why loadURL, not reload: reload only refreshes the chrome-error page left by the failure.
    retryTimer = setTimeout(() => {
      try {
        void webview.loadURL(NAS_PANEL_URL).catch(() => {})
      } catch {
        webview.setAttribute('src', NAS_PANEL_URL)
      }
    }, delay)
  }
  const onLoaded = (): void => {
    attempt = 0
  }
  webview.addEventListener('did-fail-load', onLoadFailed)
  webview.addEventListener('did-finish-load', onLoaded)
  container.appendChild(webview)
  webview.setAttribute('src', NAS_PANEL_URL)

  return () => {
    clearTimeout(retryTimer)
    webview.removeEventListener('did-fail-load', onLoadFailed)
    webview.removeEventListener('did-finish-load', onLoaded)
    moveFocusToRendererBeforeWebviewDetach(webview)
    webview.remove()
  }
}

function NasPanel({ hidden }: { hidden: boolean }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let disposed = false
    let detach: (() => void) | undefined
    void window.api.browser
      .sessionResolvePartition({ profileId: null })
      .then((partition) => {
        if (!disposed && partition && containerRef.current) {
          detach = attachNasWebview(containerRef.current, partition)
        }
      })
      .catch((error: unknown) => console.warn('[nas-panel] no browser partition:', error))
    return () => {
      disposed = true
      detach?.()
    }
  }, [])

  const toggle = (): void => {
    const next = !collapsed
    window.localStorage.setItem(NAS_PANEL_COLLAPSED_STORAGE_KEY, next ? '1' : '0')
    setCollapsed(next)
  }

  return (
    <section
      aria-label="NAS"
      className={cn(
        'flex shrink-0 flex-col border-t border-worktree-sidebar-border',
        hidden && 'hidden'
      )}
    >
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={toggle}
        className="mt-1 flex h-8 items-center justify-between px-4 text-xs font-semibold text-muted-foreground/80 select-none hover:text-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
      >
        <span>NAS</span>
        <ChevronDown
          className={cn(
            'size-3 transition-transform duration-200 motion-reduce:transition-none',
            collapsed && '-rotate-90'
          )}
          aria-hidden
        />
      </button>
      {/* Why hidden, not unmounted: reattaching the webview reloads the page and loses its login. */}
      <div ref={containerRef} className={cn('h-[min(340px,40vh)]', collapsed && 'hidden')} />
    </section>
  )
}

export default React.memo(NasPanel)
