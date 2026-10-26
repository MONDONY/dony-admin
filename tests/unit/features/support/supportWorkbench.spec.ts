import { describe, it, expect } from 'vitest'
import {
  defaultTicketId, filterTickets, groupMessagesByDay, groupTickets, insertQuickReply, isHighPriority, messageTime,
  neighbourTicketId, priorityMeta, QUICK_REPLIES, queueOrder, scopeCounts, silenceNote, summarizeTickets,
  ticketCategories, ticketGroupOf, ticketTimeline, waitingAge,
} from '@/features/support/lib/supportWorkbench'
import { ago, message, NOW, ticket } from './supportFixtures'

describe('groupes et ancienneté', () => {
  it('un ticket est à répondre, en attente de l’utilisateur ou résolu', () => {
    expect(ticketGroupOf({ status: 'NEW' })).toBe('TO_ANSWER')
    expect(ticketGroupOf({ status: 'ASSIGNED' })).toBe('TO_ANSWER')
    expect(ticketGroupOf({ status: 'WAITING_SUPPORT' })).toBe('TO_ANSWER')
    expect(ticketGroupOf({ status: 'WAITING_USER' })).toBe('WAITING_USER')
    expect(ticketGroupOf({ status: 'RESOLVED' })).toBe('RESOLVED')
  })

  it('à répondre : neutre, puis à surveiller dès 12 h, en retard dès 2 jours', () => {
    const age = (h: number) => waitingAge({ status: 'NEW', lastMessageAt: ago(h) }, NOW)
    expect(age(0.3)).toEqual({ label: '< 1 h', tone: 'neutral' })
    expect(age(5)).toEqual({ label: '5 h', tone: 'neutral' })
    expect(age(14)).toEqual({ label: '14 h', tone: 'warning' })
    expect(age(9 * 24)).toEqual({ label: '9 j', tone: 'danger' })
  })

  it('en attente de l’utilisateur : toujours neutre ; résolu : pas d’ancienneté', () => {
    expect(waitingAge({ status: 'WAITING_USER', lastMessageAt: ago(240) }, NOW)).toEqual({ label: '10 j', tone: 'neutral' })
    expect(waitingAge({ status: 'RESOLVED', lastMessageAt: ago(1) }, NOW)).toBeNull()
  })

  it('date illisible : traitée comme neuve', () => {
    expect(waitingAge({ status: 'NEW', lastMessageAt: 'pas une date' }, NOW)).toEqual({ label: '< 1 h', tone: 'neutral' })
  })

  it('priorité : seules celles qui sortent de l’ordinaire se signalent', () => {
    expect(priorityMeta('NORMAL')).toBeNull()
    expect(priorityMeta('INCONNUE')).toBeNull()
    expect(priorityMeta('HIGH')).toEqual({ label: 'Priorité haute', tone: 'warning' })
    expect(priorityMeta('URGENT')).toEqual({ label: 'Urgent', tone: 'danger' })
    expect(priorityMeta('LOW')).toEqual({ label: 'Priorité basse', tone: 'neutral' })
    expect(isHighPriority({ priority: 'URGENT' })).toBe(true)
    expect(isHighPriority({ priority: 'NORMAL' })).toBe(false)
    expect(isHighPriority({ priority: 'INCONNUE' })).toBe(false)
  })
})

