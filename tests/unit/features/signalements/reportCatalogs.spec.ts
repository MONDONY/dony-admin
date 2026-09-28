import { describe, it, expect } from 'vitest'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { legacyActionsFor } from '@/features/signalements/reportActions'
import type { AdminPermission } from '@/stores/auth'
import {
  REPORT_TARGET_TYPE_LABELS,
  reportActionConsequence,
  reportActionHelp,
  reportActionLabel,
  reportActionTakenLabel,
  reportTargetTypeLabel,
} from '@/features/signalements/reportActionLabels'

describe('reportReasonLabel', () => {
  it('maps a known catalogue value to its French label', () => {
    expect(reportReasonLabel('SCAM_ATTEMPT')).toBe('Tentative d’arnaque')
  })

  it('SCREEN_BUG (rapport du scarabée, yadony-back #317) a son libellé', () => {
    expect(reportReasonLabel('SCREEN_BUG')).toBe('Bug signalé depuis un écran')
  })

  it('falls back to the raw value for an unknown reason', () => {
    expect(reportReasonLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
  })
})

describe('types de cible', () => {
  it('PACKAGE_REQUEST est libellé « Demande d\'envoi »', () => {
    expect(REPORT_TARGET_TYPE_LABELS.PACKAGE_REQUEST).toBe('Demande d\'envoi')
    expect(reportTargetTypeLabel('PACKAGE_REQUEST')).toBe('Demande d\'envoi')
  })
  it('type inconnu affiché brut', () => {
    expect(reportTargetTypeLabel('SOMETHING')).toBe('SOMETHING')
  })
  it('PACKAGE_REQUEST : seul le rejet se fait depuis le signalement, le retrait passe par la fiche', () => {
    expect(legacyActionsFor('PACKAGE_REQUEST', new Set<AdminPermission>(['CONTENT_REMOVE']))).toEqual(['RESOLVE', 'DISMISS'])
  })
})

describe('libellés des actions', () => {
  it('libellés français des nouvelles actions', () => {
    expect(reportActionLabel('RESOLVE')).toBe('Marquer comme traité')
    expect(reportActionLabel('DELETE_MESSAGE')).toBe('Supprimer le message')
    expect(reportActionLabel('EXCLUDE_RATING')).toBe('Exclure l’avis de la note')
    expect(reportActionLabel('DELETE_RATING')).toBe('Supprimer l’avis')
    expect(reportActionLabel('WARN_AUTHOR')).toBe('Avertir l’auteur')
    expect(reportActionLabel('SUSPEND_AUTHOR')).toBe('Suspendre l’auteur')
    expect(reportActionLabel('DISMISS')).toBe('Rejeter le signalement')
  })

  it('avec targetAuthor : le nom remplace « l’auteur »', () => {
    const author = { userId: 'u1', name: 'Awa D.' }
    expect(reportActionLabel('WARN_AUTHOR', author)).toBe('Avertir Awa D.')
    expect(reportActionLabel('SUSPEND_AUTHOR', author)).toBe('Suspendre Awa D.')
    expect(reportActionLabel('RESOLVE', author)).toBe('Marquer comme traité')
  })

  it('targetAuthor null (cible APP) : aucun nom dans les libellés', () => {
    expect(reportActionLabel('WARN_AUTHOR', null)).toBe('Avertir l’auteur')
    expect(reportActionLabel('SUSPEND_AUTHOR', null)).toBe('Suspendre l’auteur')
    expect(reportActionConsequence('SUSPEND_AUTHOR', null)).toContain('Le compte de l’auteur')
  })

  it('auteur sans nom : libellé générique', () => {
    expect(reportActionLabel('WARN_AUTHOR', { userId: 'u1', name: null })).toBe('Avertir l’auteur')
    expect(reportActionLabel('SUSPEND_AUTHOR', { userId: 'u1', name: '  ' })).toBe('Suspendre l’auteur')
  })

  it('action inconnue affichée brute', () => {
    expect(reportActionLabel('FUTURE_ACTION')).toBe('FUTURE_ACTION')
    expect(reportActionTakenLabel('FUTURE_ACTION')).toBe('FUTURE_ACTION')
  })

  it('aide de « Marquer comme traité » : bug corrigé pour une cible APP', () => {
    expect(reportActionHelp('RESOLVE', 'APP')).toBe('Bug corrigé ou pris en compte')
    expect(reportActionHelp('RESOLVE', 'MESSAGE')).not.toBe('Bug corrigé ou pris en compte')
    expect(reportActionHelp('RESOLVE', 'MESSAGE')).toBeTruthy()
  })

  it('chaque action connue a une aide, une action inconnue n’en a pas', () => {
    for (const a of ['DISMISS', 'WARN', 'SUSPEND_TARGET', 'REMOVE_CONTENT', 'DELETE_MESSAGE', 'EXCLUDE_RATING', 'DELETE_RATING', 'WARN_AUTHOR', 'SUSPEND_AUTHOR']) {
      expect(reportActionHelp(a, 'USER')).toBeTruthy()
    }
    expect(reportActionHelp('FUTURE_ACTION', 'USER')).toBeNull()
  })

  it('action prise : libellé au passé', () => {
    expect(reportActionTakenLabel('RESOLVE')).toBe('Marqué comme traité')
    expect(reportActionTakenLabel('DELETE_MESSAGE')).toBe('Message supprimé')
    expect(reportActionTakenLabel('SUSPEND_AUTHOR')).toBe('Auteur suspendu')
    expect(reportActionTakenLabel('EXCLUDE_RATING')).toBe('Avis exclu de la note')
  })

  it('conséquence explicite des actions à confirmation renforcée', () => {
    expect(reportActionConsequence('SUSPEND_AUTHOR', { userId: 'u1', name: 'Awa D.' })).toContain('Awa D.')
    expect(reportActionConsequence('SUSPEND_AUTHOR')).toContain('l’auteur')
    expect(reportActionConsequence('SUSPEND_TARGET')).toContain('suspendu')
    expect(reportActionConsequence('DELETE_MESSAGE')).toContain('message')
    expect(reportActionConsequence('DELETE_RATING')).toContain('note moyenne')
    expect(reportActionConsequence('RESOLVE')).toBeNull()
  })

  it('aucun libellé ne contient de tiret cadratin', () => {
    const actions = ['RESOLVE', 'DISMISS', 'WARN', 'SUSPEND_TARGET', 'REMOVE_CONTENT', 'DELETE_MESSAGE', 'EXCLUDE_RATING', 'DELETE_RATING', 'WARN_AUTHOR', 'SUSPEND_AUTHOR']
    const texts = actions.flatMap((a) => [reportActionLabel(a), reportActionTakenLabel(a), reportActionHelp(a, 'APP') ?? '', reportActionConsequence(a) ?? ''])
    for (const t of texts) expect(t).not.toContain('—')
  })
})
