import { buildQueue, type QueueConversation } from '@/features/moderation/lib/moderationWorkbench'
import type { AdminConversation, AdminMessage } from '@/features/moderation/types/index'
import type { AdminReport } from '@/features/signalements/types/index'

export const NOW = Date.parse('2026-10-27T12:00:00Z')
export const ago = (hours: number): string => new Date(NOW - hours * 3_600_000).toISOString()

/** Identifiant INTERNE d'une conversation de test : celui que porte `targetId` d'un signalement de message. */
export const internalId = (firestoreId: string): string => `int-${firestoreId}`

const hex = (s: string): string => Array.from(s).map((c) => c.charCodeAt(0).toString(16)).join('').padStart(12, '0').slice(-12)
/** Compte d'un participant de test : un vrai UUID (les liens vers les fiches refusent tout le reste). */
export const participantId = (side: 'a' | 'b', firestoreId: string): string => `${side === 'a' ? 'aaaaaaaa' : 'bbbbbbbb'}-0000-4000-8000-${hex(firestoreId)}`

/** Une conversation telle que le nouveau back la rend : `id` Firestore, `conversationId` interne, comptes des participants. */
export const conversation = (id: string, over: Partial<AdminConversation> = {}): AdminConversation => ({
  id, bidId: null, participantA: 'Aïcha', participantB: 'Moussa', lastMessageAt: ago(30), messageCount: 0, flagged: false,
  createdAt: '2026-10-12T10:00:00Z', conversationId: internalId(id), participantAId: participantId('a', id), participantBId: participantId('b', id),
  openReportCount: 0, lastMessagePreview: null, ...over,
})

/** Un signalement ouvert sur un message de la conversation `firestoreId` (il porte l'identifiant interne). */
export const report = (id: string, firestoreId: string, over: Partial<AdminReport> = {}): AdminReport => ({
  id, targetType: 'MESSAGE', targetId: internalId(firestoreId), targetLabel: null, reason: 'SPAM', description: null, reporterName: 'Aïcha', status: 'OPEN',
  actionTaken: null, resolutionNote: null, resolvedAt: null, createdAt: ago(100), photoUrls: [], ...over,
} as AdminReport)

export const message = (id: string, over: Partial<AdminMessage> = {}): AdminMessage => ({
  id, conversationId: 'c1', senderName: 'Aïcha', content: 'Bonjour', flagged: false, deleted: false, createdAt: '2026-10-20T16:02:00Z', ...over,
})

/** Une file prête : `c1` signalée (spam), `c2` calme. */
export const queue = (): QueueConversation[] =>
  buildQueue([conversation('c1', { openReportCount: 1 }), conversation('c2', { participantA: 'Mariam', participantB: 'Ousmane' })], [report('r1', 'c1')])
