import { useCallback, useEffect, useRef } from 'react'
import { RefreshCw, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import {
  isWorkspaceBoardKeepOpenTarget,
  useWorkspaceKanbanOutsideDismiss
} from '../sidebar/use-workspace-kanban-outside-dismiss'
import {
  STATUS_BAR_RESERVE_HEIGHT,
  WORKSPACE_TOP_CHROME_HEIGHT
} from '../sidebar/workspace-chrome-metrics'
import { nasServicesPoller, useNasServices } from './nas-services-poller'
import { ServicesList } from './ServicesList'

const SERVICES_DRAWER_MAX_WIDTH_PX = 360
const HEADER_BUTTON_CLASS =
  'rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

// Why: like the Agent Dashboard sheet, Escape must first close nested overlays.
const ESCAPE_BLOCKING_OVERLAY_SELECTOR = [
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="context-menu-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
  '[role="dialog"][data-state="open"]:not([data-services-sheet])',
  '[role="alertdialog"][data-state="open"]'
].join(', ')

function ServicesDrawerBody({ onClose }: { onClose: () => void }): React.JSX.Element {
  const state = useNasServices()
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const createBrowserTab = useAppStore((s) => s.createBrowserTab)
  const handleOpen = useCallback(
    (url: string) => {
      // Why never the system browser: Ahmed wants service pages in Orca's browser,
      // not Firefox. The NAS is not host-owned work, so no runtime routing applies.
      if (!activeWorktreeId) {
        toast.info(
          translate(
            'services.drawer.noWorkspace',
            "Open a workspace to show this service in Orca's browser."
          )
        )
        return
      }
      createBrowserTab(activeWorktreeId, url, { activate: true })
      onClose()
    },
    [activeWorktreeId, createBrowserTab, onClose]
  )
  const updated = state.snapshot ? formatUiRelativeTimeFromDate(state.snapshot.genere, '') : ''

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <h1 className="text-[13px] font-semibold">
          {translate('services.drawer.title', 'Services')}
        </h1>
        {updated ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {translate('services.drawer.updated', 'Updated {{time}}', { time: updated })}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={nasServicesPoller.refresh}
            aria-label={translate('services.drawer.refresh', 'Refresh')}
            className={HEADER_BUTTON_CLASS}
          >
            <RefreshCw className={cn('size-3.5', state.loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={translate('services.drawer.close', 'Close')}
            className={HEADER_BUTTON_CLASS}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <ServicesList state={state} onOpen={handleOpen} onRetry={nasServicesPoller.refresh} />
      </div>
    </div>
  )
}

type ServicesDrawerProps = {
  leftSidebarStyle?: React.CSSProperties
  statusBarVisible: boolean
}

/** Non-modal companion sheet beside the sidebar, like the Agent Dashboard drawer. */
export function ServicesDrawer({
  leftSidebarStyle,
  statusBarVisible
}: ServicesDrawerProps): React.JSX.Element {
  const open = useAppStore((s) => s.servicesDrawerOpen)
  const setOpen = useAppStore((s) => s.setServicesDrawerOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const sidebarWidth = useAppStore((s) => s.sidebarWidth)
  const close = useCallback(() => setOpen(false), [setOpen])
  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      // Why: Radix also asks to close on focus moving out; only our own paths may close it.
      if (nextOpen) {
        setOpen(true)
      }
    },
    [setOpen]
  )
  const bodyRef = useRef<HTMLDivElement | null>(null)

  useWorkspaceKanbanOutsideDismiss({
    open,
    boardRef: bodyRef,
    preserveOpenForMenu: false,
    onOpenChange: setOpen
  })

  useEffect(() => {
    if (!open) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || document.querySelector(ESCAPE_BLOCKING_OVERLAY_SELECTOR)) {
        return
      }
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [close, open])

  const drawerLeft = sidebarOpen ? sidebarWidth : 0
  const drawerLeftCss = sidebarOpen
    ? `var(--workspace-sidebar-live-width, ${sidebarWidth}px)`
    : '0px'
  const drawerBottom = `${statusBarVisible ? STATUS_BAR_RESERVE_HEIGHT : 0}px`

  const guardSidebarInteraction = (
    event: CustomEvent<{ originalEvent: PointerEvent | FocusEvent }>
  ): void => {
    const originalEvent = event.detail.originalEvent
    if (isWorkspaceBoardKeepOpenTarget(originalEvent.target)) {
      event.preventDefault()
      return
    }
    const pointerX =
      'clientX' in originalEvent && typeof originalEvent.clientX === 'number'
        ? originalEvent.clientX
        : null
    if (pointerX !== null && pointerX < drawerLeft) {
      // Why: the sidebar stays usable while the drawer is open (the entry toggles it).
      event.preventDefault()
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange} modal={false}>
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="workspace-kanban-sheet-content bg-worktree-sidebar p-0 sm:max-w-none"
        overlayStyle={{
          top: WORKSPACE_TOP_CHROME_HEIGHT,
          bottom: drawerBottom,
          left: drawerLeftCss,
          pointerEvents: 'none'
        }}
        style={
          {
            ...leftSidebarStyle,
            left: drawerLeftCss,
            top: WORKSPACE_TOP_CHROME_HEIGHT,
            bottom: drawerBottom,
            height: 'auto',
            width: `min(calc(100vw - ${drawerLeftCss}), ${SERVICES_DRAWER_MAX_WIDTH_PX}px)`
          } as React.CSSProperties
        }
        data-services-sheet=""
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={guardSidebarInteraction}
        onInteractOutside={guardSidebarInteraction}
      >
        <SheetTitle className="sr-only">
          {translate('services.drawer.title', 'Services')}
        </SheetTitle>
        <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col">
          <ServicesDrawerBody onClose={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
