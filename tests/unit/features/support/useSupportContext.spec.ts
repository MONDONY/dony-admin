import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/support/services/supportService')
import { isSupportContext, useSupportContext } from '@/features/support/composables/useSupportContext'
import { supportService } from '@/features/support/services/supportService'
const svc = supportService as any

const ctx = { history: [{ action: 'SUPPORT_TICKET_ASSIGNED' }], notes: [{ id: 'n1', adminEmail: 'a@y.com', content: 'Note', createdAt: '2026-10-25T10:00:00' }] }

describe('useSupportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.getContext = vi.fn().mockResolvedValue(ctx)
  })

  it('lit l’historique et les notes du ticket', async () => {
    const c = useSupportContext()
    await c.load('t1')
    expect(svc.getContext).toHaveBeenCalledWith('t1')
    expect(c.context.value).toEqual(ctx)
  })

  it('ancien back (404 sans code) : rien à montrer ni à dire', async () => {
    svc.getContext.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }))
    const c = useSupportContext()
    await c.load('t1')
    expect(c.context.value).toBeNull()
    expect(c.error.value).toBeNull()
    expect(c.unavailable.value).toBe(true)
  })

  it('panne : une phrase', async () => {
    svc.getContext.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Base indisponible' } }))
    const c = useSupportContext()
    await c.load('t1')
    expect(c.error.value).toBe('Base indisponible')
  })

  it('garde de forme', () => {
    expect(isSupportContext(ctx)).toBe(true)
    expect(isSupportContext({ history: [] })).toBe(false)
    expect(isSupportContext(null)).toBe(false)
    expect(isSupportContext('<html>')).toBe(false)
  })
})
