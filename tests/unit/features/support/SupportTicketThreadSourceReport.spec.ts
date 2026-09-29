import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SupportTicketThread from '@/features/support/components/SupportTicketThread.vue'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const base = {
  id: 't1', userId: 'u9', userDisplayName: 'Awa Diop', category: 'OTHER', subject: 'Votre rapport de bug',
  status: 'ASSIGNED', priority: 'NORMAL', assignedAdminId: 'u1', assignedAdminEmail: 'admin@yadony.com',
  createdAt: '2026-09-01T10:00:00Z', lastMessageAt: '2026-09-02T08:30:00Z', resolvedAt: null, messages: [],
}
const mountThread = (ticket: unknown) =>
  mount(SupportTicketThread, {
    props: { ticket, acting: false, actionError: null } as never,
    global: { stubs: { NuxtLink } },
  })

describe('SupportTicketThread : conversation issue d’un signalement', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('sourceReportId : mention et lien vers le signalement', () => {
    const w = mountThread({ ...base, sourceReportId: 'r7' })
    const source = w.find('[data-test="ticket-source-report"]')
    expect(source.text()).toContain('Issu du signalement')
    expect(source.find('a').attributes('href')).toBe('/signalements?open=r7')
    expect(w.text()).not.toContain('—')
  })

  it('sans REPORT_VIEW : mention sans lien', () => {
    seedAuth('ADMIN', { REPORT_VIEW: false })
    const w = mountThread({ ...base, sourceReportId: 'r7' })
    const source = w.find('[data-test="ticket-source-report"]')
    expect(source.text()).toContain('Issu du signalement')
    expect(source.find('a').exists()).toBe(false)
  })

  it('ancien back ou ticket ordinaire : aucune mention', () => {
    expect(mountThread(base).find('[data-test="ticket-source-report"]').exists()).toBe(false)
    expect(mountThread({ ...base, sourceReportId: null }).find('[data-test="ticket-source-report"]').exists()).toBe(false)
  })
})
