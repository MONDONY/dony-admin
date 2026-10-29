import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const getMock = vi.fn()
const listMock = vi.fn()
const adjustMock = vi.fn()
const holdsMock = vi.fn()
const releaseMock = vi.fn()
vi.mock('@/features/wallet/services/walletService', () => ({
  walletService: {
    getUserWallet: (...a: unknown[]) => getMock(...a),
    listTransactions: (...a: unknown[]) => listMock(...a),
    adjust: (...a: unknown[]) => adjustMock(...a),
    listExternalRefundHolds: (...a: unknown[]) => holdsMock(...a),
    releaseExternalRefundHold: (...a: unknown[]) => releaseMock(...a),
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
    holdsMock.mockReset().mockResolvedValue([])
    releaseMock.mockReset()
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

  // Rejeu du ledger incohérent côté back : la part remboursable arrive à null. On le dit,
  // plutôt que d'afficher un tiret ou un faux zéro.
  it('part remboursable non calculable quand le back la rend à null', async () => {
    getMock.mockResolvedValue({ accounts: [{ ...ACCOUNTS.accounts[0], refundEligibleAmount: null }] })
    const w = await mountTab()
    const eur = w.find('[data-test="wallet-account-EUR"]')
    expect(eur.find('[data-test="wallet-refundable"]').text()).toBe('Remboursable : non calculable')
    expect(eur.text()).toContain('12,50 EUR')
    expect(w.text()).not.toContain('—')
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

  it('au-delà de 100 € : envoyée pour approbation, rien n’est rafraîchi', async () => {
    adjustMock.mockResolvedValue({
      account: null, transaction: null,
      pendingRequest: { id: 'r1', userId: 'u1', currency: 'EUR', direction: 'CREDIT', amount: 150, eurEquivalent: 150,
        reason: REASON, status: 'PENDING', requestedBy: 'a1', requestedByEmail: 'a@yadony.com', decidedBy: null,
        decidedByEmail: null, decidedAt: null, decisionNote: null, transactionId: null, createdAt: '2026-10-28T10:00:00' },
    })
    const w = await mountTab()
    getMock.mockClear(); listMock.mockClear()
    await submitCredit(w)
    expect(w.find('[data-test="adj-dialog"]').exists()).toBe(false)
    expect(w.find('[data-test="wallet-success"]').text()).toContain('envoyée pour approbation')
    expect(w.find('[data-test="wallet-success"]').text()).toContain('150,00 EUR')
    expect(getMock).not.toHaveBeenCalled()
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

  it('solde insuffisant (insufficient-wallet-balance) : detail du back affiché', async () => {
    adjustMock.mockRejectedValue({
      statusCode: 422,
      data: { code: 'insufficient-wallet-balance', detail: 'Solde insuffisant pour ce débit.' },
    })
    const w = await mountTab()
    await submitCredit(w)
    expect(w.find('[data-test="adj-error"]').text()).toBe('Solde insuffisant pour ce débit.')
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

  describe('gels après une recharge remboursée hors de l’app', () => {
    const OPEN_HOLD = {
      id: 'h1', currency: 'EUR', amount: 25, paymentIntentId: 'pi_1', stripeRefundId: 're_1', status: 'OPEN',
      createdAt: '2026-10-29T09:00:00Z',
    }
    const RELEASED_HOLD = {
      id: 'h0', currency: 'EUR', amount: 10, paymentIntentId: 'pi_0', stripeRefundId: 're_0', status: 'RELEASED',
      createdAt: '2026-10-01T09:00:00Z', releasedAt: '2026-10-02T09:00:00Z', releasedByEmail: 'ops@yadony.com',
      releaseNote: 'Solde débité de 10 €',
    }

    it('aucun gel : pas de section', async () => {
      const w = await mountTab()
      expect(holdsMock).toHaveBeenCalledWith('u1')
      expect(w.find('[data-test="wallet-holds"]').exists()).toBe(false)
    })

    it('réponse qui n’est pas une liste (page, proxy) : aucun gel, onglet intact', async () => {
      holdsMock.mockResolvedValue({ content: [], totalPages: 0 })
      const w = await mountTab()
      expect(w.find('[data-test="wallet-holds"]').exists()).toBe(false)
      expect(w.find('[data-test="wallet-account-EUR"]').exists()).toBe(true)
    })

    it('ancien back (404) : section absente, sans erreur', async () => {
      holdsMock.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, response: { status: 404 } }))
      const w = await mountTab()
      expect(w.find('[data-test="wallet-holds"]').exists()).toBe(false)
      expect(w.find('[data-test="wallet-error"]').exists()).toBe(false)
    })

    it('gel actif et gel levé : montants, statuts, auteur et note de la levée', async () => {
      holdsMock.mockResolvedValue([OPEN_HOLD, RELEASED_HOLD])
      const w = await mountTab()
      const open = w.get('[data-test="wallet-hold-h1"]').text().replace(/\s/g, ' ')
      expect(open).toContain('25,00')
      expect(open).toContain('Gel actif')
      expect(open).toContain('re_1')
      const released = w.get('[data-test="wallet-hold-h0"]').text()
      expect(released).toContain('Gel levé')
      expect(released).toContain('ops@yadony.com')
      expect(released).toContain('Solde débité de 10 €')
      expect(w.find('[data-test="wallet-hold-release-h0"]').exists()).toBe(false)
    })

    it('lever le gel : note obligatoire, appel puis relecture des soldes et des gels', async () => {
      holdsMock.mockResolvedValue([OPEN_HOLD])
      releaseMock.mockResolvedValue({ ...OPEN_HOLD, status: 'RELEASED' })
      const w = await mountTab()
      await w.get('[data-test="wallet-hold-release-h1"]').trigger('click')
      expect(w.get('[data-test="confirm"]').attributes('disabled')).toBeDefined()
      await w.get('[data-test="reason"]').setValue('Solde débité de 25 €')
      await w.get('[data-test="confirm"]').trigger('click')
      await flushPromises()
      expect(releaseMock).toHaveBeenCalledWith('u1', 'h1', 'Solde débité de 25 €')
      expect(holdsMock).toHaveBeenCalledTimes(2)
      expect(getMock).toHaveBeenCalledTimes(2)
      expect(w.get('[data-test="wallet-holds-success"]').text()).toContain('Gel levé')
    })

    it('levée refusée (déjà levé) : message gardé après la relecture', async () => {
      holdsMock.mockResolvedValue([OPEN_HOLD])
      releaseMock.mockRejectedValue(Object.assign(new Error('409'), { data: { detail: 'Ce gel a déjà été levé' } }))
      const w = await mountTab()
      await w.get('[data-test="wallet-hold-release-h1"]').trigger('click')
      await w.get('[data-test="reason"]').setValue('x')
      await w.get('[data-test="confirm"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="wallet-holds-error"]').text()).toContain('déjà été levé')
      expect(getMock).toHaveBeenCalledTimes(1)
    })

    it('sans WALLET_ADJUST (SUPPORT) : gel visible, pas de bouton de levée', async () => {
      seedAuth('SUPPORT')
      holdsMock.mockResolvedValue([OPEN_HOLD])
      const w = await mountTab()
      expect(w.find('[data-test="wallet-hold-h1"]').exists()).toBe(true)
      expect(w.find('[data-test="wallet-hold-release-h1"]').exists()).toBe(false)
    })
  })
})
