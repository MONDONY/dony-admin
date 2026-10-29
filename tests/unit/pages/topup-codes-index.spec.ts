/** Page Codes de recharge : le code créé n'est montré qu'une fois, dans la fenêtre qui suit la création. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  redemptions: vi.fn(),
  revoke: vi.fn(),
  generateCode: vi.fn(),
}))
vi.mock('@/features/topup-codes/services/topupCodesService', () => ({ topupCodesService: svc }))

const base = {
  id: 't1', amount: 2000, currency: 'XOF', maxRedemptions: 100, redeemedCount: 0, remaining: 100,
  expiresAt: '2027-01-01T00:00:00', displayStatus: 'ACTIVE' as const, note: null, createdAt: '2026-10-29T10:00:00',
  createdBy: 'u1', createdByEmail: 'admin@yadony.com', revokedAt: null,
}

const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/topup-codes/index.vue')
  const w = mount(mod.default, { global: { stubs: { PaginationControls: true } } })
  mounted.push(w)
  await flushPromises()
  return w
}

async function createFromForm(w: VueWrapper) {
  await w.get('[data-test="new-topup-code"]').trigger('click')
  await w.get('[data-test="topup-amount"]').setValue('2000')
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('pages/topup-codes', () => {
  afterEach(() => { mounted.splice(0).forEach(w => w.unmount()) })
  beforeEach(() => {
    seedAuth('ADMIN')
    svc.list.mockReset().mockResolvedValue([{ ...base, codeHint: 'EF67' }])
    svc.create.mockReset().mockResolvedValue({ ...base, code: 'YD-AB23-CD45-EF67', codeHint: 'EF67' })
  })

  it('après création : le code complet est montré une fois, puis seule sa fin reste dans la liste', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountPage()
    await createFromForm(w)

    expect(w.get('[data-test="topup-issued-code"]').text()).toBe('YD-AB23-CD45-EF67')
    await w.get('[data-test="topup-issued-copy"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('YD-AB23-CD45-EF67')
    expect(w.get('[data-test="topup-issued-copy"]').text()).toBe('Copié')

    await w.get('[data-test="topup-issued-close"]').trigger('click')
    expect(w.find('[data-test="topup-issued"]').exists()).toBe(false)
    expect(w.get('[data-test="code-t1"]').text()).toBe('•••• EF67')
    vi.unstubAllGlobals()
    vi.stubGlobal('definePageMeta', vi.fn())
  })

  it('réponse sans code (création refusée côté back ou ancien format) : pas de fenêtre', async () => {
    svc.create.mockResolvedValue({ ...base, codeHint: 'EF67' })
    const w = await mountPage()
    await createFromForm(w)
    expect(w.find('[data-test="topup-issued"]').exists()).toBe(false)
  })

  it('échec de création : formulaire gardé ouvert, pas de fenêtre de code', async () => {
    svc.create.mockRejectedValue(Object.assign(new Error('400'), { data: { detail: 'Code trop court' } }))
    const w = await mountPage()
    await createFromForm(w)
    expect(w.find('[data-test="topup-overlay"]').exists()).toBe(true)
    expect(w.find('[data-test="topup-issued"]').exists()).toBe(false)
    expect(w.get('[data-test="topup-error"]').text()).toContain('Code trop court')
  })
})
