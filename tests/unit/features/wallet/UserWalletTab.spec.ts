import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const getMock = vi.fn()
const listMock = vi.fn()
const adjustMock = vi.fn()
vi.mock('@/features/wallet/services/walletService', () => ({
  walletService: {
    getUserWallet: (...a: unknown[]) => getMock(...a),
    listTransactions: (...a: unknown[]) => listMock(...a),
    adjust: (...a: unknown[]) => adjustMock(...a),
  },
}))
import UserWalletTab from '@/features/wallet/components/UserWalletTab.vue'

const ACCOUNTS = {
  accounts: [
    { currency: 'EUR', balance: 12.5, refundEligibleAmount: 10, frozen: false },
    { currency: 'XOF', balance: 5000, refundEligibleAmount: 0, frozen: true },
  ],
}
const TXS = {
  content: [
    { id: 't1', currency: 'EUR', type: 'TOP_UP', amount: 20, balanceAfter: 20, createdAt: '2026-09-01T10:00:00Z' },
    { id: 't2', currency: 'EUR', type: 'BID_PAYMENT', amount: -7.5, balanceAfter: 12.5, bidId: 'b1', createdAt: '2026-09-02T10:00:00Z' },
    {
      id: 't3', currency: 'EUR', type: 'ADMIN_CREDIT', amount: 1, balanceAfter: 13.5, createdAt: '2026-09-03T10:00:00Z',
      adminReason: 'Geste commercial validé', adminActorId: 'a1', adminActorEmail: 'admin@yadony.com',
    },
    { id: 't4', currency: 'EUR', type: 'TYPE_FUTUR', amount: 2, balanceAfter: 15.5, createdAt: '2026-09-04T10:00:00Z' },
  ],
  totalElements: 44, totalPages: 3, number: 0, size: 20,
}
const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const REASON = 'Correction après double débit constaté'

async function mountTab() {
  const w = mount(UserWalletTab, { props: { userId: 'u1' } })
  await flushPromises()
  return w
}

async function submitCredit(w: Awaited<ReturnType<typeof mountTab>>) {
  await w.find('[data-test="wallet-adjust-open"]').trigger('click')
  await w.find('[data-test="adj-amount"]').setValue('5')
  await w.find('[data-test="adj-reason"]').setValue(REASON)
  await w.find('[data-test="adj-continue"]').trigger('click')
  await w.find('[data-test="adj-confirm"]').trigger('click')
  await flushPromises()
}

