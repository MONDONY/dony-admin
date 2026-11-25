import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  FORCED_STATUSES, statusChangeBlockedReason, statusChangeErrorMessage, statusChangeMoneyEffect,
  statusChangeOptions, statusChangeSuccessMessage,
} from '@/features/bids/lib/bidActions'
import BidStatusDialog from '@/features/bids/components/BidStatusDialog.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'

const svc = vi.hoisted(() => ({ changeBidStatus: vi.fn() }))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: svc }))
import { useBidAdminActions, resetBidActionsAvailability } from '@/features/bids/composables/useBidAdminActions'

const ID = '1c1a0000-0000-4000-8000-0000000000b2'
const base = {
  id: ID, status: 'HANDED_OVER', paymentMethod: 'STRIPE', currency: 'EUR',
  money: { status: 'ESCROW', amountCents: 4800, commissionCents: 576, refundedCents: 0, currency: 'EUR' },
} as unknown as AdminBidDetail
const bid = (over: Record<string, unknown> = {}) => ({ ...base, ...over }) as AdminBidDetail

describe('changement de statut : règles', () => {
  it('modifiable seulement de ACCEPTED à ARRIVED', () => {
    for (const s of ['ACCEPTED', 'HANDED_OVER', 'IN_TRANSIT', 'ARRIVED']) {
      expect(statusChangeBlockedReason(bid({ status: s }))).toBeNull()
    }
    expect(statusChangeBlockedReason(bid({ status: 'COMPLETED' }))).toContain('déjà livré')
    for (const s of ['CANCELLED', 'REJECTED', 'PENDING', 'NO_SHOW']) {
      expect(statusChangeBlockedReason(bid({ status: s }))).toContain('acceptés ou en cours')
    }
  })

  it('options : tout sauf le statut actuel', () => {
    expect(statusChangeOptions(bid({ status: 'IN_TRANSIT' })).map(o => o.value)).toEqual(['HANDED_OVER', 'ARRIVED', 'COMPLETED'])
    expect(statusChangeOptions(bid({ status: 'ACCEPTED' }))).toHaveLength(FORCED_STATUSES.length)
  })

  it('effet argent : versement libéré à la livraison seulement', () => {
    expect(statusChangeMoneyEffect(bid(), '')).toContain('Aucun effet sur l’argent')
    expect(statusChangeMoneyEffect(bid(), 'ARRIVED')).toContain('Aucun effet sur l’argent')
    expect(statusChangeMoneyEffect(bid(), 'COMPLETED')).toContain('42,24 EUR')
    expect(statusChangeMoneyEffect(bid({ paymentMethod: 'CASH' }), 'COMPLETED')).toContain('espèces')
    expect(statusChangeMoneyEffect(bid({ money: null }), 'COMPLETED')).toContain('Aucun argent en séquestre')
  })

  it('erreurs traduites, 403 et 422 génériques', () => {
    expect(statusChangeErrorMessage({ statusCode: 409, data: { code: 'bid-status-not-changeable' } })).toContain('ne peut plus être modifié')
    expect(statusChangeErrorMessage({ statusCode: 404, data: { code: 'bid-not-found' } })).toBe('Colis introuvable.')
    expect(statusChangeErrorMessage({ statusCode: 403 })).toBe('Action réservée aux super-administrateurs.')
    expect(statusChangeErrorMessage({ statusCode: 422 })).toContain('Formulaire incomplet')
  })

  it('messages de succès', () => {
    const r = { bidId: ID, status: 'COMPLETED', previousStatus: 'HANDED_OVER', unchanged: false }
    expect(statusChangeSuccessMessage(r, 'Livré au destinataire')).toContain('Livré')
    expect(statusChangeSuccessMessage({ ...r, status: 'ARRIVED' }, 'Arrivé à destination')).toBe('Statut du colis changé en « Arrivé à destination ».')
    expect(statusChangeSuccessMessage({ ...r, unchanged: true }, 'Livré au destinataire')).toContain('rien n’a été refait')
  })
})

describe('useBidAdminActions.changeStatus', () => {
  beforeEach(() => { svc.changeBidStatus.mockReset(); resetBidActionsAvailability() })

  it('succès : motif épuré, message affiché', async () => {
    svc.changeBidStatus.mockResolvedValue({ bidId: ID, status: 'COMPLETED', previousStatus: 'HANDED_OVER', unchanged: false })
    const a = useBidAdminActions()
    expect(await a.changeStatus(ID, 'COMPLETED', '  Message WhatsApp du 24/11  ')).toBe(true)
    expect(svc.changeBidStatus).toHaveBeenCalledWith(ID, 'COMPLETED', 'Message WhatsApp du 24/11')
    expect(a.success.value).toContain('Livré')
    expect(a.busy.value).toBe(false)
  })

  it('double clic : un seul appel', async () => {
    let resolve!: (_v: unknown) => void
    svc.changeBidStatus.mockReturnValue(new Promise(r => { resolve = r }))
    const a = useBidAdminActions()
    const first = a.changeStatus(ID, 'ARRIVED', 'Preuve écrite du 24/11')
    expect(await a.changeStatus(ID, 'ARRIVED', 'Preuve écrite du 24/11')).toBe(false)
    resolve({ bidId: ID, status: 'ARRIVED', previousStatus: 'IN_TRANSIT', unchanged: false })
    expect(await first).toBe(true)
    expect(svc.changeBidStatus).toHaveBeenCalledTimes(1)
  })

  it('refus métier traduit ; ancien back : action retenue indisponible', async () => {
    svc.changeBidStatus.mockRejectedValueOnce({ statusCode: 409, data: { code: 'bid-status-not-changeable' } })
    const a = useBidAdminActions()
    expect(await a.changeStatus(ID, 'COMPLETED', 'Preuve écrite du 24/11')).toBe(false)
    expect(a.error.value).toContain('ne peut plus être modifié')
    expect(a.statusUnavailable.value).toBe(false)
    svc.changeBidStatus.mockRejectedValueOnce({ statusCode: 404 })
    await a.changeStatus(ID, 'COMPLETED', 'Preuve écrite du 24/11')
    expect(a.statusUnavailable.value).toBe(true)
  })
})

