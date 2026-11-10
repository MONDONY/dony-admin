import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { reportKind } from '@/features/signalements/reportKind'
import type { AdminReport, ReportSource } from '@/features/signalements/types/index'

/** Ce qui s'affiche à la place du signalant quand le back a créé le signalement lui-même. */
export const SYSTEM_REPORTER_LABEL = 'Détection automatique'

/** Ce qu'il faut d'un signalement (liste, voisin, demande d'envoi) pour nommer son signalant. */
interface ReporterFields {
  reporterName?: string | null
  source?: ReportSource | null
}

/** Signalement créé par le back (détection automatique) ; `source` absent (ancien back) = un utilisateur. */
export function isSystemReport(r: Pick<ReporterFields, 'source'>): boolean {
  return r.source === 'SYSTEM'
}

/** Nom du signalant : « Détection automatique » pour le système, sinon son nom, sinon `fallback`. */
export function reporterLabel(r: ReporterFields, fallback = 'Inconnu'): string {
  if (isSystemReport(r)) return SYSTEM_REPORTER_LABEL
  return r.reporterName ?? fallback
}

/** « Signalé par Awa » ; un signalement du système dit seulement « Détection automatique ». */
export function reportedByText(r: ReporterFields, fallback = 'Inconnu'): string {
  return isSystemReport(r) ? SYSTEM_REPORTER_LABEL : `Signalé par ${reporterLabel(r, fallback)}`
}

/**
 * Cible APP : ni libellé ni identifiant côté back, on nomme l’application. Un avis résolu se
 * lit dans son aperçu : l’identifiant brut n’apprendrait rien à l’admin.
 */
export function reportTargetLabel(r: AdminReport): string {
  if (r.ratingPreview) {
    return r.ratingPreview.ratedUserName ? `Avis sur ${r.ratingPreview.ratedUserName}` : 'Avis sur un compte supprimé'
  }
  return r.targetLabel ?? r.targetId ?? (r.targetType === 'APP' ? 'Application' : 'Cible inconnue')
}

/** Un avis ou une suggestion du scarabée n'est pas un « bug » : libellé neutre. */
export function reportReasonTitle(r: AdminReport): string {
  const kind = reportKind(r)
  return kind === 'AVIS' || kind === 'SUGGESTION' ? 'Retour depuis un écran' : reportReasonLabel(r.reason)
}
