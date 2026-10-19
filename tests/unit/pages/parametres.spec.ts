/** /parametres : enregistrer `photo_purge_enabled` recharge la carte Stockage photos (statut périmé). */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRoute', () => ({ meta: {}, query: {} }))

const settings = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }))
const rates = vi.hoisted(() => ({ list: vi.fn(), sync: vi.fn(), update: vi.fn() }))
const photos = vi.hoisted(() => ({ status: vi.fn(), runPurge: vi.fn(), reconcile: vi.fn() }))
vi.mock('@/features/settings/services/settingsService', () => ({ settingsService: settings }))
vi.mock('@/features/exchange-rates/services/exchangeRatesService', () => ({ exchangeRatesService: rates }))
vi.mock('@/features/photo-storage/services/photoStorageService', () => ({ photoStorageService: photos }))
const grids = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: grids }))

const PURGE = { key: 'photo_purge_enabled', value: 'false', type: 'BOOLEAN', updatedAt: null, updatedByEmail: null }
const QUOTA = { key: 'photo_upload_daily_quota', value: '60', type: 'INTEGER', updatedAt: null, updatedByEmail: null }
const STATUS = {
  purgeEnabled: false, retentionDays: 7, running: false, lastPurges: [], lastReconciles: [],
  uploads24h: 0, bytes24h: 0, uploads7d: 0, bytes7d: 0,
}

async function mountPage() {
  const mod = await import('@/pages/parametres.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  await flushPromises()
  return w
}

async function save(w: Awaited<ReturnType<typeof mountPage>>, key: string, value: string, phrase?: string) {
  await w.find(`[data-test="setting-value-${key}"]`).setValue(value)
  await w.find(`[data-test="setting-save-${key}"]`).trigger('click')
  if (phrase) await w.find('[data-test="confirmation-input"]').setValue(phrase)
  await w.find('[data-test="confirm"]').trigger('click')
  await flushPromises()
}

describe('/parametres', () => {
  beforeAll(async () => { await import('@/pages/parametres.vue') }, 30_000)

  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    settings.list.mockResolvedValue([PURGE, QUOTA])
    rates.list.mockResolvedValue([])
    photos.status.mockResolvedValue(STATUS)
    grids.list.mockResolvedValue({ history: { content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, last: true } })
  })

  it('activer la purge recharge le statut de la carte', async () => {
    settings.update.mockResolvedValue({ ...PURGE, value: 'true' })
    const w = await mountPage()
    expect(photos.status).toHaveBeenCalledTimes(1)
    await save(w, 'photo_purge_enabled', 'true', 'ACTIVER PURGE')
    expect(settings.update).toHaveBeenCalledWith('photo_purge_enabled', 'true')
    expect(photos.status).toHaveBeenCalledTimes(2)
  })

  it('un échec de l’enregistrement ne recharge pas la carte', async () => {
    settings.update.mockRejectedValue(new Error('boom'))
    const w = await mountPage()
    await save(w, 'photo_purge_enabled', 'true', 'ACTIVER PURGE')
    expect(photos.status).toHaveBeenCalledTimes(1)
  })

  it('un autre réglage ne recharge pas la carte', async () => {
    settings.update.mockResolvedValue({ ...QUOTA, value: '70' })
    const w = await mountPage()
    await save(w, 'photo_upload_daily_quota', '70')
    expect(settings.update).toHaveBeenCalledWith('photo_upload_daily_quota', '70')
    expect(photos.status).toHaveBeenCalledTimes(1)
  })

  describe('commission par paliers', () => {
    const RATE = { key: 'commission_rate', value: '0.05', type: 'DECIMAL', updatedAt: null, updatedByEmail: null }

    it('une grille en vigueur remplace le champ du taux unique par un renvoi', async () => {
      settings.list.mockResolvedValue([RATE])
      grids.list.mockResolvedValue({ current: { id: 'g1' }, history: { content: [] } })
      const w = await mountPage()
      expect(grids.list).toHaveBeenCalledWith(0, 1)
      expect(w.find('[data-test="setting-commission-managed"]').exists()).toBe(true)
      expect(w.find('[data-test="setting-value-commission_rate"]').exists()).toBe(false)
    })

    it('tant que le statut de la grille n’est pas connu, aucun champ commission éditable', async () => {
      settings.list.mockResolvedValue([RATE])
      let resolveGrid!: (_v: unknown) => void
      grids.list.mockReturnValue(new Promise((r) => { resolveGrid = r }))
      const w = await mountPage()
      expect(w.find('[data-test="setting-value-commission_rate"]').exists()).toBe(false)
      expect(w.find('[data-test="setting-commission-pending"]').exists()).toBe(true)
      resolveGrid({ history: { content: [] } })
      await flushPromises()
      expect(w.find('[data-test="setting-value-commission_rate"]').exists()).toBe(true)
    })

    it('back sans l’endpoint : le champ reste', async () => {
      settings.list.mockResolvedValue([RATE])
      grids.list.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404 }))
      const w = await mountPage()
      expect(w.find('[data-test="setting-value-commission_rate"]').exists()).toBe(true)
    })
  })
})
