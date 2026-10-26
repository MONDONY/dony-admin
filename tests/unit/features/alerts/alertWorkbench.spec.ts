import { describe, it, expect } from 'vitest'
import {
  alertActionsFor, alertAge, alertCategories, buildAlertTimeline, isGroupAction, isNoteRequired, isSnoozed, alertNoteError, alertNoteFor, defaultAlertId, filterAlerts, followingAlertId,
  groupAlerts, neighbourAlertId, queueOrder, summarizeAlerts,
} from '@/features/alerts/lib/alertWorkbench'
import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import type { AdminAlert } from '@/features/alerts/types/index'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const HOUR = 3_600_000
const DAY = 24 * HOUR
const iso = (agoMs: number) => new Date(NOW - agoMs).toISOString()

function alert(id: string, over: Partial<AdminAlert> = {}): AdminAlert {
  return { id, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: `Paiement ${id}`, payload: {}, resolved: false, resolvedAt: null, createdAt: iso(DAY), ...over }
}

describe('alertAge', () => {
  it('moins d’une heure, en heures, en jours', () => {
    expect(alertAge({ createdAt: iso(10 * 60_000), severity: 'WARN' }, NOW).label).toBe('< 1 h')
    expect(alertAge({ createdAt: iso(5 * HOUR), severity: 'WARN' }, NOW).label).toBe('5 h')
    expect(alertAge({ createdAt: iso(3 * DAY), severity: 'WARN' }, NOW).label).toBe('3 j')
  })

  it('une critique est en retard dès 1 jour, les autres à 2 jours puis 7 jours', () => {
    expect(alertAge({ createdAt: iso(2 * HOUR), severity: 'CRITICAL' }, NOW).tone).toBe('neutral')
    expect(alertAge({ createdAt: iso(DAY), severity: 'CRITICAL' }, NOW).tone).toBe('danger')
    expect(alertAge({ createdAt: iso(DAY), severity: 'WARN' }, NOW).tone).toBe('neutral')
    expect(alertAge({ createdAt: iso(2 * DAY), severity: 'WARN' }, NOW).tone).toBe('warning')
    expect(alertAge({ createdAt: iso(7 * DAY), severity: 'INFO' }, NOW).tone).toBe('danger')
  })

  it('date illisible : pas d’âge inventé', () => {
    expect(alertAge({ createdAt: 'n’importe quoi', severity: 'WARN' }, NOW)).toEqual({ label: '< 1 h', tone: 'neutral' })
  })

  it('lit une date du back sans fuseau comme de l’UTC', () => {
    expect(alertAge({ createdAt: '2026-10-26T09:00:00', severity: 'WARN' }, NOW).label).toBe('3 h')
  })
})

