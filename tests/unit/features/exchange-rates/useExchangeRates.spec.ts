import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/exchange-rates/services/exchangeRatesService')
import { useExchangeRates } from '@/features/exchange-rates/composables/useExchangeRates'
import { exchangeRatesService } from '@/features/exchange-rates/services/exchangeRatesService'

const svc = exchangeRatesService as unknown as Record<string, ReturnType<typeof vi.fn>>

const eur = { currency: 'EUR', unitsPerEur: 1, updatedAt: null, updatedBy: null }
const usd = { currency: 'USD', unitsPerEur: 1.08, updatedAt: null, updatedBy: null }
const xof = { currency: 'XOF', unitsPerEur: 655.957, updatedAt: null, updatedBy: null }

describe('useExchangeRates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
    svc.update = vi.fn()
  })

  it('load charge la liste des taux', async () => {
    svc.list.mockResolvedValue([eur, usd, xof])
    const p = useExchangeRates()
    await p.load()
    expect(p.rates.value).toEqual([eur, usd, xof])
    expect(p.isLoading.value).toBe(false)
  })

  it('update remplace en place la devise modifiée, sans recharger toute la liste', async () => {
    svc.list.mockResolvedValue([eur, usd, xof])
    const updated = { ...usd, unitsPerEur: 1.1, updatedAt: '2026-08-20T10:00:00Z', updatedBy: 'admin-uuid' }
    svc.update.mockResolvedValue(updated)
    const p = useExchangeRates()
    await p.load()

    await p.update('USD', 1.1)

    expect(svc.update).toHaveBeenCalledWith('USD', 1.1)
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(p.rates.value).toHaveLength(3)
    expect(p.rates.value[1]).toEqual(updated)
    // Les autres devises restent intactes.
    expect(p.rates.value[0]).toEqual(eur)
    expect(p.rates.value[2]).toEqual(xof)
  })

  it('busy est vrai pendant update puis faux après résolution', async () => {
    svc.list.mockResolvedValue([usd])
    let resolveUpdate!: (_value: unknown) => void
    svc.update.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve }))
    const p = useExchangeRates()
    await p.load()

    const promise = p.update('USD', 1.1)
    expect(p.busy.value).toBe(true)
    resolveUpdate({ ...usd, unitsPerEur: 1.1 })
    await promise
    expect(p.busy.value).toBe(false)
  })

  it('busy repasse à faux même quand update échoue', async () => {
    svc.list.mockResolvedValue([usd])
    svc.update.mockRejectedValue(new Error('boom'))
    const p = useExchangeRates()
    await p.load()

    await p.update('USD', 1.1)

    expect(p.busy.value).toBe(false)
  })

  it('une erreur backend RFC 7807 sur update est extraite via son detail', async () => {
    svc.list.mockResolvedValue([xof])
    const fetchError = Object.assign(new Error('[PUT] "/admin/exchange-rates/XOF": 422 Unprocessable Entity'), {
      data: { detail: 'XOF a une parité fixe avec l\'euro (655,957), elle ne se pilote pas depuis cet écran.' },
    })
    svc.update.mockRejectedValue(fetchError)
    const p = useExchangeRates()
    await p.load()

    await p.update('XOF', 700)

    expect(p.error.value).toContain('parité fixe')
    // Le taux n'est pas altéré par un échec.
    expect(p.rates.value).toEqual([xof])
  })

  it('retombe sur un message générique quand la réponse n’a pas de detail', async () => {
    svc.list.mockResolvedValue([usd])
    svc.update.mockRejectedValue(new Error('network down'))
    const p = useExchangeRates()
    await p.load()
    await p.update('USD', 1.1)
    expect(p.error.value).toBe('network down')
  })

  it('une nouvelle action efface l’erreur précédente', async () => {
    svc.list.mockResolvedValue([usd])
    svc.update.mockRejectedValueOnce(new Error('oops'))
    const p = useExchangeRates()
    await p.load()
    await p.update('USD', 1.1)
    expect(p.error.value).toBe('oops')

    svc.update.mockResolvedValue({ ...usd, unitsPerEur: 1.2 })
    await p.update('USD', 1.2)
    expect(p.error.value).toBeNull()
  })

  it('load expose une erreur si la liste ne peut pas être chargée', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('fail'), { data: { detail: 'Taux indisponibles' } }))
    const p = useExchangeRates()
    await p.load()
    expect(p.error.value).toBe('Taux indisponibles')
    expect(p.rates.value).toEqual([])
  })

  it('update ne modifie rien si la devise est absente de la liste (défensif, pas de crash)', async () => {
    svc.list.mockResolvedValue([eur])
    svc.update.mockResolvedValue({ ...usd, unitsPerEur: 1.2 })
    const p = useExchangeRates()
    await p.load()
    await p.update('USD', 1.2)
    expect(p.rates.value).toEqual([eur])
  })
})
