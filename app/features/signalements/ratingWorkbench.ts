import { restoreReasonValid, RESTORE_REASON_MAX, RESTORE_REASON_MIN } from '@/lib/restoreReason'
import type { AdminPermission } from '@/stores/auth'
import type {
  AdminRating,
  RatingContextRated,
  RatingContextRater,
  ReportHistoryEntry,
} from '@/features/signalements/types/index'
import type { TimelineItem } from '@/features/signalements/reportContext'

export type RatingAction = 'EXCLUDE' | 'REINTEGRATE' | 'DELETE' | 'RESTORE'

/** Longueur maximale du motif d'une exclusion ou d'une suppression (celui d'une suppression est audité à vie). */
export const RATING_REASON_MAX = 500

export const RATING_ACTION_LABELS: Record<RatingAction, string> = {
  EXCLUDE: 'Exclure de la moyenne',
  REINTEGRATE: 'Réintégrer dans la moyenne',
  DELETE: 'Supprimer l’avis',
  RESTORE: 'Restaurer l’avis',
}

/** Une ligne d'aide sous chaque action, ce qu'elle fait et ce qu'elle ne fait pas. */
export const RATING_ACTION_HELP: Record<RatingAction, string> = {
  EXCLUDE: 'L’avis reste visible, mais ne compte plus dans la note',
  REINTEGRATE: 'L’avis compte de nouveau dans la note',
  DELETE: 'L’avis disparaît et la note est recalculée ; il se restaure depuis « Supprimés »',
  RESTORE: 'L’avis redevient public et la note est recalculée',
}

/** Suppression : confirmation renforcée avec sa conséquence, comme les sanctions des signalements. */
export function isDestructiveRatingAction(action: RatingAction): boolean {
  return action === 'DELETE'
}

/** Motif obligatoire pour tout geste qui retire un avis ou le restaure ; facultatif pour une réintégration. */
export function isRatingReasonRequired(action: RatingAction): boolean {
  return action !== 'REINTEGRATE'
}

/** Message d'erreur du motif, ou null quand il est acceptable. */
export function ratingReasonError(action: RatingAction, reason: string): string | null {
  const trimmed = reason.trim()
  if (action === 'RESTORE') {
    return restoreReasonValid(trimmed) ? null : `Entre ${RESTORE_REASON_MIN} et ${RESTORE_REASON_MAX} caractères : il est journalisé avec votre identifiant.`
  }
  if (trimmed.length > RATING_REASON_MAX) return `Au plus ${RATING_REASON_MAX} caractères.`
  if (isRatingReasonRequired(action) && trimmed.length === 0) return 'Le motif est obligatoire.'
  return null
}

export interface RatingActionContext {
  // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
  can: (permission: AdminPermission) => boolean
  /** POST /admin/ratings/{id}/restore absent (ancien back) : la restauration disparaît. */
  restoreUnavailable?: boolean
  /** Avis supplanté par une nouvelle note : plus restaurable. */
  superseded?: boolean
}

/**
 * Gestes possibles sur un avis, dans l'ordre d'affichage : d'abord celui qui garde l'avis, puis la
 * suppression. Chacun respecte sa permission (RATING_MODERATE, RATING_DELETE).
 */
export function ratingActions(rating: Pick<AdminRating, 'excluded' | 'deletedAt'>, ctx: RatingActionContext): RatingAction[] {
  if (rating.deletedAt) {
    return ctx.can('RATING_DELETE') && !ctx.restoreUnavailable && !ctx.superseded ? ['RESTORE'] : []
  }
  const actions: RatingAction[] = []
  if (ctx.can('RATING_MODERATE')) actions.push(rating.excluded ? 'REINTEGRATE' : 'EXCLUDE')
  if (ctx.can('RATING_DELETE')) actions.push('DELETE')
  return actions
}

/** Conséquence visible d'une suppression, pour la confirmation renforcée. */
export function ratingActionConsequence(action: RatingAction, ratedName?: string | null): string | null {
  if (action !== 'DELETE') return null
  return `L’avis disparaît du profil de ${ratedName ?? 'la personne notée'} et sa note moyenne est recalculée. Il se restaure depuis « Supprimés ».`
}

