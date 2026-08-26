import { describe, it, expect } from 'vitest'
import { alertSeverityMeta } from '@/features/alerts/components/alertSeverity'

describe('alertSeverityMeta', () => {
  it('retourne tone info pour INFO', () => {
    const r = alertSeverityMeta('INFO')
    expect(r.label).toBe('Info')
    expect(r.tone).toBe('info')
  })

  it('retourne tone warning pour WARN', () => {
    const r = alertSeverityMeta('WARN')
    expect(r.label).toBe('Attention')
    expect(r.tone).toBe('warning')
  })

  it('retourne tone danger pour CRITICAL', () => {
    const r = alertSeverityMeta('CRITICAL')
    expect(r.label).toBe('Critique')
    expect(r.tone).toBe('danger')
  })
})
