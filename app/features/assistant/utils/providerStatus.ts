import type { AdminProvider } from '@/features/assistant/types'

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'

function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function providerStatus(p: AdminProvider, now: Date = new Date()): { label: string; tone: StatusTone } {
  if (!p.enabled) return { label: 'En pause', tone: 'neutral' }
  const s = p.stats
  if (s.cooldownUntil && new Date(s.cooldownUntil) > now) {
    const code = s.lastStatus ? `Erreur ${s.lastStatus}, ` : ''
    return { label: `${code}de côté jusqu'à ${hhmm(s.cooldownUntil)}`, tone: 'danger' }
  }
  if (p.dailyRequestLimit !== null && s.requestsToday >= p.dailyRequestLimit) return { label: 'Quota atteint', tone: 'warning' }
  if (s.lastStatus !== null && s.lastStatus !== 200) return { label: `Erreur ${s.lastStatus}`, tone: 'warning' }
  return { label: 'Actif', tone: 'success' }
}
