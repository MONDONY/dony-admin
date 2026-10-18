import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResolveWalletRefundDialog from '@/features/finance/components/ResolveWalletRefundDialog.vue'
import type { AdminWalletRefundRequest } from '@/features/finance/types/index'

const XOF: AdminWalletRefundRequest = {
  id: 'r1', userId: 'u1', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-17T10:00:00',
  channel: 'MANUAL_ADMIN', userName: 'Awa Diop',
}

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(ResolveWalletRefundDialog, { props: { open: true, request: XOF, ...props } })
}
const confirmBtn = (w: ReturnType<typeof mountDialog>) => w.find('[data-test="wrr-resolve-confirm"]').element as HTMLButtonElement

describe('ResolveWalletRefundDialog', () => {
  it('ne rend rien fermé ou sans demande', () => {
    expect(mountDialog({ open: false }).find('[data-test="wrr-resolve-dialog"]').exists()).toBe(false)
    expect(mountDialog({ request: null }).find('[data-test="wrr-resolve-dialog"]').exists()).toBe(false)
  })

  it('préremplit le montant demandé dans la devise de la demande et confirme sans note', async () => {
    const w = mountDialog()
    expect((w.find('[data-test="wrr-paid-amount"]').element as HTMLInputElement).value).toBe('500')
    expect(w.find('[data-test="wrr-dialog-requested"]').text()).toBe('500 XOF')
    expect(w.text()).toContain('débité en entier')
    expect(w.find('[data-test="wrr-paid-amount-gap"]').exists()).toBe(false)
    await w.find('[data-test="wrr-resolve-confirm"]').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual([{ paidAmount: 500, note: null }])
  })

  it('émet le montant versé et la note rognée, et montre l’écart', async () => {
    const w = mountDialog()
    await w.find('[data-test="wrr-paid-amount"]').setValue('487')
    await w.find('[data-test="wrr-note"]').setValue('  Versé par Wave  ')
    expect(w.find('[data-test="wrr-paid-amount-gap"]').text()).toContain('13 XOF')
    expect(w.find('[data-test="wrr-note-count"]').text()).toBe('14 / 500')
    await w.find('[data-test="wrr-resolve-confirm"]').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual([{ paidAmount: 487, note: 'Versé par Wave' }])
  })

  it('bloque un montant invalide avec le message, comme le back', async () => {
    const w = mountDialog()
    await w.find('[data-test="wrr-paid-amount"]').setValue('487,5')
    expect(w.find('[data-test="wrr-paid-amount-error"]').text()).toBe('Pas de décimales en XOF.')
    expect(confirmBtn(w).disabled).toBe(true)
    await w.find('[data-test="wrr-paid-amount"]').setValue('600')
    expect(w.find('[data-test="wrr-paid-amount-error"]').text()).toContain('dépasser')
    expect(confirmBtn(w).disabled).toBe(true)
    await w.find('[data-test="wrr-resolve-confirm"]').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('bloque une note trop longue', async () => {
    const w = mountDialog()
    await w.find('[data-test="wrr-note"]').setValue('x'.repeat(501))
    expect(w.find('[data-test="wrr-note-count"]').classes()).toContain('text-danger')
    expect(confirmBtn(w).disabled).toBe(true)
  })

  it('en EUR : deux décimales préremplies et acceptées', async () => {
    const w = mountDialog({ request: { ...XOF, currency: 'EUR', amount: 45 } })
    expect((w.find('[data-test="wrr-paid-amount"]').element as HTMLInputElement).value).toBe('45,00')
    await w.find('[data-test="wrr-paid-amount"]').setValue('43,50')
    expect(w.find('[data-test="wrr-paid-amount-gap"]').text()).toContain('1,50 EUR')
    await w.find('[data-test="wrr-resolve-confirm"]').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual([{ paidAmount: 43.5, note: null }])
  })

  it('affiche l’erreur du back, verrouille pendant l’envoi, et annule', async () => {
    const w = mountDialog({ busy: true, error: 'Le montant versé dépasse le montant de la demande' })
    expect(w.find('[data-test="wrr-resolve-error"]').text()).toContain('dépasse')
    expect(confirmBtn(w).disabled).toBe(true)
    expect(confirmBtn(w).textContent).toContain('En cours')
    await w.find('[data-test="wrr-resolve-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('repart du montant de la nouvelle demande à chaque ouverture', async () => {
    const w = mountDialog()
    await w.find('[data-test="wrr-paid-amount"]').setValue('100')
    await w.setProps({ request: { ...XOF, id: 'r2', amount: 2000 } })
    expect((w.find('[data-test="wrr-paid-amount"]').element as HTMLInputElement).value).toBe('2000')
  })
})
