import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromoForm from '@/features/promo/components/PromoForm.vue'

describe('PromoForm', () => {
  it('emits submit with the entered values', async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    await w.find('[data-test="promo-code"]').setValue('SUMMER20')
    await w.find('[data-test="promo-value"]').setValue('20')
    await w.find('[data-test="promo-submit"]').trigger('submit')
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.code).toBe('SUMMER20')
    expect(payload.value).toBe(20)
    expect(payload.type).toBe('PERCENT')
  })

  it('disables submit when code is empty', () => {
    const w = mount(PromoForm, { props: { editing: null } })
    expect((w.find('[data-test="promo-submit"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('prefills fields when editing', () => {
    const editing = { id: 'p1', code: 'WELCOME10', type: 'PERCENT', value: 10, maxRedemptions: 100, redemptionCount: 5, expiresAt: null, active: true, createdAt: '2026-06-01T10:00:00Z' }
    const w = mount(PromoForm, { props: { editing } })
    expect((w.find('[data-test="promo-code"]').element as HTMLInputElement).value).toBe('WELCOME10')
    expect((w.find('[data-test="promo-value"]').element as HTMLInputElement).value).toBe('10')
  })

  it('emits cancel', async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    await w.find('[data-test="promo-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
  })
})
