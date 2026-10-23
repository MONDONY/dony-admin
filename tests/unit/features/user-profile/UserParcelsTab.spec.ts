import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UserParcelsTab from '@/features/user-profile/components/UserParcelsTab.vue'

const sectionMock = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: { section: (...a: unknown[]) => sectionMock(...a) },
}))
const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }
const page = (content: unknown[]) => ({ content, totalPages: 1, number: 0, totalElements: content.length })

describe('UserParcelsTab', () => {
  beforeEach(() => sectionMock.mockReset())

  it('trois sections, chacune appelle son endpoint avec des liens vers les écrans existants', async () => {
    sectionMock.mockImplementation(async (_id: string, s: string) => {
      if (s === 'parcels') return page([{ id: 'b1', trackingNumber: 'DNY-1', corridor: 'P → D', role: 'SENDER', status: 'IN_TRANSIT', createdAt: '2026-10-20T10:00:00Z', deliveredAt: null, amount: null }])
      if (s === 'trips') return page([{ id: 't1', status: 'ACTIVE', corridor: 'P → D', departureDate: '2026-10-25', availableKg: 5, pricePerKg: 8, currency: 'EUR' }])
      return page([{ id: 'q1', corridor: 'P → D', status: 'OPEN', weightKg: 3, desiredDate: '2026-10-25T00:00:00Z', createdAt: '2026-10-20T10:00:00Z', openNegotiationCount: 0 }])
    })
    const w = mount(UserParcelsTab, { props: { userId: 'u1' }, global: { stubs } })
    await flushPromises()
    expect(sectionMock.mock.calls.map(c => c[1]).sort()).toEqual(['parcels', 'requests', 'trips'])
    expect(sectionMock.mock.calls.every(c => c[0] === 'u1' && c[2] === 0 && c[3] === 20)).toBe(true)
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toEqual(['/colis?open=b1', '/colis?tab=announcements&announcement=t1', '/colis?tab=demandes&open=q1'])
    expect(w.get('[data-test="section-requests"]').text()).toContain('25/10/2026')
  })
})
