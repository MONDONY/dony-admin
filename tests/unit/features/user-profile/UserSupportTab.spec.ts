import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import UserSupportTab from '@/features/user-profile/components/UserSupportTab.vue'

const sectionMock = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: { section: (...a: unknown[]) => sectionMock(...a) },
}))
const ConvStub = { props: ['userId'], template: '<div data-test="conv-stub">{{ userId }}</div>' }
const stubs = { UserSupportConversations: ConvStub }
const AUDIT = { id: 1, action: 'USER_BANNED_BY_ADMIN', actorName: null, actorId: null, reason: null, createdAt: '2026-10-20T10:00:00Z' }

describe('UserSupportTab', () => {
  beforeEach(() => { sectionMock.mockReset() })

  it('ADMIN : conversations puis journal avec libellés français et tirets', async () => {
    seedAuth('ADMIN')
    sectionMock.mockResolvedValue({ content: [AUDIT, { ...AUDIT, id: 2, actorName: 'a@b.fr', reason: 'Fraude' }], totalPages: 1, number: 0, totalElements: 2 })
    const w = mount(UserSupportTab, { props: { userId: 'u1' }, global: { stubs } })
    await flushPromises()
    expect(w.get('[data-test="conv-stub"]').text()).toBe('u1')
    expect(sectionMock).toHaveBeenCalledWith('u1', 'audit', 0, 20, undefined)
    expect(w.get('h2').text()).toBe('Gestes des administrateurs sur ce compte')
    expect(w.get('[data-test="section-hint"]').text()).toContain('Seuls les gestes enregistrés sur le compte lui-même')
    const rows = w.findAll('[data-test="section-row"]')
    expect(rows[0].text()).toContain('Compte banni')
    expect(rows[0].text()).toContain('—')
    expect(rows[1].text()).toContain('a@b.fr')
    expect(rows[1].text()).toContain('Fraude')
    expect(w.html().indexOf('conv-stub')).toBeLessThan(w.html().indexOf('section-audit'))
  })

  it('SUPPORT : conversations visibles, journal absent et jamais appelé', async () => {
    seedAuth('SUPPORT')
    const w = mount(UserSupportTab, { props: { userId: 'u1' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="conv-stub"]').exists()).toBe(true)
    expect(w.find('[data-test="section-audit"]').exists()).toBe(false)
    expect(sectionMock).not.toHaveBeenCalled()
  })

  it('journal en erreur : bouton Réessayer', async () => {
    seedAuth('ADMIN')
    sectionMock.mockRejectedValue(new Error('boom'))
    const w = mount(UserSupportTab, { props: { userId: 'u1' }, global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain('Réessayer')
  })

  it('sans droit conversations : seul le journal', async () => {
    seedAuth('ADMIN', { SUPPORT_TICKET_VIEW: false })
    sectionMock.mockResolvedValue({ content: [], totalPages: 0, number: 0, totalElements: 0 })
    const w = mount(UserSupportTab, { props: { userId: 'u1' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="conv-stub"]').exists()).toBe(false)
    expect(w.find('[data-test="section-audit"]').exists()).toBe(true)
  })
})
