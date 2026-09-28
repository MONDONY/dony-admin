import type { ReportAction, ReportTargetAuthor, ReportTargetType } from '@/features/signalements/types/index'

export const REPORT_ACTION_LABELS: Record<ReportAction, string> = {
  RESOLVE: 'Marquer comme traité',
  DISMISS: 'Rejeter le signalement',
  WARN: 'Avertir',
  SUSPEND_TARGET: 'Suspendre la cible',
  REMOVE_CONTENT: 'Retirer le contenu',
  DELETE_MESSAGE: 'Supprimer le message',
  EXCLUDE_RATING: 'Exclure l’avis de la note',
  DELETE_RATING: 'Supprimer l’avis',
  WARN_AUTHOR: 'Avertir l’auteur',
  SUSPEND_AUTHOR: 'Suspendre l’auteur',
}

/** Libellés au passé, pour l'action prise affichée dans la liste. */
const REPORT_ACTION_TAKEN_LABELS: Record<ReportAction, string> = {
  RESOLVE: 'Marqué comme traité',
  DISMISS: 'Rejeté',
  WARN: 'Utilisateur averti',
  SUSPEND_TARGET: 'Utilisateur suspendu',
  REMOVE_CONTENT: 'Contenu retiré',
  DELETE_MESSAGE: 'Message supprimé',
  EXCLUDE_RATING: 'Avis exclu de la note',
  DELETE_RATING: 'Avis supprimé',
  WARN_AUTHOR: 'Auteur averti',
  SUSPEND_AUTHOR: 'Auteur suspendu',
}

const REPORT_ACTION_HELP: Record<ReportAction, string> = {
  RESOLVE: 'Signalement pris en compte, sans action sur la cible',
  DISMISS: 'Signalement non fondé ; le signalant n’est pas prévenu',
  WARN: 'L’utilisateur signalé reçoit un avertissement',
  SUSPEND_TARGET: 'Le compte signalé est suspendu',
  REMOVE_CONTENT: 'Le contenu signalé est retiré de la plateforme',
  DELETE_MESSAGE: 'Le message disparaît de la conversation',
  EXCLUDE_RATING: 'L’avis reste visible mais ne compte plus dans la note',
  DELETE_RATING: 'L’avis est retiré et la note recalculée',
  WARN_AUTHOR: 'L’auteur reçoit un avertissement',
  SUSPEND_AUTHOR: 'Le compte de l’auteur est suspendu',
}

const known = (action: string): action is ReportAction => Object.hasOwn(REPORT_ACTION_LABELS, action)
const authorName = (author?: ReportTargetAuthor | null) => author?.name?.trim() || null

/** Libellé d'une action ; pour WARN_AUTHOR / SUSPEND_AUTHOR, le nom de l'auteur s'il est connu. */
export function reportActionLabel(action: string, author?: ReportTargetAuthor | null): string {
  const name = authorName(author)
  if (name && action === 'WARN_AUTHOR') return `Avertir ${name}`
  if (name && action === 'SUSPEND_AUTHOR') return `Suspendre ${name}`
  return known(action) ? REPORT_ACTION_LABELS[action] : action
}

export function reportActionTakenLabel(action: string): string {
  return known(action) ? REPORT_ACTION_TAKEN_LABELS[action] : action
}

/** Aide sous l'action ; un rapport de bug (cible APP) se « traite » quand il est corrigé. */
export function reportActionHelp(action: string, targetType: ReportTargetType): string | null {
  if (action === 'RESOLVE' && targetType === 'APP') return 'Bug corrigé ou pris en compte'
  return known(action) ? REPORT_ACTION_HELP[action] : null
}

/** Conséquence explicite des actions à confirmation renforcée (SUSPEND_*, DELETE_*). */
export function reportActionConsequence(action: string, author?: ReportTargetAuthor | null): string | null {
  switch (action) {
    case 'SUSPEND_TARGET':
      return 'Le compte de l’utilisateur signalé sera suspendu : il ne pourra plus se connecter ni utiliser Yadony.'
    case 'SUSPEND_AUTHOR':
      return `Le compte de ${authorName(author) ?? 'l’auteur'} sera suspendu : il ne pourra plus se connecter ni utiliser Yadony.`
    case 'DELETE_MESSAGE':
      return 'Le message sera supprimé de la conversation, pour les deux participants.'
    case 'DELETE_RATING':
      return 'L’avis sera supprimé du profil et la note moyenne du voyageur recalculée.'
    default:
      return null
  }
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
