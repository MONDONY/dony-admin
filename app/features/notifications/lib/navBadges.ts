import { badgeLabel } from '@/features/notifications/lib/format'
import type { CounterKey, NotificationCounts } from '@/features/notifications/types/index'
import type { FinanceCounts } from '@/features/transactions/types'

export type BadgeTone = 'neutral' | 'danger'
export interface NavBadge { count: number; label: string; tone: BadgeTone }

/**
 * Entrée du menu → compteurs qui l'alimentent. `danger` : l'attente coûte (alerte ouverte,
 * versement bloqué), le reste est une file de travail ordinaire.
 */
const NAV_COUNTERS: { to: string; keys: CounterKey[]; dangerKeys: CounterKey[] }[] = [
  { to: '/signalements', keys: ['reports'], dangerKeys: [] },
  { to: '/support', keys: ['support'], dangerKeys: [] },
  { to: '/incidents', keys: ['incidents'], dangerKeys: [] },
  { to: '/kyc', keys: ['kyc'], dangerKeys: [] },
  { to: '/gp-pro', keys: ['gpPro', 'gpProReview'], dangerKeys: [] },
  { to: '/transactions', keys: ['heldPayouts', 'walletRefunds'], dangerKeys: ['heldPayouts'] },
  { to: '/users/rgpd', keys: ['gdpr'], dangerKeys: [] },
  { to: '/alertes', keys: ['alerts'], dangerKeys: ['alerts'] },
]

/** Pastille de Transactions : somme des quatre pastilles de section (mêmes nombres que la page). */
const financeTotal = (f: FinanceCounts) => f.payments + f.mobileMoney + f.soldes + f.chargebacks

/**
 * Badge par route ; absent quand le total est nul ou que les clés manquent (pas de permission).
 * `finance` (`GET /admin/finance/counts`) : quand il répond, la pastille de `/transactions` est la
 * somme de ses quatre sections ; `null` (ancien back, pas encore chargé) = clés actuelles.
 */
export function navBadges(counts: NotificationCounts, finance: FinanceCounts | null = null): Record<string, NavBadge> {
  const out: Record<string, NavBadge> = {}
  for (const { to, keys, dangerKeys } of NAV_COUNTERS) {
    const count = to === '/transactions' && finance
      ? financeTotal(finance)
      : keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0)
    if (count <= 0) continue
    const tone: BadgeTone = dangerKeys.some((k) => (counts[k] ?? 0) > 0) ? 'danger' : 'neutral'
    out[to] = { count, label: badgeLabel(count), tone }
  }
  return out
}
