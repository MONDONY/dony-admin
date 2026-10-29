import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TopupCodesTable from '@/features/topup-codes/components/TopupCodesTable.vue'

const code = {
  id: 't1', code: 'DAKAR2000', amount: 2000, currency: 'XOF', maxRedemptions: 100, redeemedCount: 37, remaining: 63,
  expiresAt: '2027-01-01T00:00:00', displayStatus: 'ACTIVE' as const, note: null, createdAt: '2026-10-15T10:00:00',
  createdBy: 'a1', createdByEmail: 'admin@yadony.test', revokedAt: null,
}

describe('TopupCodesTable', () => {
  it('affiche code, montant sans décimales et utilisations 37 / 100', () => {
    const w = mount(TopupCodesTable, { props: { codes: [code], loading: false } })
    const row = w.get('[data-test="topup-row-t1"]').text().replace(/\s/g, ' ')
    expect(row).toContain('DAKAR2000')
    expect(row).toContain('2 000 XOF')
    expect(row).toContain('37 / 100')
  })

  it('émet revoke et showRedemptions ; pas de Révoquer sur un code révoqué', async () => {
    const w = mount(TopupCodesTable, { props: { codes: [code], loading: false } })
    await w.get('[data-test="revoke-t1"]').trigger('click')
    await w.get('[data-test="redemptions-t1"]').trigger('click')
    expect(w.emitted('revoke')![0][0]).toEqual(code)
    expect(w.emitted('showRedemptions')![0][0]).toEqual(code)
    await w.setProps({ codes: [{ ...code, displayStatus: 'REVOKED' as const }] })
    expect(w.find('[data-test="revoke-t1"]').exists()).toBe(false)
  })

  it('état vide', () => {
    const w = mount(TopupCodesTable, { props: { codes: [], loading: false } })
    expect(w.text()).toContain('Aucun code de recharge')
  })

  it('code stocké haché (back récent) : fin du code masquée, pas de bouton Copier', () => {
    const hashed = { ...code, code: null, codeHint: 'MENT' }
    const w = mount(TopupCodesTable, { props: { codes: [hashed], loading: false } })
    expect(w.get('[data-test="code-t1"]').text()).toBe('•••• MENT')
    expect(w.find('[data-test="copy-t1"]').exists()).toBe(false)
  })
})
