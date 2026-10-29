/** Page Corrections à approuver : file PENDING, approbation par un second admin, retrait par l'auteur. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())

const svc = vi.hoisted(() => ({
  listAdjustmentRequests: vi.fn(),
  approveAdjustmentRequest: vi.fn(),
  rejectAdjustmentRequest: vi.fn(),
}))
vi.mock('@/features/wallet/services/walletService', () => ({ walletService: svc }))

const request = (id: string, requestedBy: string) => ({
  id, userId: 'user-1', currency: 'EUR', direction: 'CREDIT', amount: 150, eurEquivalent: 150,
  reason: 'Geste commercial après litige', status: 'PENDING', requestedBy,
  requestedByEmail: `${requestedBy}@yadony.com`, decidedBy: null, decidedByEmail: null, decidedAt: null,
  decisionNote: null, transactionId: null, createdAt: '2026-10-28T10:00:00',
})
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/ajustements-solde/index.vue')
  const w = mount(mod.default, { global: { stubs: { PaginationControls: true, NuxtLink: { template: '<a><slot /></a>' } } } })
  mounted.push(w)
  await flushPromises()
  return w
}

describe('pages/ajustements-solde', () => {
  afterEach(() => { mounted.splice(0).forEach(w => w.unmount()) })
  beforeEach(() => {
    seedAuth('ADMIN')
    svc.listAdjustmentRequests.mockReset().mockResolvedValue(page([request('r-other', 'u2'), request('r-own', 'u1')]))
    svc.approveAdjustmentRequest.mockReset().mockResolvedValue({})
    svc.rejectAdjustmentRequest.mockReset().mockResolvedValue({})
  })

  it('file vide : message dédié', async () => {
    svc.listAdjustmentRequests.mockResolvedValue(page([]))
    const w = await mountPage()
    expect(svc.listAdjustmentRequests).toHaveBeenCalledWith('PENDING', 0, 20)
    expect(w.find('[data-test="approvals-empty"]').exists()).toBe(true)
  })

  it('sa propre demande : Approuver désactivé, bouton « Retirer » ; celle d’un autre : « Rejeter »', async () => {
    const w = await mountPage()
    expect(w.get('[data-test="approval-approve-r-own"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="approval-approve-r-other"]').attributes('disabled')).toBeUndefined()
    expect(w.get('[data-test="approval-reject-r-own"]').text()).toBe('Retirer')
    expect(w.get('[data-test="approval-reject-r-other"]').text()).toBe('Rejeter')
    expect(w.get('[data-test="approval-amount-r-other"]').text()).toContain('+')
  })

  it('approuver la demande d’un autre : confirmation puis appel et message de succès', async () => {
    const w = await mountPage()
    await w.get('[data-test="approval-approve-r-other"]').trigger('click')
    expect(w.get('[role="dialog"]').text()).toContain('u2@yadony.com')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.approveAdjustmentRequest).toHaveBeenCalledWith('r-other')
    expect(w.get('[data-test="approvals-success"]').text()).toContain('approuvée')
  })

  it('retirer sa propre demande : dialogue « Retirer », note obligatoire, appel du rejet', async () => {
    const w = await mountPage()
    await w.get('[data-test="approval-reject-r-own"]').trigger('click')
    const dialog = w.get('[role="dialog"]')
    expect(dialog.text()).toContain('Retirer votre correction')
    expect(dialog.text()).toContain('vous la retirez')
    expect(w.get('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="reason"]').setValue('Saisie en double')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.rejectAdjustmentRequest).toHaveBeenCalledWith('r-own', 'Saisie en double')
  })

  it('rejeter la demande d’un autre : libellés de rejet', async () => {
    const w = await mountPage()
    await w.get('[data-test="approval-reject-r-other"]').trigger('click')
    expect(w.get('[role="dialog"]').text()).toContain('Rejeter la correction')
    await w.get('[data-test="cancel"]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(svc.rejectAdjustmentRequest).not.toHaveBeenCalled()
  })

  it('refus du back (409) : le message reste affiché après le rechargement', async () => {
    svc.approveAdjustmentRequest.mockRejectedValue({
      response: { status: 409, data: { detail: 'Cette demande a déjà été décidée' } },
    })
    const w = await mountPage()
    await w.get('[data-test="approval-approve-r-other"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.listAdjustmentRequests).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="approvals-error"]').exists()).toBe(true)
  })
})