describe('groupAlerts', () => {
  it('regroupe les types suffixés d’un identifiant sous un même titre, de la plus ancienne à la plus récente', () => {
    const groups = groupAlerts([
      alert('b', { type: 'ESCROW_J48_TIMEOUT', createdAt: iso(2 * DAY) }),
      alert('a', { type: 'ESCROW_J48_TIMEOUT', createdAt: iso(5 * DAY) }),
      alert('c', { type: 'RETURN_DEADLINE_EXPIRED', createdAt: iso(DAY) }),
    ])
    expect(groups).toHaveLength(2)
    const escrow = groups.find((g) => g.alerts.length === 2)!
    expect(escrow.alerts.map((a) => a.id)).toEqual(['a', 'b'])
    expect(escrow.title).toBe(alertGuide('ESCROW_J48_TIMEOUT').title)
    expect(escrow.category).toBe(alertGuide('ESCROW_J48_TIMEOUT').category)
  })

  it('groupe pris à la gravité de sa pire alerte ; critiques d’abord, puis les plus anciennes', () => {
    const groups = groupAlerts([
      alert('w1', { type: 'RETURN_DEADLINE_EXPIRED', severity: 'WARN', createdAt: iso(9 * DAY) }),
      alert('e1', { type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', createdAt: iso(2 * DAY) }),
      alert('e2', { type: 'ESCROW_J48_TIMEOUT', severity: 'CRITICAL', createdAt: iso(DAY) }),
      alert('i1', { type: 'PAYOUT_HELD_x', severity: 'INFO', createdAt: iso(20 * DAY) }),
    ])
    expect(groups.map((g) => g.severity)).toEqual(['CRITICAL', 'WARN', 'INFO'])
    expect(groups[0]!.alerts.map((a) => a.id)).toEqual(['e1', 'e2'])
  })

  it('liste vide : aucun groupe ; une date illisible passe en dernier', () => {
    expect(groupAlerts([])).toEqual([])
    const g = groupAlerts([alert('bad', { createdAt: 'x' }), alert('ok', { createdAt: iso(DAY) })])[0]!
    expect(g.alerts.map((a) => a.id)).toEqual(['ok', 'bad'])
  })

  it('queueOrder aplatit les groupes dans l’ordre d’affichage', () => {
    const groups = groupAlerts([alert('a'), alert('b', { type: 'RETURN_DEADLINE_EXPIRED', severity: 'CRITICAL' })])
    expect(queueOrder(groups).map((a) => a.id)).toEqual(['b', 'a'])
  })
})

describe('filtres', () => {
  const list = [
    alert('a', { detail: 'Paiement 12d4414f en séquestre', payload: { paymentId: 'pay-111' } }),
    alert('b', { type: 'RETURN_DEADLINE_EXPIRED', detail: 'Colis a7e32e19 non rendu', payload: { bidId: 'bid-222' } }),
  ]

  it('catégories dans l’ordre de première apparition, sans doublon', () => {
    expect(alertCategories([...list, alert('c')])).toEqual([alertGuide('ESCROW_J48_TIMEOUT').category, alertGuide('RETURN_DEADLINE_EXPIRED').category])
  })

  it('les règles de cohérence de l’argent forment une seule catégorie', () => {
    const inv = [alert('i1', { type: 'MONEY_INVARIANT_INV-06' }), alert('i2', { type: 'MONEY_INVARIANT_INV-02' })]
    expect(alertCategories(inv)).toEqual(['Cohérence de l’argent'])
    expect(filterAlerts(inv, { query: '', category: 'Cohérence de l’argent' })).toHaveLength(2)
    expect(groupAlerts(inv)[0]!.category).toBe('Cohérence de l’argent')
  })

  it('recherche dans le titre, la phrase, le code et les identifiants de la levée', () => {
    expect(filterAlerts(list, { query: 'a7e32e19', category: null }).map((a) => a.id)).toEqual(['b'])
    expect(filterAlerts(list, { query: 'PAY-111', category: null }).map((a) => a.id)).toEqual(['a'])
    expect(filterAlerts(list, { query: 'return_deadline', category: null }).map((a) => a.id)).toEqual(['b'])
    expect(filterAlerts(list, { query: 'séquestre', category: null }).map((a) => a.id)).toEqual(['a'])
    expect(filterAlerts(list, { query: '   ', category: null })).toHaveLength(2)
  })

  it('recherche sur le paymentId du back et filtre par catégorie', () => {
    const withPayment = [alert('p', { paymentId: '99999999-0000-4000-8000-000000000000' }), alert('q', { type: 'RETURN_DEADLINE_EXPIRED' })]
    expect(filterAlerts(withPayment, { query: '99999999', category: null }).map((a) => a.id)).toEqual(['p'])
    expect(filterAlerts(withPayment, { query: '', category: alertGuide('RETURN_DEADLINE_EXPIRED').category }).map((a) => a.id)).toEqual(['q'])
  })
})

describe('summarizeAlerts', () => {
  it('compte les ouvertes par sévérité, l’âge de la plus ancienne critique et les groupes « attention »', () => {
    const open = [
      alert('c1', { severity: 'CRITICAL', createdAt: iso(9 * DAY) }),
      alert('c2', { severity: 'CRITICAL', createdAt: iso(DAY) }),
      alert('w1'), alert('w2'), alert('w3', { type: 'RETURN_DEADLINE_EXPIRED' }),
      alert('i1', { severity: 'INFO' }),
    ]
    const s = summarizeAlerts(open, [], NOW)
    expect(s).toMatchObject({ critical: 2, warn: 3, info: 1, oldestCritical: '9 j', warnGroups: 2, resolvedThisWeek: 0 })
  })

  it('résolues cette semaine : au plus 7 jours, dates illisibles ignorées ; sans critique, pas d’âge', () => {
    const resolved = [
      alert('r1', { resolved: true, resolvedAt: iso(2 * DAY) }),
      alert('r2', { resolved: true, resolvedAt: iso(8 * DAY) }),
      alert('r3', { resolved: true, resolvedAt: null }),
    ]
    const s = summarizeAlerts([], resolved, NOW)
    expect(s.resolvedThisWeek).toBe(1)
    expect(s.oldestCritical).toBeNull()
  })
})

describe('note de résolution', () => {
  it('exige 3 à 500 caractères utiles', () => {
    expect(alertNoteError('  ok ')).toMatch(/3 caractères au moins/)
    expect(alertNoteError('corrigé')).toBeNull()
    expect(alertNoteError('x'.repeat(501))).toMatch(/500 caractères au plus/)
  })

  it('le faux positif est nommé dans la note envoyée à l’audit', () => {
    expect(alertNoteFor('FIXED', '  Remboursé via Stripe ')).toBe('Remboursé via Stripe')
    expect(alertNoteFor('FALSE_POSITIVE', 'Règle trop sensible')).toBe('Faux positif : Règle trop sensible')
  })
})

describe('sélection', () => {
  const order = [alert('a'), alert('b'), alert('c')]

  it('défaut : la première ; liste vide : aucune', () => {
    expect(defaultAlertId(order)).toBe('a')
    expect(defaultAlertId([])).toBeNull()
  })

  it('J / K restent sur place aux extrémités, sans sélection partent de la première', () => {
    expect(neighbourAlertId(order, 'a', 1)).toBe('b')
    expect(neighbourAlertId(order, 'c', 1)).toBe('c')
    expect(neighbourAlertId(order, 'a', -1)).toBe('a')
    expect(neighbourAlertId(order, null, 1)).toBe('a')
    expect(neighbourAlertId(order, 'zzz', -1)).toBe('a')
    expect(neighbourAlertId([], 'a', 1)).toBeNull()
  })

  it('après un geste : la suivante, à défaut la précédente, sinon rien', () => {
    expect(followingAlertId(order, 'a')).toBe('b')
    expect(followingAlertId(order, 'c')).toBe('b')
    expect(followingAlertId([alert('a')], 'a')).toBeNull()
    expect(followingAlertId(order, 'inconnue')).toBe('a')
    expect(followingAlertId([], null)).toBeNull()
  })
})

describe('report, réouverture', () => {
  it('une alerte est reportée tant que sa date est à venir, et seulement si elle est ouverte', () => {
    expect(isSnoozed({ resolved: false, snoozedUntil: iso(-HOUR) }, NOW)).toBe(true)
    expect(isSnoozed({ resolved: false, snoozedUntil: iso(HOUR) }, NOW)).toBe(false)
    expect(isSnoozed({ resolved: false, snoozedUntil: null }, NOW)).toBe(false)
    expect(isSnoozed({ resolved: false, snoozedUntil: 'illisible' }, NOW)).toBe(false)
    expect(isSnoozed({ resolved: true, snoozedUntil: iso(-HOUR) }, NOW)).toBe(false)
  })

  it('gestes selon l’état : résoudre ou reporter, rouvrir une résolue, remettre une reportée', () => {
    expect(alertActionsFor({ resolved: false, snoozedUntil: null }, NOW)).toEqual(['FIXED', 'FALSE_POSITIVE', 'SNOOZE'])
    expect(alertActionsFor({ resolved: false, snoozedUntil: iso(-HOUR) }, NOW)).toEqual(['FIXED', 'FALSE_POSITIVE', 'UNSNOOZE'])
    expect(alertActionsFor({ resolved: true, snoozedUntil: null }, NOW)).toEqual(['REOPEN'])
  })

  it('seul le retour dans la file se passe de note ; seuls résoudre se fait en groupe', () => {
    expect(isNoteRequired('UNSNOOZE')).toBe(false)
    expect(isNoteRequired('SNOOZE')).toBe(true)
    expect(alertNoteError('', 'UNSNOOZE')).toBeNull()
    expect(alertNoteError('ab', 'UNSNOOZE')).toMatch(/3 caractères au moins/)
    expect(isGroupAction('FIXED')).toBe(true)
    expect(isGroupAction('FALSE_POSITIVE')).toBe(true)
    expect(isGroupAction('SNOOZE')).toBe(false)
    expect(isGroupAction('REOPEN')).toBe(false)
  })
})

describe('buildAlertTimeline', () => {
  const a = { id: 'a1', createdAt: '2026-10-17T06:30:00' }

  it('la levée d’abord, puis les gestes du plus ancien au plus récent', () => {
    const t = buildAlertTimeline(a, [
      { action: 'ADMIN_ALERT_RESOLVED', at: '2026-10-19T10:00:00', actorEmail: 'moussa@yadony.com', note: 'Corrigé' },
      { action: 'ADMIN_ALERT_REOPENED', at: '2026-10-20T10:00:00', actorEmail: null, note: null },
    ])
    expect(t.map((i) => i.label)).toEqual(['Alerte levée', 'Alerte rouverte', 'Alerte résolue'])
    expect(t[2]).toMatchObject({ by: 'par moussa@yadony.com', note: 'Corrigé' })
    expect(t[1]!.by).toBeNull()
  })

  it('code d’audit inconnu laissé tel quel ; sans historique, la levée seule', () => {
    expect(buildAlertTimeline(a, [{ action: 'ADMIN_ALERT_SNOOZED' }, { action: 'AUTRE' }]).map((i) => i.label))
      .toEqual(['Alerte levée', 'AUTRE', 'Alerte reportée'])
    expect(buildAlertTimeline(a, null)).toHaveLength(1)
    expect(buildAlertTimeline(a, [{ action: 'ADMIN_ALERT_UNSNOOZED' }])[1]!.label).toBe('Alerte remise dans la file')
  })
})
