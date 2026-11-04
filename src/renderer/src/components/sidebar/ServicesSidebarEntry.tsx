import { CircleAlert, Server } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { countNasServiceStates, type NasServiceState } from '../../../../shared/nas-services'
import { useNasServices } from '@/components/services/nas-services-poller'
import {
  NAS_SERVICE_DOT_CLASS,
  nasServiceStateLabel
} from '@/components/services/nas-service-state-style'

// Fork ahmeedatm/orca: Services entry, same pip counters as the Agent Dashboard entry.
const COUNTED_STATES: NasServiceState[] = ['erreur', 'veille', 'actif']

export default function ServicesSidebarEntry(): React.JSX.Element {
  const { snapshot, failure } = useNasServices()
  const drawerOpen = useAppStore((s) => s.servicesDrawerOpen)
  const setServicesDrawerOpen = useAppStore((s) => s.setServicesDrawerOpen)
  const setAgentDashboardDrawerOpen = useAppStore((s) => s.setAgentDashboardDrawerOpen)
  const counts = snapshot ? countNasServiceStates(snapshot.services) : null

  return (
    <button
      type="button"
      aria-expanded={drawerOpen}
      onClick={() => {
        if (!drawerOpen) {
          // Why: one companion drawer at a time beside the sidebar.
          setAgentDashboardDrawerOpen(false)
        }
        setServicesDrawerOpen(!drawerOpen)
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <Server className="size-4 shrink-0 text-worktree-sidebar-foreground/30" strokeWidth={1.75} />
      <span className="flex-1">{translate('services.sidebar.label', 'Services')}</span>
      <span className="flex items-center gap-1.5">
        {counts
          ? COUNTED_STATES.filter((state) => counts[state] > 0).map((state) => (
              <span
                key={state}
                aria-label={`${nasServiceStateLabel(state)}: ${counts[state]}`}
                className="inline-flex items-center gap-1 text-[10px] tabular-nums text-worktree-sidebar-foreground/55"
              >
                <span className={cn('size-1.5 rounded-full', NAS_SERVICE_DOT_CLASS[state])} />
                {counts[state]}
              </span>
            ))
          : null}
        {!counts && failure ? (
          <CircleAlert
            aria-label={translate('services.sidebar.unavailable', 'Services unavailable')}
            className="size-3 text-worktree-sidebar-foreground/45"
          />
        ) : null}
      </span>
    </button>
  )
}
