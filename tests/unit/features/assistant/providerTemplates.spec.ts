import { describe, it, expect } from 'vitest'
import { PROVIDER_TEMPLATES } from '@/features/assistant/types'

describe('PROVIDER_TEMPLATES', () => {
  it.each(PROVIDER_TEMPLATES.map((t) => [t.label, t] as const))('%s : champs renseignés et adresse https', (_label, t) => {
    expect(t.label.trim()).not.toBe('')
    expect(t.name.trim()).not.toBe('')
    expect(t.baseUrl).toMatch(/^https:\/\/\S+$/)
    expect(new URL(t.baseUrl).host).not.toBe('')
    expect(typeof t.supportsJsonMode).toBe('boolean')
  })

  it('le modèle est renseigné, sauf pour OpenRouter où il se choisit dans leur catalogue', () => {
    for (const t of PROVIDER_TEMPLATES) {
      if (t.label === 'OpenRouter') expect(t.model).toBe('')
      else expect(t.model.trim()).not.toBe('')
    }
  })

  it('libellés uniques', () => {
    const labels = PROVIDER_TEMPLATES.map((t) => t.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
