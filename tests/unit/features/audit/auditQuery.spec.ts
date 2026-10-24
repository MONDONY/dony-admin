/** Filtres du journal d'audit dans l'URL : lecture validée, écriture des seuls filtres remplis. */
import { describe, it, expect } from 'vitest'
import { readAuditQuery, writeAuditQuery } from '@/features/audit/lib/auditQuery'

const P = '0a1b2c3d-1111-4222-8333-444455556666'

describe('readAuditQuery', () => {
  it('lien du tiroir paiement : type et identifiant d’entité', () => {
    expect(readAuditQuery({ entityType: 'PAYMENT', entityId: P }))
      .toEqual({ action: null, entityType: 'PAYMENT', entityId: P, actorId: null, from: null, to: null })
  })

  it('identifiant d’entité ou d’acteur mal formé : ignoré', () => {
    expect(readAuditQuery({ entityType: 'PAYMENT', entityId: 'pas-un-uuid' }).entityId).toBeNull()
    expect(readAuditQuery({ actorId: '../x' }).actorId).toBeNull()
  })

  it('tous les champs, valeurs invalides ignorées, tableau = première valeur', () => {
    expect(readAuditQuery({ action: 'PAYMENT_RELEASED', actorId: P, from: '2026-10-01', to: '2026-10-31', entityType: ['USER', 'X'] }))
      .toEqual({ action: 'PAYMENT_RELEASED', entityType: 'USER', entityId: null, actorId: P, from: '2026-10-01', to: '2026-10-31' })
    expect(readAuditQuery({ from: '01/10/2026', to: '2026-13', action: 'a b <script>', entityType: 'x'.repeat(200) }))
      .toEqual({ action: null, entityType: null, entityId: null, actorId: null, from: null, to: null })
    expect(readAuditQuery(undefined).entityId).toBeNull()
  })
})

describe('writeAuditQuery', () => {
  it('garde les autres paramètres, écrit les filtres remplis, retire les vides', () => {
    expect(writeAuditQuery({ keep: '1', action: 'OLD' }, { action: null, entityType: 'PAYMENT', entityId: P, actorId: '', from: null, to: null }))
      .toEqual({ keep: '1', entityType: 'PAYMENT', entityId: P })
  })

  it('valeurs saisies nettoyées (espaces) ; une saisie invalide n’est pas écrite', () => {
    expect(writeAuditQuery({}, { action: ' USER_BANNED ', entityType: null, entityId: 'abc', actorId: null, from: '2026-10-01', to: null }))
      .toEqual({ action: 'USER_BANNED', from: '2026-10-01' })
  })
})
