import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const { svc } = vi.hoisted(() => ({ svc: { getContext: vi.fn() } }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))

import { isAlertContext, useAlertContext } from '@/features/alerts/composables/useAlertContext'

describe('isAlertContext', () => {
  it('reconnaît une vraie réponse et refuse toute autre forme', () => {
    expect(isAlertContext({ related: [], history: [] })).toBe(true)
    expect(isAlertContext({ related: [] })).toBe(false)
    expect(isAlertContext({ content: [] })).toBe(false)
    expect(isAlertContext(null)).toBe(false)
    expect(isAlertContext('<html>')).toBe(false)
  })
})

describe('useAlertContext', () => {
  beforeEach(() => { svc.getContext.mockReset() })

  it('charge le contexte de l’alerte ouverte', async () => {
    svc.getContext.mockResolvedValue({ related: [{ id: 'a2' }], history: [] })
    const c = useAlertContext()
    await c.load('a1')
    expect(svc.getContext).toHaveBeenCalledWith('a1')
    expect(c.context.value).toEqual({ related: [{ id: 'a2' }], history: [] })
    expect(c.unavailable.value).toBe(false)
  })

  it('ancien back (404 sans code) : rien à montrer, aucune erreur', async () => {
    svc.getContext.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }))
    const c = useAlertContext()
    await c.load('a1')
    expect(c.context.value).toBeNull()
    expect(c.error.value).toBeNull()
    expect(c.unavailable.value).toBe(true)
  })

  it('réponse d’une autre forme : traitée comme absente', async () => {
    svc.getContext.mockResolvedValue({ content: [] })
    const c = useAlertContext()
    await c.load('a1')
    expect(c.context.value).toBeNull()
    expect(c.unavailable.value).toBe(true)
  })

  it('panne : une phrase discrète', async () => {
    svc.getContext.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }))
    const c = useAlertContext()
    await c.load('a1')
    await flushPromises()
    expect(c.error.value).toBeTruthy()
  })

  it('J / K enchaînés : la réponse d’un dossier quitté est ignorée', async () => {
    let first!: (_v: unknown) => void
    svc.getContext.mockImplementationOnce(() => new Promise((r) => { first = r }))
    svc.getContext.mockResolvedValueOnce({ related: [{ id: 'b' }], history: [] })
    const c = useAlertContext()
    const p1 = c.load('a1')
    await c.load('a2')
    first({ related: [{ id: 'a' }], history: [] })
    await p1
    expect(c.context.value).toEqual({ related: [{ id: 'b' }], history: [] })
  })
})
