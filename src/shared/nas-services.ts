// Fork ahmeedatm/orca: contract of GET https://azru.uk/etat/orca.json (nas-stacks).
// Keep in sync with the NAS side; the field names are the contract, in French.

export const NAS_SERVICE_STATES = ['erreur', 'veille', 'actif', 'inconnu'] as const
export type NasServiceState = (typeof NAS_SERVICE_STATES)[number]

export type NasService = {
  nom: string
  groupe: string
  etat: NasServiceState
  url: string | null
  depuis: string | null
}

export type NasServicesSnapshot = {
  genere: string
  services: NasService[]
}

export type NasServicesFailure = 'cle-absente' | 'cle-refusee' | 'injoignable' | 'reponse-invalide'

export type NasServicesResult =
  | { ok: true; snapshot: NasServicesSnapshot }
  | { ok: false; reason: NasServicesFailure }

export type NasServiceGroup = { groupe: string; services: NasService[] }

// Why caps: a compromised NAS must not freeze the renderer with a huge list or names.
const MAX_SERVICES = 500
const MAX_TEXT_LENGTH = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isNasServiceState(value: unknown): value is NasServiceState {
  return NAS_SERVICE_STATES.some((state) => state === value)
}

// Why https only: the renderer opens this url in a browser tab; a crafted
// javascript: or file: link from the NAS must never get there.
function parseHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  try {
    const url = new URL(value)
    const safe = url.protocol === 'https:' && !url.username && !url.password
    return safe ? url.toString() : null
  } catch {
    return null
  }
}

function isShortText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH
}

function parseService(value: unknown): NasService | null {
  if (!isRecord(value)) {
    return null
  }
  const { nom, groupe, etat } = value
  if (!isShortText(nom) || nom.trim() === '' || !isShortText(groupe)) {
    return null
  }
  return {
    nom,
    groupe,
    // Why: a state added later on the NAS must keep the service visible, not hide it.
    etat: isNasServiceState(etat) ? etat : 'inconnu',
    url: parseHttpsUrl(value.url),
    depuis: isDate(value.depuis) ? value.depuis : null
  }
}

/** Returns null when the top-level shape is wrong; drops entries that break the contract. */
export function parseNasServicesPayload(value: unknown): NasServicesSnapshot | null {
  if (!isRecord(value) || !isDate(value.genere) || !Array.isArray(value.services)) {
    return null
  }
  const services = value.services
    .slice(0, MAX_SERVICES)
    .map(parseService)
    .filter((service): service is NasService => service !== null)
  return { genere: value.genere, services }
}

const STATE_RANK: Record<NasServiceState, number> = { erreur: 0, veille: 1, actif: 2, inconnu: 3 }

function compareServices(a: NasService, b: NasService): number {
  return STATE_RANK[a.etat] - STATE_RANK[b.etat] || a.nom.localeCompare(b.nom)
}

/** Groups by `groupe`; groups holding an error come first, errors first inside each group. */
export function groupNasServices(services: readonly NasService[]): NasServiceGroup[] {
  const byGroup = new Map<string, NasService[]>()
  for (const service of services) {
    byGroup.set(service.groupe, [...(byGroup.get(service.groupe) ?? []), service])
  }
  const hasError = (group: NasServiceGroup): number =>
    group.services.some((service) => service.etat === 'erreur') ? 0 : 1
  return [...byGroup]
    .map(([groupe, members]) => ({ groupe, services: [...members].sort(compareServices) }))
    .sort((a, b) => hasError(a) - hasError(b) || a.groupe.localeCompare(b.groupe))
}

export function countNasServiceStates(
  services: readonly NasService[]
): Record<NasServiceState, number> {
  const counts: Record<NasServiceState, number> = {
    erreur: 0,
    veille: 0,
    actif: 0,
    inconnu: 0
  }
  for (const service of services) {
    counts[service.etat] += 1
  }
  return counts
}
