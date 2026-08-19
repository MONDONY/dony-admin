import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/settings/services/settingsService')
import { usePlatformSettings } from '@/features/settings/composables/usePlatformSettings'
import { settingsService } from '@/features/settings/services/settingsService'

const svc = settingsService as unknown as Record<string, ReturnType<typeof vi.fn>>

const s1 = { key: 'commission_rate', value: '10', type: 'DECIMAL', updatedAt: null, updatedByEmail: null }
const s2 = { key: 'urgency_threshold_days', value: '3', type: 'INTEGER', updatedAt: null, updatedByEmail: null }
const s3 = { key: 'reimbursement_cap_eur', value: '50', type: 'DECIMAL', updatedAt: null, updatedByEmail: null }
const s4 = { key: 'sms_enabled', value: 'true', type: 'BOOLEAN', updatedAt: null, updatedByEmail: null }

describe('usePlatformSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
    svc.update = vi.fn()
  })

  it('load charge la liste des réglages', async () => {
    svc.list.mockResolvedValue([s1, s2, s3, s4])
    const p = usePlatformSettings()
    await p.load()
    expect(p.settings.value).toEqual([s1, s2, s3, s4])
    expect(p.isLoading.value).toBe(false)
  })

  it('update remplace en place le réglage modifié, sans recharger toute la liste', async () => {
    svc.list.mockResolvedValue([s1, s2, s3, s4])
    const updated = { ...s2, value: '5', updatedAt: '2026-08-19T10:00:00Z', updatedByEmail: 'admin@yadony.com' }
    svc.update.mockResolvedValue(updated)
    const p = usePlatformSettings()
    await p.load()

    await p.update('urgency_threshold_days', '5')

    expect(svc.update).toHaveBeenCalledWith('urgency_threshold_days', '5')
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(p.settings.value).toHaveLength(4)
    expect(p.settings.value[1]).toEqual(updated)
    // Les autres réglages restent intacts.
    expect(p.settings.value[0]).toEqual(s1)
    expect(p.settings.value[2]).toEqual(s3)
    expect(p.settings.value[3]).toEqual(s4)
  })

  it('update fonctionne identiquement pour sms_enabled — pas de traitement de faveur', async () => {
    svc.list.mockResolvedValue([s1, s2, s3, s4])
    const updated = { ...s4, value: 'false', updatedAt: '2026-08-19T10:00:00Z', updatedByEmail: 'admin@yadony.com' }
    svc.update.mockResolvedValue(updated)
    const p = usePlatformSettings()
    await p.load()

    await p.update('sms_enabled', 'false')

    expect(svc.update).toHaveBeenCalledWith('sms_enabled', 'false')
    expect(p.settings.value[3]).toEqual(updated)
  })

  it('busy est vrai pendant update puis faux après résolution', async () => {
    svc.list.mockResolvedValue([s1])
    let resolveUpdate!: (_value: unknown) => void
    svc.update.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve }))
    const p = usePlatformSettings()
    await p.load()

    const promise = p.update('commission_rate', '12')
    expect(p.busy.value).toBe(true)
    resolveUpdate({ ...s1, value: '12' })
    await promise
    expect(p.busy.value).toBe(false)
  })

  it('busy repasse à faux même quand update échoue', async () => {
    svc.list.mockResolvedValue([s1])
    svc.update.mockRejectedValue(new Error('boom'))
    const p = usePlatformSettings()
    await p.load()

    await p.update('commission_rate', '12')

    expect(p.busy.value).toBe(false)
  })

  it('une erreur backend RFC 7807 sur update est extraite via son detail', async () => {
    svc.list.mockResolvedValue([s1])
    const fetchError = Object.assign(new Error('[PUT] "/admin/settings/commission_rate": 422 Unprocessable Entity'), {
      data: { detail: 'Le taux de commission doit être compris entre 0 et 100.' },
    })
    svc.update.mockRejectedValue(fetchError)
    const p = usePlatformSettings()
    await p.load()

    await p.update('commission_rate', '200')

    expect(p.error.value).toBe('Le taux de commission doit être compris entre 0 et 100.')
    // Le réglage n'est pas altéré par un échec.
    expect(p.settings.value).toEqual([s1])
  })

  it('retombe sur un message générique quand la réponse n’a pas de detail', async () => {
    svc.list.mockResolvedValue([s1])
    svc.update.mockRejectedValue(new Error('network down'))
    const p = usePlatformSettings()
    await p.load()
    await p.update('commission_rate', '12')
    expect(p.error.value).toBe('network down')
  })

  it('une nouvelle action efface l’erreur précédente', async () => {
    svc.list.mockResolvedValue([s1])
    svc.update.mockRejectedValueOnce(new Error('oops'))
    const p = usePlatformSettings()
    await p.load()
    await p.update('commission_rate', '12')
    expect(p.error.value).toBe('oops')

    svc.update.mockResolvedValue({ ...s1, value: '15' })
    await p.update('commission_rate', '15')
    expect(p.error.value).toBeNull()
  })

  it('load expose une erreur si la liste ne peut pas être chargée', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('fail'), { data: { detail: 'Paramètres indisponibles' } }))
    const p = usePlatformSettings()
    await p.load()
    expect(p.error.value).toBe('Paramètres indisponibles')
    expect(p.settings.value).toEqual([])
  })

  it('update ne modifie rien si la clé est absente de la liste (défensif, pas de crash)', async () => {
    svc.list.mockResolvedValue([s1])
    svc.update.mockResolvedValue({ ...s2, value: '9' })
    const p = usePlatformSettings()
    await p.load()
    await p.update('urgency_threshold_days', '9')
    expect(p.settings.value).toEqual([s1])
  })
})
