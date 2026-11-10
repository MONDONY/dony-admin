import { describe, it, expect } from 'vitest'
import {
  isSystemReport,
  reportedByText,
  reporterLabel,
  SYSTEM_REPORTER_LABEL,
} from '@/features/signalements/reportDisplay'

describe('signalant d’un signalement (source USER / SYSTEM)', () => {
  it('libellé du système : « Détection automatique »', () => {
    expect(SYSTEM_REPORTER_LABEL).toBe('Détection automatique')
  })

  describe('isSystemReport', () => {
    it('SYSTEM : signalement de la détection automatique', () => {
      expect(isSystemReport({ source: 'SYSTEM' })).toBe(true)
    })

    it('USER, source absente (ancien back) ou nulle : un utilisateur', () => {
      expect(isSystemReport({ source: 'USER' })).toBe(false)
      expect(isSystemReport({})).toBe(false)
      expect(isSystemReport({ source: null })).toBe(false)
    })
  })

  describe('reporterLabel', () => {
    it('SYSTEM : « Détection automatique », même si un nom traînait', () => {
      expect(reporterLabel({ source: 'SYSTEM', reporterName: null })).toBe('Détection automatique')
      expect(reporterLabel({ source: 'SYSTEM', reporterName: 'Awa' })).toBe('Détection automatique')
    })

    it('USER : le nom, sinon « Inconnu » ou le repli demandé', () => {
      expect(reporterLabel({ source: 'USER', reporterName: 'Awa' })).toBe('Awa')
      expect(reporterLabel({ source: 'USER', reporterName: null })).toBe('Inconnu')
      expect(reporterLabel({ source: 'USER', reporterName: null }, 'Signalant inconnu')).toBe('Signalant inconnu')
    })

    it('source absente (ancien back) : comportement d’avant', () => {
      expect(reporterLabel({ reporterName: 'Awa' })).toBe('Awa')
      expect(reporterLabel({ reporterName: null })).toBe('Inconnu')
      expect(reporterLabel({})).toBe('Inconnu')
    })
  })

  describe('reportedByText', () => {
    it('SYSTEM : « Détection automatique » seul, sans « Signalé par » ni « Inconnu »', () => {
      const text = reportedByText({ source: 'SYSTEM', reporterName: null })
      expect(text).toBe('Détection automatique')
      expect(text).not.toContain('Inconnu')
    })

    it('USER : « Signalé par … », repli sur « Inconnu » ou le libellé demandé', () => {
      expect(reportedByText({ source: 'USER', reporterName: 'Awa' })).toBe('Signalé par Awa')
      expect(reportedByText({ source: 'USER', reporterName: null })).toBe('Signalé par Inconnu')
      expect(reportedByText({ source: 'USER', reporterName: null }, 'un utilisateur inconnu')).toBe('Signalé par un utilisateur inconnu')
    })

    it('source absente (ancien back) : « Signalé par … » comme avant', () => {
      expect(reportedByText({ reporterName: 'Awa' })).toBe('Signalé par Awa')
      expect(reportedByText({ reporterName: null })).toBe('Signalé par Inconnu')
    })
  })
})
