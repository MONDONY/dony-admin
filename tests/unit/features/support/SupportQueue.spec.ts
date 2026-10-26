import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SupportQueue from '@/features/support/components/SupportQueue.vue'
import { groupTickets } from '@/features/support/lib/supportWorkbench'
import { ago, NOW, ticket } from './supportFixtures'

function mountQueue(tickets: ReturnType<typeof ticket>[], props: Record<string, unknown> = {}) {
  return mount(SupportQueue, { props: { groups: groupTickets(tickets), loading: false, now: NOW, ...props } })
}

describe('SupportQueue', () => {
  it('groupes avec leur compte et leurs lignes', () => {
    const w = mountQueue([ticket({ id: 'a' }), ticket({ id: 'b', status: 'WAITING_USER' }), ticket({ id: 'c', status: 'RESOLVED', resolvedAt: '2026-10-24T10:00:00Z' })])
    expect(w.get('[data-test="support-group-TO_ANSWER"]').text()).toContain('À répondre')
    expect(w.get('[data-test="support-group-WAITING_USER"]').text()).toContain('En attente de l’utilisateur')
    expect(w.get('[data-test="support-group-RESOLVED"]').text()).toContain('Résolus')
  })

  it('à répondre : sujet, personne, catégorie, ancienneté en alerte et « Non assigné »', () => {
    const w = mountQueue([ticket({ id: 'a', lastMessageAt: ago(9 * 24), priority: 'HIGH' })])
    const row = w.get('[data-test="support-row-a"]')
    expect(row.text()).toContain('Où est mon colis ?')
    expect(row.text()).toContain('user D')
    expect(row.text()).toContain('Colis')
    expect(row.text()).toContain('9 j')
    expect(row.text()).toContain('à répondre')
    expect(row.text()).toContain('Priorité haute')
    expect(row.text()).toContain('Non assigné')
    expect(row.find('.text-danger').text()).toBe('9 j')
  })

  it('propriétaire : « Moi » pour mes tickets, l’adresse d’un collègue, « Assigné » sans adresse', () => {
    const w = mountQueue([
      ticket({ id: 'a', assignedAdminId: 'me', assignedAdminEmail: 'me@yadony.com' }),
      ticket({ id: 'b', assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com' }),
      ticket({ id: 'c', assignedAdminId: 'y', assignedAdminEmail: null }),
    ], { myId: 'me' })
    expect(w.get('[data-test="support-owner-a"]').text()).toBe('Moi')
    expect(w.get('[data-test="support-owner-b"]').text()).toBe('x@yadony.com')
    expect(w.get('[data-test="support-owner-c"]').text()).toBe('Assigné')
  })

  it('en attente de l’utilisateur : « sans retour » ; résolu : date de résolution', () => {
    const w = mountQueue([ticket({ id: 'b', status: 'WAITING_USER' }), ticket({ id: 'c', status: 'RESOLVED', resolvedAt: '2026-10-24T10:12:00Z' }), ticket({ id: 'd', status: 'RESOLVED', resolvedAt: null })])
    expect(w.get('[data-test="support-row-b"]').text()).toContain('sans retour')
    expect(w.get('[data-test="support-row-c"]').text()).toContain('Résolu le 24/10')
    expect(w.get('[data-test="support-row-d"]').text()).toContain('Résolu')
    expect(w.get('[data-test="support-row-c"]').text()).not.toContain('Non assigné')
  })

  it('le ticket ouvert est marqué ; un clic le choisit', async () => {
    const w = mountQueue([ticket({ id: 'a' }), ticket({ id: 'b' })], { selectedId: 'b' })
    expect(w.get('[data-test="support-row-b"]').attributes('data-selected')).toBe('true')
    expect(w.get('[data-test="support-open-b"]').attributes('aria-current')).toBe('true')
    expect(w.get('[data-test="support-row-a"]').attributes('data-selected')).toBeUndefined()
    await w.get('[data-test="support-open-a"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['a'])
  })

  it('chargement, erreur et vide viennent du bloc d’état', async () => {
    expect(mountQueue([]).text()).toContain('Aucun ticket')
    const failed = mountQueue([], { error: 'Boum' })
    expect(failed.text()).toContain('Boum')
    await failed.get('[data-test="state-error"] button').trigger('click')
    expect(failed.emitted('retry')).toBeTruthy()
    expect(mountQueue([], { loading: true }).text()).toContain('Chargement')
  })

  it('aperçu du dernier message avec son auteur, sans ligne quand le back n’en donne pas', () => {
    const w = mountQueue([
      ticket({ id: 'a', lastMessagePreview: 'Bonjour, mon colis', lastMessageAuthor: 'USER' }),
      ticket({ id: 'b', lastMessagePreview: 'Je regarde.', lastMessageAuthor: 'ADMIN' }),
      ticket({ id: 'c' }),
    ])
    expect(w.get('[data-test="support-preview-a"]').text()).toBe('user D : Bonjour, mon colis')
    expect(w.get('[data-test="support-preview-b"]').text()).toBe('Support : Je regarde.')
    expect(w.find('[data-test="support-preview-c"]').exists()).toBe(false)
  })
})
