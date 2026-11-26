import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.stubGlobal('definePageMeta', vi.fn())

const svc = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/features/overview/services/overviewService', () => ({ overviewService: svc }))

import Page from '@/pages/m/ensemble.vue'
import PeriodChips from '@/features/mobile/components/PeriodChips.vue'
import { buildTiles } from '@/features/mobile/lib/mobileOverview'
import type { AdminOverview } from '@/features/overview/types/index'
import { seedAuth } from '../../../helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" v-bind="$attrs"><slot /></a>' }
const overview = (over: Record<string, unknown> = {}) => ({
  users: {}, announcements: {}, gmv: {},
  bids: { pending: 1, accepted: 3, inTransit: 4, completed: 9, cancelled: 2, total: 19 },
  queues: { openDisputes: 2, pendingNoShows: 1, unresolvedAlerts: 5, escrowJ48: 0, heldPayouts: 7 },
  period: { name: 'D7', signups: 1234, deletedAccounts: 3, parcelsCancelled: 6, kycInProgress: 8 },
  ...over,
})
const mountPage = async () => {
  const w = mount(Page, { global: { stubs: { NuxtLink } } })
  await flushPromises()
  return w
}
const tile = (w: ReturnType<typeof mount>, id: string) => w.find(`[data-test="tile-${id}"]`)

