import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromoTable from '@/features/promo/components/PromoTable.vue'

const codes = [
  {
    id: 'p1', code: 'WELCOME10', rate: 0.1, target: 'ANY' as const,
    validFrom: null, validTo: '2026-12-31T00:00:00Z', maxRedemptions: 100,
    perUserLimit: 1, redeemedCount: 12, status: 'ACTIVE' as const, createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'p2', code: 'FLAT5', rate: 0.05, target: 'SENDER' as const,
    validFrom: null, validTo: null, maxRedemptions: null,
    perUserLimit: 1, redeemedCount: 0, status: 'DISABLED' as const, createdAt: '2026-06-02T10:00:00Z',
  },
]

describe('PromoTable', () => {
  it('renders codes with formatted rate and target', () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    expect(w.find('[data-test="promo-row-p1"]').exists()).toBe(true)
    expect(w.text()).toContain('WELCOME10')
    expect(w.text()).toContain('10 %')
    expect(w.text()).toContain('Expéditeurs')
  })

  it('shows redemption progress', () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    expect(w.find('[data-test="promo-row-p1"]').text()).toContain('12 / 100')
  })

  it('emits edit, remove and toggleStatus', async () => {
    const w = mount(PromoTable, { props: { codes, loading: false } })
    await w.find('[data-test="edit-p1"]').trigger('click')
    expect(w.emitted('edit')![0]).toEqual(['p1'])
    await w.find('[data-test="remove-p1"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['p1'])
    await w.find('[data-test="toggle-p1"]').trigger('click')
    expect(w.emitted('toggleStatus')![0][0]).toMatchObject({ id: 'p1' })
  })

  it('empty state', () => {
    expect(mount(PromoTable, { props: { codes: [], loading: false } }).text()).toMatch(/Aucun code/i)
  })

  describe('origine des codes', () => {
    const stubs = { NuxtLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' } }
    const base = {
      rate: 0.05, target: 'SENDER' as const, validFrom: null, validTo: null, maxRedemptions: 1,
      perUserLimit: 1, status: 'ACTIVE' as const, createdAt: '2026-06-02T10:00:00Z',
    }
    const rows = [
      { ...base, id: 'a1', code: 'ADM', origin: 'ADMIN' as const, redeemedCount: 0 },
      { ...base, id: 'r1', code: 'AMINATA05', origin: 'REFERRAL_REWARD' as const, ownerUserId: 'u-1', ownerFirstName: 'Aminata', redeemedCount: 1 },
      { ...base, id: 'w1', code: 'MOUSSA05', origin: 'REFERRAL_WELCOME' as const, ownerUserId: 'u-2', ownerFirstName: 'Moussa', redeemedCount: 0 },
      { ...base, id: 'old', code: 'OLD', redeemedCount: 0 },
    ]
    const mountRows = () => mount(PromoTable, { props: { codes: rows, loading: false }, global: { stubs } })

    it('affiche la colonne Origine et un libellé par origine', () => {
      const w = mountRows()
      expect(w.text()).toContain('Origine')
      expect(w.find('[data-test="origin-a1"]').text()).toBe('Créé par l\'admin')
      expect(w.find('[data-test="origin-r1"]').text()).toBe('Parrainage : récompense du parrain')
      expect(w.find('[data-test="origin-w1"]').text()).toBe('Parrainage : bienvenue du filleul')
    })

    it('traite l\'absence d\'origine (ancien back) comme ADMIN', () => {
      const w = mountRows()
      expect(w.find('[data-test="origin-old"]').text()).toBe('Créé par l\'admin')
      expect(w.find('[data-test="edit-old"]').exists()).toBe(true)
      expect(w.find('[data-test="remove-old"]').exists()).toBe(true)
      expect(w.find('[data-test="owner-old"]').exists()).toBe(false)
    })

    it('lie le prénom du propriétaire à sa fiche utilisateur', () => {
      const w = mountRows()
      const link = w.find('[data-test="owner-r1"]')
      expect(link.text()).toBe('Aminata')
      expect(link.attributes('data-to')).toBe('/users/u-1')
      expect(w.find('[data-test="owner-w1"]').attributes('data-to')).toBe('/users/u-2')
      expect(w.find('[data-test="owner-a1"]').exists()).toBe(false)
    })

    it('n\'affiche pas de lien si le propriétaire est inconnu', () => {
      const w = mount(PromoTable, {
        props: { codes: [{ ...rows[1], id: 'x', ownerUserId: null, ownerFirstName: null }], loading: false }, global: { stubs },
      })
      expect(w.find('[data-test="owner-x"]').exists()).toBe(false)
    })

    it('indique Utilisé ou Non utilisé', () => {
      const w = mountRows()
      expect(w.find('[data-test="used-r1"]').text()).toBe('Utilisé')
      expect(w.find('[data-test="used-w1"]').text()).toBe('Non utilisé')
    })

    it('masque Éditer et Supprimer pour les codes de parrainage, garde le statut', () => {
      const w = mountRows()
      for (const id of ['r1', 'w1']) {
        expect(w.find(`[data-test="edit-${id}"]`).exists()).toBe(false)
        expect(w.find(`[data-test="remove-${id}"]`).exists()).toBe(false)
        expect(w.find(`[data-test="toggle-${id}"]`).exists()).toBe(true)
      }
      expect(w.find('[data-test="edit-a1"]').exists()).toBe(true)
      expect(w.find('[data-test="remove-a1"]').exists()).toBe(true)
      expect(w.find('[data-test="toggle-a1"]').exists()).toBe(true)
    })
  })
})
