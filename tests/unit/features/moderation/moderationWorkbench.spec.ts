import { describe, it, expect } from 'vitest'
import {
  buildQueue, conversationTimeline, defaultConversationId, filterQueue, flaggedMessageId, flagsSupported, groupQueue, isMessageDeleted,
  isReported, isRightSide, isSystemMessage, mergeConversations, neighbourConversationId, oldestReport, participantsLabel, queueOrder,
  reportAge, scopeCounts, summarizeQueue, type QueueConversation,
} from '@/features/moderation/lib/moderationWorkbench'
import { conversation as conv, internalId, NOW, participantId, report } from './moderationFixtures'

const H = 3_600_000

describe('buildQueue', () => {
  it('rattache à chaque conversation ses signalements ouverts, par identifiant INTERNE', () => {
    const q = buildQueue([conv('c1'), conv('c2')], [report('r1', 'c1'), report('r2', 'c1', { reason: 'HARASSMENT' })])
    expect(q.find((c) => c.id === 'c1')!.reports.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(q.find((c) => c.id === 'c2')!.reports).toEqual([])
    expect(q.every((c) => !c.partial)).toBe(true)
  })

  it('un signalement qui porte l’identifiant Firestore ne rapproche rien (ce n’est pas son identifiant)', () => {
    const q = buildQueue([conv('c1')], [report('r1', 'c1', { targetId: 'c1' })])
    expect(q[0]!.reports).toEqual([])
  })

  it('ignore les signalements qui ne sont ni ouverts ni sur un message', () => {
    const q = buildQueue([conv('c1')], [
      report('r1', 'c1', { status: 'RESOLVED' }),
      report('r2', 'c1', { targetType: 'USER' }),
      report('r3', 'c1', { targetId: '' }),
    ])
    expect(q[0]!.reports).toEqual([])
    expect(q).toHaveLength(1)
  })

  it('un signalement dont la conversation n’est pas chargée est ignoré, jamais ajouté sans identifiant Firestore', () => {
    const q = buildQueue([conv('c1')], [report('r1', 'old', { targetLabel: 'Awa ↔ Cheikh' })])
    expect(q.map((c) => c.id)).toEqual(['c1'])
  })

  it('le compte du serveur fait foi quand le détail des signalements manque (sans REPORT_VIEW)', () => {
    const q = buildQueue([conv('c1', { openReportCount: 3 }), conv('c2')], [])
    expect(q[0]).toMatchObject({ openReportCount: 3, reports: [] })
    expect(isReported(q[0]!)).toBe(true)
    expect(isReported(q[1]!)).toBe(false)
  })

  it('le détail ne descend jamais le compte du serveur sous ce qu’il liste', () => {
    const q = buildQueue([conv('c1', { openReportCount: 0 })], [report('r1', 'c1'), report('r2', 'c1')])
    expect(q[0]!.openReportCount).toBe(2)
  })

  it('un compte absent ou illisible vaut zéro', () => {
    const q = buildQueue([conv('c1', { openReportCount: undefined }), conv('c2', { openReportCount: 'x' as unknown as number })], [])
    expect(q.map((c) => c.openReportCount)).toEqual([0, 0])
  })

  it('reprend les champs de la conversation : comptes, aperçu nettoyé, fermeture', () => {
    const q = buildQueue([conv('c1', { closedAt: '2026-10-25T09:00:00', lastMessagePreview: '  Bonjour  ' })], [])
    expect(q[0]).toMatchObject({
      id: 'c1', conversationId: internalId('c1'), participantAId: participantId('a', 'c1'), participantBId: participantId('b', 'c1'), participantA: 'Aïcha',
      lastMessagePreview: 'Bonjour', closedAt: '2026-10-25T09:00:00', partial: false,
    })
  })

  it('ancien back : pas d’identifiant interne, aucun rapprochement possible, champs absents tolérés', () => {
    const old = conv('c1', { conversationId: undefined, participantAId: undefined, participantBId: undefined, openReportCount: undefined, lastMessagePreview: undefined })
    const q = buildQueue([old], [report('r1', 'c1')])
    expect(q[0]).toMatchObject({ conversationId: null, participantAId: null, participantBId: null, lastMessagePreview: null, openReportCount: 0, reports: [] })
  })
})

describe('mergeConversations et flagsSupported', () => {
  it('réunit les pages sans doublon, la première d’abord', () => {
    const merged = mergeConversations([conv('c1'), conv('c2')], [conv('c2'), conv('c3')], [])
    expect(merged.map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('le nouveau back rend conversationId ; l’ancien non ; une liste vide ne dit rien', () => {
    expect(flagsSupported([conv('c1')])).toBe(true)
    expect(flagsSupported([conv('c1', { conversationId: undefined })])).toBe(false)
    expect(flagsSupported([conv('c1', { conversationId: undefined }), conv('c2')])).toBe(true)
    expect(flagsSupported([])).toBe(true)
  })
})

describe('filtre et groupes', () => {
  const items = buildQueue(
    [conv('c1', { openReportCount: 1 }), conv('c2', { participantA: 'Mariam', participantB: 'Ousmane', lastMessageAt: new Date(NOW - H).toISOString() }),
      conv('c3', { participantA: 'Fatou', participantB: 'Ibrahim', lastMessageAt: new Date(NOW - 5 * H).toISOString(), openReportCount: 1 })],
    [report('r1', 'c3', { createdAt: new Date(NOW - 10 * H).toISOString() }), report('r2', 'c1', { createdAt: new Date(NOW - 100 * H).toISOString() })],
  )

  it('signalées d’abord, le plus ancien signalement en tête, puis l’activité récente', () => {
    const groups = groupQueue(items)
    expect(groups.map((g) => g.key)).toEqual(['REPORTED', 'RECENT'])
    expect(groups[0]!.items.map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(groups[1]!.items.map((c) => c.id)).toEqual(['c2'])
    expect(queueOrder(groups).map((c) => c.id)).toEqual(['c1', 'c3', 'c2'])
  })

  it('signalées sans détail de signalement : départagées par l’activité la plus récente', () => {
    const bare = buildQueue([conv('a', { openReportCount: 1, lastMessageAt: new Date(NOW - 9 * H).toISOString() }), conv('b', { openReportCount: 2, lastMessageAt: new Date(NOW - 2 * H).toISOString() })], [])
    expect(groupQueue(bare)[0]!.items.map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('un groupe vide disparaît', () => {
    expect(groupQueue(items.filter((c) => !isReported(c))).map((g) => g.key)).toEqual(['RECENT'])
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
      [report('r1', 'c1', { createdAt: new Date(NOW - 20 * H).toISOString() }), report('r2', 'c1', { createdAt: new Date(NOW - 19 * H).toISOString() }),
        report('r3', 'c2', { createdAt: new Date(NOW - 100 * H).toISOString(), reporterName: 'Sara' })],
    )
    const s = summarizeQueue(items, NOW)
    expect(s).toMatchObject({ reportedConversations: 2, openReports: 3 })
    expect(s.oldest).toEqual({ label: '4 j', reporter: 'Sara', participants: 'Fatou ↔ Ibrahim' })
  })

  it('sans détail de signalement (sans REPORT_VIEW) : le compte du serveur, mais pas d’ancienneté', () => {
    const s = summarizeQueue(buildQueue([conv('c1', { openReportCount: 2 }), conv('c2', { openReportCount: 1 })], []), NOW)
    expect(s).toEqual({ reportedConversations: 2, openReports: 3, oldest: null })
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

describe('conversationTimeline', () => {
  it('du plus ancien au plus récent, avec libellés, auteur et motif', () => {
    const items = conversationTimeline([
      { action: 'CONVERSATION_NOTE_ADDED', at: '2026-10-26T09:00:00', actorEmail: 'sira@yadony.com' },
      { action: 'MESSAGE_ADMIN_RESTORED', at: '2026-10-25T16:00:00', actorEmail: 'sara@yadony.com', note: 'suppression abusive' },
      { action: 'MESSAGE_ADMIN_DELETED', at: '2026-10-25T15:02:00', actorEmail: 'sara@yadony.com', note: 'propos haineux' },
    ])
    expect(items.map((i) => i.label)).toEqual(['Message supprimé', 'Message rétabli', 'Note ajoutée'])
    expect(items[0]).toMatchObject({ by: 'par sara@yadony.com', note: 'propos haineux', at: '2026-10-25T15:02:00Z' })
    expect(new Set(items.map((i) => i.key)).size).toBe(3)
  })

  it('un code inconnu garde son code ; auteur et date absents tolérés', () => {
    expect(conversationTimeline([{ action: 'AUTRE_CODE' }])[0]).toEqual({ key: 'AUTRE_CODE-0', label: 'AUTRE_CODE', at: null, by: null, note: null })
  })

  it('pas d’historique : liste vide', () => {
    expect(conversationTimeline(null)).toEqual([])
    expect(conversationTimeline(undefined)).toEqual([])
    expect(conversationTimeline([])).toEqual([])
  })
})
