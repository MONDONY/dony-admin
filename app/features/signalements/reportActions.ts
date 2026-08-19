import type { AdminPermission } from '@/stores/auth'
import type { ReportAction, ReportTargetType } from '@/features/signalements/types/index'

/**
 * Miroir de `ReportAction.appliesTo` côté back (applicabilité par cible) + de la
 * vérification d'autorité que `AdminReportsController.resolveReport` fait pour
 * SUSPEND_TARGET (USER_SUSPEND) et REMOVE_CONTENT (CONTENT_REMOVE) — un SUPPORT a
 * REPORT_RESOLVE sans avoir CONTENT_REMOVE, il ne doit donc pas voir cette option.
 * Le back revalide de toute façon ; ce filtre évite seulement de proposer une action
 * que la confirmation rejettera en 403/422.
 */
export function actionsFor(targetType: ReportTargetType, permissions: Set<AdminPermission>): ReportAction[] {
  const applicable: ReportAction[] = targetType === 'USER'
    ? ['DISMISS', 'WARN', 'SUSPEND_TARGET']
    : targetType === 'ANNOUNCEMENT'
      ? ['DISMISS', 'REMOVE_CONTENT']
      : ['DISMISS']

  return applicable.filter((action) => {
    if (action === 'SUSPEND_TARGET') return permissions.has('USER_SUSPEND')
    if (action === 'REMOVE_CONTENT') return permissions.has('CONTENT_REMOVE')
    return true
  })
}
