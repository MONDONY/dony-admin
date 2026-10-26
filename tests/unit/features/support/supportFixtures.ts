import type { AdminSupportTicket, SupportMessage } from '@/features/support/types/index'

export const NOW = Date.parse('2026-10-26T12:00:00Z')
const H = 3_600_000
export const ago = (hours: number): string => new Date(NOW - hours * H).toISOString()

export const ticket = (over: Partial<AdminSupportTicket> = {}): AdminSupportTicket => ({
  id: 't1', category: 'PACKAGE', subject: 'Où est mon colis ?', status: 'NEW', priority: 'NORMAL', userId: 'u1',
  userDisplayName: 'user D', assignedAdminId: null, assignedAdminEmail: null,
  createdAt: ago(200), lastMessageAt: ago(200), resolvedAt: null, messages: null,
  ...over,
})

export const message = (id: string, authorType: 'USER' | 'ADMIN', createdAt: string, content: string | null = 'Bonjour'): SupportMessage => ({
  id, authorType, content, createdAt,
})
