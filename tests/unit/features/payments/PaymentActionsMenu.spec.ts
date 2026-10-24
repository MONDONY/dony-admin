/** Menu « Actions » du tiroir paiement : chaque geste listé, grisé avec sa raison quand impossible. */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import PaymentActionsMenu from '@/features/payments/components/PaymentActionsMenu.vue'
import { paymentActions, type PaymentAction } from '@/features/payments/lib/paymentActions'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

const pay = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
  id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 100, currency: 'EUR',
  createdAt: '2026-10-19T14:02:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false, ...over,
})
const wrappers: VueWrapper[] = []
function mountMenu(actions: PaymentAction[] = paymentActions(pay(), () => true, false), busy = false) {
  const w = mount(PaymentActionsMenu, { props: { actions, busy }, attachTo: document.body })
  wrappers.push(w)
  return w
}
afterEach(() => { while (wrappers.length) wrappers.pop()!.unmount() })

describe('PaymentActionsMenu', () => {
  it('fermé par défaut, s’ouvre au clic sur « Actions »', async () => {
    const w = mountMenu()
    const trigger = w.find('[data-test="payment-actions-menu"]')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(w.find('[data-test="action-release"]').exists()).toBe(false)
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(w.findAll('[role="menuitem"]')).toHaveLength(4)
  })

  it('un geste possible émet son identifiant et referme le menu', async () => {
    const w = mountMenu()
    await w.find('[data-test="payment-actions-menu"]').trigger('click')
    await w.find('[data-test="action-refund"]').trigger('click')
    expect(w.emitted('act')).toEqual([['refund']])
    expect(w.find('[data-test="action-refund"]').exists()).toBe(false)
  })

  it('un geste impossible reste visible, aria-disabled, avec sa raison, et n’émet rien', async () => {
    const w = mountMenu(paymentActions(pay({ status: 'RELEASED' }), () => true, false))
    await w.find('[data-test="payment-actions-menu"]').trigger('click')
    const release = w.find('[data-test="action-release"]')
    expect(release.attributes('aria-disabled')).toBe('true')
    const reason = w.find(`#${release.attributes('aria-describedby')}`)
    expect(reason.text()).toContain('séquestre')
    await release.trigger('click')
    expect(w.emitted('act')).toBeUndefined()
  })

  it('pendant un envoi : gestes désactivés, « En cours… »', async () => {
    const w = mountMenu(undefined, true)
    await w.find('[data-test="payment-actions-menu"]').trigger('click')
    const release = w.find('[data-test="action-release"]')
    expect(release.attributes('disabled')).toBeDefined()
    expect(release.text()).toContain('En cours')
  })

  it('clavier : ↓ ouvre sur la première entrée, Échap referme sans fermer le tiroir', async () => {
    const w = mountMenu()
    const trigger = w.find('[data-test="payment-actions-menu"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(document.activeElement?.getAttribute('data-test')).toBe('action-release')
    await w.find('[data-test="action-release"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-test')).toBe('action-refund')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.activeElement!.dispatchEvent(esc)
    await nextTick()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('[data-test="action-release"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })

  it('clavier : ↑ ouvre sur la dernière entrée, Début / Fin, ↑ boucle, Tab referme ; second clic referme', async () => {
    const w = mountMenu()
    const trigger = w.find('[data-test="payment-actions-menu"]')
    await trigger.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(document.activeElement?.getAttribute('data-test')).toBe('action-retry-refund')
    const press = async (key: string) => { await w.find(`[data-test="${document.activeElement?.getAttribute('data-test')}"]`).trigger('keydown', { key }) }
    await press('Home')
    expect(document.activeElement?.getAttribute('data-test')).toBe('action-release')
    await press('ArrowUp')
    expect(document.activeElement?.getAttribute('data-test')).toBe('action-retry-refund')
    await press('End')
    expect(document.activeElement?.getAttribute('data-test')).toBe('action-retry-refund')
    await press('x')
    expect(document.activeElement?.getAttribute('data-test')).toBe('action-retry-refund')
    await press('Tab')
    expect(w.find('[data-test="action-release"]').exists()).toBe(false)
    await trigger.trigger('keydown', { key: 'Enter' })
    await trigger.trigger('click')
    await trigger.trigger('click')
    expect(w.find('[data-test="action-release"]').exists()).toBe(false)
  })

  it('clic hors du menu : refermé', async () => {
    const w = mountMenu()
    await w.find('[data-test="payment-actions-menu"]').trigger('click')
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(w.find('[data-test="action-release"]').exists()).toBe(false)
  })

  it('expose focus() pour rendre le focus au bouton après une modale', () => {
    const w = mountMenu()
    ;(w.vm as unknown as { focus: () => void }).focus()
    expect(document.activeElement).toBe(w.find('[data-test="payment-actions-menu"]').element)
  })
})
