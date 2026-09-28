import type { AdminPermission } from '@/stores/auth'
import type { AdminReport, ReportAction, ReportTargetType } from '@/features/signalements/types/index'

/**
 * Ordre d'affichage stable, quel que soit l'ordre renvoyé par le back : d'abord « Marquer
 * comme traité » (le cas courant), puis les actions sur le contenu, puis sur l'auteur, et
 * le rejet en dernier.
 */
export const REPORT_ACTION_ORDER: readonly ReportAction[] = [
  'RESOLVE',
  'REMOVE_CONTENT',
  'DELETE_MESSAGE',
  'EXCLUDE_RATING',
  'DELETE_RATING',
  'WARN',
  'SUSPEND_TARGET',
  'WARN_AUTHOR',
  'SUSPEND_AUTHOR',
  'DISMISS',
]

/** Trie et dédoublonne ; une action inconnue (back plus récent) passe juste avant DISMISS. */
export function sortActions(actions: readonly string[]): string[] {
  const unique = [...new Set(actions)]
  const rank = (a: string) => {
    const i = REPORT_ACTION_ORDER.indexOf(a as ReportAction)
    if (i >= 0) return i
    return REPORT_ACTION_ORDER.length - 1.5 // entre SUSPEND_AUTHOR et DISMISS
  }
  // Tri stable : deux inconnues gardent l'ordre du back.
  return unique.sort((a, b) => rank(a) - rank(b))
}

/**
 * Repli pour un back qui ne renvoie pas encore `availableActions` : miroir de l'ancien
 * `ReportAction.appliesTo` et de la vérification d'autorité de `resolveReport`, enrichi de
 * RESOLVE pour tous les types. L'ancien back refusera RESOLVE : le dialogue affiche alors
 * son `detail`.
 *
 * PACKAGE_REQUEST : le retrait d'une demande d'envoi passe par sa fiche (/colis?tab=demandes),
 * qui explique ses conséquences (négociations annulées).
 */
export function legacyActionsFor(targetType: ReportTargetType, permissions: Set<AdminPermission>): ReportAction[] {
  const specific: ReportAction[] = targetType === 'USER'
    ? ['WARN', 'SUSPEND_TARGET']
    : targetType === 'ANNOUNCEMENT'
      ? ['REMOVE_CONTENT']
      : []
  const allowed = specific.filter((action) => {
    if (action === 'SUSPEND_TARGET') return permissions.has('USER_SUSPEND')
    if (action === 'REMOVE_CONTENT') return permissions.has('CONTENT_REMOVE')
    return true
  })
  return sortActions(['RESOLVE', ...allowed, 'DISMISS']) as ReportAction[]
}

/**
 * Actions proposées pour un signalement. `availableActions` fourni par le back fait foi
 * (type de cible, cible résolvable et permissions déjà croisés) : le front ne refiltre rien.
 */
export function actionsForReport(
  report: Pick<AdminReport, 'targetType' | 'availableActions'>,
  permissions: Set<AdminPermission>,
): string[] {
  if (Array.isArray(report.availableActions)) return sortActions(report.availableActions)
  return legacyActionsFor(report.targetType, permissions)
}

/** Pré-sélection du dialogue : jamais une sanction choisie d'office. */
export function defaultActionFor(actions: readonly string[]): string | null {
  if (actions.includes('RESOLVE')) return 'RESOLVE'
  if (actions.includes('DISMISS')) return 'DISMISS'
  return null
}

/** Note obligatoire pour toute sanction (et toute action inconnue), facultative pour RESOLVE/DISMISS. */
export function isNoteRequired(action: string): boolean {
  return action !== 'RESOLVE' && action !== 'DISMISS'
}

/** Le signalant reçoit une notification sobre quand son signalement est traité, pas au rejet. */
export function notifiesReporter(action: string): boolean {
  return action !== 'DISMISS'
}

/** Suspensions et suppressions : conséquence explicite et case de confirmation. */
export function requiresStrongConfirmation(action: string): boolean {
  return action.startsWith('SUSPEND_') || action.startsWith('DELETE_')
}
