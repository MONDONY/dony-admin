import { describe, it, expect, beforeEach } from 'vitest'
import { computed } from 'vue'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import WalletsTable from '@/features/finance/components/WalletsTable.vue'
import { toHref, type AdminRoute } from '@/lib/adminLinks'
import type { AdminWallet } from '@/features/finance/types/index'

const NuxtLink = {
  name: 'NuxtLink', props: ['to'],
  setup(p: { to: string | AdminRoute }) { return { href: computed(() => (typeof p.to === 'string' ? p.to : toHref(p.to))) } },
  template: '<a :href="href"><slot /></a>',
}
const U = '11111111-2222-4333-8444-555555555555'
const wallet = (over: Partial<AdminWallet> = {}): AdminWallet => ({ id: 'w1', userId: U, balanceCents: 12840, currency: 'EUR', updatedAt: '2026-10-22T10:00:00', userName: 'Mariam Koné (@mariam)', ...over })
const mountTable = (wallets: AdminWallet[], props: Record<string, unknown> = {}) =>
  mount(WalletsTable, { props: { wallets, loading: false, ...props }, global: { stubs: { NuxtLink } } })

describe('WalletsTable', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('colonnes : Titulaire, Solde, Devise, Mis à jour', () => {
    expect(mountTable([wallet()]).findAll('th').map(t => t.text())).toEqual(['Titulaire', 'Solde', 'Devise', 'Mis à jour'])
  })
  it('titulaire nommé : lien vers sa fiche, onglet Argent ; aucun UUID visible', () => {
    const w = mountTable([wallet()])
    const a = w.find('[data-test="wallet-holder-w1"]')
    expect(a.element.tagName).toBe('A')
    expect(a.attributes('href')).toBe(`/users/${U}?tab=money`)
    expect(a.text()).toBe('Mariam Koné (@mariam)')
    expect(w.find('[data-test="wallet-row-w1"]').text()).not.toContain('11111111')
  })
  it('sans USER_VIEW : le nom en texte, pas de lien', () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    const w = mountTable([wallet()])
    expect(w.find('[data-test="wallet-holder-w1"]').element.tagName).toBe('SPAN')
    expect(w.findAll('a')).toHaveLength(0)
  })
  it('compte supprimé (nom absent, nouveau back) : identifiant abrégé en texte simple, pas de lien', () => {
    const w = mountTable([wallet(), wallet({ id: 'w2', userName: undefined })])
    const cell = w.find('[data-test="wallet-holder-w2"]')
    expect(cell.element.tagName).toBe('SPAN')
    expect(cell.text()).toBe('11111111')
    expect(w.find('[data-test="wallet-row-w2"]').text()).toContain('Compte supprimé')
    expect(w.find('[data-test="wallet-row-w2"]').text()).not.toContain('undefined')
  })
  it('ancien back (aucun nom) : colonne d’avant, identifiant abrégé, relié à la fiche', () => {
    const w = mountTable([wallet({ userName: undefined }), wallet({ id: 'w3', userId: 'u1', userName: undefined })])
    const a = w.find('[data-test="wallet-holder-w1"]')
    expect(a.element.tagName).toBe('A')
    expect(a.text()).toBe('11111111')
    expect(a.attributes('href')).toBe(`/users/${U}?tab=money`)
    // Identifiant qui n'est pas un UUID : pas de lien, jamais « undefined ».
    expect(w.find('[data-test="wallet-holder-w3"]').element.tagName).toBe('SPAN')
    expect(w.find('[data-test="wallet-row-w3"]').text()).toContain('u1')
    expect(w.text()).not.toContain('Compte supprimé')
  })
  it('solde formaté, négatif signalé ; date du serveur lue en UTC', () => {
    const w = mountTable([wallet({ balanceCents: -620 })])
    const amount = w.find('[data-test="wallet-balance-w1"]')
    expect(amount.text()).toBe('-6,20 EUR')
    expect(amount.classes()).toContain('text-danger')
    expect(w.find('[data-test="wallet-row-w1"]').text()).toContain('22 oct.')
  })
  it('état vide seulement sans erreur : une liste en échec n’est jamais « Aucun portefeuille »', () => {
    expect(mountTable([]).text()).toMatch(/Aucun portefeuille/)
    expect(mountTable([], { failed: true }).text()).not.toMatch(/Aucun portefeuille/)
  })
  it('lecture seule : aucun bouton, lignes non cliquables', () => {
    const w = mountTable([wallet()])
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.find('[data-test="wallet-row-w1"]').attributes('tabindex')).toBeUndefined()
  })
})
