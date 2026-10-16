import { describe, it, expect } from 'vitest'
import { providerStatus } from '@/features/assistant/utils/providerStatus'
import type { AdminProvider } from '@/features/assistant/types'

const base: AdminProvider = {
  id: 'p', name: 'Groq', slug: 'groq', baseUrl: 'https://a.com', model: 'm', apiKeyLast4: '1234',
  supportsJsonMode: true, dailyRequestLimit: 10, priority: 1, enabled: true,
  stats: { requestsToday: 0, successesToday: 0, lastStatus: null, lastError: null, cooldownUntil: null },
}
const now = new Date('2026-10-16T14:00:00Z')

describe('providerStatus', () => {
  it('en pause si désactivé', () => {
    expect(providerStatus({ ...base, enabled: false }, now)).toEqual({ label: 'En pause', tone: 'neutral' })
  })
  it('quota atteint', () => {
    expect(providerStatus({ ...base, stats: { ...base.stats, requestsToday: 10 } }, now).label).toBe('Quota atteint')
  })
  it('mis de côté avec l’heure', () => {
    const p = { ...base, stats: { ...base.stats, lastStatus: 401, cooldownUntil: '2026-10-16T14:10:00Z' } }
    const s = providerStatus(p, now)
    expect(s.tone).toBe('danger')
    expect(s.label).toMatch(/^Erreur 401, de côté jusqu'à \d{2}:\d{2}$/)
  })
  it('dernière erreur sans mise de côté', () => {
    expect(providerStatus({ ...base, stats: { ...base.stats, lastStatus: 503 } }, now)).toEqual({ label: 'Erreur 503', tone: 'warning' })
  })
  it('actif', () => {
    expect(providerStatus(base, now)).toEqual({ label: 'Actif', tone: 'success' })
  })
})

describe('providerStatus, mise de côté expirée', () => {
  it('une mise de côté passée ne compte plus', () => {
    const p = { ...base, stats: { ...base.stats, lastStatus: 429, cooldownUntil: '2026-10-16T13:00:00Z' } }
    expect(providerStatus(p, now)).toEqual({ label: 'Erreur 429', tone: 'warning' })
  })
})
