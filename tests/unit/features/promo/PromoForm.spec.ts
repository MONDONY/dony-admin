import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromoForm from '@/features/promo/components/PromoForm.vue'

describe('PromoForm', () => {
  it('emits submit with the entered values (rate as fraction)', async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    await w.find('[data-test="promo-code"]').setValue('summer20')
    await w.find('[data-test="promo-rate"]').setValue('20')
    await w.find('[data-test="promo-submit"]').trigger('submit')
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.code).toBe('SUMMER20')
    expect(payload.rate).toBe(0.2)
    expect(payload.target).toBe('ANY')
    expect(payload.perUserLimit).toBe(1)
  })

  it('disables submit when code is empty', () => {
    const w = mount(PromoForm, { props: { editing: null } })
    expect((w.find('[data-test="promo-submit"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('prefills fields when editing', () => {
    const editing = {
      id: 'p1', code: 'WELCOME10', rate: 0.1, target: 'SENDER' as const,
      validFrom: null, validTo: '2026-12-31T23:59:59', maxRedemptions: 100,
      perUserLimit: 2, redeemedCount: 5, status: 'ACTIVE' as const, createdAt: '2026-06-01T10:00:00Z',
    }
    const w = mount(PromoForm, { props: { editing } })
    expect((w.find('[data-test="promo-code"]').element as HTMLInputElement).value).toBe('WELCOME10')
    expect((w.find('[data-test="promo-rate"]').element as HTMLInputElement).value).toBe('10')
    expect((w.find('[data-test="promo-target"]').element as HTMLSelectElement).value).toBe('SENDER')
  })

  it('emits cancel', async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    await w.find('[data-test="promo-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
  })
})
