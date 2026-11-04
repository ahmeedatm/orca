import type { NasServiceState } from '../../../../shared/nas-services'
import { translate } from '@/i18n/i18n'

// Why these colours: same pips as the Agent Dashboard entry (done = emerald,
// idle = neutral), errors take the destructive token from the style guide.
export const NAS_SERVICE_DOT_CLASS: Record<NasServiceState, string> = {
  erreur: 'bg-destructive',
  veille: 'bg-neutral-500/50',
  actif: 'bg-emerald-500',
  inconnu: 'border border-neutral-500/60'
}

export function nasServiceStateLabel(state: NasServiceState): string {
  switch (state) {
    case 'erreur':
      return translate('services.state.erreur', 'Error')
    case 'veille':
      return translate('services.state.veille', 'Asleep')
    case 'actif':
      return translate('services.state.actif', 'Running')
    case 'inconnu':
      return translate('services.state.inconnu', 'Not checked yet')
  }
}