describe('file', () => {
  const old = ticket({ id: 'old', lastMessageAt: ago(200) })
  const recent = ticket({ id: 'recent', lastMessageAt: ago(5) })
  const urgent = ticket({ id: 'urgent', priority: 'URGENT', lastMessageAt: ago(3) })
  const waiting = ticket({ id: 'waiting', status: 'WAITING_USER', lastMessageAt: ago(30) })
  const waiting2 = ticket({ id: 'waiting2', status: 'WAITING_USER', lastMessageAt: ago(10) })
  const done = ticket({ id: 'done', status: 'RESOLVED', lastMessageAt: ago(60), resolvedAt: ago(48) })

  it('groupes dans l’ordre À répondre, En attente, Résolus ; groupe vide absent', () => {
    expect(groupTickets([done, waiting, old]).map((g) => g.key)).toEqual(['TO_ANSWER', 'WAITING_USER', 'RESOLVED'])
    expect(groupTickets([done]).map((g) => g.title)).toEqual(['Résolus'])
    expect(groupTickets([])).toEqual([])
  })

  it('à répondre : priorité haute d’abord, puis le plus ancien ; les autres : le plus récent', () => {
    const groups = groupTickets([recent, old, urgent, waiting, waiting2])
    expect(groups[0]!.tickets.map((t) => t.id)).toEqual(['urgent', 'old', 'recent'])
    expect(groups[1]!.tickets.map((t) => t.id)).toEqual(['waiting2', 'waiting'])
    expect(queueOrder(groups).map((t) => t.id)).toEqual(['urgent', 'old', 'recent', 'waiting2', 'waiting'])
  })

  const base = { scope: 'all' as const, query: '', category: null, highPriorityOnly: false, myId: 'me' }
  const mine = ticket({ id: 'mine', assignedAdminId: 'me', assignedAdminEmail: 'me@yadony.com' })
  const theirs = ticket({ id: 'theirs', assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com', subject: 'Remboursement', category: 'PAYMENT', userDisplayName: 'Fatou B.' })
  const all = [old, mine, theirs, done]

  it('périmètres : non assignés encore ouverts, les miens, tous', () => {
    expect(filterTickets(all, { ...base, scope: 'unassigned' }).map((t) => t.id)).toEqual(['old'])
    expect(filterTickets(all, { ...base, scope: 'mine' }).map((t) => t.id)).toEqual(['mine'])
    expect(filterTickets(all, { ...base, scope: 'mine', myId: null })).toEqual([])
    expect(filterTickets(all, base)).toHaveLength(4)
  })

  it('catégorie, priorité haute et recherche (sujet, nom, catégorie)', () => {
    expect(filterTickets(all, { ...base, category: 'PAYMENT' }).map((t) => t.id)).toEqual(['theirs'])
    expect(filterTickets([old, urgent], { ...base, highPriorityOnly: true }).map((t) => t.id)).toEqual(['urgent'])
    expect(filterTickets(all, { ...base, query: 'rembours' }).map((t) => t.id)).toEqual(['theirs'])
    expect(filterTickets(all, { ...base, query: 'fatou' }).map((t) => t.id)).toEqual(['theirs'])
    expect(filterTickets(all, { ...base, query: 'paiement' }).map((t) => t.id)).toEqual(['theirs'])
    expect(filterTickets(all, { ...base, query: '  ' })).toHaveLength(4)
    expect(filterTickets(all, { ...base, query: 'introuvable' })).toEqual([])
  })

  it('compte par onglet et catégories présentes', () => {
    expect(scopeCounts(all, 'me')).toEqual({ unassigned: 1, mine: 1, all: 4 })
    expect(scopeCounts(all, null).mine).toBe(0)
    expect(ticketCategories(all)).toEqual(['PACKAGE', 'PAYMENT'])
  })
})

describe('synthèse', () => {
  it('à répondre, non assignés, plus ancien en attente, résolus de la semaine', () => {
    const tickets = [
      ticket({ id: 'a', lastMessageAt: ago(200), subject: 'Le plus ancien' }),
      ticket({ id: 'b', lastMessageAt: ago(5) }),
      ticket({ id: 'c', status: 'WAITING_USER', assignedAdminId: 'x' }),
      ticket({ id: 'd', status: 'RESOLVED', resolvedAt: ago(24) }),
      ticket({ id: 'e', status: 'RESOLVED', resolvedAt: ago(24 * 20) }),
    ]
    expect(summarizeTickets(tickets, NOW)).toEqual({
      toAnswer: 2, unassigned: 2, oldest: { label: '8 j', subject: 'Le plus ancien' }, resolvedThisWeek: 1,
    })
  })

  it('rien à répondre : pas de plus ancien', () => {
    expect(summarizeTickets([ticket({ status: 'RESOLVED', resolvedAt: null })], NOW)).toEqual({ toAnswer: 0, unassigned: 0, oldest: null, resolvedThisWeek: 0 })
  })
})

describe('sélection', () => {
  const order = ['a', 'b', 'c'].map((id) => ticket({ id }))
  it('défaut et voisins', () => {
    expect(defaultTicketId(order)).toBe('a')
    expect(defaultTicketId([])).toBeNull()
    expect(neighbourTicketId(order, 'a', 1)).toBe('b')
    expect(neighbourTicketId(order, 'a', -1)).toBe('a')
    expect(neighbourTicketId(order, 'c', 1)).toBe('c')
    expect(neighbourTicketId(order, null, 1)).toBe('a')
    expect(neighbourTicketId([], null, 1)).toBeNull()
  })
})

describe('conversation', () => {
  it('messages par jour (heure de Paris), année ajoutée hors de l’année en cours', () => {
    const days = groupMessagesByDay([
      message('1', 'USER', '2026-10-17T13:19:00Z'),
      message('2', 'USER', '2026-10-17T13:25:00'),
      message('3', 'ADMIN', '2026-10-18T07:02:00Z'),
      message('4', 'USER', '2025-06-01T10:00:00Z'),
      message('5', 'USER', '2025-12-31T23:30:00Z'),
    ], NOW)
    // 23:30 UTC le 31 décembre est déjà le 1er janvier à Paris : l'année en cours, sans année affichée.
    expect(days.map((d) => d.label)).toEqual(['17 octobre', '18 octobre', '1 juin 2025', '1 janvier'])
    expect(days[0]!.messages.map((m) => m.id)).toEqual(['1', '2'])
  })

  it('date illisible : un jour « Date inconnue »', () => {
    expect(groupMessagesByDay([message('1', 'USER', 'oups')], NOW)).toEqual([{ key: 'inconnu', label: 'Date inconnue', messages: [message('1', 'USER', 'oups')] }])
    expect(messageTime('oups')).toBe('')
    expect(messageTime('2026-10-17T13:19:00Z')).toBe('15:19')
  })

  it('« Sans réponse depuis… » : seulement à répondre et depuis plus d’un jour', () => {
    expect(silenceNote({ status: 'NEW', lastMessageAt: ago(9 * 24) }, NOW)).toBe('Sans réponse depuis 9 j')
    expect(silenceNote({ status: 'NEW', lastMessageAt: ago(5) }, NOW)).toBeNull()
    expect(silenceNote({ status: 'WAITING_USER', lastMessageAt: ago(9 * 24) }, NOW)).toBeNull()
    expect(silenceNote({ status: 'NEW', lastMessageAt: 'oups' }, NOW)).toBeNull()
  })
})

describe('réponse et historique', () => {
  it('une réponse type s’ajoute au brouillon après une ligne vide', () => {
    expect(insertQuickReply('', 'Texte')).toBe('Texte')
    expect(insertQuickReply('Début  \n', 'Texte')).toBe('Début\n\nTexte')
    expect(QUICK_REPLIES).toHaveLength(5)
    expect(new Set(QUICK_REPLIES.map((q) => q.label)).size).toBe(5)
  })

  it('historique : ouverture, assignation (sans date), résolution', () => {
    const t = ticket({ createdAt: '2026-10-17T15:19:00', assignedAdminEmail: 'sira@yadony.com', resolvedAt: '2026-10-24T10:12:00Z' })
    expect(ticketTimeline(t).map((i) => i.label)).toEqual(['Ticket ouvert', 'Assigné à sira@yadony.com', 'Résolu'])
    expect(ticketTimeline(t)[0]!.at).toBe('2026-10-17T15:19:00Z')
    expect(ticketTimeline(ticket()).map((i) => i.label)).toEqual(['Ticket ouvert'])
  })
})
