import type { AdminReport } from '@/features/signalements/types/index'

export type AgeTone = 'neutral' | 'warning' | 'danger'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Au-delà d'un jour un signalement ouvert mérite l'œil, au-delà de trois il est en retard. */
const WARNING_AFTER = DAY
const DANGER_AFTER = 3 * DAY

/** « il y a 2 h » et la teinte d'urgence ; `now` injectable pour les tests. */
export function reportAge(createdAt: string, now: number = Date.now()): { label: string; tone: AgeTone } {
  const elapsed = Math.max(0, now - new Date(createdAt).getTime())
  const tone: AgeTone = elapsed >= DANGER_AFTER ? 'danger' : elapsed >= WARNING_AFTER ? 'warning' : 'neutral'
  if (elapsed < HOUR) return { label: `il y a ${Math.max(1, Math.floor(elapsed / MINUTE))} min`, tone }
  if (elapsed < DAY) return { label: `il y a ${Math.floor(elapsed / HOUR)} h`, tone }
  return { label: `il y a ${Math.floor(elapsed / DAY)} j`, tone }
}

/** À traiter : ouvert et non supprimé. */
export function isOpenReport(r: Pick<AdminReport, 'status' | 'deletedAt'>): boolean {
  return r.status === 'OPEN' && !r.deletedAt
}

/** Sélection par défaut : le premier à traiter, sinon le premier de la liste. */
export function defaultReportId(reports: readonly AdminReport[]): string | null {
  return (reports.find(isOpenReport) ?? reports[0])?.id ?? null
}

/**
 * Après un traitement : le prochain à traiter, en descendant dans la liste puis, à défaut, en
 * remontant. null quand il n'en reste aucun (l'appelant garde alors le dossier affiché).
 */
export function nextReportId(reports: readonly AdminReport[], currentId: string | null): string | null {
  const from = reports.findIndex((r) => r.id === currentId)
  const after = reports.slice(from + 1).find(isOpenReport)
  if (after) return after.id
  const before = reports.slice(0, Math.max(0, from)).reverse().find(isOpenReport)
  return before?.id ?? null
}

/** Voisin dans la liste (J / K), sans boucler ; reste sur place aux extrémités. */
export function neighbourReportId(reports: readonly AdminReport[], currentId: string | null, step: 1 | -1): string | null {
  if (reports.length === 0) return null
  const from = reports.findIndex((r) => r.id === currentId)
  if (from === -1) return reports[0]!.id
  const next = Math.min(reports.length - 1, Math.max(0, from + step))
  return reports[next]!.id
}
