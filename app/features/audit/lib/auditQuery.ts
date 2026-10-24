import type { AuditFilterState } from '@/features/audit/types/index'
import { uuidParam } from '@/lib/safeInput'

/**
 * Filtres du journal d'audit portés par l'URL (`/audit?entityType=PAYMENT&entityId=<uuid>` depuis
 * le tiroir paiement, ou une vue filtrée partagée). Toute valeur mal formée est ignorée plutôt
 * que passée au back ; les identifiants doivent être des UUID.
 */
type AuditKey = keyof AuditFilterState
const KEYS: AuditKey[] = ['action', 'entityType', 'entityId', 'actorId', 'from', 'to']

const CODE = /^[A-Za-z][A-Za-z0-9_]{0,79}$/
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function valid(key: AuditKey, raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (key === 'entityId' || key === 'actorId') return uuidParam(v)
  if (key === 'from' || key === 'to') return DAY.test(v) ? v : null
  return CODE.test(v) ? v : null
}

const first = (v: unknown): string | null => {
  const raw = Array.isArray(v) ? v[0] : v
  return typeof raw === 'string' ? raw : null
}

/** État complet des filtres lu dans l'URL (absent ou invalide = null). */
export function readAuditQuery(query: Record<string, unknown> | undefined): Required<AuditFilterState> {
  const out = {} as Required<AuditFilterState>
  for (const k of KEYS) {
    const raw = first(query?.[k])
    out[k] = raw === null ? null : valid(k, raw)
  }
  return out
}

/** `query` dont les filtres sont remplacés par l'état courant (vides et invalides retirés). */
export function writeAuditQuery(query: Record<string, unknown> | undefined, filters: AuditFilterState): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(query ?? {})) {
    if (!(KEYS as string[]).includes(k) && typeof v === 'string') out[k] = v
  }
  for (const k of KEYS) {
    const v = filters[k]
    const ok = typeof v === 'string' ? valid(k, v) : null
    if (ok) out[k] = ok
  }
  return out
}
