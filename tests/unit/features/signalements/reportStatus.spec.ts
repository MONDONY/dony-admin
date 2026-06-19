import { describe, it, expect } from 'vitest'
import { reportStatusMeta } from '@/features/signalements/components/reportStatus'

describe('reportStatusMeta', () => {
  it('maps OPEN to warning', () => {
    expect(reportStatusMeta('OPEN')).toEqual({ label: 'Ouvert', tone: 'warning' })
  })
  it('maps RESOLVED to success', () => {
    expect(reportStatusMeta('RESOLVED')).toEqual({ label: 'Résolu', tone: 'success' })
  })
  it('maps DISMISSED to neutral', () => {
    expect(reportStatusMeta('DISMISSED')).toEqual({ label: 'Rejeté', tone: 'neutral' })
  })
})
