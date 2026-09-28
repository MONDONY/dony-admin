import { describe, it, expect } from 'vitest'
import {
  badgeLabel, formatFullDate, formatRelativeFr, formatTabTitle, isSafeInternalLink, isUnread,
} from '@/features/notifications/lib/format'
import { navBadges } from '@/features/notifications/lib/navBadges'
import { notificationIcon, severityClasses } from '@/features/notifications/lib/notificationMeta'
import { Bell, Flag, IdCard } from 'lucide-vue-next'

const NOW = new Date('2026-09-28T12:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('badgeLabel', () => {
  it('affiche le nombre tel quel jusqu’à 99', () => {
    expect(badgeLabel(1)).toBe('1')
    expect(badgeLabel(99)).toBe('99')
  })
  it('affiche « 99+ » au-delà de 99 ou si le back a plafonné le compte', () => {
    expect(badgeLabel(100)).toBe('99+')
    expect(badgeLabel(12, true)).toBe('99+')
  })
})

describe('formatRelativeFr', () => {
  it('« à l’instant » sous la minute', () => {
    expect(formatRelativeFr(ago(20_000), NOW)).toBe('à l’instant')
  })
  it('« il y a 5 min »', () => {
    expect(formatRelativeFr(ago(5 * 60_000), NOW)).toMatch(/^il y a 5\smin$/)
  })
  it('en heures puis en jours', () => {
    expect(formatRelativeFr(ago(3 * 3_600_000), NOW)).toMatch(/^il y a 3\sh$/)
    expect(formatRelativeFr(ago(26 * 3_600_000), NOW)).toBe('hier')
    expect(formatRelativeFr(ago(3 * 86_400_000), NOW)).toMatch(/^il y a 3\sj$/)
  })
  it('date courte au-delà d’une semaine', () => {
    expect(formatRelativeFr('2026-09-01T10:00:00Z', NOW)).toMatch(/^le 1\ssept\.?$/)
  })
  it('une date à venir (horloge décalée) reste « à l’instant »', () => {
    expect(formatRelativeFr(new Date(NOW + 60_000).toISOString(), NOW)).toBe('à l’instant')
  })
  it('date invalide : chaîne vide', () => {
    expect(formatRelativeFr('pas une date', NOW)).toBe('')
    expect(formatFullDate('pas une date')).toBe('')
  })
})

describe('formatFullDate', () => {
  it('date complète en français, sans tiret cadratin', () => {
    const s = formatFullDate('2026-09-28T10:00:00Z')
    expect(s).toMatch(/2026/)
    expect(s).toMatch(/septembre/)
    expect(s).not.toContain('—')
  })
})

describe('formatTabTitle', () => {
  it('préfixe « (N) » quand il y a des non lus', () => {
    expect(formatTabTitle('Yadony ADMIN', 3)).toBe('(3) Yadony ADMIN')
    expect(formatTabTitle('Yadony ADMIN', 150)).toBe('(99+) Yadony ADMIN')
    expect(formatTabTitle('Yadony ADMIN', 4, true)).toBe('(99+) Yadony ADMIN')
  })
  it('titre inchangé à 0', () => {
    expect(formatTabTitle('Yadony ADMIN', 0)).toBe('Yadony ADMIN')
  })
})

describe('isSafeInternalLink', () => {
  it('accepte une route interne de l’admin', () => {
    expect(isSafeInternalLink('/signalements')).toBe(true)
    expect(isSafeInternalLink('/kyc?status=IN_REVIEW&open=u1')).toBe(true)
  })
  it('refuse un lien externe, protocole-relatif ou vide', () => {
    expect(isSafeInternalLink('https://evil.example')).toBe(false)
    expect(isSafeInternalLink('//evil.example')).toBe(false)
    expect(isSafeInternalLink('/\\evil.example')).toBe(false)
    expect(isSafeInternalLink('javascript:alert(1)')).toBe(false)
    expect(isSafeInternalLink('')).toBe(false)
    expect(isSafeInternalLink(null)).toBe(false)
  })
})