describe('m/ensemble page', () => {
  beforeEach(() => {
    svc.fetch.mockReset()
    seedAuth('ADMIN')
    svc.fetch.mockResolvedValue(overview())
  })

  it('chips_changePeriodAndRefetch starts on 7 jours then refetches with the chosen period', async () => {
    const w = await mountPage()
    expect(svc.fetch).toHaveBeenLastCalledWith('D7')
    const chips = w.findAll('[data-test="period-chip"]')
    expect(chips.map(c => c.text())).toEqual(['Aujourd’hui', '7 jours', '30 jours'])
    expect(chips[1]!.attributes('aria-selected')).toBe('true')
    await chips[2]!.trigger('click'); await flushPromises()
    expect(svc.fetch).toHaveBeenLastCalledWith('D30')
    expect(w.findAll('[data-test="period-chip"]')[2]!.attributes('aria-selected')).toBe('true')
    await chips[0]!.trigger('click'); await flushPromises()
    expect(svc.fetch).toHaveBeenLastCalledWith('TODAY')
    expect(svc.fetch).toHaveBeenCalledTimes(3)
  })

  it('renders the six tiles with tabular French numbers and the "en cours" definition', async () => {
    const w = await mountPage()
    expect(tile(w, 'signups').text()).toContain('Inscrits')
    expect(tile(w, 'signups').text().replace(/\s/g, '')).toContain('1234')
    expect(tile(w, 'deleted').text()).toContain('3')
    expect(tile(w, 'inProgress').text()).toContain('7') // accepted 3 + inTransit 4
    expect(tile(w, 'inProgress').text()).toContain('Colis en cours')
    expect(tile(w, 'cancelled').text()).toContain('6')
    expect(tile(w, 'kyc').text()).toContain('8')
    expect(tile(w, 'alerts').text()).toContain('5')
    expect(tile(w, 'signups').find('[data-test="tile-value"]').classes()).toContain('tabular-nums')
    expect(w.find('[data-test="period-hint"]').exists()).toBe(false)
  })

  it('tiles_hidden_whenBackendHasNoPeriodBlock keeps the non-period tiles and shows the hint', async () => {
    svc.fetch.mockResolvedValue(overview({ period: undefined }))
    const w = await mountPage()
    for (const id of ['signups', 'deleted', 'cancelled', 'kyc']) expect(tile(w, id).exists()).toBe(false)
    expect(tile(w, 'inProgress').exists()).toBe(true)
    expect(tile(w, 'alerts').exists()).toBe(true)
    expect(w.find('[data-test="period-chip"]').exists()).toBe(false)
    expect(w.find('[data-test="period-hint"]').text()).toBe('Données de période indisponibles')
  })

  it('queueRows_render_andAlertLinksToList: three plain rows, alerts tile links to /m/alertes', async () => {
    const w = await mountPage()
    const rows = w.findAll('[data-test="queue-row"]')
    expect(rows.map(r => r.findAll('span').map(x => x.text()))).toEqual([['Litiges ouverts', '2'], ['No-shows à arbitrer', '1'], ['Versements retenus', '7']])
    expect(rows.every(r => r.element.tagName !== 'A')).toBe(true)
    expect(tile(w, 'alerts').attributes('href')).toBe('/m/alertes')
    expect(tile(w, 'signups').element.tagName).not.toBe('A')
  })

  it('alerts tile is danger only when > 0, and not a link without ALERT_VIEW', async () => {
    let w = await mountPage()
    expect(tile(w, 'alerts').find('[data-test="tile-value"]').classes()).toContain('text-danger')
    svc.fetch.mockResolvedValue(overview({ queues: { openDisputes: 0, pendingNoShows: 0, unresolvedAlerts: 0, escrowJ48: 0 } }))
    w = await mountPage()
    expect(tile(w, 'alerts').find('[data-test="tile-value"]').classes()).not.toContain('text-danger')
    expect(w.findAll('[data-test="queue-row"]')[2]!.text()).toContain('0') // heldPayouts ?? 0
    seedAuth('ADMIN', { ALERT_VIEW: false })
    w = await mountPage()
    expect(tile(w, 'alerts').attributes('href')).toBeUndefined()
  })

  it('identity tile is a snapshot: caption "à l’instant", outside the period tiles, never dimmed by a period reload', async () => {
    const tiles = buildTiles(overview() as unknown as AdminOverview)
    expect(tiles.find(t => t.id === 'kyc')).toMatchObject({ label: 'Identités en cours', period: false, caption: 'à l’instant' })
    expect(tiles.filter(t => t.period).map(t => t.id)).toEqual(['signups', 'deleted', 'cancelled'])
    expect(tiles.filter(t => t.caption).map(t => t.id)).toEqual(['kyc'])
    const w = await mountPage()
    expect(tile(w, 'kyc').find('[data-test="tile-caption"]').text()).toBe('à l’instant')
    expect(tile(w, 'signups').find('[data-test="tile-caption"]').exists()).toBe(false)
    svc.fetch.mockReturnValueOnce(new Promise(() => {}))
    await w.findAll('[data-test="period-chip"]')[0]!.trigger('click')
    expect(tile(w, 'signups').classes()).toContain('opacity-60')
    expect(tile(w, 'cancelled').classes()).toContain('opacity-60')
    expect(tile(w, 'kyc').classes()).not.toContain('opacity-60')
    expect(tile(w, 'alerts').classes()).not.toContain('opacity-60')
  })

  it('staleResponse_isIgnored: a slow earlier response never overwrites a newer one', async () => {
    let resolveSlow!: (_v: unknown) => void
    svc.fetch.mockReset()
    svc.fetch
      .mockResolvedValueOnce(overview())
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r }))
      .mockResolvedValueOnce(overview({ period: { name: 'TODAY', signups: 42, deletedAccounts: 0, parcelsCancelled: 0, kycInProgress: 0 } }))
    const w = await mountPage()
    const chips = w.findAll('[data-test="period-chip"]')
    await chips[2]!.trigger('click') // slow D30
    await chips[0]!.trigger('click') // fast TODAY
    await flushPromises()
    expect(tile(w, 'signups').text()).toContain('42')
    resolveSlow(overview({ period: { name: 'D30', signups: 9999, deletedAccounts: 0, parcelsCancelled: 0, kycInProgress: 0 } }))
    await flushPromises()
    expect(tile(w, 'signups').text()).toContain('42')
    expect(tile(w, 'signups').text()).not.toContain('9')
  })

  it('shows an error and a loading state', async () => {
    svc.fetch.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne' } }))
    const w = await mountPage()
    expect(w.find('[data-test="overview-error"]').text()).toBe('Panne')
    expect(w.text()).not.toContain('—')
  })

  it('shows Chargement while the first fetch is pending', async () => {
    svc.fetch.mockReturnValue(new Promise(() => {}))
    const w = mount(Page, { global: { stubs: { NuxtLink } } })
    await nextTick()
    expect(w.text()).toContain('Chargement')
  })
})

describe('PeriodChips', () => {
  it('emits select with the chip key', async () => {
    const w = mount(PeriodChips, { props: { modelValue: 'D7' } })
    await w.findAll('[data-test="period-chip"]')[0]!.trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['TODAY'])
  })
})
