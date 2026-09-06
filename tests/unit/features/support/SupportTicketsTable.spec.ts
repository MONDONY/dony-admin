import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SupportTicketsTable from '@/features/support/components/SupportTicketsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const tickets = [
  {
    id: 't1',
    userId: 'u9',
    userDisplayName: 'Awa Diop',
    category: 'PAIEMENT',
    subject: 'Mon remboursement n’arrive pas',
    status: 'NEW',
    priority: 'NORMAL',
    assignedAdminId: null,
    assignedAdminEmail: null,
    createdAt: '2026-09-01T10:00:00Z',
    lastMessageAt: '2026-09-02T08:30:00Z',
    resolvedAt: null,
    messages: [],
  },
]

describe('SupportTicketsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('affiche le sujet, l’utilisateur et la catégorie du ticket', () => {
    const w = mount(SupportTicketsTable, { props: { tickets, loading: false } })
    expect(w.text()).toContain('Mon remboursement n’arrive pas')
    expect(w.text()).toContain('Awa Diop')
    expect(w.text()).toContain('PAIEMENT')
  })

  it('traduit le statut plutôt que d’afficher la valeur brute du backend', () => {
    const w = mount(SupportTicketsTable, { props: { tickets, loading: false } })
    expect(w.text()).toContain('Nouveau')
    expect(w.text()).not.toContain('NEW')
  })

  it('rend un tiret cadratin dans la colonne « Assigné à » d’un ticket libre', () => {
    const w = mount(SupportTicketsTable, { props: { tickets, loading: false } })
    expect(w.text()).toContain('—')
  })

  it('affiche l’email de l’admin quand le ticket est assigné', () => {
    const assigned = [{ ...tickets[0], assignedAdminEmail: 'sofia@yadony.com' }]
    const w = mount(SupportTicketsTable, { props: { tickets: assigned, loading: false } })
    expect(w.text()).toContain('sofia@yadony.com')
  })

  it('émet select avec l’identifiant du ticket cliqué', async () => {
    const w = mount(SupportTicketsTable, { props: { tickets, loading: false } })
    await w.find('tbody tr').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['t1'])
  })

  it('annonce le chargement', () => {
    const w = mount(SupportTicketsTable, { props: { tickets: [], loading: true } })
    expect(w.text()).toMatch(/Chargement/i)
  })

  it('annonce la file vide, et seulement une fois le chargement terminé', () => {
    const w = mount(SupportTicketsTable, { props: { tickets: [], loading: false } })
    expect(w.text()).toMatch(/Aucun ticket/i)
  })
})
