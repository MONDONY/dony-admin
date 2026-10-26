import { describe, it, expect, vi, beforeEach } from 'vitest'

const { svc } = vi.hoisted(() => ({ svc: { list: vi.fn() } }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))

import { useAlertSummary } from '@/features/alerts/composables/useAlertSummary'

const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 200 })
const mk = (id: string, severity: string, over: Record<string, unknown> = {}) => ({
  id, type: 'ESCROW_J48_TIMEOUT', severity, payload: {}, resolved: false, resolvedAt: null, createdAt: new Date(Date.now() - 86_400_000).toISOString(), ...over,
})

describe('useAlertSummary', () => {
  beforeEach(() => { svc.list.mockReset() })

  it('compte toutes les ouvertes et les résolues récentes avec deux lectures larges', async () => {
    svc.list.mockImplementation(async (filters: { resolved: string }) => (filters.resolved === 'OPEN'
      ? page([mk('c', 'CRITICAL'), mk('w', 'WARN'), mk('i', 'INFO')])
      : page([mk('r', 'WARN', { resolved: true, resolvedAt: new Date().toISOString() })])))
    const s = useAlertSummary()
    expect(s.loaded.value).toBe(false)
    await s.refresh()
    expect(s.summary.value).toMatchObject({ critical: 1, warn: 1, info: 1, resolvedThisWeek: 1 })
    expect(s.loaded.value).toBe(true)
    expect(svc.list.mock.calls.map((c) => [c[0].resolved, c[2]])).toEqual([['OPEN', 200], ['RESOLVED', 100]])
  })

  it('panne : le bandeau reste à zéro, sans erreur', async () => {
    svc.list.mockRejectedValue(new Error('boom'))
    const s = useAlertSummary()
    await expect(s.refresh()).resolves.toBeUndefined()
    expect(s.loaded.value).toBe(false)
    expect(s.summary.value.critical).toBe(0)
  })
})
