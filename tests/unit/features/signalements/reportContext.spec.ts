import { describe, it, expect } from 'vitest'
import {
  accountStatusMeta,
  buildTimeline,
  memberSinceLabel,
  receivedReportsText,
  reporterHistoryText,
  reporterTrust,
  sameScreenSummary,
  targetKindTitle,
  targetStatusMeta,
} from '@/features/signalements/reportContext'

const stats = (total: number, resolved: number, dismissed: number) => ({ totalReports: total, resolvedReports: resolved, dismissedReports: dismissed })

describe('reporterTrust : un repère, pas un verdict', () => {
  it('premier signalement, puis peu d’historique, tant que les proportions ne disent rien', () => {
    expect(reporterTrust(stats(0, 0, 0)).label).toBe('Premier signalement')
    expect(reporterTrust(stats(1, 1, 0)).label).toBe('Premier signalement')
    expect(reporterTrust(stats(2, 0, 2))).toEqual({ label: 'Peu d’historique', tone: 'neutral' })
  })

  it('fiable quand la plupart des signalements ont été traités', () => {
    expect(reporterTrust(stats(4, 3, 1))).toEqual({ label: 'Fiable', tone: 'success' })
    expect(reporterTrust(stats(5, 3, 2)).label).toBe('Fiable') // 60 % pile
  })

  it('à prendre avec recul quand la plupart ont été rejetés', () => {
    expect(reporterTrust(stats(5, 1, 4))).toEqual({ label: 'À prendre avec recul', tone: 'warning' })
  })

  it('mitigé entre les deux, ou quand beaucoup sont encore ouverts', () => {
    expect(reporterTrust(stats(6, 3, 3)).label).toBe('Historique mitigé')
    expect(reporterTrust(stats(10, 2, 1)).label).toBe('Historique mitigé')
  })
})

describe('memberSinceLabel', () => {
  it('mois et année en français', () => {
    expect(memberSinceLabel('2026-03-15T09:00:00')).toBe('Membre depuis mars 2026')
  })
  it('sans date ou date illisible : rien', () => {
    expect(memberSinceLabel(null)).toBeNull()
    expect(memberSinceLabel(undefined)).toBeNull()
    expect(memberSinceLabel('pas une date')).toBeNull()
  })
})

describe('accountStatusMeta', () => {
  it('signale un compte suspendu, banni ou en cours de suppression', () => {
    expect(accountStatusMeta('SUSPENDED')).toEqual({ label: 'Compte suspendu', tone: 'danger' })
    expect(accountStatusMeta('BANNED')).toEqual({ label: 'Compte banni', tone: 'danger' })
    expect(accountStatusMeta('PENDING_DELETION')).toEqual({ label: 'Suppression demandée', tone: 'warning' })
  })
  it('rien à dire d’un compte actif ou d’un statut inconnu', () => {
    expect(accountStatusMeta('ACTIVE')).toBeNull()
    expect(accountStatusMeta(null)).toBeNull()
    expect(accountStatusMeta('AUTRE')).toBeNull()
  })
})

describe('textes de décompte', () => {
  it('signalements reçus : accords et partie ouverte', () => {
    expect(receivedReportsText({ reportsReceived: 0, openReportsReceived: 0 })).toBe('Aucun signalement reçu')
    expect(receivedReportsText({ reportsReceived: 1, openReportsReceived: 0 })).toBe('1 signalement reçu')
    expect(receivedReportsText({ reportsReceived: 3, openReportsReceived: 1 })).toBe('3 signalements reçus, dont 1 ouvert')
    expect(receivedReportsText({ reportsReceived: 4, openReportsReceived: 2 })).toBe('4 signalements reçus, dont 2 ouverts')
  })

  it('signalements du signalant : ne cite que ce qui existe', () => {
    expect(reporterHistoryText(stats(4, 3, 1))).toBe('4 signalements, 3 traités, 1 rejeté')
    expect(reporterHistoryText(stats(1, 0, 0))).toBe('1 signalement')
    expect(reporterHistoryText(stats(2, 0, 2))).toBe('2 signalements, 2 rejetés')
  })
})

