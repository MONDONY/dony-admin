import { describe, it, expect } from 'vitest'
import { messageFor, PRESET_LANGUAGES, withLanguage } from '@/features/broadcast/composables/audiencePresets'
import type { AudiencePreset } from '@/features/broadcast/types/index'

const PRESET: AudiencePreset = {
  key: 'activation',
  label: 'À activer',
  description: 'Inscrits récents.',
  rule: { op: 'AND', children: [{ field: 'kyc', operator: 'IN', value: ['NOT_STARTED'] }] },
  messages: { fr: { title: 'Bienvenue', body: 'Corps' }, en: { title: 'Welcome', body: 'Body' } },
}

describe('audiencePresets', () => {
  it('propose le français puis l’anglais', () => {
    expect(PRESET_LANGUAGES.map((l) => l.code)).toEqual(['fr', 'en'])
  })

  it('withLanguage ajoute la condition « Langue » à la racine sans toucher à l’original', () => {
    const rule = withLanguage(PRESET.rule, 'en')
    expect(rule.op).toBe('AND')
    expect(rule.children).toHaveLength(2)
    expect(rule.children[1]).toEqual({ field: 'language', operator: 'IN', value: ['en'] })
    expect((PRESET.rule as { children: unknown[] }).children).toHaveLength(1)
  })

  it('withLanguage tolère une règle absente ou sans enfants', () => {
    expect(withLanguage(null, 'fr').children).toEqual([{ field: 'language', operator: 'IN', value: ['fr'] }])
    expect(withLanguage({ op: 'AND' }, 'fr').children).toHaveLength(1)
  })

  it('messageFor renvoie le modèle de la langue, ou null s’il manque', () => {
    expect(messageFor(PRESET, 'fr')?.title).toBe('Bienvenue')
    expect(messageFor(PRESET, 'en')?.title).toBe('Welcome')
    expect(messageFor({ ...PRESET, messages: { fr: PRESET.messages.fr! } }, 'en')).toBeNull()
  })
})
