import { describe, it, expect } from 'vitest'
import {
  applicationStatusMeta, documentTypeLabel, fmtDate, frequencyLabel, reasonValid, reviewReasonLabel, sourceLabel,
} from '@/features/gp-pro/types/index'

describe('libellés GP Pro', () => {
  it('fréquence, origine, type de document, motif de revue : connus, inconnus, absents', () => {
    expect(frequencyLabel('WEEKLY')).toBe('Chaque semaine')
    expect(frequencyLabel('DAILY')).toBe('DAILY')
    expect(frequencyLabel(null)).toBe('Non renseignée')
    expect(sourceLabel('ADMIN')).toBe('Attribution directe')
    expect(sourceLabel('API')).toBe('API')
    expect(sourceLabel(undefined)).toBe('Inconnue')
    expect(documentTypeLabel('TRAVEL_PROOF')).toBe('Billet ou carte d’embarquement')
    expect(documentTypeLabel('SCAN')).toBe('SCAN')
    expect(documentTypeLabel(null)).toBe('Document')
    expect(reviewReasonLabel('INACTIVE')).toBe('Aucun trajet depuis 8 semaines')
    expect(reviewReasonLabel('NEW')).toBe('NEW')
    expect(reviewReasonLabel(null)).toBe('Motif inconnu')
  })

  it('statut d’une demande', () => {
    expect(applicationStatusMeta('PENDING')).toEqual({ label: 'À examiner', tone: 'warning' })
    expect(applicationStatusMeta('APPROVED').tone).toBe('success')
    expect(applicationStatusMeta('ARCHIVED')).toEqual({ label: 'ARCHIVED', tone: 'neutral' })
    expect(applicationStatusMeta(null)).toEqual({ label: 'Inconnu', tone: 'neutral' })
  })

  it('motif : 10 à 1000 caractères après trim', () => {
    expect(reasonValid('   court   ')).toBe(false)
    expect(reasonValid('Motif suffisant')).toBe(true)
    expect(reasonValid('x'.repeat(1001))).toBe(false)
  })

  it('date courte, tiret sans date', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate('2026-10-17T10:00:00Z')).toContain('2026')
  })
})