describe('buildTimeline', () => {
  const report = { id: 'r1', createdAt: '2026-10-26T10:55:00Z', reporterName: 'Awa Diallo' }

  it('la réception en premier, puis les gestes du plus ancien au plus récent', () => {
    const items = buildTimeline(report, [
      { action: 'REPORT_RESTORED', at: '2026-10-28T09:00:00Z', actorEmail: 'sira@yadony.com', note: 'Supprimé par erreur' },
      { action: 'REPORT_DELETED', at: '2026-10-27T09:00:00Z', actorEmail: 'sira@yadony.com' },
      { action: 'REPORT_RESOLVED', detail: 'WARN_AUTHOR', at: '2026-10-26T11:00:00Z', actorEmail: 'admin@yadony.com', note: 'Premier avertissement' },
    ])
    expect(items.map((i) => i.label)).toEqual([
      'Signalement reçu', 'Auteur averti', 'Signalement supprimé', 'Signalement restauré',
    ])
    expect(items[0]).toMatchObject({ by: 'par Awa Diallo', note: null, at: '2026-10-26T10:55:00Z' })
    expect(items[1]).toMatchObject({ by: 'par admin@yadony.com', note: 'Premier avertissement' })
    expect(items[3].note).toBe('Supprimé par erreur')
  })

  it('résolution sans action connue, code d’audit inconnu : libellés de repli', () => {
    const items = buildTimeline(report, [
      { action: 'REPORT_AUTRE' },
      { action: 'REPORT_RESOLVED' },
    ])
    expect(items.map((i) => i.label)).toEqual(['Signalement reçu', 'Signalement traité', 'REPORT_AUTRE'])
    expect(items[1]).toMatchObject({ by: null, note: null, at: null })
  })

  it('un geste sans acteur connu ne montre pas « par »', () => {
    expect(buildTimeline(report, [{ action: 'REPORT_DELETED', actorEmail: null }])[1]!.by).toBeNull()
  })

  it('sans historique ni signalant : seulement la réception', () => {
    expect(buildTimeline({ ...report, reporterName: null }, undefined)).toEqual([
      { key: 'received-r1', label: 'Signalement reçu', at: '2026-10-26T10:55:00Z', by: null, note: null },
    ])
    expect(buildTimeline(report, null)).toHaveLength(1)
  })
})

describe('fiche de la cible', () => {
  it('titre selon le type, un type inconnu reste brut', () => {
    expect(targetKindTitle('ANNOUNCEMENT')).toBe('L’annonce')
    expect(targetKindTitle('PACKAGE_REQUEST')).toBe('La demande d’envoi')
    expect(targetKindTitle('BID')).toBe('L’offre')
    expect(targetKindTitle('AUTRE')).toBe('AUTRE')
  })

  it('statuts en français, par type de cible', () => {
    expect(targetStatusMeta('ANNOUNCEMENT', 'ACTIVE')).toEqual({ label: 'En ligne', tone: 'success' })
    expect(targetStatusMeta('PACKAGE_REQUEST', 'OPEN')).toEqual({ label: 'Ouverte', tone: 'success' })
    expect(targetStatusMeta('BID', 'PAYMENT_ESCROWED')).toEqual({ label: 'Paiement bloqué', tone: 'neutral' })
  })

  it('retrait par l’équipe, refus et absence : teinte d’alerte', () => {
    expect(targetStatusMeta('ANNOUNCEMENT', 'REMOVED_BY_ADMIN')).toEqual({ label: 'Retirée par l’équipe', tone: 'danger' })
    expect(targetStatusMeta('BID', 'REJECTED')?.tone).toBe('danger')
    expect(targetStatusMeta('BID', 'NO_SHOW')?.tone).toBe('danger')
    expect(targetStatusMeta('BID', 'PARCEL_REFUSED')?.tone).toBe('danger')
  })

  it('annulée ou expirée : neutre ; terminée ou acceptée : succès', () => {
    expect(targetStatusMeta('ANNOUNCEMENT', 'CANCELLED')?.tone).toBe('neutral')
    expect(targetStatusMeta('PACKAGE_REQUEST', 'EXPIRED')?.tone).toBe('neutral')
    expect(targetStatusMeta('BID', 'COMPLETED')?.tone).toBe('success')
    expect(targetStatusMeta('BID', 'ACCEPTED')?.tone).toBe('success')
  })

  it('statut inconnu ou type inconnu : brut et neutre ; sans statut : rien', () => {
    expect(targetStatusMeta('ANNOUNCEMENT', 'NOUVEAU')).toEqual({ label: 'NOUVEAU', tone: 'neutral' })
    expect(targetStatusMeta('AUTRE', 'ACTIVE')).toEqual({ label: 'ACTIVE', tone: 'success' })
    expect(targetStatusMeta('BID', null)).toBeNull()
    expect(targetStatusMeta('BID', '')).toBeNull()
  })
})

describe('sameScreenSummary', () => {
  it('un seul retour : rien de répété', () => {
    expect(sameScreenSummary({ total: 1, open: 1 })).toEqual({ text: '1 retour sur cet écran', repeated: false })
  })

  it('plusieurs, dont ouverts', () => {
    expect(sameScreenSummary({ total: 2, open: 1 })).toEqual({ text: '2 retours sur cet écran, dont 1 ouvert', repeated: false })
    expect(sameScreenSummary({ total: 7, open: 5 })).toEqual({ text: '7 retours sur cet écran, dont 5 ouverts', repeated: true })
  })

  it('aucun ouvert : ne le dit pas ; répété dès trois', () => {
    expect(sameScreenSummary({ total: 3, open: 0 })).toEqual({ text: '3 retours sur cet écran', repeated: true })
  })
})
