import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TopupCodeForm from '@/features/topup-codes/components/TopupCodeForm.vue'

describe('TopupCodeForm', () => {
  it('bouton Créer désactivé tant que le montant est vide', () => {
    const w = mount(TopupCodeForm, { props: { generate: vi.fn() } })
    expect(w.get('[data-test="topup-submit"]').attributes('disabled')).toBeDefined()
  })

  it('soumet le code en majuscules, la quantité et la devise ; code vide → null', async () => {
    const w = mount(TopupCodeForm, { props: { generate: vi.fn() } })
    await w.get('[data-test="topup-amount"]').setValue('2000')
    await w.get('[data-test="topup-currency"]').setValue('XOF')
    await w.get('[data-test="topup-quantity"]').setValue('100')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')![0][0]).toEqual({
      code: null, amount: 2000, currency: 'XOF', maxRedemptions: 100, expiresAt: null, note: null,
    })
    await w.get('[data-test="topup-code"]').setValue(' dakar-2000-ok ')
    await w.get('form').trigger('submit')
    expect((w.emitted('submit')![1][0] as any).code).toBe('DAKAR-2000-OK')
  })

  it('accepte une virgule décimale', async () => {
    const w = mount(TopupCodeForm, { props: { generate: vi.fn() } })
    await w.get('[data-test="topup-amount"]').setValue('10,50')
    await w.get('[data-test="topup-currency"]').setValue('EUR')
    await w.get('form').trigger('submit')
    expect((w.emitted('submit')![0][0] as any).amount).toBe(10.5)
  })

  it('le bouton Générer remplit le champ code', async () => {
    const generate = vi.fn().mockResolvedValue('YD-AB23-CD45')
    const w = mount(TopupCodeForm, { props: { generate } })
    await w.get('[data-test="topup-generate"]').trigger('click')
    await flushPromises()
    expect((w.get('[data-test="topup-code"]').element as HTMLInputElement).value).toBe('YD-AB23-CD45')
  })

  it('date d’expiration choisie envoyée en fin de journée', async () => {
    const w = mount(TopupCodeForm, { props: { generate: vi.fn() } })
    await w.get('[data-test="topup-amount"]').setValue('5')
    await w.get('[data-test="topup-expires"]').setValue('2026-12-31')
    await w.get('form').trigger('submit')
    expect((w.emitted('submit')![0][0] as any).expiresAt).toBe('2026-12-31T23:59:59')
  })

  it('code saisi de moins de 10 lettres ou chiffres : Créer désactivé et règle en rouge', async () => {
    const w = mount(TopupCodeForm, { props: { generate: vi.fn() } })
    await w.get('[data-test="topup-amount"]').setValue('10')
    await w.get('[data-test="topup-code"]').setValue('DAKAR-2000')
    expect(w.get('[data-test="topup-submit"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="topup-code-rule"]').classes()).toContain('text-danger')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    await w.get('[data-test="topup-code"]').setValue('DAKAR-20001')
    expect(w.get('[data-test="topup-submit"]').attributes('disabled')).toBeUndefined()
    expect(w.get('[data-test="topup-code-rule"]').classes()).not.toContain('text-danger')
  })
})
