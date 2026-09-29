import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const listByUserMock = vi.fn()
vi.mock('@/features/support/services/supportService', () => ({
  supportService: { listByUser: (...a: unknown[]) => listByUserMock(...a) },
}))
import UserSupportConversations from '@/features/support/components/UserSupportConversations.vue'

const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const ticket = (id: string, over: Record<string, unknown> = {}) => ({
  id, category: 'PAYMENT', subject: `Sujet ${id}`, status: 'WAITING_USER', priority: 'NORMAL',
  userId: 'u1', userDisplayName: 'Awa', assignedAdminId: 'a1', assignedAdminEmail: 'a@yadony.com',
  createdAt: '2026-09-28T10:00:00Z', lastMessageAt: '2026-09-28T11:00:00Z', resolvedAt: null, messages: null,
  ...over,
})
const page = (content: unknown[], totalElements = content.length) => ({ content, totalElements, totalPages: 1, number: 0, size: 5 })

function mountSection(userId = 'u1') {
  return mount(UserSupportConversations, { props: { userId }, global: { stubs: { NuxtLink: NuxtLinkStub } } })
}

describe('UserSupportConversations', () => {
  beforeEach(() => {
    seedAuth('ADMIN')
    listByUserMock.mockReset()
  })

  it('liste les 5 dernières conversations avec statut FR et lien vers le fil', async () => {
    listByUserMock.mockResolvedValue(page([ticket('t1'), ticket('t2', { status: 'RESOLVED' })], 7))
    const w = mountSection()
    expect(w.find('[data-test="user-support-loading"]').exists()).toBe(true)
    await flushPromises()
    expect(listByUserMock).toHaveBeenCalledWith('u1', 5)
    const rows = w.findAll('[data-test^="user-support-row-"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Sujet t1')
    expect(rows[0]!.text()).toContain('Attente utilisateur')
    expect(rows[1]!.text()).toContain('Résolu')
    expect(rows[0]!.find('a').attributes('href')).toBe('/support?ticket=t1')
    expect(w.find('[data-test="user-support-all"]').attributes('href')).toBe('/support?userId=u1')
    expect(w.find('[data-test="user-support-all"]').text()).toContain('Voir tout')
    expect(w.text()).not.toContain('—')
  })

  it('aucune conversation : état vide, pas de « Voir tout »', async () => {
    listByUserMock.mockResolvedValue(page([]))
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test="user-support-empty"]').text()).toContain('Aucune conversation')
    expect(w.find('[data-test="user-support-all"]').exists()).toBe(false)
  })

  it('ancien back qui ignore ?userId= : section masquée', async () => {
    listByUserMock.mockResolvedValue(page([ticket('t1'), ticket('t2', { userId: 'autre' })]))
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test="user-support-section"]').exists()).toBe(false)
  })

  it('lignes sans userId : conservées (rien ne permet de les écarter)', async () => {
    listByUserMock.mockResolvedValue(page([ticket('t1', { userId: undefined })]))
    const w = mountSection()
    await flushPromises()
    expect(w.findAll('[data-test^="user-support-row-"]')).toHaveLength(1)
  })

  it('erreur de lecture : message dans la section', async () => {
    listByUserMock.mockRejectedValue(Object.assign(new Error('500'), { data: { detail: 'Serveur indisponible' } }))
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test="user-support-error"]').text()).toBe('Serveur indisponible')
  })

  it('erreur sans détail : repli lisible', async () => {
    listByUserMock.mockRejectedValue(new Error(''))
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test="user-support-error"]').text()).toBe('Conversations indisponibles.')
  })

  it('recharge quand la fiche change d’utilisateur, sans mélanger les réponses', async () => {
    let first!: (_v: unknown) => void
    listByUserMock.mockReturnValueOnce(new Promise((r) => { first = r }))
    listByUserMock.mockResolvedValueOnce(page([ticket('t5', { userId: 'u2' })]))
    const w = mountSection('u1')
    await w.setProps({ userId: 'u2' })
    await flushPromises()
    first(page([ticket('t1')]))
    await flushPromises()
    expect(listByUserMock).toHaveBeenLastCalledWith('u2', 5)
    const rows = w.findAll('[data-test^="user-support-row-"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Sujet t5')
  })

  it('date absente : pas de tiret affiché', async () => {
    listByUserMock.mockResolvedValue(page([ticket('t1', { lastMessageAt: null, createdAt: null })]))
    const w = mountSection()
    await flushPromises()
    expect(w.text()).not.toContain('—')
  })
})
