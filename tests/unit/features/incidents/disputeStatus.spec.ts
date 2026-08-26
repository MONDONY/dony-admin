import { describe, it, expect } from 'vitest'
import { disputeStatusMeta } from '@/features/incidents/components/disputeStatus'

describe('disputeStatusMeta', () => {
  it('retourne "Ouvert" avec tone warning pour OPEN', () => {
    const r = disputeStatusMeta('OPEN')
    expect(r.label).toBe('Ouvert')
    expect(r.tone).toBe('warning')
  })

  it('retourne "Résolu" avec tone success pour RESOLVED', () => {
    const r = disputeStatusMeta('RESOLVED')
    expect(r.label).toBe('Résolu')
    expect(r.tone).toBe('success')
  })
})