describe('UserWalletTab', () => {
  beforeEach(() => {
    seedAuth('ADMIN')
    getMock.mockReset().mockResolvedValue(ACCOUNTS)
    listMock.mockReset().mockResolvedValue(TXS)
    adjustMock.mockReset()
  })

  it('affiche un solde par devise, la part remboursable et le badge Gelé', async () => {
    const w = await mountTab()
    const eur = w.find('[data-test="wallet-account-EUR"]')
    expect(eur.text()).toContain('12,50 EUR')
    expect(eur.text()).toContain('10,00 EUR')
    expect(eur.find('[data-test="wallet-frozen"]').exists()).toBe(false)
    const xof = w.find('[data-test="wallet-account-XOF"]')
    expect(xof.text()).toContain('5\u202f000,00 XOF')
    expect(xof.find('[data-test="wallet-frozen"]').text()).toBe('Gelé')
  })

  it('journal : libellés français, montants signés et colorés, type inconnu brut', async () => {
    const w = await mountTab()
    const t1 = w.find('[data-test="wallet-tx-t1"]')
    expect(t1.text()).toContain('Recharge')
    expect(t1.find('[data-test="wallet-tx-amount"]').text()).toBe('+20,00 EUR')
    expect(t1.find('[data-test="wallet-tx-amount"]').classes()).toContain('text-success')
    const t2 = w.find('[data-test="wallet-tx-t2"]')
    expect(t2.find('[data-test="wallet-tx-amount"]').text()).toBe('−7,50 EUR')
    expect(t2.find('[data-test="wallet-tx-amount"]').classes()).toContain('text-danger')
    expect(t2.text()).toContain('12,50 EUR')
    expect(w.find('[data-test="wallet-tx-t4"]').text()).toContain('TYPE_FUTUR')
  })

  it('un ajustement montre le motif et l’email de l’admin', async () => {
    const w = await mountTab()
    const t3 = w.find('[data-test="wallet-tx-t3"]')
    expect(t3.find('[data-test="wallet-tx-admin"]').text()).toContain('Geste commercial validé')
    expect(t3.find('[data-test="wallet-tx-admin"]').text()).toContain('admin@yadony.com')
    expect(w.find('[data-test="wallet-tx-t1"] [data-test="wallet-tx-admin"]').exists()).toBe(false)
  })

  it('ajustement sans email : repli sur l’identifiant de l’admin', async () => {
    listMock.mockResolvedValue({ ...TXS, content: [{ ...TXS.content[2], adminActorEmail: null }] })
    const w = await mountTab()
    expect(w.find('[data-test="wallet-tx-admin"]').text()).toContain('a1')
  })

  it('filtres devise et type relancent le journal en première page', async () => {
    const w = await mountTab()
    await w.find('[data-test="wallet-filter-currency"]').setValue('EUR')
    await flushPromises()
    expect(listMock).toHaveBeenLastCalledWith('u1', { currency: 'EUR', type: null }, 0, 20)
    await w.find('[data-test="wallet-filter-type"]').setValue('ADMIN_CREDIT')
    await flushPromises()
    expect(listMock).toHaveBeenLastCalledWith('u1', { currency: 'EUR', type: 'ADMIN_CREDIT' }, 0, 20)
    await w.find('[data-test="wallet-filter-currency"]').setValue('')
    await flushPromises()
    expect(listMock).toHaveBeenLastCalledWith('u1', { currency: null, type: 'ADMIN_CREDIT' }, 0, 20)
  })

  it('pagination du journal', async () => {
    const w = await mountTab()
    await w.find('[data-test="next"]').trigger('click')
    await flushPromises()
    expect(listMock).toHaveBeenLastCalledWith('u1', { currency: null, type: null }, 1, 20)
  })

  it('journal vide : message explicite', async () => {
    listMock.mockResolvedValue(EMPTY)
    const w = await mountTab()
    expect(w.find('[data-test="wallet-tx-empty"]').exists()).toBe(true)
  })

  it('aucun compte : message explicite', async () => {
    getMock.mockResolvedValue({ accounts: [] })
    const w = await mountTab()
    expect(w.find('[data-test="wallet-no-account"]').exists()).toBe(true)
  })

  it('ancien back : mention discrète, ni erreur rouge ni bouton de correction', async () => {
    getMock.mockRejectedValue({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })
    const w = await mountTab()
    expect(w.find('[data-test="wallet-unavailable"]').text()).toBe('Portefeuille indisponible pour le moment')
    expect(w.find('[data-test="wallet-error"]').exists()).toBe(false)
    expect(w.find('[data-test="wallet-adjust-open"]').exists()).toBe(false)
  })

  it('erreur des soldes : message du back en rouge, pas de bouton de correction', async () => {
    getMock.mockRejectedValue({ statusCode: 500, data: { detail: 'Service indisponible' } })
    const w = await mountTab()
    expect(w.find('[data-test="wallet-error"]').text()).toBe('Service indisponible')
    expect(w.find('[data-test="wallet-adjust-open"]').exists()).toBe(false)
  })

  it('erreur du journal : affichée sous les soldes', async () => {
    listMock.mockRejectedValue({ statusCode: 500, data: { detail: 'Journal indisponible' } })
    const w = await mountTab()
    expect(w.find('[data-test="wallet-tx-error"]').text()).toBe('Journal indisponible')
    expect(w.find('[data-test="wallet-account-EUR"]').exists()).toBe(true)
  })

  it('SUPPORT (sans WALLET_ADJUST) ne voit pas le bouton de correction', async () => {
    seedAuth('SUPPORT')
    const w = await mountTab()
    expect(w.find('[data-test="wallet-account-EUR"]').exists()).toBe(true)
    expect(w.find('[data-test="wallet-adjust-open"]').exists()).toBe(false)
  })

  it('correction réussie : clé d’idempotence envoyée, soldes et journal rafraîchis, message de succès', async () => {
    adjustMock.mockResolvedValue({ account: { ...ACCOUNTS.accounts[0], balance: 17.5 }, transaction: TXS.content[2] })
    const w = await mountTab()
    getMock.mockClear(); listMock.mockClear()
    await submitCredit(w)
    expect(adjustMock).toHaveBeenCalledTimes(1)
    const [userId, body, key] = adjustMock.mock.calls[0]
    expect(userId).toBe('u1')
    expect(body).toEqual({ currency: 'EUR', direction: 'CREDIT', amount: 5, reason: REASON })
    expect(typeof key).toBe('string')
    expect((key as string).length).toBeGreaterThan(10)
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(listMock).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="adj-dialog"]').exists()).toBe(false)
    expect(w.find('[data-test="wallet-success"]').text()).toContain('Solde corrigé')
    expect(w.find('[data-test="wallet-success"]').text()).toContain('17,50 EUR')
  })

  it('refus 422 : le detail du back reste affiché dans le dialogue, rien n’est rafraîchi', async () => {
    adjustMock.mockRejectedValue({
      statusCode: 422,
      data: { code: 'wallet-adjustment-cap-exceeded', detail: 'Une correction ne peut pas dépasser 500 € d’équivalent.' },
    })
    const w = await mountTab()
    getMock.mockClear(); listMock.mockClear()
    await submitCredit(w)
    expect(w.find('[data-test="adj-error"]').text()).toBe('Une correction ne peut pas dépasser 500 € d’équivalent.')
    expect(w.find('[data-test="adj-dialog"]').exists()).toBe(true)
    expect(getMock).not.toHaveBeenCalled()
    expect(w.find('[data-test="wallet-success"]').exists()).toBe(false)
  })

  it('annuler ferme le dialogue sans appel', async () => {
    const w = await mountTab()
    await w.find('[data-test="wallet-adjust-open"]').trigger('click')
    await w.find('[data-test="adj-cancel"]').trigger('click')
    expect(w.find('[data-test="adj-dialog"]').exists()).toBe(false)
    expect(adjustMock).not.toHaveBeenCalled()
  })

  it('une nouvelle ouverture efface le message de succès précédent', async () => {
    adjustMock.mockResolvedValue({ account: ACCOUNTS.accounts[0], transaction: TXS.content[2] })
    const w = await mountTab()
    await submitCredit(w)
    expect(w.find('[data-test="wallet-success"]').exists()).toBe(true)
    await w.find('[data-test="wallet-adjust-open"]').trigger('click')
    expect(w.find('[data-test="wallet-success"]').exists()).toBe(false)
  })

  it('aucun texte affiché ne contient de tiret cadratin', async () => {
    const w = await mountTab()
    expect(w.text()).not.toContain('—')
  })
})
