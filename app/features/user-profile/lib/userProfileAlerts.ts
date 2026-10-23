import { formatAmount } from '@/features/finance/types/index'
import type { UserOverviewKpis } from '@/features/user-profile/types/index'

export interface UserAlert { id: string; text: string }

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`
}

/** Une alerte par condition vraie ; un champ `null` (permission absente) n'en produit jamais. */
export function buildAlerts(
  user: { status: string; deletionScheduledFor?: string | null },
  kpis: UserOverviewKpis,
): UserAlert[] {
  const alerts: UserAlert[] = []
  if (user.status === 'SUSPENDED') alerts.push({ id: 'suspended', text: 'Compte suspendu' })
  if (user.status === 'BANNED') alerts.push({ id: 'banned', text: 'Compte banni' })
  if (user.deletionScheduledFor || user.status === 'PENDING_DELETION') {
    alerts.push({ id: 'deletion', text: 'Suppression du compte demandée' })
  }
  if (kpis.openDisputes !== null && kpis.openDisputes > 0) {
    alerts.push({ id: 'disputes', text: plural(kpis.openDisputes, 'litige ouvert', 'litiges ouverts') })
  }
  if (kpis.heldByCurrency && kpis.heldByCurrency.length > 0) {
    const parts = kpis.heldByCurrency.map(m => formatAmount(m.amountCents, m.currency))
    alerts.push({ id: 'held', text: `Argent retenu : ${parts.join(', ')}` })
  }
  if (kpis.reportsPending !== null && kpis.reportsPending > 0) {
    alerts.push({ id: 'reports', text: plural(kpis.reportsPending, 'signalement à traiter', 'signalements à traiter') })
  }
  return alerts
}
