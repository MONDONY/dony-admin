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

  it("n'émet pas submit quand le formulaire est invalide (canSubmit false)", async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    // code vide → canSubmit = false → onSubmit early return
    await w.find('[data-test="promo-submit"]').trigger('submit')
    expect(w.emitted('submit')).toBeFalsy()
  })

  it('émet submit avec validFrom et validTo formatées en ISO quand saisies', async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    await w.find('[data-test="promo-code"]').setValue('NOEL25')
    await w.find('[data-test="promo-rate"]').setValue('25')
    await w.find('[data-test="promo-valid-from"]').setValue('2026-12-01')
    await w.find('[data-test="promo-valid-to"]').setValue('2026-12-31')
    await w.find('[data-test="promo-submit"]').trigger('submit')
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.validFrom).toBe('2026-12-01T00:00:00')
    expect(payload.validTo).toBe('2026-12-31T23:59:59')
  })

  it('émet submit avec validFrom et validTo null quand non saisies', async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    await w.find('[data-test="promo-code"]').setValue('ETE26')
    await w.find('[data-test="promo-rate"]').setValue('15')
    // Pas de saisie de dates → doivent rester null
    await w.find('[data-test="promo-submit"]').trigger('submit')
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.validFrom).toBeNull()
    expect(payload.validTo).toBeNull()
  })

  it('émet submit avec maxRedemptions null quand non saisi', async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    await w.find('[data-test="promo-code"]').setValue('LIBRE')
    await w.find('[data-test="promo-rate"]').setValue('5')
    await w.find('[data-test="promo-submit"]').trigger('submit')
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.maxRedemptions).toBeNull()
  })

  it('émet submit avec maxRedemptions et perUserLimit définis quand saisis', async () => {
    const w = mount(PromoForm, { props: { editing: null } })
    await w.find('[data-test="promo-code"]').setValue('LIMITE')
    await w.find('[data-test="promo-rate"]').setValue('10')
    await w.find('[data-test="promo-max"]').setValue('50')
    await w.find('[data-test="promo-per-user"]').setValue('3')
    await w.find('[data-test="promo-submit"]').trigger('submit')
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.maxRedemptions).toBe(50)
    expect(payload.perUserLimit).toBe(3)
  })

  it('préremplit validFrom quand editing a une date de début', () => {
    const editing = {
      id: 'p2', code: 'DEBUT', rate: 0.2, target: 'ANY' as const,
      validFrom: '2026-06-01T00:00:00', validTo: null,
      maxRedemptions: null, perUserLimit: null,
      redeemedCount: 0, status: 'ACTIVE' as const, createdAt: '2026-01-01T00:00:00Z',
    }
    const w = mount(PromoForm, { props: { editing } })
    expect((w.find('[data-test="promo-valid-from"]').element as HTMLInputElement).value).toBe('2026-06-01')
  })
})
