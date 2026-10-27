import { describe, it, expect } from 'vitest'
import {
  buildQueue, defaultConversationId, filterQueue, flaggedMessageId, groupQueue, isMessageDeleted, isRightSide, isSystemMessage,
  neighbourConversationId, oldestReport, participantsLabel, queueOrder, reportAge, scopeCounts, summarizeQueue,
  type QueueConversation,
} from '@/features/moderation/lib/moderationWorkbench'
import type { AdminConversation } from '@/features/moderation/types/index'
import type { AdminReport } from '@/features/signalements/types/index'

const NOW = Date.parse('2026-10-27T12:00:00Z')
const H = 3_600_000

const conv = (id: string, over: Partial<AdminConversation> = {}): AdminConversation => ({
  id, bidId: null, participantA: 'Aïcha', participantB: 'Moussa', lastMessageAt: '2026-10-26T10:00:00Z', messageCount: 0, flagged: false,
  createdAt: '2026-10-20T10:00:00Z', ...over,
})
const report = (id: string, targetId: string, over: Partial<AdminReport> = {}): AdminReport => ({
  id, targetType: 'MESSAGE', targetId, targetLabel: null, reason: 'SPAM', description: null, reporterName: 'Aïcha', status: 'OPEN',
  actionTaken: null, resolutionNote: null, resolvedAt: null, createdAt: '2026-10-23T12:00:00Z', photoUrls: [], ...over,
} as AdminReport)

