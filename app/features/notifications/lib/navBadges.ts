import { badgeLabel } from '@/features/notifications/lib/format'
import type { CounterKey, NotificationCounts } from '@/features/notifications/types/index'

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
  { to: '/transactions', keys: ['heldPayouts', 'walletRefunds'], dangerKeys: ['heldPayouts'] },
  { to: '/users/rgpd', keys: ['gdpr'], dangerKeys: [] },
  { to: '/alertes', keys: ['alerts'], dangerKeys: ['alerts'] },
]

/** Badge par route ; absent quand le total est nul ou que les clés manquent (pas de permission). */
export function navBadges(counts: NotificationCounts): Record<string, NavBadge> {
  const out: Record<string, NavBadge> = {}
  for (const { to, keys, dangerKeys } of NAV_COUNTERS) {
    const count = keys.reduce((sum, k) => sum + (counts[k] ?? 0), 0)
    if (count <= 0) continue
    const tone: BadgeTone = dangerKeys.some((k) => (counts[k] ?? 0) > 0) ? 'danger' : 'neutral'
    out[to] = { count, label: badgeLabel(count), tone }
  }
  return out
}
