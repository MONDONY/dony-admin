import { buildQueue, type QueueConversation } from '@/features/moderation/lib/moderationWorkbench'
import type { AdminConversation, AdminMessage } from '@/features/moderation/types/index'
import type { AdminReport } from '@/features/signalements/types/index'

export const NOW = Date.parse('2026-10-27T12:00:00Z')
export const ago = (hours: number): string => new Date(NOW - hours * 3_600_000).toISOString()

export const conversation = (id: string, over: Partial<AdminConversation> = {}): AdminConversation => ({
  id, bidId: null, participantA: 'Aïcha', participantB: 'Moussa', lastMessageAt: ago(30), messageCount: 0, flagged: false,
  createdAt: '2026-10-12T10:00:00Z', ...over,
})

export const report = (id: string, targetId: string, over: Partial<AdminReport> = {}): AdminReport => ({
  id, targetType: 'MESSAGE', targetId, targetLabel: null, reason: 'SPAM', description: null, reporterName: 'Aïcha', status: 'OPEN',
  actionTaken: null, resolutionNote: null, resolvedAt: null, createdAt: ago(100), photoUrls: [], ...over,
} as AdminReport)

export const message = (id: string, over: Partial<AdminMessage> = {}): AdminMessage => ({
  id, conversationId: 'c1', senderName: 'Aïcha', content: 'Bonjour', flagged: false, deleted: false, createdAt: '2026-10-20T16:02:00Z', ...over,
})

/** Une file prête : `c1` signalée (spam), `c2` calme. */
export const queue = (): QueueConversation[] =>
  buildQueue([conversation('c1'), conversation('c2', { participantA: 'Mariam', participantB: 'Ousmane' })], [report('r1', 'c1')])
