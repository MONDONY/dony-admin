import { describe, it, expect } from 'vitest'
import type { AdminPermission } from '@/stores/auth'
import {
  actionsForReport,
  defaultActionFor,
  isNoteRequired,
  legacyActionsFor,
  notifiesReporter,
  requiresStrongConfirmation,
  sortActions,
} from '@/features/signalements/reportActions'

const all = new Set<AdminPermission>(['USER_SUSPEND', 'CONTENT_REMOVE'])
const none = new Set<AdminPermission>()

describe('sortActions : ordre stable RESOLVE, contenu, auteur, DISMISS', () => {
  it('trie un ordre quelconque du back', () => {
    expect(sortActions(['DISMISS', 'SUSPEND_AUTHOR', 'DELETE_MESSAGE', 'WARN_AUTHOR', 'RESOLVE']))
      .toEqual(['RESOLVE', 'DELETE_MESSAGE', 'WARN_AUTHOR', 'SUSPEND_AUTHOR', 'DISMISS'])
  })

  it('avis : exclure avant supprimer, puis l’auteur', () => {
    expect(sortActions(['WARN_AUTHOR', 'DELETE_RATING', 'DISMISS', 'EXCLUDE_RATING', 'RESOLVE']))
      .toEqual(['RESOLVE', 'EXCLUDE_RATING', 'DELETE_RATING', 'WARN_AUTHOR', 'DISMISS'])
  })

  it('une action inconnue (back plus récent) passe juste avant DISMISS, sans doublon', () => {
    expect(sortActions(['DISMISS', 'FUTURE_ACTION', 'RESOLVE', 'RESOLVE']))
      .toEqual(['RESOLVE', 'FUTURE_ACTION', 'DISMISS'])
  })
})

describe('actionsForReport', () => {
  it('availableActions fourni : c’est LA source, les permissions locales sont ignorées', () => {
    // Un SUPPORT sans USER_SUSPEND : le back a déjà tranché, le front ne refiltre pas.
    const report = { targetType: 'MESSAGE' as const, availableActions: ['DISMISS', 'SUSPEND_AUTHOR', 'RESOLVE'] }
    expect(actionsForReport(report, none)).toEqual(['RESOLVE', 'SUSPEND_AUTHOR', 'DISMISS'])
  })

  it('availableActions vide (déjà traité) : aucune action', () => {
    expect(actionsForReport({ targetType: 'USER', availableActions: [] }, all)).toEqual([])
  })

  it('ancien back (pas de availableActions) : repli local enrichi de RESOLVE', () => {
    expect(actionsForReport({ targetType: 'APP' }, all)).toEqual(['RESOLVE', 'DISMISS'])
    expect(actionsForReport({ targetType: 'USER', availableActions: null }, all))
      .toEqual(['RESOLVE', 'WARN', 'SUSPEND_TARGET', 'DISMISS'])
  })
})

describe('legacyActionsFor (ancien back)', () => {
  it('USER avec toutes les permissions', () => {
    expect(legacyActionsFor('USER', all)).toEqual(['RESOLVE', 'WARN', 'SUSPEND_TARGET', 'DISMISS'])
  })
  it('USER sans USER_SUSPEND', () => {
    expect(legacyActionsFor('USER', none)).toEqual(['RESOLVE', 'WARN', 'DISMISS'])
  })
  it('ANNOUNCEMENT avec et sans CONTENT_REMOVE', () => {
    expect(legacyActionsFor('ANNOUNCEMENT', all)).toEqual(['RESOLVE', 'REMOVE_CONTENT', 'DISMISS'])
    expect(legacyActionsFor('ANNOUNCEMENT', none)).toEqual(['RESOLVE', 'DISMISS'])
  })
  it('BID, MESSAGE, RATING, APP, PACKAGE_REQUEST : traiter ou rejeter', () => {
    for (const t of ['BID', 'MESSAGE', 'RATING', 'APP', 'PACKAGE_REQUEST'] as const) {
      expect(legacyActionsFor(t, all)).toEqual(['RESOLVE', 'DISMISS'])
    }
  })
})

describe('règles du dialogue', () => {
  it('note facultative pour RESOLVE et DISMISS, obligatoire pour toute sanction', () => {
    expect(isNoteRequired('RESOLVE')).toBe(false)
    expect(isNoteRequired('DISMISS')).toBe(false)
    for (const a of ['WARN', 'SUSPEND_TARGET', 'REMOVE_CONTENT', 'DELETE_MESSAGE', 'EXCLUDE_RATING', 'DELETE_RATING', 'WARN_AUTHOR', 'SUSPEND_AUTHOR', 'FUTURE_ACTION']) {
      expect(isNoteRequired(a)).toBe(true)
    }
  })

  it('le signalant est prévenu pour toute action sauf le rejet', () => {
    expect(notifiesReporter('DISMISS')).toBe(false)
    expect(notifiesReporter('RESOLVE')).toBe(true)
    expect(notifiesReporter('DELETE_MESSAGE')).toBe(true)
  })

  it('confirmation renforcée pour SUSPEND_* et DELETE_* seulement', () => {
    for (const a of ['SUSPEND_TARGET', 'SUSPEND_AUTHOR', 'DELETE_MESSAGE', 'DELETE_RATING']) {
      expect(requiresStrongConfirmation(a)).toBe(true)
    }
    for (const a of ['RESOLVE', 'DISMISS', 'WARN', 'WARN_AUTHOR', 'EXCLUDE_RATING', 'REMOVE_CONTENT']) {
      expect(requiresStrongConfirmation(a)).toBe(false)
    }
  })

  it('action par défaut : RESOLVE, sinon DISMISS, jamais une sanction choisie d’office', () => {
    expect(defaultActionFor(['RESOLVE', 'DELETE_MESSAGE', 'DISMISS'])).toBe('RESOLVE')
    expect(defaultActionFor(['DELETE_MESSAGE', 'DISMISS'])).toBe('DISMISS')
    expect(defaultActionFor(['WARN_AUTHOR'])).toBeNull()
    expect(defaultActionFor([])).toBeNull()
  })
})
