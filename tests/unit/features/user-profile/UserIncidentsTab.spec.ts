import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import UserIncidentsTab from '@/features/user-profile/components/UserIncidentsTab.vue'

const sectionMock = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: { section: (...a: unknown[]) => sectionMock(...a) },
}))
const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }
const empty = { content: [], totalPages: 0, number: 0, totalElements: 0 }
const mountTab = async () => {
  const w = mount(UserIncidentsTab, { props: { userId: 'u1' }, global: { stubs } })
  await flushPromises()
  return w
}
const sections = () => sectionMock.mock.calls.map(c => `${c[1]}${c[4]?.direction ? `:${c[4].direction}` : ''}`).sort()

describe('UserIncidentsTab', () => {
  beforeEach(() => {
    sectionMock.mockReset()
    sectionMock.mockResolvedValue(empty)
  })

  it('tous les droits : litiges, annulations, signalements reçus et envoyés, avis', async () => {
    seedAuth('ADMIN')
    const w = await mountTab()
    expect(sections()).toEqual(['cancellations', 'disputes', 'ratings', 'reports:RECEIVED', 'reports:SENT'])
    expect(w.get('[data-test="section-reports-received"]').text()).toContain('Signalements visant directement ce compte')
    expect(w.get('[data-test="section-reports-sent"]').text()).not.toContain('visant directement')
  })

  it('sans REPORT_VIEW : aucun signalement', async () => {
    seedAuth('SUPPORT', { REPORT_VIEW: false })
    const w = await mountTab()
    expect(sections()).toEqual(['cancellations', 'disputes', 'ratings'])
    expect(w.text()).not.toContain('Signalements')
  })

  it('sans DISPUTE_VIEW : ni litiges ni annulations', async () => {
    seedAuth('SUPPORT', { DISPUTE_VIEW: false })
    const w = await mountTab()
    expect(sections()).toEqual(['ratings', 'reports:RECEIVED', 'reports:SENT'])
    expect(w.text()).not.toContain('Litiges')
  })

  it('sans RATING_MODERATE : pas d’avis', async () => {
    seedAuth('SUPPORT', { RATING_MODERATE: false })
    await mountTab()
    expect(sections()).not.toContain('ratings')
  })

  it('liens litige et signalement, annulations et avis sans lien', async () => {
    seedAuth('ADMIN')
    sectionMock.mockImplementation(async (_i: string, s: string) => {
      if (s === 'disputes') return { ...empty, content: [{ id: 'd1', bidId: 'b', type: 'LOST', status: 'OPEN', role: 'SENDER', createdAt: '2026-10-20T10:00:00Z', resolvedAt: null }], totalPages: 1 }
      if (s === 'cancellations') return { ...empty, content: [{ id: 'c1', bidId: 'b', reason: null, scope: null, status: 'PENDING', declaredByUser: true, createdAt: '2026-10-20T10:00:00Z' }], totalPages: 1 }
      if (s === 'ratings') return { ...empty, content: [{ id: 'r1', bidId: 'b', stars: 5, comment: 'Top', flagged: false, createdAt: '2026-10-20T10:00:00Z' }], totalPages: 1 }
      return { ...empty, content: [{ id: 'g1', direction: 'x', targetType: 'USER', reason: 'SPAM', status: 'OPEN', createdAt: '2026-10-20T10:00:00Z' }], totalPages: 1 }
    })
    const w = await mountTab()
    expect(w.get('[data-test="section-disputes"] a').attributes('href')).toBe('/incidents?open=d1')
    expect(w.find('[data-test="section-cancellations"] a').exists()).toBe(false)
    expect(w.find('[data-test="section-ratings"] a').exists()).toBe(false)
    expect(w.get('[data-test="section-reports-received"] a').attributes('href')).toBe('/signalements?open=g1')
  })
})
