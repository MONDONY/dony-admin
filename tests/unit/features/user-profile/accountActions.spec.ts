import { describe, it, expect } from 'vitest'
import { seedAuth } from '~/tests/helpers/auth'
import { availableActions, groupActions } from '@/features/user-profile/lib/accountActions'
import type { AdminRole } from '@/stores/auth'

const base = { status: 'ACTIVE', publishingSuspended: false, messagingMutedUntil: null } as never
const ids = (user: object, role: AdminRole, overrides: Record<string, boolean> = {}) => {
  const auth = seedAuth(role, overrides)
  return availableActions({ ...(base as object), ...user } as never, p => auth.can(p)).map(a => a.id)
}

describe('availableActions', () => {
  it('ADMIN, compte actif : notifier, écrire, suspendre, bannir, suspendre la publication, couper la messagerie', () => {
    expect(ids({}, 'ADMIN')).toEqual(['notify', 'writeSupport', 'suspend', 'ban', 'suspendPublishing', 'mute'])
  })

  it('SUPPORT : uniquement écrire à l’utilisateur', () => {
    expect(ids({}, 'SUPPORT')).toEqual(['writeSupport'])
    expect(ids({ messagingMutedUntil: '2026-11-01T10:00:00Z', publishingSuspended: true }, 'SUPPORT')).toEqual(['writeSupport'])
  })

  it('compte suspendu : réactiver, jamais suspendre ni bannir', () => {
    const r = ids({ status: 'SUSPENDED' }, 'ADMIN')
    expect(r).toContain('unsuspend')
    expect(r).not.toContain('suspend')
    expect(r).not.toContain('ban')
    expect(r).not.toContain('unban')
  })

  it('compte banni : lever le bannissement exige USER_SUSPEND ET USER_BAN', () => {
    expect(ids({ status: 'BANNED' }, 'ADMIN')).toContain('unban')
    expect(ids({ status: 'BANNED' }, 'ADMIN', { USER_BAN: false })).not.toContain('unban')
    expect(ids({ status: 'BANNED' }, 'ADMIN', { USER_SUSPEND: false })).not.toContain('unban')
  })

  it('suppression demandée : pas d’écriture au support', () => {
    const r = ids({ status: 'PENDING_DELETION' }, 'ADMIN')
    expect(r).not.toContain('writeSupport')
    expect(r).not.toContain('suspend')
  })

  it('publication suspendue : lever la suspension, plus suspendre', () => {
    const r = ids({ publishingSuspended: true }, 'ADMIN')
    expect(r).toContain('liftPublishing')
    expect(r).not.toContain('suspendPublishing')
  })

  it('messagerie coupée : rétablir en plus de couper ; absent sans USER_MESSAGE_MUTE', () => {
    expect(ids({ messagingMutedUntil: '2026-11-01T10:00:00Z' }, 'ADMIN')).toEqual(expect.arrayContaining(['mute', 'unmute']))
    expect(ids({ messagingMutedUntil: '2026-11-01T10:00:00Z' }, 'ADMIN', { USER_MESSAGE_MUTE: false })).not.toContain('unmute')
    expect(ids({ messagingMutedUntil: undefined }, 'ADMIN')).not.toContain('unmute')
  })

  it('chaque action a libellé, aide, et le bon drapeau de motif', () => {
    const auth = seedAuth('ADMIN')
    const all = availableActions({ ...(base as object), status: 'ACTIVE' } as never, p => auth.can(p))
    for (const a of all) { expect(a.label).toBeTruthy(); expect(a.hint).toBeTruthy() }
    const by = Object.fromEntries(all.map(a => [a.id, a]))
    expect(by.suspend).toMatchObject({ requiresReason: true, danger: true, group: 'Compte' })
    expect(by.ban).toMatchObject({ requiresReason: true, danger: true })
    expect(by.mute).toMatchObject({ requiresReason: true, group: 'Activité' })
    expect(by.notify).toMatchObject({ requiresReason: false, danger: false, group: 'Communiquer' })
  })
})

describe('groupActions', () => {
  it('ordonne les groupes et n’émet aucun groupe vide', () => {
    const auth = seedAuth('SUPPORT')
    const groups = groupActions(availableActions(base, p => auth.can(p)))
    expect(groups.map(g => g.group)).toEqual(['Communiquer'])
    expect(groupActions([])).toEqual([])
  })

  it('ADMIN : trois groupes dans l’ordre Communiquer, Compte, Activité', () => {
    const auth = seedAuth('ADMIN')
    expect(groupActions(availableActions(base, p => auth.can(p))).map(g => g.group)).toEqual(['Communiquer', 'Compte', 'Activité'])
  })
})
