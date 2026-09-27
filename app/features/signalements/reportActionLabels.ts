import type { ReportAction, ReportTargetType } from '@/features/signalements/types/index'

export const REPORT_ACTION_LABELS: Record<ReportAction, string> = {
  DISMISS: 'Rejeter le signalement',
  WARN: 'Avertir',
  SUSPEND_TARGET: 'Suspendre la cible',
  REMOVE_CONTENT: 'Retirer le contenu',
}

export const REPORT_TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  USER: 'Utilisateur',
  ANNOUNCEMENT: 'Annonce',
  BID: 'Candidature',
  MESSAGE: 'Message',
  RATING: 'Avis',
  APP: 'Application',
  PACKAGE_REQUEST: 'Demande d\'envoi',
}

/** Type de cible lisible ; un type ajouté côté back avant le front s'affiche tel quel. */
export function reportTargetTypeLabel(type: string): string {
  return REPORT_TARGET_TYPE_LABELS[type as ReportTargetType] ?? type
}