/** « 4,2 » : une décimale, virgule française. */
export function formatAverage(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

export interface AverageEffect {
  before: number | null
  /** Moyenne après le geste ; null quand plus aucun avis ne compterait. */
  after: number | null
  /** Avis comptés après le geste. */
  countAfter: number
}

/**
 * Ce que le geste ferait de la moyenne de la personne notée, pour que l'admin voie l'effet avant de
 * confirmer. Exclure ou supprimer retire l'avis de la moyenne, réintégrer ou restaurer l'y remet.
 * Null quand le geste ne change pas la moyenne (avis déjà hors moyenne) ou qu'elle est inconnue.
 */
export function averageEffect(
  action: RatingAction,
  rating: Pick<AdminRating, 'score' | 'excluded' | 'deletedAt'>,
  rated: Pick<RatingContextRated, 'averageRating' | 'ratingCount'> | null | undefined,
): AverageEffect | null {
  if (!rated) return null
  const { ratingCount: count } = rated
  const avg = rated.averageRating ?? null
  const counted = !rating.excluded && !rating.deletedAt
  if (action === 'EXCLUDE' || action === 'DELETE') {
    if (!counted) return null
    if (count <= 1 || avg === null) return { before: avg, after: null, countAfter: Math.max(0, count - 1) }
    return { before: avg, after: (avg * count - rating.score) / (count - 1), countAfter: count - 1 }
  }
  // REINTEGRATE / RESTORE : l'avis rejoint la moyenne, sauf s'il en était déjà exclu.
  if (action === 'RESTORE' && rating.excluded) return null
  if (avg === null || count === 0) return { before: null, after: rating.score, countAfter: 1 }
  return { before: avg, after: (avg * count + rating.score) / (count + 1), countAfter: count + 1 }
}

/** Texte de l'effet : « Moyenne de Moussa : 4,2 → 4,4 (17 avis) ». */
export function averageEffectText(effect: AverageEffect, ratedName?: string | null): string {
  const who = ratedName ?? 'la personne notée'
  const before = effect.before === null ? 'aucune' : formatAverage(effect.before)
  const after = effect.after === null ? 'aucune' : formatAverage(effect.after)
  const n = effect.countAfter
  return `Moyenne de ${who} : ${before} → ${after} (${n} avis)`
}

const LOW_RATIO = 0.6
const MIN_GIVEN = 5

/** Un notant qui note presque toujours bas : à lire comme un repère, pas comme un verdict. */
export function raterHabit(r: Pick<RatingContextRater, 'ratingsGiven' | 'lowRatingsGiven'>): { label: string; tone: 'warning' } | null {
  if (r.ratingsGiven < MIN_GIVEN) return null
  return r.lowRatingsGiven / r.ratingsGiven >= LOW_RATIO ? { label: 'Note presque toujours bas', tone: 'warning' } : null
}

/** « 3 notes de Awa à Moussa » dès deux notes du même compte au même compte ; sinon rien. */
export function sameRelationText(count: number, raterName?: string | null, ratedName?: string | null): string | null {
  if (count < 2) return null
  return `${count} notes de ${raterName ?? 'ce compte'} à ${ratedName ?? 'cette personne'}`
}

/** Hauteurs relatives (0 à 1) des barres de répartition, de 5 étoiles à 1. */
export function distributionBars(distribution: Record<string, number> | null | undefined): { stars: number; count: number; ratio: number }[] {
  const counts = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: distribution?.[String(stars)] ?? 0 }))
  const max = Math.max(1, ...counts.map((c) => c.count))
  return counts.map((c) => ({ ...c, ratio: c.count / max }))
}

/** Sélection par défaut : le premier avis signalé à traiter, sinon le premier. */
export function defaultRatingId(ratings: readonly AdminRating[]): string | null {
  const pending = ratings.find((r) => r.flagged && !r.excluded && !r.deletedAt)
  return (pending ?? ratings[0])?.id ?? null
}

/** Après un geste : l'avis qui suit dans la liste, sinon celui qui précède ; null s'il n'y en a pas d'autre. */
export function followingRatingId(ratings: readonly AdminRating[], currentId: string | null): string | null {
  const from = ratings.findIndex((r) => r.id === currentId)
  if (from === -1) return null
  return (ratings[from + 1] ?? ratings[from - 1])?.id ?? null
}

/** Voisin dans la liste (J / K), sans boucler. */
export function neighbourRatingId(ratings: readonly AdminRating[], currentId: string | null, step: 1 | -1): string | null {
  if (ratings.length === 0) return null
  const from = ratings.findIndex((r) => r.id === currentId)
  if (from === -1) return ratings[0]!.id
  return ratings[Math.min(ratings.length - 1, Math.max(0, from + step))]!.id
}

// ----- Chronologie -----

const CREATED_ACTIONS = new Set([
  'RATING_CREATED', 'RECIPIENT_RATING_CREATED', 'TRAVELER_RATING_CREATED', 'RECEPTION_RATING_CREATED',
])
const AUDIT_LABELS: Record<string, string> = {
  RATING_CREATED: 'Avis laissé',
  RECIPIENT_RATING_CREATED: 'Avis laissé par le destinataire',
  TRAVELER_RATING_CREATED: 'Avis laissé par le voyageur',
  RECEPTION_RATING_CREATED: 'Avis laissé à la réception',
  RATING_DELETED: 'Avis supprimé',
  RATING_RESTORED: 'Avis restauré',
  FRAUD_ALERT_RATING_FARMING: 'Alerte fraude : notes en série',
}

function auditLabel(e: ReportHistoryEntry): string {
  if (e.action === 'RATING_EXCLUDED') return e.detail === 'REINTEGRATED' ? 'Avis réintégré dans la moyenne' : 'Avis exclu de la moyenne'
  return AUDIT_LABELS[e.action] ?? e.action
}

/**
 * Chronologie d'un avis, du plus ancien au plus récent (le back rend le plus récent d'abord). Un avis
 * ancien n'a pas toujours de trace de création : on la déduit alors de sa date.
 */
export function buildRatingTimeline(
  rating: Pick<AdminRating, 'id' | 'createdAt' | 'raterName'>,
  history: readonly ReportHistoryEntry[] | null | undefined,
): TimelineItem[] {
  const steps = [...(history ?? [])].reverse().map((e, i): TimelineItem => ({
    key: `${e.action}-${i}`, label: auditLabel(e), at: e.at ?? null,
    by: e.actorEmail ? `par ${e.actorEmail}` : null, note: e.note ?? null,
  }))
  const hasCreation = (history ?? []).some((e) => CREATED_ACTIONS.has(e.action))
  if (hasCreation) return steps
  const created: TimelineItem = {
    key: `created-${rating.id}`, label: 'Avis laissé', at: rating.createdAt,
    by: rating.raterName ? `par ${rating.raterName}` : null, note: null,
  }
  return [created, ...steps]
}
