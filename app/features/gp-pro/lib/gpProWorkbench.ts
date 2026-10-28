import type {
  AdminGpProApplicationDetail, AdminGpProApplicationRow, AdminGpProReviewRow,
} from '@/features/gp-pro/types/index'
import { parseServerDate } from '@/lib/serverDate'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Seuil de note sous lequel le serveur lève l'alerte « Notes récentes sous 4/5 ». */
export const GP_PRO_RATING_THRESHOLD = 4

export type GpProScope = 'demandes' | 'revue'

function ms(iso: string | null | undefined): number {
  const v = parseServerDate(iso)
  return Number.isNaN(v) ? NaN : v
}

/** Du plus ancien au plus récent ; une date absente ou illisible passe en dernier. */
// eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
function oldestFirst<T>(items: readonly T[], date: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => {
    const x = ms(date(a))
    const y = ms(date(b))
    if (Number.isNaN(x)) return Number.isNaN(y) ? 0 : 1
    if (Number.isNaN(y)) return -1
    return x - y
  })
}

export const sortApplications = (items: readonly AdminGpProApplicationRow[]) => oldestFirst(items, (r) => r.createdAt)
export const sortReview = (items: readonly AdminGpProReviewRow[]) => oldestFirst(items, (r) => r.detectedAt)

/** Ancienneté lisible (« < 1 h », « 5 h », « 3 j ») ; null sans date exploitable. */
export function ageLabel(iso: string | null | undefined, now: number = Date.now()): string | null {
  const at = ms(iso)
  if (Number.isNaN(at)) return null
  const elapsed = Math.max(0, now - at)
  if (elapsed < HOUR) return '< 1 h'
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h`
  return `${Math.floor(elapsed / DAY)} j`
}

/** Voisin de `current` dans `keys` ; sans dossier ouvert (ou hors liste), J prend le premier, K le dernier. */
export function neighbourKey(keys: readonly string[], current: string | null, step: 1 | -1): string | null {
  if (keys.length === 0) return null
  const at = current === null ? -1 : keys.indexOf(current)
  if (at === -1) return (step === 1 ? keys[0] : keys[keys.length - 1]) ?? null
  return keys[at + step] ?? null
}

export interface GpProSummary {
  /** Demandes à examiner selon le serveur (toutes pages). */
  applications: number
  /** Titulaires à revoir selon le serveur (toutes pages). */
  review: number
  oldest: { label: string; name: string } | null
}

export function applicantName(row: { displayName?: string | null }): string {
  return row.displayName?.trim() || 'Nom non renseigné'
}

export function summarizeGpPro(
  applications: readonly AdminGpProApplicationRow[], applicationsTotal: number, reviewTotal: number, now: number = Date.now(),
): GpProSummary {
  const first = sortApplications(applications).find((r) => ageLabel(r.createdAt, now) !== null)
  return {
    applications: applicationsTotal,
    review: reviewTotal,
    oldest: first ? { label: ageLabel(first.createdAt, now)!, name: applicantName(first) } : null,
  }
}

export type AttentionKey = 'kyc' | 'disputes' | 'reports' | 'rating' | 'trips'

/**
 * Ce qui mérite un regard avant de décider, tiré de la fiche déjà servie : identité, litiges et
 * signalements ouverts, note sous le seuil, aucun trajet publié. Vide : rien d'inquiétant.
 */
export function attentionPoints(d: Pick<
  AdminGpProApplicationDetail, 'kycStatus' | 'openDisputes' | 'openReports' | 'averageRating' | 'publishedTrips'
>): { key: AttentionKey; label: string }[] {
  const points: { key: AttentionKey; label: string }[] = []
  if (d.kycStatus !== 'VERIFIED') points.push({ key: 'kyc', label: 'L’identité n’est pas vérifiée : accepter est impossible tant qu’elle ne l’est pas.' })
  const disputes = d.openDisputes ?? 0
  if (disputes > 0) points.push({ key: 'disputes', label: `${disputes} litige${disputes > 1 ? 's' : ''} ouvert${disputes > 1 ? 's' : ''} sur son compte.` })
  const reports = d.openReports ?? 0
  if (reports > 0) points.push({ key: 'reports', label: `${reports} signalement${reports > 1 ? 's' : ''} ouvert${reports > 1 ? 's' : ''} sur son compte.` })
  if (typeof d.averageRating === 'number' && d.averageRating < GP_PRO_RATING_THRESHOLD) {
    points.push({ key: 'rating', label: `Note moyenne ${d.averageRating.toFixed(1).replace('.', ',')} / 5, sous ${GP_PRO_RATING_THRESHOLD}/5.` })
  }
  if (d.publishedTrips === 0) points.push({ key: 'trips', label: 'Aucun trajet publié pour l’instant.' })
  return points
}
