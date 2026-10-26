import { describe, it, expect } from 'vitest'
import {
  defaultReportId,
  isOpenReport,
  neighbourReportId,
  nextReportId,
  reportAge,
} from '@/features/signalements/reportWorkbench'
import type { AdminReport } from '@/features/signalements/types/index'

const NOW = new Date('2026-10-26T12:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const MIN = 60_000
const H = 60 * MIN
const D = 24 * H

function report(id: string, extra: Partial<AdminReport> = {}): AdminReport {
  return {
    id, targetType: 'USER', targetId: 'u1', targetLabel: 'Cible', reason: 'HARASSMENT', description: null,
    reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null, resolvedAt: null,
    createdAt: '2026-10-26T10:00:00Z', photoUrls: [], ...extra,
  }
}

describe('reportAge : ancienneté lisible et teinte d’urgence', () => {
  it('minutes, heures, jours', () => {
    expect(reportAge(ago(5 * MIN), NOW).label).toBe('il y a 5 min')
    expect(reportAge(ago(2 * H + 10 * MIN), NOW).label).toBe('il y a 2 h')
    expect(reportAge(ago(3 * D + H), NOW).label).toBe('il y a 3 j')
  })

  it('jamais « il y a 0 min » : au moins une minute', () => {
    expect(reportAge(ago(5_000), NOW).label).toBe('il y a 1 min')
  })

  it('une date future (horloge décalée) ne donne pas de durée négative', () => {
    expect(reportAge(ago(-10 * MIN), NOW)).toEqual({ label: 'il y a 1 min', tone: 'neutral' })
  })

  it('neutre sous 24 h, alerte dès 24 h, en retard dès 72 h', () => {
    expect(reportAge(ago(23 * H), NOW).tone).toBe('neutral')
    expect(reportAge(ago(24 * H), NOW).tone).toBe('warning')
    expect(reportAge(ago(71 * H), NOW).tone).toBe('warning')
    expect(reportAge(ago(72 * H), NOW).tone).toBe('danger')
  })
})

describe('isOpenReport / defaultReportId', () => {
  it('ouvert et non supprimé uniquement', () => {
    expect(isOpenReport(report('a'))).toBe(true)
    expect(isOpenReport(report('a', { status: 'RESOLVED' }))).toBe(false)
    expect(isOpenReport(report('a', { deletedAt: '2026-10-01T00:00:00Z' }))).toBe(false)
  })

  it('sélection par défaut : le premier à traiter, sinon le premier', () => {
    expect(defaultReportId([report('a', { status: 'RESOLVED' }), report('b'), report('c')])).toBe('b')
    expect(defaultReportId([report('a', { status: 'RESOLVED' }), report('b', { status: 'DISMISSED' })])).toBe('a')
    expect(defaultReportId([])).toBeNull()
  })
})

describe('nextReportId : où aller après un traitement', () => {
  const list = [report('a'), report('b'), report('c'), report('d', { status: 'RESOLVED' })]

  it('descend vers le prochain ouvert', () => {
    expect(nextReportId(list, 'a')).toBe('b')
  })

  it('saute les signalements déjà traités', () => {
    const l = [report('a'), report('b', { status: 'RESOLVED' }), report('c')]
    expect(nextReportId(l, 'a')).toBe('c')
  })

  it('en bas de liste, remonte vers le plus proche ouvert', () => {
    expect(nextReportId(list, 'c')).toBe('b')
  })

  it('rend null quand plus rien n’est à traiter', () => {
    const l = [report('a', { status: 'RESOLVED' }), report('b', { status: 'RESOLVED' })]
    expect(nextReportId(l, 'a')).toBeNull()
  })

  it('identifiant inconnu : repart du début', () => {
    expect(nextReportId(list, 'zzz')).toBe('a')
  })

  it('liste vide', () => {
    expect(nextReportId([], 'a')).toBeNull()
  })
})

describe('neighbourReportId : J / K', () => {
  const list = [report('a'), report('b'), report('c')]

  it('avance et recule d’un cran', () => {
    expect(neighbourReportId(list, 'b', 1)).toBe('c')
    expect(neighbourReportId(list, 'b', -1)).toBe('a')
  })

  it('reste aux extrémités, sans boucler', () => {
    expect(neighbourReportId(list, 'c', 1)).toBe('c')
    expect(neighbourReportId(list, 'a', -1)).toBe('a')
  })

  it('rien de sélectionné : prend le premier', () => {
    expect(neighbourReportId(list, null, 1)).toBe('a')
  })

  it('liste vide', () => {
    expect(neighbourReportId([], null, 1)).toBeNull()
  })
})
