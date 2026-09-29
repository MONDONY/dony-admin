import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportsTable from '@/features/signalements/components/ReportsTable.vue'
import type { AdminReport } from '@/features/signalements/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const bug: AdminReport = {
  id: 'r1', targetType: 'APP', targetId: '', targetLabel: null, reason: 'SCREEN_BUG', description: 'Écran figé',
  reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null, resolvedAt: null,
  createdAt: '2026-09-20T10:00:00Z', photoUrls: [], screenRoute: '/home',
}
const mountTable = (reports: AdminReport[], extra: Record<string, unknown> = {}) =>
  mount(ReportsTable, { props: { reports, loading: false, ...extra }, global: { stubs: { NuxtLink } } })

describe('ReportsTable : répondre au signalant', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('canReply du back : bouton Répondre qui émet reply', async () => {
    const w = mountTable([{ ...bug, canReply: true }])
    const btn = w.find('[data-test="reply-r1"]')
    expect(btn.text()).toBe('Répondre')
    await btn.trigger('click')
    expect(w.emitted('reply')?.[0]).toEqual(['r1'])
  })

  it('canReply false : pas de bouton', () => {
    expect(mountTable([{ ...bug, canReply: false }]).find('[data-test="reply-r1"]').exists()).toBe(false)
  })

  it('ancien back : visible sur une cible APP avec SUPPORT_TICKET_MANAGE', () => {
    expect(mountTable([bug]).find('[data-test="reply-r1"]').exists()).toBe(true)
    expect(mountTable([{ ...bug, targetType: 'USER' }]).find('[data-test="reply-r1"]').exists()).toBe(false)
    seedAuth('SUPPORT', { SUPPORT_TICKET_MANAGE: false })
    expect(mountTable([bug]).find('[data-test="reply-r1"]').exists()).toBe(false)
  })

  it('sans supportTicketId : pas de badge', () => {
    const w = mountTable([{ ...bug, canReply: true }])
    expect(w.find('[data-test="report-conversation-r1"]').exists()).toBe(false)
  })

  it('conversation ouverte : badge, lien vers le fil et « Répondre à nouveau »', () => {
    const w = mountTable([{ ...bug, canReply: true, supportTicketId: 't9' }])
    const badge = w.find('[data-test="report-conversation-r1"]')
    expect(badge.text()).toContain('Conversation ouverte')
    expect(w.find('[data-test="report-conversation-link-r1"]').attributes('href')).toBe('/support?ticket=t9')
    expect(w.find('[data-test="reply-r1"]').text()).toBe('Répondre à nouveau')
    expect(w.text()).not.toContain('—')
  })

  it('sans SUPPORT_TICKET_VIEW : badge sans lien', () => {
    seedAuth('ADMIN', { SUPPORT_TICKET_VIEW: false })
    const w = mountTable([{ ...bug, canReply: true, supportTicketId: 't9' }])
    expect(w.find('[data-test="report-conversation-r1"]').exists()).toBe(true)
    expect(w.find('[data-test="report-conversation-link-r1"]').exists()).toBe(false)
  })

  it('le traitement reste proposé à côté de Répondre', () => {
    const w = mountTable([{ ...bug, canReply: true, availableActions: ['RESOLVE', 'DISMISS'] }])
    expect(w.find('[data-test="resolve-r1"]').exists()).toBe(true)
    expect(w.find('[data-test="reply-r1"]').exists()).toBe(true)
  })

  it('signalement déjà traité ou rejeté : Répondre reste proposé si canReply', () => {
    for (const status of ['RESOLVED', 'DISMISSED'] as const) {
      const w = mountTable([{ ...bug, status, canReply: true, availableActions: [] }])
      expect(w.find('[data-test="reply-r1"]').exists()).toBe(true)
      expect(w.find('[data-test="resolve-r1"]').exists()).toBe(false)
    }
  })

  it('un signalement supprimé ne propose pas de répondre', () => {
    const w = mountTable([{ ...bug, canReply: true, deletedAt: '2026-09-21T10:00:00Z' }])
    expect(w.find('[data-test="reply-r1"]').exists()).toBe(false)
  })

  it('met en avant le signalement ouvert par lien', () => {
    const w = mountTable([bug, { ...bug, id: 'r2' }], { highlightId: 'r2' })
    expect(w.find('[data-test="report-row-r2"]').attributes('data-highlighted')).toBe('true')
    expect(w.find('[data-test="report-row-r1"]').attributes('data-highlighted')).toBeUndefined()
  })
})
