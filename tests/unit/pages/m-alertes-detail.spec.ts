import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

vi.stubGlobal('definePageMeta', vi.fn())
const U = '3f2a9c1e-1111-4222-8333-444455556666'
const routeState: { params: Record<string, unknown> } = { params: { id: U } }
vi.stubGlobal('useRoute', () => routeState)

const svc = vi.hoisted(() => ({
  get: vi.fn(), list: vi.fn(), resolve: vi.fn(), resolveBatch: vi.fn(), reopen: vi.fn(), snooze: vi.fn(), unsnooze: vi.fn(), violations: vi.fn(), getContext: vi.fn(),
}))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))
const mobile = vi.hoisted(() => ({ claimAlert: vi.fn(), releaseAlert: vi.fn() }))
vi.mock('@/features/mobile/services/mobileService', () => ({ mobileService: mobile }))

import Page from '@/pages/m/alertes/[id].vue'
import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import { seedAuth } from '../../helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const base = {
  id: U, type: 'PAYOUT_HELD_abc', severity: 'CRITICAL', payload: { amount: 120, currency: 'EUR' },
  resolved: false, resolvedAt: null, createdAt: '2026-11-26T08:00:00',
}
const mountPage = async () => {
  const w = mount(Page, { global: { stubs: { NuxtLink } } })
  await flushPromises()
  return w
}
const err = (status: number, code?: string) => Object.assign(new Error('x'), { statusCode: status, data: code ? { code } : {} })