describe('isUnread', () => {
  it('non lu si createdAt > lastSeenAt, ou si rien n’a jamais été vu', () => {
    expect(isUnread('2026-09-28T10:00:00Z', '2026-09-28T09:00:00Z')).toBe(true)
    expect(isUnread('2026-09-28T08:00:00Z', '2026-09-28T09:00:00Z')).toBe(false)
    expect(isUnread('2026-09-28T09:00:00Z', '2026-09-28T09:00:00Z')).toBe(false)
    expect(isUnread('2026-09-28T08:00:00Z', null)).toBe(true)
  })
})

describe('navBadges', () => {
  it('une entrée par compteur présent et positif', () => {
    const b = navBadges({ reports: 2, support: 0, kyc: 150, alerts: 1, gdpr: 3, incidents: 4 })
    expect(b['/signalements']).toEqual({ count: 2, label: '2', tone: 'neutral' })
    expect(b['/support']).toBeUndefined()
    expect(b['/kyc']).toEqual({ count: 150, label: '99+', tone: 'neutral' })
    expect(b['/alertes']).toEqual({ count: 1, label: '1', tone: 'danger' })
    expect(b['/users/rgpd']?.label).toBe('3')
    expect(b['/incidents']?.label).toBe('4')
  })
  it('Transactions additionne versements retenus et remboursements wallet, rouge si des versements sont retenus', () => {
    expect(navBadges({ heldPayouts: 1, walletRefunds: 2 })['/transactions']).toEqual({ count: 3, label: '3', tone: 'danger' })
    expect(navBadges({ walletRefunds: 2 })['/transactions']).toEqual({ count: 2, label: '2', tone: 'neutral' })
    expect(navBadges({ heldPayouts: 0, walletRefunds: 0 })['/transactions']).toBeUndefined()
  })
  it('clé absente = pas de badge', () => {
    expect(navBadges({})).toEqual({})
  })
})

describe('notificationMeta', () => {
  it('une icône par type, générique pour un type inconnu', () => {
    expect(notificationIcon('REPORT_CREATED')).toBe(Flag)
    expect(notificationIcon('KYC_IN_REVIEW')).toBe(IdCard)
    expect(notificationIcon('TYPE_FUTUR')).toBe(Bell)
  })
  it('une couleur par sévérité, INFO par défaut', () => {
    expect(severityClasses('CRITICAL')).toContain('danger')
    expect(severityClasses('WARNING')).toContain('warning')
    expect(severityClasses('INFO')).toContain('primary')
    expect(severityClasses('AUTRE')).toBe(severityClasses('INFO'))
  })
})

describe('dates ISO UTC du back (millisecondes ou microsecondes)', () => {
  it('« il y a 5 min » avec millisecondes et microsecondes', () => {
    expect(formatRelativeFr('2026-09-28T11:54:30.123Z', NOW)).toMatch(/^il y a 5\smin$/)
    expect(formatRelativeFr('2026-09-28T11:54:30.123456Z', NOW)).toMatch(/^il y a 5\smin$/)
    expect(formatFullDate('2026-09-28T11:55:00.123456Z')).toMatch(/septembre 2026/)
  })
  it('isUnread compare jusqu’à la microseconde', () => {
    expect(isUnread('2026-09-28T10:00:00.000002Z', '2026-09-28T10:00:00.000001Z')).toBe(true)
    expect(isUnread('2026-09-28T10:00:00.000001Z', '2026-09-28T10:00:00.000001Z')).toBe(false)
    expect(isUnread('2026-09-28T10:00:00.5Z', '2026-09-28T10:00:00Z')).toBe(true)
    expect(isUnread('2026-09-28T10:00:00Z', '2026-09-28T10:00:00.5Z')).toBe(false)
    expect(isUnread('2026-09-28T10:00:00.123456Z', '2026-09-28T10:00:00.123Z')).toBe(true)
  })
  it('date invalide : jamais non lue', () => {
    expect(isUnread('n/a', '2026-09-28T10:00:00Z')).toBe(false)
  })
})