describe('buildQueue', () => {
  it('rattache à chaque conversation ses signalements ouverts sur un message', () => {
    const q = buildQueue([conv('c1'), conv('c2')], [report('r1', 'c1'), report('r2', 'c1', { reason: 'HARASSMENT' })])
    expect(q.find((c) => c.id === 'c1')!.reports.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(q.find((c) => c.id === 'c2')!.reports).toEqual([])
    expect(q.every((c) => !c.partial)).toBe(true)
  })

  it('ignore les signalements qui ne sont ni ouverts ni sur un message', () => {
    const q = buildQueue([conv('c1')], [
      report('r1', 'c1', { status: 'RESOLVED' }),
      report('r2', 'c1', { targetType: 'USER' }),
      report('r3', '', {}),
    ])
    expect(q[0]!.reports).toEqual([])
    expect(q).toHaveLength(1)
  })

  it('ajoute une conversation signalée absente de la page chargée, avec son libellé', () => {
    const q = buildQueue([conv('c1')], [report('r1', 'old', { targetLabel: 'Awa ↔ Cheikh' }), report('r2', 'old')])
    const old = q.find((c) => c.id === 'old')!
    expect(old).toMatchObject({ partial: true, participantA: 'Awa ↔ Cheikh', participantB: null })
    expect(old.reports).toHaveLength(2)
  })

  it('reprend les champs de la conversation, fermeture comprise', () => {
    const q = buildQueue([conv('c1', { closedAt: '2026-10-25T09:00:00' })], [])
    expect(q[0]).toMatchObject({ id: 'c1', participantA: 'Aïcha', closedAt: '2026-10-25T09:00:00', partial: false })
  })
})

describe('filtre et groupes', () => {
  const items = buildQueue(
    [conv('c1'), conv('c2', { participantA: 'Mariam', participantB: 'Ousmane', lastMessageAt: '2026-10-27T11:00:00Z' }), conv('c3', { participantA: 'Fatou', participantB: 'Ibrahim', lastMessageAt: '2026-10-25T11:00:00Z' })],
    [report('r1', 'c3', { createdAt: '2026-10-26T12:00:00Z' }), report('r2', 'c1', { createdAt: '2026-10-23T12:00:00Z' })],
  )

  it('signalées d’abord, le plus ancien signalement en tête, puis l’activité récente', () => {
    const groups = groupQueue(items)
    expect(groups.map((g) => g.key)).toEqual(['REPORTED', 'RECENT'])
    expect(groups[0]!.items.map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(groups[1]!.items.map((c) => c.id)).toEqual(['c2'])
    expect(queueOrder(groups).map((c) => c.id)).toEqual(['c1', 'c3', 'c2'])
  })

  it('un groupe vide disparaît', () => {
    expect(groupQueue(items.filter((c) => c.reports.length === 0)).map((g) => g.key)).toEqual(['RECENT'])
    expect(groupQueue([])).toEqual([])
  })

  it('le périmètre « Signalées » écarte les conversations calmes', () => {
    expect(filterQueue(items, { scope: 'reported', query: '' }).map((c) => c.id).sort()).toEqual(['c1', 'c3'])
    expect(filterQueue(items, { scope: 'all', query: '' })).toHaveLength(3)
  })

  it('la recherche ignore accents et casse, sur les deux participants', () => {
    expect(filterQueue(items, { scope: 'all', query: 'aicha' }).map((c) => c.id)).toEqual(['c1'])
    expect(filterQueue(items, { scope: 'all', query: '  OUSMANE ' }).map((c) => c.id)).toEqual(['c2'])
    expect(filterQueue(items, { scope: 'all', query: 'zzz' })).toEqual([])
  })

  it('compte par périmètre', () => {
    expect(scopeCounts(items)).toEqual({ reported: 2, all: 3 })
  })

  it('une conversation sans activité connue passe après les autres', () => {
    const q = buildQueue([conv('a', { lastMessageAt: null, createdAt: '2026-10-01T00:00:00Z' }), conv('b', { lastMessageAt: '2026-10-26T00:00:00Z' })], [])
    expect(groupQueue(q)[0]!.items.map((c) => c.id)).toEqual(['b', 'a'])
    const bare = buildQueue([conv('x', { lastMessageAt: null, createdAt: 'illisible' })], [])
    expect(groupQueue(bare)[0]!.items).toHaveLength(1)
  })
})

describe('sélection', () => {
  const order = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as QueueConversation[]
  it('défaut = premier de la file', () => {
    expect(defaultConversationId(order)).toBe('a')
    expect(defaultConversationId([])).toBeNull()
  })
  it('J / K : voisin, borné aux extrémités, premier sans sélection', () => {
    expect(neighbourConversationId(order, 'a', 1)).toBe('b')
    expect(neighbourConversationId(order, 'c', 1)).toBe('c')
    expect(neighbourConversationId(order, 'a', -1)).toBe('a')
    expect(neighbourConversationId(order, null, 1)).toBe('a')
    expect(neighbourConversationId(order, 'zz', -1)).toBe('a')
    expect(neighbourConversationId([], 'a', 1)).toBeNull()
  })
})

describe('reportAge', () => {
  it('neutre, à surveiller (12 h), en retard (2 j)', () => {
    expect(reportAge(new Date(NOW - 30 * 60_000).toISOString(), NOW)).toEqual({ label: '< 1 h', tone: 'neutral' })
    expect(reportAge(new Date(NOW - 2 * H).toISOString(), NOW)).toEqual({ label: '2 h', tone: 'neutral' })
    expect(reportAge(new Date(NOW - 13 * H).toISOString(), NOW)).toEqual({ label: '13 h', tone: 'warning' })
    expect(reportAge(new Date(NOW - 30 * H).toISOString(), NOW)).toEqual({ label: '1 j', tone: 'warning' })
    expect(reportAge(new Date(NOW - 100 * H).toISOString(), NOW)).toEqual({ label: '4 j', tone: 'danger' })
  })
  it('date illisible ou absente : rien', () => {
    expect(reportAge(null, NOW)).toBeNull()
    expect(reportAge('n’importe quoi', NOW)).toBeNull()
  })
  it('une date dans le futur ne devient pas négative', () => {
    expect(reportAge(new Date(NOW + H).toISOString(), NOW)!.label).toBe('< 1 h')
  })
  it('lit une date du back sans fuseau comme de l’UTC', () => {
    expect(reportAge('2026-10-27T10:00:00', NOW)).toEqual({ label: '2 h', tone: 'neutral' })
  })
})

describe('oldestReport et synthèse', () => {
  it('le plus ancien signalement d’une conversation', () => {
    const c = buildQueue([conv('c1')], [report('r1', 'c1', { createdAt: '2026-10-26T00:00:00Z' }), report('r2', 'c1', { createdAt: '2026-10-24T00:00:00Z' })])[0]!
    expect(oldestReport(c)!.id).toBe('r2')
    expect(oldestReport({ reports: [] })).toBeNull()
  })

  it('compte les signalements, les conversations et nomme le plus ancien', () => {
    const items = buildQueue(
      [conv('c1'), conv('c2', { participantA: 'Fatou', participantB: 'Ibrahim' }), conv('c3')],
      [report('r1', 'c1', { createdAt: '2026-10-26T12:00:00Z' }), report('r2', 'c1', { createdAt: '2026-10-26T13:00:00Z' }), report('r3', 'c2', { createdAt: '2026-10-23T12:00:00Z', reporterName: 'Sara' })],
    )
    const s = summarizeQueue(items, NOW)
    expect(s).toMatchObject({ reportedConversations: 2, openReports: 3 })
    expect(s.oldest).toEqual({ label: '4 j', reporter: 'Sara', participants: 'Fatou ↔ Ibrahim' })
  })

  it('sans signalement : rien d’ancien', () => {
    expect(summarizeQueue(buildQueue([conv('c1')], []), NOW)).toEqual({ reportedConversations: 0, openReports: 0, oldest: null })
  })

  it('un signalement à la date illisible ne fait pas le plus ancien', () => {
    const s = summarizeQueue(buildQueue([conv('c1')], [report('r1', 'c1', { createdAt: 'illisible' })]), NOW)
    expect(s.openReports).toBe(1)
    expect(s.oldest).toBeNull()
  })
})

describe('participantsLabel', () => {
  it('« A ↔ B », « — » pour un inconnu, libellé du signalement hors page', () => {
    expect(participantsLabel({ participantA: 'Aïcha', participantB: 'Moussa', partial: false })).toBe('Aïcha ↔ Moussa')
    expect(participantsLabel({ participantA: null, participantB: 'Moussa', partial: false })).toBe('— ↔ Moussa')
    expect(participantsLabel({ participantA: 'Awa ↔ Cheikh', participantB: null, partial: true })).toBe('Awa ↔ Cheikh')
    expect(participantsLabel({ participantA: null, participantB: null, partial: true })).toBe('Conversation signalée')
  })
})

describe('messages', () => {
  it('supprimé : drapeau ou date', () => {
    expect(isMessageDeleted({ deleted: true })).toBe(true)
    expect(isMessageDeleted({ deleted: false, deletedAt: '2026-10-25T15:02:00Z' })).toBe(true)
    expect(isMessageDeleted({ deleted: false })).toBe(false)
  })
  it('message de la plateforme', () => {
    expect(isSystemMessage({ type: 'SYSTEM', senderName: null })).toBe(true)
    expect(isSystemMessage({ type: 'TEXT', senderName: 'Systeme' })).toBe(true)
    expect(isSystemMessage({ type: 'TEXT', senderName: 'Awa' })).toBe(false)
  })
  it('bulle à droite pour le second participant', () => {
    const c = { participantB: 'Moussa' }
    expect(isRightSide({ senderName: 'Moussa' }, c)).toBe(true)
    expect(isRightSide({ senderName: 'Aïcha' }, c)).toBe(false)
    expect(isRightSide({ senderName: null }, c)).toBe(false)
    expect(isRightSide({ senderName: 'Moussa' }, null)).toBe(false)
  })
  it('message signalé d’après le contexte du signalement', () => {
    expect(flaggedMessageId([{ id: 'm1', flagged: false }, { id: 'm2', flagged: true }])).toBe('m2')
    expect(flaggedMessageId([{ id: 'm1', flagged: false }])).toBeNull()
    expect(flaggedMessageId(null)).toBeNull()
    expect(flaggedMessageId(undefined)).toBeNull()
  })
})
