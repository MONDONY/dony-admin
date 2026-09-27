import { describe, it, expect, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const listMock = vi.fn()
vi.mock('@/features/wallet/services/walletService', () => ({
  walletService: {
    getUserWallet: (...a: unknown[]) => getMock(...a),
    listTransactions: (...a: unknown[]) => listMock(...a),
  },
}))
import { useUserWallet } from '@/features/wallet/composables/useUserWallet'

const ACCOUNTS = { accounts: [{ currency: 'EUR', balance: 12.5, refundEligibleAmount: 10, frozen: false }] }
const tx = (id: string) => ({ id, currency: 'EUR', type: 'TOP_UP', amount: 10, balanceAfter: 10, createdAt: '2026-09-01T10:00:00Z' })
const page = (n: number, totalPages = 3) => ({ content: [tx(`t${n}`)], totalElements: 30, totalPages, number: n, size: 20 })

describe('useUserWallet', () => {
  beforeEach(() => { getMock.mockReset(); listMock.mockReset() })

  it('load charge les comptes puis la première page du journal', async () => {
    getMock.mockResolvedValue(ACCOUNTS)
    listMock.mockResolvedValue(page(0))
    const w = useUserWallet('u1')
    await w.load()
    expect(getMock).toHaveBeenCalledWith('u1')
    expect(listMock).toHaveBeenCalledWith('u1', { currency: null, type: null }, 0, 20)
    expect(w.accounts.value).toEqual(ACCOUNTS.accounts)
    expect(w.transactions.value.map((t) => t.id)).toEqual(['t0'])
    expect(w.totalPages.value).toBe(3)
    expect(w.unavailable.value).toBe(false)
    expect(w.isLoading.value).toBe(false)
  })

  it('tolère une réponse sans liste de comptes', async () => {
    getMock.mockResolvedValue({})
    listMock.mockResolvedValue(page(0))
    const w = useUserWallet('u1')
    await w.load()
    expect(w.accounts.value).toEqual([])
  })

  it('goToPage recharge la page demandée', async () => {
    listMock.mockResolvedValue(page(2))
    const w = useUserWallet('u1')
    await w.goToPage(2)
    expect(listMock).toHaveBeenLastCalledWith('u1', { currency: null, type: null }, 2, 20)
    expect(w.page.value).toBe(2)
  })

  it('un filtre de devise ou de type revient à la première page', async () => {
    listMock.mockResolvedValue(page(0))
    const w = useUserWallet('u1')
    await w.goToPage(2)
    await w.setCurrencyFilter('XOF')
    expect(listMock).toHaveBeenLastCalledWith('u1', { currency: 'XOF', type: null }, 0, 20)
    await w.setTypeFilter('ADMIN_DEBIT')
    expect(listMock).toHaveBeenLastCalledWith('u1', { currency: 'XOF', type: 'ADMIN_DEBIT' }, 0, 20)
    await w.setCurrencyFilter(null)
    expect(listMock).toHaveBeenLastCalledWith('u1', { currency: null, type: 'ADMIN_DEBIT' }, 0, 20)
  })

  it('ancien back (404 sans code) : portefeuille indisponible, pas d’erreur, journal non demandé', async () => {
    getMock.mockRejectedValue({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })
    const w = useUserWallet('u1')
    await w.load()
    expect(w.unavailable.value).toBe(true)
    expect(w.error.value).toBeNull()
    expect(listMock).not.toHaveBeenCalled()
  })

  it('une erreur métier des comptes affiche le detail du ProblemDetail', async () => {
    getMock.mockRejectedValue({ statusCode: 500, data: { detail: 'Base indisponible' } })
    const w = useUserWallet('u1')
    await w.load()
    expect(w.unavailable.value).toBe(false)
    expect(w.error.value).toBe('Base indisponible')
    expect(listMock).not.toHaveBeenCalled()
  })

  it('une erreur du journal est isolée des soldes', async () => {
    getMock.mockResolvedValue(ACCOUNTS)
    listMock.mockRejectedValue({ statusCode: 400, data: { detail: 'Type inconnu' } })
    const w = useUserWallet('u1')
    await w.load()
    expect(w.accounts.value).toHaveLength(1)
    expect(w.error.value).toBeNull()
    expect(w.transactionsError.value).toBe('Type inconnu')
    expect(w.transactionsLoading.value).toBe(false)
  })

  it('erreur sans detail : message de repli', async () => {
    getMock.mockRejectedValue({})
    const w = useUserWallet('u1')
    await w.load()
    expect(w.error.value).toBe('Impossible de charger le portefeuille')
    listMock.mockRejectedValue({})
    await w.fetchTransactions()
    expect(w.transactionsError.value).toBe('Impossible de charger le journal du portefeuille')
  })

  it('refresh recharge soldes et journal sur la page courante', async () => {
    getMock.mockResolvedValue(ACCOUNTS)
    listMock.mockResolvedValue(page(1))
    const w = useUserWallet('u1')
    await w.goToPage(1)
    listMock.mockClear()
    await w.refresh()
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(listMock).toHaveBeenCalledWith('u1', { currency: null, type: null }, 1, 20)
  })

  it('un 404 sur le journal après des soldes reçus reste une erreur', async () => {
    getMock.mockResolvedValue(ACCOUNTS)
    listMock.mockRejectedValue({ statusCode: 404 })
    const w = useUserWallet('u1')
    await w.load()
    expect(w.unavailable.value).toBe(false)
    expect(w.transactionsError.value).not.toBeNull()
  })
})