describe('m/alertes/[id] page', () => {
  beforeEach(() => {
    Object.values(svc).forEach(f => f.mockReset())
    Object.values(mobile).forEach(f => f.mockReset())
    routeState.params = { id: U }
    seedAuth('ADMIN')
    svc.get.mockResolvedValue({ ...base })
  })

  it('detail_showsFactsExplanationAndDesktopSteps', async () => {
    const w = await mountPage()
    const guide = alertGuide('PAYOUT_HELD_abc')
    expect(w.find('[data-test="alert-title"]').text()).toBe(guide.title)
    expect(w.find('[data-test="tag-severity"]').text()).toBe('Critique')
    expect(w.find('[data-test="tag-category"]').text()).toBe(guide.category)
    expect(w.find('[data-test="facts"]').text()).toContain('Montant')
    expect(w.find('[data-test="facts"]').text()).toContain('120')
    expect(w.find('[data-test="explanation"]').text()).toContain('Pourquoi c’est important')
    expect(w.find('[data-test="explanation"]').text()).toContain(guide.explanation)
    const steps = w.findAll('[data-test="desktop-steps"] li').map(l => l.text())
    expect(steps).toEqual(guide.actions)
    expect(w.find('[data-test="desktop-steps"]').text()).toContain('Ensuite, sur l’ordinateur')
    expect(w.text()).not.toContain('—')
  })

  it('claimButton_callsClaimAndShowsOwner', async () => {
    mobile.claimAlert.mockResolvedValue({ ...base, claimedByName: 'admin@yadony.com', claimedAt: '2026-11-26T09:00:00' })
    const w = await mountPage()
    const btn = w.find('[data-test="claim-button"]')
    expect(btn.text()).toBe('J’ai vu, je m’en occupe')
    await btn.trigger('click')
    await flushPromises()
    expect(mobile.claimAlert).toHaveBeenCalledWith(U)
    expect(w.find('[data-test="claimed-by"]').text()).toBe('Pris en charge par admin@yadony.com')
    expect(w.find('[data-test="claim-button"]').exists()).toBe(false)
    expect(w.find('[data-test="release-button"]').text()).toBe('Libérer')
  })

  it('claimButton_hidden_withoutAlertResolve', async () => {
    seedAuth('ADMIN', { ALERT_RESOLVE: false })
    const w = await mountPage()
    expect(w.find('[data-test="claim-button"]').exists()).toBe(false)
    expect(w.find('[data-test="alert-title"]').exists()).toBe(true)
  })

  it('claimButton_hidden_whenBackendReturns404', async () => {
    mobile.claimAlert.mockRejectedValue(err(404))
    const w = await mountPage()
    await w.find('[data-test="claim-button"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="claim-button"]').exists()).toBe(false)
    expect(w.find('[data-test="claim-error"]').exists()).toBe(false)
    expect(w.find('[data-test="alert-title"]').exists()).toBe(true)
  })

  it('claim_409_showsAlreadyClaimedAndRefreshes', async () => {
    mobile.claimAlert.mockRejectedValue(err(409, 'alert-already-claimed'))
    svc.get.mockResolvedValueOnce({ ...base })
      .mockResolvedValueOnce({ ...base, claimedByName: 'autre@yadony.com', claimedAt: '2026-11-26T09:00:00' })
    const w = await mountPage()
    await w.find('[data-test="claim-button"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="claim-error"]').text()).toBe('Déjà pris en charge par un autre administrateur')
    expect(svc.get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="claimed-by"]').text()).toContain('autre@yadony.com')
    expect(w.find('[data-test="claim-button"]').exists()).toBe(false)
  })

  it('release_onlyForClaimerOrAdminManage', async () => {
    const claimed = { ...base, claimedByName: 'autre@yadony.com', claimedAt: '2026-11-26T09:00:00' }
    // ADMIN (sans ADMIN_MANAGE), pas le preneur : pas de bouton.
    svc.get.mockResolvedValue(claimed)
    let w = await mountPage()
    expect(w.find('[data-test="release-button"]').exists()).toBe(false)
    // Le preneur : bouton.
    svc.get.mockResolvedValue({ ...claimed, claimedByName: 'Admin@Yadony.com' })
    w = await mountPage()
    expect(w.find('[data-test="release-button"]').exists()).toBe(true)
    // SUPER_ADMIN (ADMIN_MANAGE) : bouton même s'il n'est pas le preneur.
    seedAuth('SUPER_ADMIN')
    svc.get.mockResolvedValue(claimed)
    w = await mountPage()
    mobile.releaseAlert.mockResolvedValue({ ...base })
    await w.find('[data-test="release-button"]').trigger('click')
    await flushPromises()
    expect(mobile.releaseAlert).toHaveBeenCalledWith(U)
    expect(w.find('[data-test="release-button"]').exists()).toBe(false)
    expect(w.find('[data-test="claim-button"]').exists()).toBe(true)
  })

  it('release 403 alert-claim-not-yours shows the message and refreshes', async () => {
    svc.get.mockResolvedValue({ ...base, claimedByName: 'admin@yadony.com', claimedAt: '2026-11-26T09:00:00' })
    mobile.releaseAlert.mockRejectedValue(err(403, 'alert-claim-not-yours'))
    const w = await mountPage()
    await w.find('[data-test="release-button"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="claim-error"]').text()).toBe('Cette prise en charge n’est pas la vôtre')
    expect(svc.get).toHaveBeenCalledTimes(2)
  })

  it('other claim errors show the problem message and keep the button', async () => {
    mobile.claimAlert.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne' } }))
    const w = await mountPage()
    await w.find('[data-test="claim-button"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="claim-error"]').text()).toBe('Panne')
    expect(w.find('[data-test="claim-button"]').exists()).toBe(true)
  })

  it('hides the claim button on a resolved alert', async () => {
    svc.get.mockResolvedValue({ ...base, resolved: true })
    const w = await mountPage()
    expect(w.find('[data-test="claim-button"]').exists()).toBe(false)
  })

  it('noButtonCallsResolveSnoozeOrReopen', async () => {
    mobile.claimAlert.mockResolvedValue({ ...base, claimedByName: 'admin@yadony.com', claimedAt: '2026-11-26T09:00:00' })
    mobile.releaseAlert.mockResolvedValue({ ...base })
    const w = await mountPage()
    for (const sel of ['[data-test="claim-button"]', '[data-test="release-button"]']) {
      await w.find(sel).trigger('click')
      await flushPromises()
    }
    for (const b of w.findAll('button')) { await b.trigger('click'); await flushPromises() }
    for (const k of ['resolve', 'resolveBatch', 'snooze', 'unsnooze', 'reopen'] as const) expect(svc[k]).not.toHaveBeenCalled()

    // Et le code lui-même n'en référence aucun.
    const root = resolvePath(__dirname, '../../../app')
    const sources = ['pages/m/alertes/[id].vue', 'features/mobile/composables/useMobileAlertDetail.ts']
      .map(f => readFileSync(resolvePath(root, f), 'utf8')).join('\n')
    expect(sources).not.toMatch(/\.(resolve|resolveBatch|snooze|unsnooze|reopen)\s*\(/)
    expect(sources).not.toMatch(/useAlerts\b/)
  })

  it('shows not found for an invalid or unknown id', async () => {
    routeState.params = { id: '../x' }
    let w = await mountPage()
    expect(w.find('[data-test="alert-not-found"]').exists()).toBe(true)
    expect(svc.get).not.toHaveBeenCalled()
    routeState.params = { id: U }
    svc.get.mockRejectedValue(err(404))
    w = await mountPage()
    expect(w.find('[data-test="alert-not-found"]').exists()).toBe(true)
  })

  it('shows a message on a load failure', async () => {
    svc.get.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne serveur' } }))
    const w = await mountPage()
    expect(w.find('[data-test="alert-error"]').text()).toBe('Panne serveur')
  })

  it('has no secondary write-to-user button (no /m/support start flow)', async () => {
    const w = await mountPage()
    expect(w.text()).not.toContain('Écrire à l’utilisateur')
  })
})
