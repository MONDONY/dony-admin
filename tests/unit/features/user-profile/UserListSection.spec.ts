import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UserListSection from '@/features/user-profile/components/UserListSection.vue'
import type { SectionColumn } from '@/features/user-profile/lib/sectionColumns'

const sectionMock = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: { section: (...a: unknown[]) => sectionMock(...a) },
}))

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }
const columns: SectionColumn[] = [
  { key: 'name', label: 'Nom' },
  { key: 'state', label: 'Statut', format: r => (r.state === 'X' ? 'Xylo' : '—'), tone: () => 'success' },
  { key: 'note', label: 'Note' },
]
const page = (content: unknown[], totalPages = 1) => ({ content, totalPages, number: 0, totalElements: content.length })
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(UserListSection, {
    props: { title: 'Colis', columns, section: 'parcels', userId: 'u1', emptyLabel: 'Aucun colis', ...props },
    global: { stubs },
  })

describe('UserListSection', () => {
  beforeEach(() => sectionMock.mockReset())

  it('charge la page 0 de 20 au montage, une seule fois', async () => {
    sectionMock.mockResolvedValue(page([]))
    mountIt({ extra: { direction: 'SENT' } })
    await flushPromises()
    expect(sectionMock).toHaveBeenCalledTimes(1)
    expect(sectionMock).toHaveBeenCalledWith('u1', 'parcels', 0, 20, { direction: 'SENT' })
  })

  it('liste vide : message dédié', async () => {
    sectionMock.mockResolvedValue(page([]))
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('Aucun colis')
  })

  it('lignes : tableau nommé, th scope=col, tiret pour valeur absente, badge avec texte', async () => {
    sectionMock.mockResolvedValue(page([{ id: 'a', name: 'Awa', state: 'X', note: null }]))
    const w = mountIt()
    await flushPromises()
    const table = w.get('table')
    expect(table.attributes('aria-labelledby')).toBeTruthy()
    expect(w.findAll('th').every(t => t.attributes('scope') === 'col')).toBe(true)
    const row = w.get('[data-test="section-row"]')
    expect(row.text()).toContain('Awa')
    expect(row.text()).toContain('Xylo')
    expect(row.findAll('td')[2]!.text()).toBe('—')
    expect(w.find('[data-test="state-empty"]').exists()).toBe(false)
  })

  it('500 : erreur, jamais « vide », et Réessayer recharge', async () => {
    sectionMock.mockRejectedValueOnce({ statusCode: 500 }).mockResolvedValueOnce(page([{ id: 'a', name: 'Awa' }]))
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-test="state-error"]').exists()).toBe(true)
    expect(w.text()).not.toContain('Aucun colis')
    await w.get('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(sectionMock).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
    expect(w.text()).toContain('Awa')
  })

  it('pagination : visible au-delà d’une page, changer de page recharge', async () => {
    sectionMock.mockResolvedValue(page([{ id: 'a', name: 'Awa' }], 3))
    const w = mountIt()
    await flushPromises()
    await w.get('[data-test="next"]').trigger('click')
    await flushPromises()
    expect(sectionMock).toHaveBeenLastCalledWith('u1', 'parcels', 1, 20, undefined)
  })

  it('une seule page : pas de pagination', async () => {
    sectionMock.mockResolvedValue(page([{ id: 'a', name: 'Awa' }], 1))
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-test="next"]').exists()).toBe(false)
  })

  it('lien « Ouvrir » avec nom accessible commençant par Ouvrir, absent si linkFor renvoie null', async () => {
    sectionMock.mockResolvedValue(page([{ id: 'a', name: 'Awa', note: 'n' }, { id: 'b', name: 'Bob', note: 'm' }]))
    const w = mountIt({ linkFor: (r: { id: string }) => (r.id === 'a' ? `/colis?open=${r.id}` : null) })
    await flushPromises()
    const links = w.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]!.attributes('href')).toBe('/colis?open=a')
    expect(links[0]!.attributes('aria-label')).toMatch(/^Ouvrir /)
    expect(links[0]!.attributes('aria-label')).toContain('Awa')
  })

  it('sans linkFor : pas de colonne Ouvrir ; titre et indication affichés ; slot action', async () => {
    sectionMock.mockResolvedValue(page([{ id: 'a', name: 'Awa' }]))
    const w = mount(UserListSection, {
      props: { title: 'Colis', hint: 'Une indication', columns, section: 'parcels', userId: 'u1', emptyLabel: 'x' },
      slots: { action: '<button data-test="act">Agir</button>' },
      global: { stubs },
    })
    await flushPromises()
    expect(w.text()).not.toContain('Ouvrir')
    expect(w.get('[data-test="section-hint"]').text()).toBe('Une indication')
    expect(w.find('[data-test="act"]').exists()).toBe(true)
    expect(w.get('h2').text()).toBe('Colis')
  })

  it('ligne sans id et colonnes vides : repli sur le titre pour le nom du lien', async () => {
    sectionMock.mockResolvedValue(page([{ note: 'n' }]))
    const w = mountIt({ linkFor: () => '/x' })
    await flushPromises()
    expect(w.get('a').attributes('aria-label')).toBe('Ouvrir Colis')
  })
})
