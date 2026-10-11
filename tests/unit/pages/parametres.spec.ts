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

const PURGE = { key: 'photo_purge_enabled', value: 'false', type: 'BOOLEAN', updatedAt: null, updatedByEmail: null }
const QUOTA = { key: 'photo_upload_daily_quota', value: '60', type: 'INTEGER', updatedAt: null, updatedByEmail: null }
const STATUS = {
  purgeEnabled: false, retentionDays: 7, running: false, lastPurges: [], lastReconciles: [],
  uploads24h: 0, bytes24h: 0, uploads7d: 0, bytes7d: 0,
}

async function mountPage() {
  const mod = await import('@/pages/parametres.vue')
  const w = mount(mod.default)
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
})
