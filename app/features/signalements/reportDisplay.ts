import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { reportKind } from '@/features/signalements/reportKind'
import type { AdminReport } from '@/features/signalements/types/index'

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
