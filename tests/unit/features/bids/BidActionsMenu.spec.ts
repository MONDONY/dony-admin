/** Menu « Actions » du tiroir colis : mêmes gestes, mêmes garde-fous, mêmes `data-test` qu'avant. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import BidActionsMenu from '@/features/bids/components/BidActionsMenu.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { props: ['to'], template: '<a href="#" :data-to="JSON.stringify(to)"><slot /></a>' }
const money = { paymentId: 'pay-1', status: 'ESCROW', rail: 'STRIPE', amountCents: 4800, commissionCents: 576, refundedCents: 0,
  currency: 'EUR', capturedAt: null, escrowReleasedAt: null, payoutHeldAt: null, disputed: false }
const links = { negotiationThreadId: null, disputeId: null, disputeStatus: null, conversationId: 'fs-42', cancellationId: null }
const bid = (over: Partial<AdminBidDetail> = {}) => ({
  id: 'b1', status: 'ACCEPTED', paymentMethod: 'STRIPE', netEur: 40, currency: 'EUR', money, links, ...over,
}) as AdminBidDetail

const wrappers: VueWrapper[] = []
function mountMenu(props: Record<string, unknown> = {}) {
  const w = mount(BidActionsMenu, {
    props: { bid: bid(), copied: null, identifiersText: 'Colis : b1', busy: false, cancelUnavailable: false,
      disputeUnavailable: false, success: null, error: null, ...props },
    global: { stubs: { NuxtLink } }, attachTo: document.body,
  })
  wrappers.push(w)
  return w
}
const open = async (w: VueWrapper) => { await w.find('[data-test="bid-actions-menu"]').trigger('click') }

describe('BidActionsMenu', () => {
  beforeEach(() => { seedAuth('SUPER_ADMIN') })
  afterEach(() => { while (wrappers.length) wrappers.pop()!.unmount() })

  it('menu_opensAndClosesWithEscape : aria, focus sur la première entrée, flèches, Échap rend le focus', async () => {
    const w = mountMenu()
    const btn = w.find('[data-test="bid-actions-menu"]')
    expect(btn.attributes('aria-haspopup')).toBe('menu')
    expect(btn.attributes('aria-expanded')).toBe('false')
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await open(w)
    expect(btn.attributes('aria-expanded')).toBe('true')
    const menu = w.find('[role="menu"]')
    expect(menu.exists()).toBe(true)
    const items = menu.findAll('[role="menuitem"]')
    expect(items.map(i => i.attributes('data-test'))).toEqual(
      ['action-payment', 'action-conversation', 'action-copy-ids', 'action-cancel', 'action-open-dispute'])
    expect(document.activeElement).toBe(items[0]!.element)
    await menu.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1]!.element)
    await menu.trigger('keydown', { key: 'ArrowUp' })
    await menu.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[4]!.element)
    await menu.trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(items[0]!.element)
    await menu.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(items[4]!.element)
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    items[4]!.element.dispatchEvent(esc)
    await w.vm.$nextTick()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(btn.element)
  })

  it('clic à l’extérieur et second clic sur le bouton ferment le menu', async () => {
    const w = mountMenu()
    await open(w)
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await open(w)
    await w.find('[role="menu"]').trigger('pointerdown')
    expect(w.find('[role="menu"]').exists()).toBe(true)
    await open(w)
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('liens : paiement, conversation ; litige et absence selon les liens', async () => {
    const w = mountMenu({ bid: bid({ status: 'NO_SHOW', links: { ...links, disputeId: 'dsp-1', disputeStatus: 'OPEN', cancellationId: 'c-1' } }) })
    await open(w)
    expect(w.find('[data-test="action-payment"]').attributes('data-to')).toContain('"open":"pay-1"')
    expect(w.find('[data-test="action-conversation"]').attributes('data-to')).toContain('"open":"fs-42"')
    expect(w.find('[data-test="action-dispute"]').text()).toBe('Voir le litige (ouvert)')
    expect(w.find('[data-test="action-dispute"]').attributes('data-to')).toContain('"open":"dsp-1"')
    expect(w.find('[data-test="action-noshow"]').attributes('data-to')).toContain('"tab":"noshows"')
    await w.find('[data-test="action-payment"]').trigger('click')
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('menu_hidesPaymentLinkWithoutPaymentView : liens masqués sans les droits', async () => {
    seedAuth('SUPPORT', { PAYMENT_VIEW: false, DISPUTE_VIEW: false, MODERATION_VIEW: false, SUPPORT_TICKET_MANAGE: false })
    const w = mountMenu({ bid: bid({ status: 'NO_SHOW', links: { ...links, disputeId: 'dsp-1', cancellationId: 'c-1' } }) })
    await open(w)
    expect(w.find('[data-test="action-payment"]').exists()).toBe(false)
    expect(w.find('[data-test="action-dispute"]').exists()).toBe(false)
    expect(w.find('[data-test="action-noshow"]').exists()).toBe(false)
    expect(w.find('[data-test="action-conversation"]').exists()).toBe(false)
    expect(w.find('[data-test="unavailable-support"]').text()).toContain('réservé aux admins qui gèrent le support')
    const noMoney = mountMenu({ bid: bid({ money: null }) })
    seedAuth('SUPER_ADMIN')
    await open(noMoney)
    expect(noMoney.find('[data-test="action-payment"]').exists()).toBe(false)
  })

  it('menu_cancelDisabledReason_shown : sans ADMIN_MANAGE, entrées désactivées avec la raison', async () => {
    seedAuth('ADMIN')
    const w = mountMenu()
    await open(w)
    const cancel = w.find('[data-test="action-cancel"]')
    expect(cancel.attributes('disabled')).toBeDefined()
    expect(cancel.attributes('aria-describedby')).toBe('bid-cancel-reason')
    expect(w.find('[data-test="action-open-dispute"]').attributes('disabled')).toBeDefined()
    expect(w.find('#bid-cancel-reason').attributes('data-test')).toBe('cancel-disabled-reason')
    expect(w.find('[data-test="cancel-disabled-reason"]').text()).toBe('Annuler le colis : Réservé aux super-administrateurs : demandez à l’un d’eux.')
    expect(w.find('[data-test="dispute-disabled-reason"]').text()).toContain('Réservé aux super-administrateurs')
    // Les flèches sautent les entrées désactivées.
    const menu = w.find('[role="menu"]')
    await menu.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(w.find('[data-test="action-copy-ids"]').element)
  })

  it('colis livré et versé : raisons du back ; occupé : entrées désactivées', async () => {
    const w = mountMenu({ bid: bid({ status: 'COMPLETED', money: { ...money, status: 'RELEASED', escrowReleasedAt: '2026-10-09T10:00:00' } }) })
    await open(w)
    expect(w.find('[data-test="cancel-disabled-reason"]').text()).toContain('déjà livré')
    expect(w.find('[data-test="dispute-disabled-reason"]').text()).toContain('déjà été payé')
    const busy = mountMenu({ busy: true })
    await open(busy)
    expect(busy.find('[data-test="action-cancel"]').attributes('disabled')).toBeDefined()
    expect(busy.find('[data-test="cancel-disabled-reason"]').exists()).toBe(false)
  })

  it('ancien back : gestes remplacés par « action indisponible »', async () => {
    const w = mountMenu({ cancelUnavailable: true, disputeUnavailable: true })
    await open(w)
    expect(w.find('[data-test="action-cancel"]').exists()).toBe(false)
    expect(w.find('[data-test="action-open-dispute"]').exists()).toBe(false)
    expect(w.find('[data-test="unavailable-cancel"]').text()).toContain('Action indisponible sur cet environnement')
    expect(w.find('[data-test="unavailable-dispute"]').exists()).toBe(true)
  })

  it('gestes : ferment le menu et demandent la modale ; copier garde le menu ouvert', async () => {
    const w = mountMenu()
    await open(w)
    await w.find('[data-test="action-copy-ids"]').trigger('click')
    expect(w.emitted('copy')?.[0]).toEqual(['all', 'Colis : b1'])
    expect(w.find('[role="menu"]').exists()).toBe(true)
    await w.setProps({ copied: 'all' })
    expect(w.find('[data-test="action-copy-ids"]').text()).toBe('Identifiants copiés')
    await w.find('[data-test="action-cancel"]').trigger('click')
    expect(w.emitted('open-dialog')?.[0]).toEqual(['cancel'])
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await open(w)
    await w.find('[data-test="action-open-dispute"]').trigger('click')
    expect(w.emitted('open-dialog')?.[1]).toEqual(['dispute'])
  })

  it('messages de succès et d’erreur visibles menu fermé, erreur masquée pendant une modale', async () => {
    const w = mountMenu({ success: 'Remboursement lancé', error: null })
    expect(w.find('[data-test="action-success"]').text()).toBe('Remboursement lancé')
    await w.setProps({ success: null, error: 'Refusé' })
    expect(w.find('[data-test="action-error"]').text()).toBe('Refusé')
    await w.setProps({ dialogOpen: true })
    expect(w.find('[data-test="action-error"]').exists()).toBe(false)
  })
})