describe('BidStatusDialog', () => {
  const options = FORCED_STATUSES.filter(o => o.value !== 'HANDED_OVER')
  const moneyEffects = { '': 'EFFET NEUTRE', ARRIVED: 'EFFET NEUTRE', COMPLETED: 'EFFET LIVRÉ' }
  const mountDialog = (props: Record<string, unknown> = {}) =>
    mount(BidStatusDialog, { props: { open: true, options, moneyEffects, ...props } })

  it('fermé : rien', () => {
    expect(mountDialog({ open: false }).find('[data-test="status-dialog"]').exists()).toBe(false)
  })

  it('statut, motif de 10 caractères et confirmation explicite obligatoires', async () => {
    const w = mountDialog()
    const confirm = w.find('[data-test="status-confirm"]')
    expect(w.find('[data-test="status-money-effect"]').text()).toBe('EFFET NEUTRE')
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="status-ack"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="status-target"]').setValue('COMPLETED')
    expect(w.find('[data-test="status-money-effect"]').text()).toBe('EFFET LIVRÉ')
    await w.find('[data-test="status-ack"]').setValue(true)
    expect(confirm.attributes('disabled')).toBeDefined()
    await w.find('[data-test="status-reason"]').setValue('court')
    expect(w.find('[data-test="status-reason-hint"]').text()).toContain('10 caractères au moins')
    expect(confirm.attributes('disabled')).toBeDefined()
    await w.find('[data-test="status-reason"]').setValue('  Message WhatsApp du destinataire  ')
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['COMPLETED', 'Message WhatsApp du destinataire'])
  })

  it('changer de statut décoche la confirmation ; motif trop long refusé ; erreur et occupé', async () => {
    const w = mountDialog({ error: 'Boom', busy: true })
    expect(w.find('[data-test="status-error"]').text()).toBe('Boom')
    expect(w.find('[data-test="status-confirm"]').text()).toContain('Enregistrement')
    await w.setProps({ busy: false, error: null })
    await w.find('[data-test="status-target"]').setValue('ARRIVED')
    await w.find('[data-test="status-ack"]').setValue(true)
    await w.find('[data-test="status-target"]').setValue('COMPLETED')
    expect((w.find('[data-test="status-ack"]').element as HTMLInputElement).checked).toBe(false)
    await w.find('[data-test="status-reason"]').setValue('x'.repeat(1001))
    expect(w.find('[data-test="status-reason-hint"]').text()).toContain('1000 caractères au plus')
    await w.find('[data-test="status-confirm"]').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
    await w.find('[data-test="status-dismiss"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})

describe('BidActionsMenu : Changer le statut', () => {
  const NuxtLink = { props: ['to'], template: '<a href="#"><slot /></a>' }
  async function menuFor(role: 'SUPER_ADMIN' | 'ADMIN', over: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
    const { seedAuth } = await import('~/tests/helpers/auth')
    seedAuth(role)
    const { default: BidActionsMenu } = await import('@/features/bids/components/BidActionsMenu.vue')
    const w = mount(BidActionsMenu, {
      props: { bid: bid(over), copied: null, identifiersText: '', busy: false, cancelUnavailable: false,
        disputeUnavailable: false, ...props },
      global: { stubs: { NuxtLink } },
    })
    await w.find('[data-test="bid-actions-menu"]').trigger('click')
    return w
  }

  it('super-admin : ouvre le dialogue de statut', async () => {
    const w = await menuFor('SUPER_ADMIN')
    const item = w.find('[data-test="action-change-status"]')
    expect(item.attributes('aria-disabled')).toBeUndefined()
    await item.trigger('click')
    expect(w.emitted('open-dialog')![0]).toEqual(['status'])
  })

  it('colis livré : geste bloqué avec sa raison, aucun événement', async () => {
    const w = await menuFor('SUPER_ADMIN', { status: 'COMPLETED' })
    const item = w.find('[data-test="action-change-status"]')
    expect(item.attributes('aria-disabled')).toBe('true')
    expect(w.find('[data-test="status-disabled-reason"]').text()).toContain('déjà livré')
    await item.trigger('click')
    expect(w.emitted('open-dialog')).toBeUndefined()
  })

  it('sans ADMIN_MANAGE : bloqué ; ancien back : remplacé par l’avis d’indisponibilité', async () => {
    const w = await menuFor('ADMIN')
    expect(w.find('[data-test="action-change-status"]').attributes('aria-disabled')).toBe('true')
    const w2 = await menuFor('SUPER_ADMIN', {}, { statusUnavailable: true })
    expect(w2.find('[data-test="action-change-status"]').exists()).toBe(false)
    expect(w2.find('[data-test="unavailable-status"]').exists()).toBe(true)
  })
})
