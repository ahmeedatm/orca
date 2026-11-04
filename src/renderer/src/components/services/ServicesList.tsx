import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { formatUiRelativeTimeFromDate } from '@/i18n/relative-time-format'
import {
  groupNasServices,
  type NasService,
  type NasServicesFailure
} from '../../../../shared/nas-services'
import type { NasServicesState } from './nas-services-poller'
import { NAS_SERVICE_DOT_CLASS, nasServiceStateLabel } from './nas-service-state-style'

export const NAS_KEY_COMMAND = 'security add-generic-password -s orca-nas-azru -a ahmed -w'

function failureMessage(failure: NasServicesFailure): string {
  switch (failure) {
    case 'cle-absente':
      return translate(
        'services.drawer.keyMissing',
        'The NAS key is missing from the macOS Keychain. Add it under orca-nas-azru:'
      )
    case 'cle-refusee':
      return translate(
        'services.drawer.keyRefused',
        'The NAS refused the key. Check the orca-nas-azru item in the Keychain.'
      )
    case 'injoignable':
      return translate('services.drawer.unreachable', 'NAS unreachable. Orca retries on its own.')
    case 'reponse-invalide':
      return translate('services.drawer.invalid', 'The NAS sent an unreadable answer.')
  }
}

function FailureNotice({
  failure,
  onRetry
}: {
  failure: NasServicesFailure
  onRetry: () => void
}): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 px-4 py-3 text-[12px] text-muted-foreground"
    >
      <p>{failureMessage(failure)}</p>
      {failure === 'cle-absente' ? (
        <code className="w-full rounded-md bg-muted px-2 py-1 font-mono text-[11px] break-words text-foreground select-text">
          {NAS_KEY_COMMAND}
        </code>
      ) : null}
      <Button type="button" variant="outline" size="xs" onClick={onRetry}>
        {translate('services.drawer.retry', 'Retry')}
      </Button>
    </div>
  )
}

function ServiceRow({
  service,
  onOpen
}: {
  service: NasService
  onOpen: (url: string) => void
}): React.JSX.Element {
  const url = service.url
  const since = service.depuis ? formatUiRelativeTimeFromDate(service.depuis, '') : ''
  return (
    <li>
      <button
        type="button"
        disabled={!url}
        onClick={url ? () => onOpen(url) : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] tracking-tight transition-colors',
          'text-worktree-sidebar-foreground enabled:hover:bg-worktree-sidebar-foreground/8 disabled:cursor-default'
        )}
      >
        <span
          role="img"
          aria-label={nasServiceStateLabel(service.etat)}
          className={cn('size-1.5 shrink-0 rounded-full', NAS_SERVICE_DOT_CLASS[service.etat])}
        />
        <span className="min-w-0 flex-1 truncate">{service.nom}</span>
        {since ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{since}</span>
        ) : null}
      </button>
    </li>
  )
}

export function ServicesList({
  state,
  onOpen,
  onRetry
}: {
  state: NasServicesState
  onOpen: (url: string) => void
  onRetry: () => void
}): React.JSX.Element {
  const { snapshot, failure, loading } = state
  if (!snapshot) {
    if (failure && !loading) {
      return <FailureNotice failure={failure} onRetry={onRetry} />
    }
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-[12px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {translate('services.drawer.loading', 'Loading services…')}
      </div>
    )
  }

  const groups = groupNasServices(snapshot.services)
  const otherGroupLabel = translate('services.drawer.otherGroup', 'Other')
  return (
    <>
      {failure ? <FailureNotice failure={failure} onRetry={onRetry} /> : null}
      {groups.length === 0 ? (
        <p className="px-4 py-3 text-[12px] text-muted-foreground">
          {translate('services.drawer.empty', 'The NAS reports no services.')}
        </p>
      ) : (
        <div className="flex flex-col gap-2 px-2 py-2">
          {groups.map((group) => (
            <section key={group.groupe} aria-label={group.groupe || otherGroupLabel}>
              <h2 className="px-2 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {group.groupe || otherGroupLabel}
              </h2>
              <ul className="flex flex-col">
                {group.services.map((service, index) => (
                  // Why the index: the NAS may list two services with the same name.
                  <ServiceRow key={`${service.nom}-${index}`} service={service} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
