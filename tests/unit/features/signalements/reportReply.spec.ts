import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { reportsService } from '@/features/signalements/services/reportsService'
import {
  REPORT_REPLY_MAX, canReplyToReport, hasSupportConversation, replySentMessage, reporterFirstName,
  reportLink, supportConversationLink,
} from '@/features/signalements/reportReply'
import type { AdminReport } from '@/features/signalements/types/index'
import type { AdminPermission } from '@/stores/auth'

const bug: AdminReport = {
  id: 'r1', targetType: 'APP', targetId: '', targetLabel: null, reason: 'SCREEN_BUG', description: 'Le bouton ne répond pas',
  reporterName: 'Awa Diallo', status: 'OPEN', actionTaken: null, resolutionNote: null, resolvedAt: null,
  createdAt: '2026-09-20T10:00:00Z', photoUrls: [], screenRoute: '/home',
}
const allow = new Set<AdminPermission>(['SUPPORT_TICKET_MANAGE'])
const deny = new Set<AdminPermission>()

describe('reportsService.reply / get', () => {
  beforeEach(() => { apiMock.mockReset() })

  it('reply POST /admin/reports/{id}/reply avec message et pièces jointes', async () => {
    apiMock.mockResolvedValue({ ticketId: 't1', created: true, ticket: { id: 't1' } })
    const res = await reportsService.reply('r1', { message: 'Merci', attachmentKeys: ['k1'] })
    expect(apiMock).toHaveBeenCalledWith('/admin/reports/r1/reply', {
      method: 'POST', body: { message: 'Merci', attachmentKeys: ['k1'] },
    })
    expect(res.ticketId).toBe('t1')
  })

  it('reply encode l’identifiant', async () => {
    apiMock.mockResolvedValue({ ticketId: 't1', created: false, ticket: { id: 't1' } })
    await reportsService.reply('a/b', { message: 'x' })
    expect(apiMock.mock.calls[0][0]).toBe('/admin/reports/a%2Fb/reply')
  })

  it('get GET /admin/reports/{id}', async () => {
    apiMock.mockResolvedValue(bug)
    expect(await reportsService.get('r1')).toEqual(bug)
    expect(apiMock).toHaveBeenCalledWith('/admin/reports/r1')
  })
})

describe('règles de réponse', () => {
  it('le champ canReply du back fait foi', () => {
    expect(canReplyToReport({ ...bug, canReply: false }, allow)).toBe(false)
    expect(canReplyToReport({ ...bug, targetType: 'USER', canReply: true }, deny)).toBe(true)
  })

  it('ancien back sans canReply : cible APP et SUPPORT_TICKET_MANAGE', () => {
    expect(canReplyToReport(bug, allow)).toBe(true)
    expect(canReplyToReport(bug, new Set<AdminPermission>(['SUPPORT_TICKET_VIEW']))).toBe(false)
    expect(canReplyToReport(bug, deny)).toBe(false)
    expect(canReplyToReport({ ...bug, targetType: 'USER' }, allow)).toBe(false)
    expect(canReplyToReport({ ...bug, canReply: null }, allow)).toBe(true)
  })

  it('un signalement supprimé ne se répond pas', () => {
    expect(canReplyToReport({ ...bug, deletedAt: '2026-09-21T10:00:00Z', canReply: true }, allow)).toBe(false)
  })

  it('hasSupportConversation seulement avec un identifiant', () => {
    expect(hasSupportConversation(bug)).toBe(false)
    expect(hasSupportConversation({ ...bug, supportTicketId: null })).toBe(false)
    expect(hasSupportConversation({ ...bug, supportTicketId: '' })).toBe(false)
    expect(hasSupportConversation({ ...bug, supportTicketId: 't1' })).toBe(true)
  })

  it('liens profonds', () => {
    expect(supportConversationLink('t 1')).toBe('/support?ticket=t%201')
    expect(reportLink('r 1')).toBe('/signalements?open=r%201')
  })

  it('prénom du signalant, avec replis', () => {
    expect(reporterFirstName('Awa Diallo')).toBe('Awa')
    expect(reporterFirstName('  Moussa  ')).toBe('Moussa')
    expect(reporterFirstName(null, 'Fatou Sy')).toBe('Fatou')
    expect(reporterFirstName('', '')).toBe('Le signalant')
    expect(reporterFirstName(undefined)).toBe('Le signalant')
  })

  it('message de succès sans tiret cadratin', () => {
    const m = replySentMessage('Awa')
    expect(m).toBe('Réponse envoyée, conversation créée. Awa la verra dans Yadony Support.')
    expect(replySentMessage('Awa', false)).toBe('Réponse ajoutée à la conversation. Awa la verra dans Yadony Support.')
    expect(m).not.toContain('—')
    expect(REPORT_REPLY_MAX).toBe(4000)
  })
})
